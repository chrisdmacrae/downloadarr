import { Injectable, Logger } from '@nestjs/common';
import { AppConfigurationService } from '../../config/services/app-configuration.service';

export interface SeasonInfo {
  seasonNumber: number;
  totalEpisodes: number;
  isComplete: boolean;
  lastAirDate: Date | null;
  episodes: EpisodeInfo[];
}

export interface EpisodeInfo {
  episodeNumber: number;
  title: string | null;
  airDate: Date | null;
  isReleased: boolean; // Released at least 1 day ago
}

export interface ShowInfo {
  tmdbId: number;
  title: string;
  totalSeasons: number;
  isOngoing: boolean;
  seasons: SeasonInfo[];
}

@Injectable()
export class TvShowReleaseValidatorService {
  private readonly logger = new Logger(TvShowReleaseValidatorService.name);
  private readonly releaseBuffer = 24 * 60 * 60 * 1000; // 1 day in milliseconds
  
  // Cache to avoid repeated API calls
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 60 * 60 * 1000; // 1 hour cache

  constructor(
    private readonly appConfigService: AppConfigurationService,
  ) {}

  /**
   * Check if an episode has been released (at least 1 day ago)
   */
  async isEpisodeReleased(tmdbId: number, seasonNumber: number, episodeNumber: number): Promise<boolean> {
    if (!tmdbId) return true; // Assume released if no TMDB ID

    try {
      const episodeInfo = await this.getEpisodeInfo(tmdbId, seasonNumber, episodeNumber);
      return episodeInfo?.isReleased ?? true;
    } catch (error) {
      this.logger.warn(`Error checking episode release for TMDB ${tmdbId} S${seasonNumber}E${episodeNumber}:`, error);
      return true; // Assume released on error
    }
  }

  /**
   * Check if a season is complete (all episodes have aired at least 1 day ago)
   */
  async isSeasonComplete(tmdbId: number, seasonNumber: number): Promise<boolean> {
    if (!tmdbId) return true; // Assume complete if no TMDB ID

    try {
      const seasonInfo = await this.getSeasonInfo(tmdbId, seasonNumber);
      return seasonInfo?.isComplete ?? true;
    } catch (error) {
      this.logger.warn(`Error checking season completion for TMDB ${tmdbId} S${seasonNumber}:`, error);
      return true; // Assume complete on error
    }
  }

  /**
   * Get detailed information about a specific episode
   */
  async getEpisodeInfo(tmdbId: number, seasonNumber: number, episodeNumber: number): Promise<EpisodeInfo | null> {
    const cacheKey = `episode_${tmdbId}_${seasonNumber}_${episodeNumber}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const apiKeysConfig = await this.appConfigService.getApiKeysConfig();
      if (!apiKeysConfig.tmdbApiKey) {
        this.logger.warn('TMDB API key not configured');
        return null;
      }

      const response = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${apiKeysConfig.tmdbApiKey}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          this.logger.debug(`Episode S${seasonNumber}E${episodeNumber} not found for TMDB ${tmdbId}`);
          return null;
        }
        throw new Error(`TMDB API error: ${response.status}`);
      }

      const episodeData = await response.json();
      const episodeInfo = this.parseEpisodeData(episodeData);
      
      this.setCachedData(cacheKey, episodeInfo);
      return episodeInfo;
    } catch (error) {
      this.logger.error(`Error fetching episode info for TMDB ${tmdbId} S${seasonNumber}E${episodeNumber}:`, error);
      return null;
    }
  }

  /**
   * Get detailed information about a specific season
   */
  async getSeasonInfo(tmdbId: number, seasonNumber: number): Promise<SeasonInfo | null> {
    const cacheKey = `season_${tmdbId}_${seasonNumber}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const apiKeysConfig = await this.appConfigService.getApiKeysConfig();
      if (!apiKeysConfig.tmdbApiKey) {
        this.logger.warn('TMDB API key not configured');
        return null;
      }

      const response = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?api_key=${apiKeysConfig.tmdbApiKey}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          this.logger.debug(`Season ${seasonNumber} not found for TMDB ${tmdbId}`);
          return null;
        }
        throw new Error(`TMDB API error: ${response.status}`);
      }

      const seasonData = await response.json();
      const seasonInfo = this.parseSeasonData(seasonData);
      
      this.setCachedData(cacheKey, seasonInfo);
      return seasonInfo;
    } catch (error) {
      this.logger.error(`Error fetching season info for TMDB ${tmdbId} S${seasonNumber}:`, error);
      return null;
    }
  }

  /**
   * Get detailed information about a TV show
   */
  async getShowInfo(tmdbId: number): Promise<ShowInfo | null> {
    const cacheKey = `show_${tmdbId}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const apiKeysConfig = await this.appConfigService.getApiKeysConfig();
      if (!apiKeysConfig.tmdbApiKey) {
        this.logger.warn('TMDB API key not configured');
        return null;
      }

      const response = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKeysConfig.tmdbApiKey}`
      );

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`);
      }

      const showData = await response.json();
      
      // Get season information
      const seasons: SeasonInfo[] = [];
      for (const season of showData.seasons || []) {
        if (season.season_number === 0) continue; // Skip specials
        
        const seasonInfo = await this.getSeasonInfo(tmdbId, season.season_number);
        if (seasonInfo) {
          seasons.push(seasonInfo);
        }
      }

      const showInfo: ShowInfo = {
        tmdbId,
        title: showData.name || showData.original_name,
        totalSeasons: showData.number_of_seasons || 0,
        isOngoing: showData.status === 'Returning Series' || showData.status === 'In Production',
        seasons,
      };
      
      this.setCachedData(cacheKey, showInfo);
      return showInfo;
    } catch (error) {
      this.logger.error(`Error fetching show info for TMDB ${tmdbId}:`, error);
      return null;
    }
  }

  /**
   * Get all released episodes for a season
   */
  async getReleasedEpisodes(tmdbId: number, seasonNumber: number): Promise<number[]> {
    const seasonInfo = await this.getSeasonInfo(tmdbId, seasonNumber);
    if (!seasonInfo) return [];

    return seasonInfo.episodes
      .filter(ep => ep.isReleased)
      .map(ep => ep.episodeNumber);
  }

  /**
   * Get all complete seasons for a show
   */
  async getCompleteSeasons(tmdbId: number): Promise<number[]> {
    const showInfo = await this.getShowInfo(tmdbId);
    if (!showInfo) return [];

    return showInfo.seasons
      .filter(season => season.isComplete)
      .map(season => season.seasonNumber);
  }

  /**
   * Parse episode data from TMDB API response
   */
  private parseEpisodeData(episodeData: any): EpisodeInfo {
    const airDate = episodeData.air_date ? new Date(episodeData.air_date) : null;
    const isReleased = this.isDateReleased(airDate);

    return {
      episodeNumber: episodeData.episode_number,
      title: episodeData.name || null,
      airDate,
      isReleased,
    };
  }

  /**
   * Parse season data from TMDB API response
   */
  private parseSeasonData(seasonData: any): SeasonInfo {
    const episodes: EpisodeInfo[] = [];
    let lastAirDate: Date | null = null;
    let isComplete = true;

    for (const episodeData of seasonData.episodes || []) {
      const episodeInfo = this.parseEpisodeData(episodeData);
      episodes.push(episodeInfo);

      if (episodeInfo.airDate) {
        if (!lastAirDate || episodeInfo.airDate > lastAirDate) {
          lastAirDate = episodeInfo.airDate;
        }
      }

      // If any episode is not released, the season is not complete
      if (!episodeInfo.isReleased) {
        isComplete = false;
      }
    }

    return {
      seasonNumber: seasonData.season_number,
      totalEpisodes: episodes.length,
      isComplete,
      lastAirDate,
      episodes,
    };
  }

  /**
   * Check if a date is considered "released" (at least 1 day ago)
   */
  private isDateReleased(date: Date | null): boolean {
    if (!date) return false;
    
    const now = new Date();
    const releaseThreshold = new Date(now.getTime() - this.releaseBuffer);
    
    return date <= releaseThreshold;
  }

  /**
   * Get cached data if it exists and is not expired
   */
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data with timestamp
   */
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('TMDB cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
