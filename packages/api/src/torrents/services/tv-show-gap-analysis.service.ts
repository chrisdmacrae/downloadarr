import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ContentType, EpisodeStatus, SeasonStatus } from '../../../generated/prisma';
import { TvShowReleaseValidatorService } from './tv-show-release-validator.service';

export interface SeasonGap {
  seasonNumber: number;
  totalEpisodes: number;
  completedEpisodes: number;
  missingEpisodes: number[];
  isComplete: boolean; // All episodes aired
  isFullyDownloaded: boolean; // All episodes downloaded
}

export interface ContentGapAnalysis {
  requestId: string;
  showTitle: string;
  tmdbId: number | null;
  totalSeasons: number;
  
  // Missing entire seasons
  missingSeasons: number[];
  
  // Incomplete seasons (some episodes missing)
  incompleteSeasons: SeasonGap[];
  
  // Complete seasons (all episodes downloaded)
  completeSeasons: number[];
  
  // Recommendations for what to download next
  recommendations: DownloadRecommendation[];
}

export interface DownloadRecommendation {
  type: 'multi-season-pack' | 'season-pack' | 'individual-episodes';
  priority: number; // Higher is better
  description: string;
  targets: {
    seasons?: number[];
    episodes?: Array<{ season: number; episode: number }>;
  };
  reasoning: string;
}

@Injectable()
export class TvShowGapAnalysisService {
  private readonly logger = new Logger(TvShowGapAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly releaseValidator: TvShowReleaseValidatorService,
  ) {}

  /**
   * Perform comprehensive gap analysis for a TV show request
   */
  async analyzeContentGaps(requestId: string): Promise<ContentGapAnalysis> {
    const request = await this.prisma.requestedTorrent.findUnique({
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

    if (!request || request.contentType !== ContentType.TV_SHOW) {
      throw new Error(`TV show request ${requestId} not found`);
    }

    const analysis: ContentGapAnalysis = {
      requestId,
      showTitle: request.title,
      tmdbId: request.tmdbId,
      totalSeasons: request.totalSeasons || request.tvShowSeasons.length,
      missingSeasons: [],
      incompleteSeasons: [],
      completeSeasons: [],
      recommendations: [],
    };

    // Analyze each season
    for (const season of request.tvShowSeasons) {
      const seasonGap = await this.analyzeSeasonGap(season, request.tmdbId);
      
      if (seasonGap.completedEpisodes === 0) {
        // No episodes downloaded for this season
        analysis.missingSeasons.push(season.seasonNumber);
      } else if (!seasonGap.isFullyDownloaded) {
        // Season is incomplete
        analysis.incompleteSeasons.push(seasonGap);
      } else {
        // Season is complete
        analysis.completeSeasons.push(season.seasonNumber);
      }
    }

    // Generate download recommendations
    analysis.recommendations = await this.generateRecommendations(analysis);

    this.logger.debug(`Gap analysis for ${request.title}: ${analysis.missingSeasons.length} missing seasons, ${analysis.incompleteSeasons.length} incomplete seasons`);

    return analysis;
  }

  /**
   * Analyze gaps for a specific season
   */
  private async analyzeSeasonGap(season: any, tmdbId: number | null): Promise<SeasonGap> {
    const completedEpisodes = season.episodes.filter(ep => ep.status === EpisodeStatus.COMPLETED);
    const totalEpisodes = season.totalEpisodes || season.episodes.length;
    
    // Find missing episodes
    const completedEpisodeNumbers = completedEpisodes.map(ep => ep.episodeNumber);
    const missingEpisodes: number[] = [];
    
    for (let i = 1; i <= totalEpisodes; i++) {
      if (!completedEpisodeNumbers.includes(i)) {
        // Only include episodes that have been released
        if (await this.releaseValidator.isEpisodeReleased(tmdbId, season.seasonNumber, i)) {
          missingEpisodes.push(i);
        }
      }
    }

    const isComplete = await this.releaseValidator.isSeasonComplete(tmdbId, season.seasonNumber);
    const isFullyDownloaded = missingEpisodes.length === 0;

    return {
      seasonNumber: season.seasonNumber,
      totalEpisodes,
      completedEpisodes: completedEpisodes.length,
      missingEpisodes,
      isComplete,
      isFullyDownloaded,
    };
  }

  /**
   * Generate download recommendations based on gap analysis
   */
  private async generateRecommendations(analysis: ContentGapAnalysis): Promise<DownloadRecommendation[]> {
    const recommendations: DownloadRecommendation[] = [];

    // Recommendation 1: Multi-season packs for multiple missing seasons
    if (analysis.missingSeasons.length > 1) {
      // Check for consecutive seasons
      const consecutiveGroups = this.findConsecutiveSeasons(analysis.missingSeasons);
      
      for (const group of consecutiveGroups) {
        if (group.length > 1) {
          recommendations.push({
            type: 'multi-season-pack',
            priority: 90 + group.length * 5, // Higher priority for more seasons
            description: `Multi-season pack for seasons ${group.join('-')}`,
            targets: { seasons: group },
            reasoning: `Covers ${group.length} consecutive missing seasons efficiently`,
          });
        }
      }

      // Also recommend complete series if many seasons are missing
      if (analysis.missingSeasons.length >= 3) {
        recommendations.push({
          type: 'multi-season-pack',
          priority: 100,
          description: 'Complete series pack',
          targets: { seasons: analysis.missingSeasons },
          reasoning: `Covers all ${analysis.missingSeasons.length} missing seasons in one download`,
        });
      }
    }

    // Recommendation 2: Individual season packs for missing seasons
    for (const seasonNumber of analysis.missingSeasons) {
      recommendations.push({
        type: 'season-pack',
        priority: 70,
        description: `Season ${seasonNumber} pack`,
        targets: { seasons: [seasonNumber] },
        reasoning: `Complete season pack for missing season ${seasonNumber}`,
      });
    }

    // Recommendation 3: Individual episodes for incomplete seasons
    for (const incompleteSeason of analysis.incompleteSeasons) {
      if (incompleteSeason.missingEpisodes.length <= 3) {
        // Only recommend individual episodes if few are missing
        const episodes = incompleteSeason.missingEpisodes.map(ep => ({
          season: incompleteSeason.seasonNumber,
          episode: ep,
        }));

        recommendations.push({
          type: 'individual-episodes',
          priority: 50 - incompleteSeason.missingEpisodes.length, // Lower priority for more episodes
          description: `Individual episodes for Season ${incompleteSeason.seasonNumber}`,
          targets: { episodes },
          reasoning: `Only ${incompleteSeason.missingEpisodes.length} episodes missing from season ${incompleteSeason.seasonNumber}`,
        });
      } else {
        // If many episodes are missing, recommend the full season pack
        recommendations.push({
          type: 'season-pack',
          priority: 65,
          description: `Season ${incompleteSeason.seasonNumber} pack (re-download)`,
          targets: { seasons: [incompleteSeason.seasonNumber] },
          reasoning: `Many episodes (${incompleteSeason.missingEpisodes.length}) missing from season ${incompleteSeason.seasonNumber}`,
        });
      }
    }

    // Sort by priority (highest first)
    recommendations.sort((a, b) => b.priority - a.priority);

    return recommendations;
  }

  /**
   * Find consecutive groups of seasons
   */
  private findConsecutiveSeasons(seasons: number[]): number[][] {
    if (seasons.length === 0) return [];

    const sorted = [...seasons].sort((a, b) => a - b);
    const groups: number[][] = [];
    let currentGroup = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        // Consecutive season
        currentGroup.push(sorted[i]);
      } else {
        // Gap found, start new group
        groups.push(currentGroup);
        currentGroup = [sorted[i]];
      }
    }

    groups.push(currentGroup);
    return groups;
  }



  /**
   * Check if a TV show request needs more content
   */
  async needsMoreContent(requestId: string): Promise<boolean> {
    const analysis = await this.analyzeContentGaps(requestId);
    return analysis.missingSeasons.length > 0 || analysis.incompleteSeasons.length > 0;
  }

  /**
   * Get the next best download target for a TV show
   */
  async getNextDownloadTarget(requestId: string): Promise<DownloadRecommendation | null> {
    const analysis = await this.analyzeContentGaps(requestId);
    return analysis.recommendations.length > 0 ? analysis.recommendations[0] : null;
  }
}
