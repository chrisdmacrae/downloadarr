import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ContentType, SeasonStatus, EpisodeStatus } from '../../../generated/prisma';

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
  private readonly tmdbApiKey = process.env.TMDB_API_KEY;
  private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';

  constructor(private readonly prisma: PrismaService) {}

  async populateSeasonData(requestId: string): Promise<void> {
    this.logger.log(`Populating season data for request ${requestId}`);

    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      this.logger.warn(`Request ${requestId} not found`);
      return;
    }

    if (request.contentType !== ContentType.TV_SHOW || !request.isOngoing) {
      this.logger.log(`Request ${requestId} is not an ongoing TV show, skipping`);
      return;
    }

    if (!request.tmdbId) {
      this.logger.warn(`Request ${requestId} has no TMDB ID, cannot fetch metadata`);
      return;
    }

    if (!this.tmdbApiKey) {
      this.logger.warn('TMDB API key not configured, skipping metadata fetch');
      return;
    }

    try {
      // Fetch TV show details from TMDB
      const tvShow = await this.fetchTvShowDetails(request.tmdbId);
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

        await this.createOrUpdateSeason(requestId, tmdbSeason);
      }

      this.logger.log(`Successfully populated season data for request ${requestId}`);
    } catch (error) {
      this.logger.error(`Error populating season data for request ${requestId}: ${error.message}`, error.stack);
    }
  }

  private async fetchTvShowDetails(tmdbId: number): Promise<TMDBTvShow | null> {
    try {
      const response = await fetch(
        `${this.tmdbBaseUrl}/tv/${tmdbId}?api_key=${this.tmdbApiKey}&append_to_response=seasons`
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

  private async fetchSeasonDetails(tmdbId: number, seasonNumber: number): Promise<TMDBSeasonDetails | null> {
    try {
      const response = await fetch(
        `${this.tmdbBaseUrl}/tv/${tmdbId}/season/${seasonNumber}?api_key=${this.tmdbApiKey}`
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

  private async createOrUpdateSeason(requestId: string, tmdbSeason: TMDBSeason): Promise<void> {
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
      const seasonDetails = await this.fetchSeasonDetails(request.tmdbId, tmdbSeason.season_number);
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
    this.logger.log('Starting metadata update for all ongoing TV shows');

    const ongoingRequests = await this.prisma.requestedTorrent.findMany({
      where: {
        contentType: ContentType.TV_SHOW,
        isOngoing: true,
        tmdbId: { not: null },
      },
      select: { id: true, title: true },
    });

    this.logger.log(`Found ${ongoingRequests.length} ongoing TV show requests to update`);

    for (const request of ongoingRequests) {
      try {
        await this.populateSeasonData(request.id);
        // Add a small delay to avoid hitting TMDB rate limits
        await new Promise(resolve => setTimeout(resolve, 250));
      } catch (error) {
        this.logger.error(`Error updating metadata for ${request.title}: ${error.message}`);
      }
    }

    this.logger.log('Completed metadata update for all ongoing TV shows');
  }
}
