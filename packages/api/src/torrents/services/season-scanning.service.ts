import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationRulesService } from '../../organization/services/organization-rules.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';
import { TvShowMetadataService } from './tv-show-metadata.service';
import { TorrentTitleMatcherService } from './torrent-title-matcher.service';
import { ContentType, EpisodeStatus } from '../../../generated/prisma';
import { promises as fs } from 'fs';
import * as path from 'path';
import { generateDirectoryNameVariations } from '../../common/utils/filesystem.utils';

interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  air_date: string;
  season_number: number;
}

@Injectable()
export class SeasonScanningService {
  private readonly logger = new Logger(SeasonScanningService.name);
  private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationRulesService: OrganizationRulesService,
    private readonly appConfigService: AppConfigurationService,
    @Inject(forwardRef(() => TvShowMetadataService))
    private readonly tvShowMetadataService: TvShowMetadataService,
    private readonly titleMatcher: TorrentTitleMatcherService,
  ) {}

  /**
   * Scan all TV show seasons and update episode progress based on organized files
   */
  async scanAllSeasons(): Promise<{
    seasonsScanned: number;
    episodesUpdated: number;
    episodesMarkedMissing: number;
    errors: number;
  }> {
    const results = { seasonsScanned: 0, episodesUpdated: 0, episodesMarkedMissing: 0, errors: 0 };

    try {
      // Get all TV show requests that have seasons
      const tvShowRequests = await this.prisma.requestedTorrent.findMany({
        where: {
          contentType: ContentType.TV_SHOW,
        },
        include: {
          tvShowSeasons: {
            include: {
              episodes: true,
            },
          },
        },
      });

      this.logger.log(`Found ${tvShowRequests.length} TV show requests to scan`);

      for (const request of tvShowRequests) {
        try {
          // Delegate to individual request scanning
          const requestResults = await this.scanTvShowRequest(request.id);
          results.seasonsScanned += request.tvShowSeasons.length;
          results.episodesUpdated += requestResults.episodesUpdated;
          results.episodesMarkedMissing += requestResults.episodesMarkedMissing;
        } catch (error) {
          this.logger.error(`Error scanning seasons for ${request.title}:`, error);
          results.errors++;
        }
      }

      this.logger.log(`Season scanning completed. Scanned ${results.seasonsScanned} seasons, updated ${results.episodesUpdated} episodes, marked ${results.episodesMarkedMissing} episodes as missing`);

      if (results.episodesMarkedMissing > 0) {
        this.logger.log(`🔍 Found ${results.episodesMarkedMissing} missing episode files that were previously completed`);
      }
      return results;
    } catch (error) {
      this.logger.error('Error during season scanning:', error);
      throw error;
    }
  }

  /**
   * Scan a specific season and update episode progress
   */
  async scanSeason(request: any, season: any): Promise<{ episodesUpdated: number; episodesMarkedMissing: number }> {
    const results = { episodesUpdated: 0, episodesMarkedMissing: 0 };

    try {
      // Get the expected season directory path
      const seasonPath = await this.getSeasonDirectoryPath(request, season.seasonNumber);

      if (!seasonPath) {
        this.logger.debug(`No season directory found for ${request.title} Season ${season.seasonNumber}`);

        // Even if we can't find the directory, check for missing episodes
        for (const episode of season.episodes) {
          if (episode.status === EpisodeStatus.COMPLETED) {
            // Episode was completed but directory path not found, mark as pending
            await this.prisma.tvShowEpisode.update({
              where: { id: episode.id },
              data: {
                status: EpisodeStatus.PENDING,
                updatedAt: new Date(),
              },
            });

            this.logger.log(`Episode ${episode.episodeNumber} of ${request.title} S${season.seasonNumber} directory not found, marked as PENDING`);
            results.episodesUpdated++;
            results.episodesMarkedMissing++;
          }
        }

        return results;
      }

      // Check if season directory exists
      try {
        await fs.access(seasonPath);
      } catch {
        this.logger.debug(`Season directory does not exist: ${seasonPath}`);

        // Even if directory doesn't exist, we should check for missing episodes
        // that were previously completed
        for (const episode of season.episodes) {
          if (episode.status === EpisodeStatus.COMPLETED) {
            // Episode was completed but directory is missing, mark as pending
            await this.prisma.tvShowEpisode.update({
              where: { id: episode.id },
              data: {
                status: EpisodeStatus.PENDING,
                updatedAt: new Date(),
              },
            });

            this.logger.log(`Episode ${episode.episodeNumber} of ${request.title} S${season.seasonNumber} directory is missing, marked as PENDING`);
            results.episodesUpdated++;
            results.episodesMarkedMissing++;
          }
        }

        return results;
      }

      this.logger.debug(`Scanning season directory: ${seasonPath}`);

      // Auto-detect all episodes in the directory
      const detectedEpisodes = await this.detectAllEpisodesInDirectory(seasonPath, season.seasonNumber);

      if (detectedEpisodes.length === 0) {
        this.logger.debug(`No episodes detected in season directory: ${seasonPath}`);
        return results;
      }

      this.logger.debug(`Detected ${detectedEpisodes.length} episodes in ${seasonPath}`);

      // Validate episodes against TMDB if available
      const validEpisodes = await this.validateEpisodesWithTMDB(request, season.seasonNumber, season.episodes);

      // Create a set of detected episode numbers for quick lookup
      const detectedEpisodeNumbers = new Set(detectedEpisodes.map(ep => ep.episodeNumber));

      // Process detected episodes
      for (const detectedEpisode of detectedEpisodes) {
        // Find corresponding episode record
        const episode = season.episodes.find(ep => ep.episodeNumber === detectedEpisode.episodeNumber);

        if (episode) {
          // Check if this episode is valid according to TMDB
          const isValidEpisode = validEpisodes.some(validEp => validEp.episode_number === episode.episodeNumber);

          if (isValidEpisode) {
            // Episode has organized files and is valid, mark as completed if not already
            if (episode.status !== EpisodeStatus.COMPLETED) {
              await this.prisma.tvShowEpisode.update({
                where: { id: episode.id },
                data: {
                  status: EpisodeStatus.COMPLETED,
                  updatedAt: new Date(),
                },
              });

              this.logger.debug(`Updated episode ${episode.episodeNumber} of ${request.title} S${season.seasonNumber} to COMPLETED`);
              results.episodesUpdated++;
            }
          } else {
            this.logger.warn(`Found file for episode ${episode.episodeNumber} of ${request.title} S${season.seasonNumber}, but episode not found in TMDB. Skipping.`);
          }
        } else {
          // Episode file found but no episode record exists - create it if valid
          const isValidEpisode = validEpisodes.some(validEp => validEp.episode_number === detectedEpisode.episodeNumber);

          if (isValidEpisode) {
            const validEpisodeData = validEpisodes.find(validEp => validEp.episode_number === detectedEpisode.episodeNumber);

            await this.prisma.tvShowEpisode.create({
              data: {
                tvShowSeasonId: season.id,
                episodeNumber: detectedEpisode.episodeNumber,
                title: validEpisodeData?.name || null,
                airDate: validEpisodeData?.air_date ? new Date(validEpisodeData.air_date) : null,
                status: EpisodeStatus.COMPLETED,
              },
            });

            this.logger.log(`Created and completed episode ${detectedEpisode.episodeNumber} for ${request.title} S${season.seasonNumber}`);
            results.episodesUpdated++;
          }
        }
      }

      // Check for episodes that were previously completed but no longer have files
      this.logger.debug(`Checking ${season.episodes.length} episodes for missing files in ${request.title} S${season.seasonNumber}`);

      for (const episode of season.episodes) {
        if (episode.status === EpisodeStatus.COMPLETED && !detectedEpisodeNumbers.has(episode.episodeNumber)) {
          // Episode was completed but file is missing, mark as pending
          await this.prisma.tvShowEpisode.update({
            where: { id: episode.id },
            data: {
              status: EpisodeStatus.PENDING,
              updatedAt: new Date(),
            },
          });

          this.logger.log(`Episode ${episode.episodeNumber} of ${request.title} S${season.seasonNumber} file is missing, marked as PENDING`);
          results.episodesUpdated++;
          results.episodesMarkedMissing++;
        } else if (episode.status === EpisodeStatus.COMPLETED) {
          this.logger.debug(`Episode ${episode.episodeNumber} of ${request.title} S${season.seasonNumber} is completed and file exists`);
        } else {
          this.logger.debug(`Episode ${episode.episodeNumber} of ${request.title} S${season.seasonNumber} has status ${episode.status}`);
        }
      }

      // Update season status based on episode completion
      await this.updateSeasonStatusFromEpisodes(season.id);

      return results;
    } catch (error) {
      this.logger.error(`Error scanning season ${season.seasonNumber} for ${request.title}:`, error);
      throw error;
    }
  }

  /**
   * Get the expected directory path for a season
   */
  private async getSeasonDirectoryPath(request: any, seasonNumber: number): Promise<string | null> {
    try {
      const settings = await this.organizationRulesService.getSettings();
      const tvShowsPath = settings.tvShowsPath || `${settings.libraryPath}/tv-shows`;

      this.logger.debug(`Looking for season directory for ${request.title} S${seasonNumber} in ${tvShowsPath}`);

      // Generate directory name variations using shared utility
      const uniqueDirectoryNames = generateDirectoryNameVariations(request.title, request.year);
      this.logger.debug(`Generated ${uniqueDirectoryNames.length} directory name variations for "${request.title}": ${uniqueDirectoryNames.join(', ')}`);

      // Try different possible season directory patterns
      const seasonPatterns = [
        `Season ${seasonNumber}`,
        `Season ${seasonNumber.toString().padStart(2, '0')}`,
        `S${seasonNumber.toString().padStart(2, '0')}`,
        `s${seasonNumber.toString().padStart(2, '0')}`,
      ];

      // Check all combinations
      for (const showDir of uniqueDirectoryNames) {
        for (const seasonPattern of seasonPatterns) {
          const possiblePath = path.join(tvShowsPath, showDir, seasonPattern);
          this.logger.debug(`Checking path: ${possiblePath}`);
          try {
            await fs.access(possiblePath);
            this.logger.debug(`Found season directory: ${possiblePath}`);
            return possiblePath;
          } catch {
            // Path doesn't exist, try next one
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting season directory path for ${request.title} S${seasonNumber}:`, error);
      return null;
    }
  }

  /**
   * Get all media files in a directory recursively
   */
  private async getMediaFilesInDirectory(dirPath: string): Promise<string[]> {
    const mediaExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.getMediaFilesInDirectory(fullPath);
          files.push(...subFiles);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (mediaExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error reading directory ${dirPath}:`, error);
    }

    return files;
  }

  /**
   * Find files that match a specific season and episode using enhanced patterns
   */
  private findMatchingFiles(files: string[], seasonNumber: number, episodeNumber: number): string[] {
    const matchingFiles: string[] = [];

    // Enhanced patterns to match season and episode
    const patterns = [
      // Standard patterns: S01E01, S1E1
      new RegExp(`s${seasonNumber.toString().padStart(2, '0')}e${episodeNumber.toString().padStart(2, '0')}`, 'i'),
      new RegExp(`s${seasonNumber}e${episodeNumber}`, 'i'),

      // With separators: S01.E01, S01-E01, S01_E01
      new RegExp(`s${seasonNumber.toString().padStart(2, '0')}[._-]e${episodeNumber.toString().padStart(2, '0')}`, 'i'),
      new RegExp(`s${seasonNumber}[._-]e${episodeNumber}`, 'i'),

      // With spaces: S01 E01, S1 E1
      new RegExp(`s${seasonNumber.toString().padStart(2, '0')}\\s+e${episodeNumber.toString().padStart(2, '0')}`, 'i'),
      new RegExp(`s${seasonNumber}\\s+e${episodeNumber}`, 'i'),

      // Alternative format: 1x01, 01x01
      new RegExp(`${seasonNumber.toString().padStart(2, '0')}x${episodeNumber.toString().padStart(2, '0')}`, 'i'),
      new RegExp(`${seasonNumber}x${episodeNumber.toString().padStart(2, '0')}`, 'i'),

      // Season/Episode format: Season 1 Episode 1
      new RegExp(`season\\s*${seasonNumber}.*episode\\s*${episodeNumber}`, 'i'),

      // Bracket format: [S01E01], (S01E01)
      new RegExp(`[\\[\\(]s${seasonNumber.toString().padStart(2, '0')}e${episodeNumber.toString().padStart(2, '0')}[\\]\\)]`, 'i'),

      // Episode only format (when in season-specific directory): E01, Episode 1
      new RegExp(`^e${episodeNumber.toString().padStart(2, '0')}`, 'i'),
      new RegExp(`episode\\s*${episodeNumber}`, 'i'),
    ];

    for (const file of files) {
      const fileName = path.basename(file);

      for (const pattern of patterns) {
        if (pattern.test(fileName)) {
          matchingFiles.push(file);
          this.logger.debug(`Matched file ${fileName} with pattern ${pattern.source}`);
          break; // Found a match, no need to test other patterns
        }
      }
    }

    return matchingFiles;
  }

  /**
   * Extract episode information from filename using the title matcher
   */
  private extractEpisodeInfoFromFile(filePath: string): { season?: number; episode?: number } | null {
    const fileName = path.basename(filePath);
    const titleMatch = this.titleMatcher.analyzeTorrentTitle(fileName);

    if (titleMatch.type === 'individual-episode' && titleMatch.details.season && titleMatch.details.episode) {
      return {
        season: titleMatch.details.season,
        episode: titleMatch.details.episode,
      };
    }

    return null;
  }

  /**
   * Scan directory for all episodes and automatically detect them
   */
  private async detectAllEpisodesInDirectory(dirPath: string, seasonNumber: number): Promise<Array<{ episodeNumber: number; filePath: string }>> {
    const mediaFiles = await this.getMediaFilesInDirectory(dirPath);
    const detectedEpisodes: Array<{ episodeNumber: number; filePath: string }> = [];

    for (const filePath of mediaFiles) {
      const episodeInfo = this.extractEpisodeInfoFromFile(filePath);

      if (episodeInfo && episodeInfo.season === seasonNumber && episodeInfo.episode) {
        detectedEpisodes.push({
          episodeNumber: episodeInfo.episode,
          filePath,
        });
      }
    }

    // Sort by episode number
    detectedEpisodes.sort((a, b) => a.episodeNumber - b.episodeNumber);

    this.logger.debug(`Detected ${detectedEpisodes.length} episodes in ${dirPath}`);
    return detectedEpisodes;
  }

  /**
   * Update season status based on episode completion
   */
  private async updateSeasonStatusFromEpisodes(seasonId: string): Promise<void> {
    try {
      const season = await this.prisma.tvShowSeason.findUnique({
        where: { id: seasonId },
        include: { episodes: true },
      });

      if (!season || season.episodes.length === 0) {
        return;
      }

      const completedEpisodes = season.episodes.filter(ep => ep.status === 'COMPLETED');
      const totalEpisodes = season.episodes.length;

      let newStatus: string;
      if (completedEpisodes.length === totalEpisodes) {
        newStatus = 'COMPLETED';
      } else if (completedEpisodes.length > 0) {
        newStatus = 'DOWNLOADING'; // Use DOWNLOADING to represent partially completed seasons
      } else {
        newStatus = 'PENDING';
      }

      // Only update if status has changed
      if (season.status !== newStatus) {
        await this.prisma.tvShowSeason.update({
          where: { id: seasonId },
          data: {
            status: newStatus as any,
            updatedAt: new Date(),
          },
        });

        this.logger.debug(`Updated season ${seasonId} status to ${newStatus} (${completedEpisodes.length}/${totalEpisodes} episodes completed)`);
      }
    } catch (error) {
      this.logger.error(`Error updating season status for ${seasonId}:`, error);
    }
  }

  /**
   * Validate episodes against TMDB to ensure we have correct episode data
   */
  private async validateEpisodesWithTMDB(request: any, seasonNumber: number, episodes: any[]): Promise<TMDBEpisode[]> {
    try {
      // Check if TMDB API key is configured
      const apiKeysConfig = await this.appConfigService.getApiKeysConfig();
      if (!apiKeysConfig.tmdbApiKey || !request.tmdbId) {
        this.logger.debug(`TMDB API key or TMDB ID not available for ${request.title}. Skipping TMDB validation.`);
        // Return all episodes as valid if we can't validate
        return episodes.map(ep => ({
          id: ep.id,
          episode_number: ep.episodeNumber,
          name: ep.title || '',
          air_date: ep.airDate || '',
          season_number: seasonNumber,
        }));
      }

      // Fetch season details from TMDB
      const seasonDetails = await this.fetchSeasonDetailsFromTMDB(request.tmdbId, seasonNumber, apiKeysConfig.tmdbApiKey);

      if (!seasonDetails) {
        this.logger.warn(`Could not fetch season ${seasonNumber} details from TMDB for ${request.title}`);
        // Return all episodes as valid if we can't validate
        return episodes.map(ep => ({
          id: ep.id,
          episode_number: ep.episodeNumber,
          name: ep.title || '',
          air_date: ep.airDate || '',
          season_number: seasonNumber,
        }));
      }

      this.logger.debug(`Validated ${seasonDetails.episodes.length} episodes for ${request.title} S${seasonNumber} with TMDB`);
      return seasonDetails.episodes;
    } catch (error) {
      this.logger.error(`Error validating episodes with TMDB for ${request.title} S${seasonNumber}:`, error);
      // Return all episodes as valid if validation fails
      return episodes.map(ep => ({
        id: ep.id,
        episode_number: ep.episodeNumber,
        name: ep.title || '',
        air_date: ep.airDate || '',
        season_number: seasonNumber,
      }));
    }
  }

  /**
   * Fetch season details from TMDB
   */
  private async fetchSeasonDetailsFromTMDB(tmdbId: number, seasonNumber: number, apiKey: string): Promise<{ episodes: TMDBEpisode[] } | null> {
    try {
      const response = await fetch(
        `${this.tmdbBaseUrl}/tv/${tmdbId}/season/${seasonNumber}?api_key=${apiKey}`
      );

      if (!response.ok) {
        this.logger.warn(`TMDB API returned ${response.status} for season ${seasonNumber} of TV show ${tmdbId}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error fetching season details from TMDB: ${error.message}`);
      return null;
    }
  }

  /**
   * Scan a specific TV show request
   * First ensures seasons and episodes are populated, then scans for completed episodes
   */
  async scanTvShowRequest(requestId: string): Promise<{ episodesUpdated: number; episodesMarkedMissing: number }> {
    const results = { episodesUpdated: 0, episodesMarkedMissing: 0 };

    try {
      let request = await this.prisma.requestedTorrent.findUnique({
        where: { id: requestId },
        include: {
          tvShowSeasons: {
            include: {
              episodes: true,
            },
          },
        },
      });

      if (!request || request.contentType !== ContentType.TV_SHOW) {
        this.logger.warn(`Request ${requestId} is not a TV show or not found`);
        return results;
      }

      // If no seasons exist, populate them first
      if (!request.tvShowSeasons || request.tvShowSeasons.length === 0) {
        this.logger.log(`No seasons found for ${request.title}, populating season data first`);
        await this.tvShowMetadataService.populateSeasonData(requestId);

        // Refetch the request with populated seasons
        request = await this.prisma.requestedTorrent.findUnique({
          where: { id: requestId },
          include: {
            tvShowSeasons: {
              include: {
                episodes: true,
              },
            },
          },
        });

        if (!request || !request.tvShowSeasons || request.tvShowSeasons.length === 0) {
          this.logger.warn(`Still no seasons found for ${request.title} after populating metadata`);
          return results;
        }
      }

      // Now scan all seasons for completed episodes
      for (const season of request.tvShowSeasons) {
        const seasonResults = await this.scanSeason(request, season);
        results.episodesUpdated += seasonResults.episodesUpdated;
        results.episodesMarkedMissing += seasonResults.episodesMarkedMissing;
      }

      return results;
    } catch (error) {
      this.logger.error(`Error scanning TV show request ${requestId}:`, error);
      throw error;
    }
  }
}
