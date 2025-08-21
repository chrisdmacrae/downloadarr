import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';
import { ContentType, SeasonStatus, EpisodeStatus } from '../../../generated/prisma';
import { SeasonScanningService } from './season-scanning.service';

interface TMDBTvShow {
  id: number;
  name: string;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TMDBSeason[];
}

interface TMDBSeason {
  id: number;
  season_number: number;
  episode_count: number;
  air_date: string;
  name: string;
}

interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  air_date: string;
  season_number: number;
}

interface TMDBSeasonDetails {
  id: number;
  season_number: number;
  episode_count: number;
  episodes: TMDBEpisode[];
}

@Injectable()
export class TvShowMetadataService {
  private readonly logger = new Logger(TvShowMetadataService.name);
  private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfigService: AppConfigurationService,
    @Inject(forwardRef(() => SeasonScanningService))
    private readonly seasonScanningService: SeasonScanningService,
  ) {}

  async populateSeasonData(requestId: string): Promise<void> {
    this.logger.log(`Populating season data for request ${requestId}`);

    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      this.logger.error(`Request ${requestId} not found`);
      return;
    }

    if (request.contentType !== ContentType.TV_SHOW) {
      this.logger.log(`Request ${requestId} is not a TV show (type: ${request.contentType}), skipping`);
      return;
    }

    if (!request.tmdbId) {
      this.logger.error(`Request ${requestId} (${request.title}) has no TMDB ID, cannot fetch metadata`);
      return;
    }

    // Get TMDB API key from database
    const apiKeysConfig = await this.appConfigService.getApiKeysConfig();
    if (!apiKeysConfig.tmdbApiKey) {
      this.logger.error('TMDB API key not configured in database! Please configure it in the application settings.');
      return;
    }

    this.logger.log(`Processing TV show: ${request.title} (TMDB ID: ${request.tmdbId}, Ongoing: ${request.isOngoing})`)

    try {
      // Fetch TV show details from TMDB
      const tvShow = await this.fetchTvShowDetails(request.tmdbId, apiKeysConfig.tmdbApiKey);
      if (!tvShow) {
        this.logger.warn(`Could not fetch TV show details for TMDB ID ${request.tmdbId}`);
        return;
      }

      // Update request with total seasons/episodes if not set
      if (!request.totalSeasons || !request.totalEpisodes) {
        await this.prisma.requestedTorrent.update({
          where: { id: requestId },
          data: {
            totalSeasons: request.totalSeasons || tvShow.number_of_seasons,
            totalEpisodes: request.totalEpisodes || tvShow.number_of_episodes,
          },
        });
      }

      // Create or update seasons
      for (const tmdbSeason of tvShow.seasons) {
        // Skip season 0 (specials) for now
        if (tmdbSeason.season_number === 0) continue;

        await this.createOrUpdateSeason(requestId, tmdbSeason, apiKeysConfig.tmdbApiKey);
      }

      this.logger.log(`Successfully populated season data for request ${requestId}`);
    } catch (error) {
      this.logger.error(`Error populating season data for request ${requestId}: ${error.message}`, error.stack);
    }
  }

  private async fetchTvShowDetails(tmdbId: number, apiKey: string): Promise<TMDBTvShow | null> {
    try {
      const response = await fetch(
        `${this.tmdbBaseUrl}/tv/${tmdbId}?api_key=${apiKey}&append_to_response=seasons`
      );

      if (!response.ok) {
        this.logger.warn(`TMDB API returned ${response.status} for TV show ${tmdbId}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error fetching TV show details from TMDB: ${error.message}`);
      return null;
    }
  }

  private async fetchSeasonDetails(tmdbId: number, seasonNumber: number, apiKey: string): Promise<TMDBSeasonDetails | null> {
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

  private async createOrUpdateSeason(requestId: string, tmdbSeason: TMDBSeason, apiKey: string): Promise<void> {
    // Check if season already exists
    const existingSeason = await this.prisma.tvShowSeason.findUnique({
      where: {
        requestedTorrentId_seasonNumber: {
          requestedTorrentId: requestId,
          seasonNumber: tmdbSeason.season_number,
        },
      },
    });

    if (existingSeason) {
      // Update existing season if episode count changed
      if (existingSeason.totalEpisodes !== tmdbSeason.episode_count) {
        await this.prisma.tvShowSeason.update({
          where: { id: existingSeason.id },
          data: { totalEpisodes: tmdbSeason.episode_count },
        });
      }
    } else {
      // Create new season
      await this.prisma.tvShowSeason.create({
        data: {
          requestedTorrentId: requestId,
          seasonNumber: tmdbSeason.season_number,
          totalEpisodes: tmdbSeason.episode_count,
          status: SeasonStatus.PENDING,
        },
      });
    }

    // Fetch detailed season info to get episodes
    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
      select: { tmdbId: true },
    });

    if (request?.tmdbId) {
      const seasonDetails = await this.fetchSeasonDetails(request.tmdbId, tmdbSeason.season_number, apiKey);
      if (seasonDetails) {
        await this.createOrUpdateEpisodes(requestId, tmdbSeason.season_number, seasonDetails.episodes);
      }
    }
  }

  private async createOrUpdateEpisodes(requestId: string, seasonNumber: number, episodes: TMDBEpisode[]): Promise<void> {
    const season = await this.prisma.tvShowSeason.findUnique({
      where: {
        requestedTorrentId_seasonNumber: {
          requestedTorrentId: requestId,
          seasonNumber: seasonNumber,
        },
      },
    });

    if (!season) {
      this.logger.warn(`Season ${seasonNumber} not found for request ${requestId}`);
      return;
    }

    for (const episode of episodes) {
      const existingEpisode = await this.prisma.tvShowEpisode.findUnique({
        where: {
          tvShowSeasonId_episodeNumber: {
            tvShowSeasonId: season.id,
            episodeNumber: episode.episode_number,
          },
        },
      });

      if (!existingEpisode) {
        await this.prisma.tvShowEpisode.create({
          data: {
            tvShowSeasonId: season.id,
            episodeNumber: episode.episode_number,
            title: episode.name,
            airDate: episode.air_date ? new Date(episode.air_date) : null,
            status: EpisodeStatus.PENDING,
          },
        });
      }
    }
  }

  async updateAllOngoingShows(): Promise<void> {
    this.logger.log('Starting metadata update and filesystem scanning for all TV shows');

    // Check if TMDB API key is configured
    const apiKeysConfig = await this.appConfigService.getApiKeysConfig();
    if (!apiKeysConfig.tmdbApiKey) {
      this.logger.warn('TMDB API key not configured in database! Skipping metadata update.');
      return;
    }

    const tvShowRequests = await this.prisma.requestedTorrent.findMany({
      where: {
        contentType: ContentType.TV_SHOW,
        tmdbId: { not: null },
      },
      select: { id: true, title: true, isOngoing: true },
    });

    this.logger.log(`Found ${tvShowRequests.length} TV show requests to update`);

    let metadataUpdated = 0;
    let filesystemScanned = 0;
    let errors = 0;

    for (const request of tvShowRequests) {
      try {
        // Step 1: Update metadata from TMDB
        this.logger.debug(`Updating metadata for: ${request.title} (ongoing: ${request.isOngoing})`);
        await this.populateSeasonData(request.id);
        metadataUpdated++;

        // Step 2: Scan filesystem for organized files and update episode status
        this.logger.debug(`Scanning filesystem for: ${request.title}`);
        const scanResults = await this.seasonScanningService.scanTvShowRequest(request.id);
        filesystemScanned++;

        if (scanResults.episodesUpdated > 0 || scanResults.episodesMarkedMissing > 0) {
          this.logger.log(`Updated ${scanResults.episodesUpdated} episodes and marked ${scanResults.episodesMarkedMissing} episodes as missing for ${request.title} based on filesystem scan`);
        }

        // Add a small delay to avoid hitting TMDB rate limits
        await new Promise(resolve => setTimeout(resolve, 250));
      } catch (error) {
        this.logger.error(`Error updating ${request.title}: ${error.message}`);
        errors++;
      }
    }

    this.logger.log(`Completed TV show update: ${metadataUpdated} metadata updated, ${filesystemScanned} filesystem scanned, ${errors} errors`);
  }
}
