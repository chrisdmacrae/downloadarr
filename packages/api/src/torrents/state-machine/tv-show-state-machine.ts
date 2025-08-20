import { Injectable, Logger } from '@nestjs/common';
import { RequestStatus, SeasonStatus, EpisodeStatus } from '../../../generated/prisma';

export interface TvShowStateContext {
  requestId: string;
  seasons: Array<{
    id: string;
    seasonNumber: number;
    status: SeasonStatus;
    episodes: Array<{
      id: string;
      episodeNumber: number;
      status: EpisodeStatus;
    }>;
  }>;
  isOngoing: boolean;
}

export interface TvShowStateResult {
  mainRequestStatus: RequestStatus;
  seasonUpdates: Array<{
    seasonId: string;
    newStatus: SeasonStatus;
  }>;
  episodeUpdates: Array<{
    episodeId: string;
    newStatus: EpisodeStatus;
  }>;
}

@Injectable()
export class TvShowStateMachine {
  private readonly logger = new Logger(TvShowStateMachine.name);

  /**
   * Calculate the aggregate status for a TV show request based on its seasons and episodes
   */
  calculateAggregateStatus(context: TvShowStateContext): TvShowStateResult {
    const { seasons, isOngoing } = context;

    // If no seasons, return PENDING
    if (seasons.length === 0) {
      return {
        mainRequestStatus: RequestStatus.PENDING,
        seasonUpdates: [],
        episodeUpdates: [],
      };
    }

    // Calculate season statuses based on episodes
    const seasonUpdates: Array<{ seasonId: string; newStatus: SeasonStatus }> = [];
    const episodeUpdates: Array<{ episodeId: string; newStatus: EpisodeStatus }> = [];

    const updatedSeasons = seasons.map(season => {
      const calculatedSeasonStatus = this.calculateSeasonStatus(season.episodes);
      
      if (calculatedSeasonStatus !== season.status) {
        seasonUpdates.push({
          seasonId: season.id,
          newStatus: calculatedSeasonStatus,
        });
      }

      return {
        ...season,
        status: calculatedSeasonStatus,
      };
    });

    // Calculate main request status based on seasons
    const mainRequestStatus = this.calculateMainRequestStatus(updatedSeasons, isOngoing);

    return {
      mainRequestStatus,
      seasonUpdates,
      episodeUpdates,
    };
  }

  /**
   * Calculate season status based on episode statuses
   */
  private calculateSeasonStatus(episodes: Array<{ id: string; episodeNumber: number; status: EpisodeStatus }>): SeasonStatus {
    if (episodes.length === 0) {
      return SeasonStatus.PENDING;
    }

    const episodeStatuses = episodes.map(ep => ep.status);

    // If all episodes are completed, season is completed
    if (episodeStatuses.every(status => status === EpisodeStatus.COMPLETED)) {
      return SeasonStatus.COMPLETED;
    }

    // If any episode is downloading, season is downloading
    if (episodeStatuses.some(status => status === EpisodeStatus.DOWNLOADING)) {
      return SeasonStatus.DOWNLOADING;
    }

    // If any episode is found, season is found
    if (episodeStatuses.some(status => status === EpisodeStatus.FOUND)) {
      return SeasonStatus.FOUND;
    }

    // If any episode is searching, season is searching
    if (episodeStatuses.some(status => status === EpisodeStatus.SEARCHING)) {
      return SeasonStatus.SEARCHING;
    }

    // If all episodes failed, season failed
    if (episodeStatuses.every(status => status === EpisodeStatus.FAILED)) {
      return SeasonStatus.FAILED;
    }

    // Default to pending
    return SeasonStatus.PENDING;
  }

  /**
   * Calculate main request status based on season statuses
   */
  private calculateMainRequestStatus(
    seasons: Array<{ seasonNumber: number; status: SeasonStatus }>,
    isOngoing: boolean
  ): RequestStatus {
    if (seasons.length === 0) {
      return RequestStatus.PENDING;
    }

    const seasonStatuses = seasons.map(s => s.status);

    // For ongoing shows, status is based on the latest incomplete season
    if (isOngoing) {
      return this.calculateOngoingShowStatus(seasons);
    }

    // For specific season/episode requests, all must be complete
    if (seasonStatuses.every(status => status === SeasonStatus.COMPLETED)) {
      return RequestStatus.COMPLETED;
    }

    // If any season is downloading, main request is downloading
    if (seasonStatuses.some(status => status === SeasonStatus.DOWNLOADING)) {
      return RequestStatus.DOWNLOADING;
    }

    // If any season is found, main request is found
    if (seasonStatuses.some(status => status === SeasonStatus.FOUND)) {
      return RequestStatus.FOUND;
    }

    // If any season is searching, main request is searching
    if (seasonStatuses.some(status => status === SeasonStatus.SEARCHING)) {
      return RequestStatus.SEARCHING;
    }

    // If all seasons failed, main request failed
    if (seasonStatuses.every(status => status === SeasonStatus.FAILED)) {
      return RequestStatus.FAILED;
    }

    // Default to pending
    return RequestStatus.PENDING;
  }

  /**
   * Calculate status for ongoing TV shows
   * The status should be the status of the latest season that is not completed
   */
  private calculateOngoingShowStatus(seasons: Array<{ seasonNumber: number; status: SeasonStatus }>): RequestStatus {
    // Sort seasons by season number (latest first)
    const sortedSeasons = [...seasons].sort((a, b) => b.seasonNumber - a.seasonNumber);

    // Find the latest season that is not completed
    const latestIncompleteSeasonStatus = sortedSeasons.find(s => s.status !== SeasonStatus.COMPLETED)?.status;

    if (!latestIncompleteSeasonStatus) {
      // All seasons are completed, but since it's ongoing, we're still pending for new seasons
      return RequestStatus.PENDING;
    }

    // Map season status to request status
    switch (latestIncompleteSeasonStatus) {
      case SeasonStatus.PENDING:
        return RequestStatus.PENDING;
      case SeasonStatus.SEARCHING:
        return RequestStatus.SEARCHING;
      case SeasonStatus.FOUND:
        return RequestStatus.FOUND;
      case SeasonStatus.DOWNLOADING:
        return RequestStatus.DOWNLOADING;
      case SeasonStatus.COMPLETED:
        return RequestStatus.PENDING; // Ready for next season
      case SeasonStatus.FAILED:
        return RequestStatus.FAILED;
      default:
        return RequestStatus.PENDING;
    }
  }

  /**
   * Handle season pack download completion
   * When a season pack is downloaded, all episodes in that season should be marked as completed
   */
  markSeasonPackCompleted(seasonId: string, episodes: Array<{ id: string; episodeNumber: number }>): Array<{ episodeId: string; newStatus: EpisodeStatus }> {
    return episodes.map(episode => ({
      episodeId: episode.id,
      newStatus: EpisodeStatus.COMPLETED,
    }));
  }

  /**
   * Handle individual episode download completion
   */
  markEpisodeCompleted(episodeId: string): Array<{ episodeId: string; newStatus: EpisodeStatus }> {
    return [{
      episodeId,
      newStatus: EpisodeStatus.COMPLETED,
    }];
  }

  /**
   * Handle season pack download failure
   */
  markSeasonPackFailed(seasonId: string, episodes: Array<{ id: string; episodeNumber: number }>): Array<{ episodeId: string; newStatus: EpisodeStatus }> {
    return episodes.map(episode => ({
      episodeId: episode.id,
      newStatus: EpisodeStatus.FAILED,
    }));
  }

  /**
   * Handle individual episode download failure
   */
  markEpisodeFailed(episodeId: string): Array<{ episodeId: string; newStatus: EpisodeStatus }> {
    return [{
      episodeId,
      newStatus: EpisodeStatus.FAILED,
    }];
  }

  /**
   * Determine if a TV show request needs new episodes/seasons to be searched
   * This is used for ongoing shows to automatically search for new content
   */
  needsNewContentSearch(context: TvShowStateContext, latestAvailableSeason?: number): boolean {
    const { seasons, isOngoing } = context;

    if (!isOngoing) {
      return false;
    }

    if (!latestAvailableSeason) {
      return false;
    }

    // Check if we have all available seasons
    const maxRequestedSeason = Math.max(...seasons.map(s => s.seasonNumber));
    
    return latestAvailableSeason > maxRequestedSeason;
  }
}
