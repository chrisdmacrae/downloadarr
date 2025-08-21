import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ContentType, EpisodeStatus, SeasonStatus } from '../../../generated/prisma';
import { TorrentResult } from '../../discovery/interfaces/external-api.interface';
import { TorrentTitleMatcherService } from './torrent-title-matcher.service';
import { TvShowReleaseValidatorService } from './tv-show-release-validator.service';
import { TvShowMetadataService } from './tv-show-metadata.service';

export interface MissingContent {
  missingSeasons: number[];
  incompleteSeasons: Array<{
    seasonNumber: number;
    missingEpisodes: number[];
    totalEpisodes: number;
  }>;
}

export interface TorrentMatch {
  torrent: TorrentResult;
  type: 'multi-season' | 'season-pack' | 'individual-episode';
  covers: {
    seasons?: number[];
    episodes?: Array<{ season: number; episode: number }>;
  };
  priority: number; // Higher is better
  reason: string;
}

@Injectable()
export class TvShowTorrentSelectionService {
  private readonly logger = new Logger(TvShowTorrentSelectionService.name);



  constructor(
    private readonly prisma: PrismaService,
    private readonly titleMatcher: TorrentTitleMatcherService,
    private readonly releaseValidator: TvShowReleaseValidatorService,
    @Inject(forwardRef(() => TvShowMetadataService))
    private readonly metadataService: TvShowMetadataService,
  ) {}

  /**
   * Analyze what content is missing for a TV show request
   */
  async analyzeMissingContent(requestId: string): Promise<MissingContent> {
    let request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
      include: {
        tvShowSeasons: {
          include: {
            episodes: true,
          },
          orderBy: { seasonNumber: 'asc' },
        },
      },
    });

    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    // If no seasons are populated yet and we have a TMDB ID, try to populate them first
    if ((!request.tvShowSeasons || request.tvShowSeasons.length === 0) && request.tmdbId) {
      this.logger.debug(`No seasons found for ${request.title}, attempting to populate metadata first`);

      try {
        await this.metadataService.populateSeasonData(requestId);

        // Re-fetch the request with populated seasons
        request = await this.prisma.requestedTorrent.findUnique({
          where: { id: requestId },
          include: {
            tvShowSeasons: {
              include: {
                episodes: true,
              },
              orderBy: { seasonNumber: 'asc' },
            },
          },
        });

        if (request) {
          this.logger.debug(`After metadata population, ${request.title} now has ${request.tvShowSeasons?.length || 0} seasons`);
        }
      } catch (error) {
        this.logger.warn(`Failed to populate metadata for ${request.title}: ${error.message}`);
      }
    }

    const missingSeasons: number[] = [];
    const incompleteSeasons: Array<{
      seasonNumber: number;
      missingEpisodes: number[];
      totalEpisodes: number;
    }> = [];

    // Check each season
    for (const season of request.tvShowSeasons || []) {
      const completedEpisodes = season.episodes.filter(ep => ep.status === EpisodeStatus.COMPLETED);
      const totalEpisodes = season.totalEpisodes || season.episodes.length;

      // Check if season is complete (all episodes have aired)
      const isSeasonComplete = await this.releaseValidator.isSeasonComplete(request.tmdbId, season.seasonNumber);

      if (completedEpisodes.length === 0) {
        // No episodes downloaded for this season
        if (isSeasonComplete) {
          // Season has aired but nothing downloaded - definitely missing
          missingSeasons.push(season.seasonNumber);
          this.logger.debug(`Season ${season.seasonNumber} marked as missing: 0 completed episodes (season aired)`);
        } else {
          // Season hasn't fully aired - check if any episodes have been released
          const releasedEpisodes: number[] = [];
          for (let i = 1; i <= totalEpisodes; i++) {
            if (await this.releaseValidator.isEpisodeReleased(request.tmdbId, season.seasonNumber, i)) {
              releasedEpisodes.push(i);
            }
          }

          if (releasedEpisodes.length > 0) {
            // Some episodes have been released but not downloaded
            missingSeasons.push(season.seasonNumber);
            this.logger.debug(`Season ${season.seasonNumber} marked as missing: 0 completed episodes, ${releasedEpisodes.length} episodes released`);
          } else {
            // No episodes released yet - upcoming season
            this.logger.debug(`Season ${season.seasonNumber} skipped: upcoming season, no episodes released yet`);
          }
        }
      } else if (completedEpisodes.length < totalEpisodes) {
        // Season is incomplete - check which episodes are missing and released
        const completedEpisodeNumbers = completedEpisodes.map(ep => ep.episodeNumber);
        const missingEpisodes: number[] = [];

        for (let i = 1; i <= totalEpisodes; i++) {
          if (!completedEpisodeNumbers.includes(i)) {
            // Only include episodes that have been released
            if (await this.releaseValidator.isEpisodeReleased(request.tmdbId, season.seasonNumber, i)) {
              missingEpisodes.push(i);
            }
          }
        }

        if (missingEpisodes.length > 0) {
          incompleteSeasons.push({
            seasonNumber: season.seasonNumber,
            missingEpisodes,
            totalEpisodes,
          });
          this.logger.debug(`Season ${season.seasonNumber} marked as incomplete: ${missingEpisodes.length} missing episodes`);
        } else {
          this.logger.debug(`Season ${season.seasonNumber} skipped: no missing released episodes`);
        }
      } else if (completedEpisodes.length === totalEpisodes) {
        this.logger.debug(`Season ${season.seasonNumber} skipped: fully completed`);
      }
    }

    // Sort missing seasons and incomplete seasons chronologically
    missingSeasons.sort((a, b) => a - b);
    incompleteSeasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

    // Sort missing episodes within each incomplete season
    incompleteSeasons.forEach(season => {
      season.missingEpisodes.sort((a, b) => a - b);
    });

    this.logger.debug(`Gap analysis for ${request.title}: ${missingSeasons.length} missing seasons [${missingSeasons.join(', ')}], ${incompleteSeasons.length} incomplete seasons`);

    return { missingSeasons, incompleteSeasons };
  }

  /**
   * Select the best torrent from a list based on missing content
   */
  async selectBestTorrent(
    torrents: TorrentResult[],
    missingContent: MissingContent,
    showTitle: string,
  ): Promise<TorrentMatch | null> {
    const matches: TorrentMatch[] = [];

    for (const torrent of torrents) {
      const match = this.analyzeTorrentTitle(torrent, missingContent, showTitle);
      if (match) {
        match.torrent = torrent; // Set the torrent reference
        matches.push(match);
      }
    }

    if (matches.length === 0) {
      return null;
    }

    // Sort by priority (highest first), then by chronological order, then by seeders
    matches.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // If priorities are equal, prefer torrents covering earlier seasons
      const aEarliestSeason = this.getEarliestSeasonFromMatch(a);
      const bEarliestSeason = this.getEarliestSeasonFromMatch(b);

      if (aEarliestSeason !== bEarliestSeason) {
        return aEarliestSeason - bEarliestSeason; // Earlier seasons first
      }

      return b.torrent.seeders - a.torrent.seeders;
    });

    this.logger.debug(`Selected best torrent: ${matches[0].torrent.title} (${matches[0].reason})`);
    return matches[0];
  }

  /**
   * Get the earliest season number from a torrent match for sorting
   */
  private getEarliestSeasonFromMatch(match: TorrentMatch): number {
    if (match.covers.seasons && match.covers.seasons.length > 0) {
      return Math.min(...match.covers.seasons);
    }

    if (match.covers.episodes && match.covers.episodes.length > 0) {
      return Math.min(...match.covers.episodes.map(ep => ep.season));
    }

    return 999; // Default high value for unknown seasons
  }

  /**
   * Analyze a torrent title to determine what content it covers
   */
  private analyzeTorrentTitle(
    torrent: TorrentResult,
    missingContent: MissingContent,
    showTitle: string,
  ): TorrentMatch | null {
    // Use the title matcher to analyze the torrent
    const titleMatch = this.titleMatcher.analyzeTorrentTitle(torrent.title, showTitle);

    if (titleMatch.confidence < 70) {
      return null; // Not confident enough in the match
    }

    // Convert title match to torrent match based on missing content
    return this.convertTitleMatchToTorrentMatch(titleMatch, missingContent, torrent);
  }

  /**
   * Convert a title match to a torrent match based on missing content
   */
  private convertTitleMatchToTorrentMatch(
    titleMatch: any,
    missingContent: MissingContent,
    torrent: TorrentResult,
  ): TorrentMatch | null {
    // Safeguard: If this is a season-specific torrent (e.g., S06), ensure it only covers that season
    if (titleMatch.type === 'season-pack' && titleMatch.details.season) {
      const specificSeason = titleMatch.details.season;

      this.logger.debug(`Season pack detected: ${torrent.title} -> Season ${specificSeason}`);
      this.logger.debug(`Missing seasons: [${missingContent.missingSeasons.join(', ')}]`);

      // Only match if this specific season is actually missing
      if (missingContent.missingSeasons.includes(specificSeason)) {
        this.logger.debug(`Matching season pack to missing season ${specificSeason}`);
        const chronologicalPriority = this.calculateChronologicalPriority(specificSeason, missingContent.missingSeasons);
        return {
          torrent,
          type: 'season-pack',
          covers: { seasons: [specificSeason] },
          priority: 60 + chronologicalPriority,
          reason: `Season pack for missing season ${specificSeason}`,
        };
      }

      // Don't match season-specific torrents to other seasons
      this.logger.debug(`Season ${specificSeason} is not missing, skipping season pack`);
      return null;
    }
    switch (titleMatch.type) {
      case 'complete-series':
        if (missingContent.missingSeasons.length > 0) {
          // Complete series gets high base priority, but still consider chronological order
          // Prioritize complete series that include earlier seasons
          const earliestSeason = Math.min(...missingContent.missingSeasons);
          const chronologicalBonus = earliestSeason === 1 ? 20 : Math.max(0, 20 - (earliestSeason - 1) * 5);

          return {
            torrent,
            type: 'multi-season',
            covers: { seasons: [...missingContent.missingSeasons] },
            priority: 100 + chronologicalBonus,
            reason: 'Complete series pack covering all missing seasons',
          };
        }
        break;

      case 'multi-season':
        if (titleMatch.details.seasons) {
          const coveredSeasons = titleMatch.details.seasons.filter(s =>
            missingContent.missingSeasons.includes(s)
          );

          if (coveredSeasons.length > 1) {
            // Prioritize multi-season packs that include earlier seasons
            const earliestSeason = Math.min(...coveredSeasons);
            const chronologicalBonus = this.calculateChronologicalPriority(earliestSeason, missingContent.missingSeasons);

            return {
              torrent,
              type: 'multi-season',
              covers: { seasons: coveredSeasons },
              priority: 80 + coveredSeasons.length * 5 + chronologicalBonus,
              reason: `Multi-season pack covering seasons ${coveredSeasons.join(', ')}`,
            };
          } else if (coveredSeasons.length === 1) {
            const chronologicalBonus = this.calculateChronologicalPriority(coveredSeasons[0], missingContent.missingSeasons);
            return {
              torrent,
              type: 'season-pack',
              covers: { seasons: coveredSeasons },
              priority: 65 + chronologicalBonus,
              reason: `Season pack for season ${coveredSeasons[0]}`,
            };
          }
        }
        break;

      case 'season-pack':
        // Season pack matching is now handled at the top of the function
        // This ensures season-specific torrents only match their specific season
        break;

      case 'individual-episode':
        if (titleMatch.details.season && titleMatch.details.episode) {
          const season = titleMatch.details.season;
          const episode = titleMatch.details.episode;

          // Check if this episode belongs to a missing season (completely missing)
          const isFromMissingSeason = missingContent.missingSeasons.includes(season);

          // Check if this episode belongs to an incomplete season (partially missing)
          const incompleteSeason = missingContent.incompleteSeasons.find(
            s => s.seasonNumber === season
          );
          const isFromIncompleteSeason = incompleteSeason && incompleteSeason.missingEpisodes.includes(episode);

          if (isFromMissingSeason || isFromIncompleteSeason) {
            // Prioritize episodes chronologically: earlier seasons and earlier episodes within seasons
            const seasonChronologicalBonus = this.calculateChronologicalPriority(season, missingContent.missingSeasons);
            const episodeChronologicalBonus = this.calculateEpisodePriority(season, episode, missingContent);

            const reason = isFromMissingSeason
              ? `Individual episode S${season}E${episode} from missing season ${season}`
              : `Individual episode S${season}E${episode} from incomplete season ${season}`;

            return {
              torrent,
              type: 'individual-episode',
              covers: { episodes: [{ season, episode }] },
              priority: 30 + seasonChronologicalBonus + episodeChronologicalBonus,
              reason,
            };
          }
        }
        break;
    }

    return null;
  }

  /**
   * Calculate chronological priority bonus for seasons and episodes
   * Earlier seasons/episodes get higher priority to ensure chronological order
   */
  private calculateChronologicalPriority(season: number, missingSeasons: number[]): number {
    // Sort missing seasons to find the earliest
    const sortedMissingSeasons = [...missingSeasons].sort((a, b) => a - b);
    const earliestMissingSeason = sortedMissingSeasons[0];

    // Give highest bonus to the earliest missing season, decreasing for later seasons
    // This ensures Season 1 is prioritized over Season 3, etc.
    const maxBonus = 50;
    const seasonIndex = sortedMissingSeasons.indexOf(season);

    if (seasonIndex === -1) return 0; // Season not in missing list

    // Calculate bonus: earliest season gets full bonus, later seasons get progressively less
    const bonus = maxBonus - (seasonIndex * 10);
    return Math.max(0, bonus);
  }

  /**
   * Calculate chronological priority for episodes within a season
   */
  private calculateEpisodePriority(season: number, episode: number, missingContent: MissingContent): number {
    const incompleteSeason = missingContent.incompleteSeasons.find(s => s.seasonNumber === season);
    if (!incompleteSeason) return 0;

    // Sort missing episodes to prioritize earlier episodes
    const sortedMissingEpisodes = [...incompleteSeason.missingEpisodes].sort((a, b) => a - b);
    const episodeIndex = sortedMissingEpisodes.indexOf(episode);

    if (episodeIndex === -1) return 0;

    // Give higher priority to earlier episodes
    const maxBonus = 20;
    const bonus = maxBonus - (episodeIndex * 2);
    return Math.max(0, bonus);
  }
}
