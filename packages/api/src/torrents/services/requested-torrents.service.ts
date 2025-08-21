import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ContentType, RequestStatus, TorrentQuality, TorrentFormat, RequestedTorrent } from '../../../generated/prisma';
import { CreateTorrentRequestDto, UpdateTorrentRequestDto } from '../dto/torrent-request.dto';
import { TvShowSeasonQueryDto, TvShowEpisodeQueryDto } from '../dto/tv-show-season.dto';
import { TvShowMetadataService } from './tv-show-metadata.service';
import { RequestLifecycleOrchestrator } from './request-lifecycle-orchestrator.service';
import { Aria2Service } from '../../download/aria2.service';

@Injectable()
export class RequestedTorrentsService {
  private readonly logger = new Logger(RequestedTorrentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tvShowMetadataService: TvShowMetadataService,
    private readonly aria2Service: Aria2Service,
    @Inject(forwardRef(() => RequestLifecycleOrchestrator))
    private readonly orchestrator: RequestLifecycleOrchestrator,
  ) {}

  async createMovieRequest(dto: CreateTorrentRequestDto): Promise<RequestedTorrent> {
    this.logger.log(`Creating movie torrent request for: ${dto.title} (${dto.year})`);

    // Check for existing requests to prevent duplicates
    const existingRequest = await this.findExistingMovieRequest(dto);
    if (existingRequest) {
      this.logger.warn(`Duplicate movie request detected for: ${dto.title} (${dto.year}). Existing request ID: ${existingRequest.id}`);
      throw new Error(`A request for "${dto.title}" (${dto.year}) already exists with status: ${existingRequest.status}`);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Expire after 30 days

    const nextSearchAt = new Date();
    nextSearchAt.setMinutes(nextSearchAt.getMinutes() + 1); // Start searching in 1 minute

    return this.prisma.requestedTorrent.create({
      data: {
        contentType: ContentType.MOVIE,
        title: dto.title,
        year: dto.year,
        imdbId: dto.imdbId,
        tmdbId: dto.tmdbId,
        preferredQualities: dto.preferredQualities || [TorrentQuality.HD_1080P],
        preferredFormats: dto.preferredFormats || [TorrentFormat.X265],
        minSeeders: dto.minSeeders || 5,
        maxSizeGB: dto.maxSizeGB || 20,
        blacklistedWords: dto.blacklistedWords || [],
        trustedIndexers: dto.trustedIndexers || [],
        searchIntervalMins: dto.searchIntervalMins || 30,
        maxSearchAttempts: dto.maxSearchAttempts || 50,
        priority: dto.priority || 5,
        expiresAt,
        nextSearchAt,
        userId: dto.userId,
      },
    });
  }

  async createTvShowRequest(dto: CreateTorrentRequestDto): Promise<RequestedTorrent> {
    const isOngoing = dto.isOngoing === true;
    const logMessage = isOngoing
      ? `Creating ongoing TV show request for: ${dto.title}`
      : `Creating TV show torrent request for: ${dto.title} S${dto.season}${dto.episode ? `E${dto.episode}` : ''}`;

    this.logger.log(logMessage);

    // Check for existing requests to prevent duplicates
    const existingRequest = await this.findExistingTvShowRequest(dto);
    if (existingRequest) {
      const existingMessage = isOngoing
        ? `Duplicate ongoing TV show request detected for: ${dto.title}. Existing request ID: ${existingRequest.id}`
        : `Duplicate TV show request detected for: ${dto.title} S${dto.season}${dto.episode ? `E${dto.episode}` : ''}. Existing request ID: ${existingRequest.id}`;

      this.logger.warn(existingMessage);

      const errorMessage = isOngoing
        ? `An ongoing request for "${dto.title}" already exists with status: ${existingRequest.status}`
        : `A request for "${dto.title}" S${dto.season}${dto.episode ? `E${dto.episode}` : ''} already exists with status: ${existingRequest.status}`;

      throw new Error(errorMessage);
    }

    const expiresAt = new Date();
    // Ongoing requests expire after 1 year, regular requests after 30 days
    expiresAt.setDate(expiresAt.getDate() + (isOngoing ? 365 : 30));

    const nextSearchAt = new Date();
    nextSearchAt.setMinutes(nextSearchAt.getMinutes() + 1); // Start searching in 1 minute

    const request = await this.prisma.requestedTorrent.create({
      data: {
        contentType: ContentType.TV_SHOW,
        title: dto.title,
        year: dto.year,
        season: dto.season,
        episode: dto.episode,
        isOngoing: isOngoing,
        totalSeasons: dto.totalSeasons,
        totalEpisodes: dto.totalEpisodes,
        imdbId: dto.imdbId,
        tmdbId: dto.tmdbId,
        preferredQualities: dto.preferredQualities || [TorrentQuality.HD_1080P],
        preferredFormats: dto.preferredFormats || [TorrentFormat.X265],
        minSeeders: dto.minSeeders || 5,
        maxSizeGB: dto.maxSizeGB || 15, // Smaller default for TV shows
        blacklistedWords: dto.blacklistedWords || [],
        trustedIndexers: dto.trustedIndexers || [],
        searchIntervalMins: dto.searchIntervalMins || 30,
        maxSearchAttempts: isOngoing ? 1000 : (dto.maxSearchAttempts || 50), // More attempts for ongoing shows
        priority: dto.priority || 5,
        expiresAt,
        nextSearchAt,
        userId: dto.userId,
      },
    });

    // Populate season/episode metadata for all TV shows with TMDB ID
    if (dto.tmdbId) {
      // Run metadata population in the background to avoid blocking the request
      setImmediate(() => {
        this.tvShowMetadataService.populateSeasonData(request.id).catch(error => {
          this.logger.error(`Failed to populate metadata for request ${request.id}: ${error.message}`);
        });
      });
    }

    return request;
  }

  async createGameRequest(dto: CreateTorrentRequestDto): Promise<RequestedTorrent> {
    this.logger.log(`Creating game torrent request for: ${dto.title} (Platform: "${dto.platform || 'None specified'}")`);
    this.logger.debug(`Game request DTO:`, { title: dto.title, platform: dto.platform, igdbId: dto.igdbId, genre: dto.genre });

    // Check for existing requests to prevent duplicates
    const existingRequest = await this.findExistingGameRequest(dto);
    if (existingRequest) {
      this.logger.warn(`Duplicate game request detected for: ${dto.title} (${dto.platform || 'Unknown Platform'}). Existing request ID: ${existingRequest.id}`);
      throw new Error(`A request for "${dto.title}" (${dto.platform || 'Unknown Platform'}) already exists with status: ${existingRequest.status}`);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Expire after 30 days

    const nextSearchAt = new Date();
    nextSearchAt.setMinutes(nextSearchAt.getMinutes() + 1); // Start searching in 1 minute

    return this.prisma.requestedTorrent.create({
      data: {
        contentType: ContentType.GAME,
        title: dto.title,
        year: dto.year,
        igdbId: dto.igdbId,
        platform: dto.platform,
        genre: dto.genre,
        preferredQualities: dto.preferredQualities || [TorrentQuality.HD_1080P],
        preferredFormats: dto.preferredFormats || [TorrentFormat.X265],
        minSeeders: dto.minSeeders || 5,
        maxSizeGB: dto.maxSizeGB || 50, // Larger default for games
        blacklistedWords: dto.blacklistedWords || [],
        trustedIndexers: dto.trustedIndexers || [],
        searchIntervalMins: dto.searchIntervalMins || 30,
        maxSearchAttempts: dto.maxSearchAttempts || 50,
        priority: dto.priority || 5,
        expiresAt,
        nextSearchAt,
        userId: dto.userId,
      },
    });
  }

  async getRequestById(id: string): Promise<RequestedTorrent> {
    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id },
      include: {
        searchLogs: {
          orderBy: { searchedAt: 'desc' },
          take: 10, // Last 10 search attempts
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Torrent request with ID ${id} not found`);
    }

    return request;
  }

  async getAllRequests(userId?: string): Promise<RequestedTorrent[]> {
    return this.prisma.requestedTorrent.findMany({
      where: userId ? { userId } : {},
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        searchLogs: {
          orderBy: { searchedAt: 'desc' },
          take: 1, // Just the latest search log
        },
        // Include TV show seasons for ongoing TV show requests
        tvShowSeasons: {
          include: {
            episodes: true,
            torrentDownloads: true,
          },
          orderBy: {
            seasonNumber: 'asc',
          },
        },
        torrentDownloads: true,
      },
    });
  }

  async getRequestsByStatus(status: RequestStatus, userId?: string): Promise<RequestedTorrent[]> {
    return this.prisma.requestedTorrent.findMany({
      where: {
        status,
        ...(userId && { userId }),
      },
      orderBy: [
        { priority: 'desc' },
        { nextSearchAt: 'asc' },
      ],
      include: {
        searchLogs: {
          orderBy: { searchedAt: 'desc' },
          take: 1, // Just the latest search log
        },
        // Include TV show seasons for ongoing TV show requests
        tvShowSeasons: {
          include: {
            episodes: true,
            torrentDownloads: true,
          },
          orderBy: {
            seasonNumber: 'asc',
          },
        },
        torrentDownloads: true,
      },
    });
  }

  async getRequestsByStatuses(statuses: RequestStatus[], userId?: string): Promise<RequestedTorrent[]> {
    return this.prisma.requestedTorrent.findMany({
      where: {
        status: {
          in: statuses,
        },
        ...(userId && { userId }),
      },
      orderBy: [
        { priority: 'desc' },
        { nextSearchAt: 'asc' },
      ],
    });
  }

  async getRequestsReadyForSearch(): Promise<RequestedTorrent[]> {
    const now = new Date();

    // Get all requests that might be ready for search
    const candidates = await this.prisma.requestedTorrent.findMany({
      where: {
        status: {
          in: [RequestStatus.PENDING, RequestStatus.SEARCHING],
        },
        nextSearchAt: {
          lte: now,
        },
        expiresAt: {
          gt: now,
        },
      },
      orderBy: [
        { priority: 'desc' },
        { nextSearchAt: 'asc' },
      ],
    });

    // Filter out requests that have exceeded their max search attempts
    return candidates.filter(request => request.searchAttempts < request.maxSearchAttempts);
  }

  async updateRequest(id: string, dto: UpdateTorrentRequestDto): Promise<RequestedTorrent> {
    const request = await this.getRequestById(id);

    // Only allow updates for requests that haven't started searching yet
    if (request.status !== RequestStatus.PENDING) {
      throw new Error(`Cannot update request in ${request.status} status. Only PENDING requests can be edited.`);
    }

    this.logger.log(`Updating torrent request ${id}: ${JSON.stringify(dto)}`);

    return this.prisma.requestedTorrent.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });
  }

  async updateRequestStatus(id: string, status: RequestStatus, additionalData?: Partial<RequestedTorrent>): Promise<RequestedTorrent> {
    this.logger.log(`Updating torrent request ${id} status to: ${status} (via orchestrator)`);

    return this.orchestrator.transitionRequest({
      requestId: id,
      targetStatus: status,
      metadata: additionalData,
    });
  }

  async markAsFound(id: string, torrentInfo: {
    title: string;
    link: string;
    magnetUri?: string;
    size: string;
    seeders: number;
    indexer: string;
  }): Promise<RequestedTorrent> {
    this.logger.log(`Marking torrent request ${id} as found: ${torrentInfo.title}`);

    return this.orchestrator.markAsFound(id, torrentInfo);
  }

  async markAsDownloading(id: string, downloadJobId: string, aria2Gid?: string): Promise<RequestedTorrent> {
    this.logger.log(`Marking torrent request ${id} as downloading with job ID: ${downloadJobId}`);

    return this.orchestrator.startDownload(id, {
      downloadJobId,
      aria2Gid: aria2Gid || '',
      torrentInfo: {
        title: 'Unknown',
        link: '',
        size: '0',
        seeders: 0,
        indexer: 'Unknown',
      },
    });
  }

  async incrementSearchAttempt(id: string): Promise<RequestedTorrent> {
    this.logger.log(`Starting search for request ${id}`);
    return this.orchestrator.startSearch(id);
  }

  async cancelRequest(id: string): Promise<RequestedTorrent> {
    this.logger.log(`Cancelling torrent request ${id}`);
    return this.orchestrator.cancelRequest(id);
  }

  async deleteRequest(id: string): Promise<void> {
    this.logger.log(`Deleting torrent request ${id}`);

    // Get the request to check if it has an active download
    const request = await this.getRequestById(id);

    // If the request has an active download, cancel it first via orchestrator
    if (request.status === RequestStatus.DOWNLOADING) {
      this.logger.log(`Cancelling active download for request ${id}`);
      try {
        await this.orchestrator.cancelRequest(id);
        this.logger.log(`Successfully cancelled download for request ${id}`);
      } catch (error) {
        this.logger.warn(`Failed to cancel download for request ${id}: ${error.message}`);
        // Continue with deletion even if cancellation fails
      }
    }

    // Delete the torrent request
    await this.prisma.requestedTorrent.delete({
      where: { id },
    });

    this.logger.log(`Successfully deleted torrent request ${id}`);
  }

  async cleanupExpiredRequests(): Promise<number> {
    // Get expired requests and mark them via orchestrator
    const expiredRequests = await this.prisma.requestedTorrent.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        status: {
          in: [RequestStatus.PENDING, RequestStatus.SEARCHING],
        },
      },
    });

    let count = 0;
    for (const request of expiredRequests) {
      try {
        await this.orchestrator.markAsExpired(request.id);
        count++;
      } catch (error) {
        this.logger.error(`Failed to mark request ${request.id} as expired:`, error);
      }
    }

    if (count > 0) {
      this.logger.log(`Marked ${count} torrent requests as expired`);
    }

    return count;
  }

  async getRequestStats(userId?: string): Promise<{
    total: number;
    pending: number;
    searching: number;
    found: number;
    downloading: number;
    completed: number;
    failed: number;
    cancelled: number;
    expired: number;
  }> {
    const where = userId ? { userId } : {};

    const [
      total,
      pending,
      searching,
      found,
      downloading,
      completed,
      failed,
      cancelled,
      expired,
    ] = await Promise.all([
      this.prisma.requestedTorrent.count({ where }),
      this.prisma.requestedTorrent.count({ where: { ...where, status: RequestStatus.PENDING } }),
      this.prisma.requestedTorrent.count({ where: { ...where, status: RequestStatus.SEARCHING } }),
      this.prisma.requestedTorrent.count({ where: { ...where, status: RequestStatus.FOUND } }),
      this.prisma.requestedTorrent.count({ where: { ...where, status: RequestStatus.DOWNLOADING } }),
      this.prisma.requestedTorrent.count({ where: { ...where, status: RequestStatus.COMPLETED } }),
      this.prisma.requestedTorrent.count({ where: { ...where, status: RequestStatus.FAILED } }),
      this.prisma.requestedTorrent.count({ where: { ...where, status: RequestStatus.CANCELLED } }),
      this.prisma.requestedTorrent.count({ where: { ...where, status: RequestStatus.EXPIRED } }),
    ]);

    return {
      total,
      pending,
      searching,
      found,
      downloading,
      completed,
      failed,
      cancelled,
      expired,
    };
  }

  /**
   * Find existing movie request to prevent duplicates
   */
  private async findExistingMovieRequest(dto: CreateTorrentRequestDto): Promise<RequestedTorrent | null> {
    // Exclude cancelled, failed, and expired requests from duplicate check
    const excludedStatuses = [RequestStatus.CANCELLED, RequestStatus.FAILED, RequestStatus.EXPIRED];

    // Build base where clause (no user filtering - prevent all duplicates globally)
    const baseWhere = {
      contentType: ContentType.MOVIE,
      status: { notIn: excludedStatuses },
    };

    // First, try to find by IMDB ID if provided (most accurate)
    if (dto.imdbId) {
      const existingByImdb = await this.prisma.requestedTorrent.findFirst({
        where: {
          ...baseWhere,
          imdbId: dto.imdbId,
        },
      });
      if (existingByImdb) return existingByImdb;
    }

    // Then try by TMDB ID if provided
    if (dto.tmdbId) {
      const existingByTmdb = await this.prisma.requestedTorrent.findFirst({
        where: {
          ...baseWhere,
          tmdbId: dto.tmdbId,
        },
      });
      if (existingByTmdb) return existingByTmdb;
    }

    // Finally, try by title and year (less accurate but catches most duplicates)
    if (dto.title && dto.year) {
      const existingByTitleYear = await this.prisma.requestedTorrent.findFirst({
        where: {
          ...baseWhere,
          title: { equals: dto.title, mode: 'insensitive' },
          year: dto.year,
        },
      });
      if (existingByTitleYear) return existingByTitleYear;
    }

    return null;
  }

  /**
   * Find existing TV show request to prevent duplicates
   */
  private async findExistingTvShowRequest(dto: CreateTorrentRequestDto): Promise<RequestedTorrent | null> {
    // Exclude cancelled, failed, and expired requests from duplicate check
    const excludedStatuses = [RequestStatus.CANCELLED, RequestStatus.FAILED, RequestStatus.EXPIRED];

    const isOngoing = dto.isOngoing === true;

    // For ongoing requests, check for any existing ongoing request for the same show
    if (isOngoing) {
      const baseWhere = {
        contentType: ContentType.TV_SHOW,
        status: { notIn: excludedStatuses },
        isOngoing: true,
      };

      // First, try to find by IMDB ID if provided (most accurate)
      if (dto.imdbId) {
        const existingByImdb = await this.prisma.requestedTorrent.findFirst({
          where: {
            ...baseWhere,
            imdbId: dto.imdbId,
          },
        });
        if (existingByImdb) return existingByImdb;
      }

      // Then try by TMDB ID if provided
      if (dto.tmdbId) {
        const existingByTmdb = await this.prisma.requestedTorrent.findFirst({
          where: {
            ...baseWhere,
            tmdbId: dto.tmdbId,
          },
        });
        if (existingByTmdb) return existingByTmdb;
      }

      // Finally, try by title for ongoing requests
      if (dto.title) {
        const existingByTitle = await this.prisma.requestedTorrent.findFirst({
          where: {
            ...baseWhere,
            title: { equals: dto.title, mode: 'insensitive' },
          },
        });
        if (existingByTitle) return existingByTitle;
      }
    } else {
      // For specific season/episode requests, use the original logic
      const baseWhere = {
        contentType: ContentType.TV_SHOW,
        status: { notIn: excludedStatuses },
        season: dto.season,
        episode: dto.episode,
        isOngoing: { not: true }, // Exclude ongoing requests from specific episode checks
      };

      // First, try to find by IMDB ID if provided (most accurate)
      if (dto.imdbId) {
        const existingByImdb = await this.prisma.requestedTorrent.findFirst({
          where: {
            ...baseWhere,
            imdbId: dto.imdbId,
          },
        });
        if (existingByImdb) return existingByImdb;
      }

      // Then try by TMDB ID if provided
      if (dto.tmdbId) {
        const existingByTmdb = await this.prisma.requestedTorrent.findFirst({
          where: {
            ...baseWhere,
            tmdbId: dto.tmdbId,
          },
        });
        if (existingByTmdb) return existingByTmdb;
      }

      // Finally, try by title, season, and episode
      if (dto.title && dto.season) {
        const existingByTitleSeason = await this.prisma.requestedTorrent.findFirst({
          where: {
            ...baseWhere,
            title: { equals: dto.title, mode: 'insensitive' },
          },
        });
        if (existingByTitleSeason) return existingByTitleSeason;
      }
    }

    return null;
  }

  /**
   * Find existing game request to prevent duplicates
   */
  private async findExistingGameRequest(dto: CreateTorrentRequestDto): Promise<RequestedTorrent | null> {
    // Exclude cancelled, failed, and expired requests from duplicate check
    const excludedStatuses = [RequestStatus.CANCELLED, RequestStatus.FAILED, RequestStatus.EXPIRED];

    // Build base where clause (no user filtering - prevent all duplicates globally)
    const baseWhere = {
      contentType: ContentType.GAME,
      status: { notIn: excludedStatuses },
    };

    // First, try to find by IGDB ID if provided (most accurate)
    if (dto.igdbId) {
      const existingByIgdb = await this.prisma.requestedTorrent.findFirst({
        where: {
          ...baseWhere,
          igdbId: dto.igdbId,
        },
      });
      if (existingByIgdb) return existingByIgdb;
    }

    // Then try by title, platform, and year
    if (dto.title) {
      const existingByTitle = await this.prisma.requestedTorrent.findFirst({
        where: {
          ...baseWhere,
          title: { equals: dto.title, mode: 'insensitive' },
          platform: dto.platform || null,
          year: dto.year || null,
        },
      });
      if (existingByTitle) return existingByTitle;
    }

    return null;
  }

  // TV Show Season Management Methods

  async getTvShowSeasons(requestId: string, query: TvShowSeasonQueryDto) {
    this.logger.log(`Getting TV show seasons for request ${requestId}`);

    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Torrent request with ID ${requestId} not found`);
    }

    if (request.contentType !== ContentType.TV_SHOW) {
      throw new Error('Request is not for a TV show');
    }

    const includeEpisodes = query.includeEpisodes === true;
    const includeDownloads = query.includeDownloads === true;

    return this.prisma.tvShowSeason.findMany({
      where: {
        requestedTorrentId: requestId,
        ...(query.status && { status: query.status }),
      },
      include: {
        episodes: includeEpisodes ? {
          include: {
            torrentDownloads: includeDownloads,
          },
        } : false,
        torrentDownloads: includeDownloads,
      },
      orderBy: {
        seasonNumber: 'asc',
      },
    });
  }

  async getTvShowSeason(requestId: string, seasonNumber: number) {
    this.logger.log(`Getting TV show season ${seasonNumber} for request ${requestId}`);

    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Torrent request with ID ${requestId} not found`);
    }

    if (request.contentType !== ContentType.TV_SHOW) {
      throw new Error('Request is not for a TV show');
    }

    const season = await this.prisma.tvShowSeason.findUnique({
      where: {
        requestedTorrentId_seasonNumber: {
          requestedTorrentId: requestId,
          seasonNumber: seasonNumber,
        },
      },
      include: {
        episodes: {
          include: {
            torrentDownloads: true,
          },
          orderBy: {
            episodeNumber: 'asc',
          },
        },
        torrentDownloads: true,
      },
    });

    if (!season) {
      throw new NotFoundException(`Season ${seasonNumber} not found for request ${requestId}`);
    }

    // Populate real-time progress data from aria2 for torrent downloads
    const seasonWithProgress = await this.populateDownloadProgress(season);

    return seasonWithProgress;
  }

  async getTvShowEpisodes(requestId: string, seasonNumber: number, query: TvShowEpisodeQueryDto) {
    this.logger.log(`Getting TV show episodes for season ${seasonNumber} of request ${requestId}`);

    const season = await this.prisma.tvShowSeason.findUnique({
      where: {
        requestedTorrentId_seasonNumber: {
          requestedTorrentId: requestId,
          seasonNumber: seasonNumber,
        },
      },
    });

    if (!season) {
      throw new NotFoundException(`Season ${seasonNumber} not found for request ${requestId}`);
    }

    const includeDownloads = query.includeDownloads === true;

    return this.prisma.tvShowEpisode.findMany({
      where: {
        tvShowSeasonId: season.id,
        ...(query.status && { status: query.status }),
      },
      include: {
        torrentDownloads: includeDownloads,
      },
      orderBy: {
        episodeNumber: 'asc',
      },
    });
  }

  async getTorrentDownloads(requestId: string) {
    this.logger.log(`Getting torrent downloads for request ${requestId}`);

    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Torrent request with ID ${requestId} not found`);
    }

    const downloads = await this.prisma.torrentDownload.findMany({
      where: {
        requestedTorrentId: requestId,
      },
      include: {
        tvShowSeason: true,
        tvShowEpisode: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Return downloads without progress data - use DownloadAggregationService for live progress
    return downloads;
  }

  /**
   * Populate real-time download progress from aria2 for torrent downloads
   */
  private async populateDownloadProgress(season: any): Promise<any> {
    // Create a deep copy to avoid mutating the original object
    const seasonWithProgress = JSON.parse(JSON.stringify(season));

    // Helper function to populate progress for a single torrent download
    const populateProgress = async (download: any) => {
      if (download.aria2Gid && download.status === 'DOWNLOADING') {
        try {
          const aria2Status = await this.aria2Service.getStatus(download.aria2Gid);

          // Calculate progress
          const totalLength = parseInt(aria2Status.totalLength) || 0;
          const completedLength = parseInt(aria2Status.completedLength) || 0;
          const progress = totalLength > 0 ? Math.round((completedLength / totalLength) * 100) : 0;

          // Format download speed
          const downloadSpeed = parseInt(aria2Status.downloadSpeed) || 0;
          const speed = this.formatSpeed(downloadSpeed);

          // Calculate ETA
          const eta = this.calculateEta(totalLength, completedLength, downloadSpeed);

          // Add real-time progress data
          download.downloadProgress = progress;
          download.downloadSpeed = speed;
          download.downloadEta = eta;
        } catch (error) {
          this.logger.debug(`Failed to get aria2 status for GID ${download.aria2Gid}:`, error);
          // Keep existing values or set defaults
          download.downloadProgress = download.downloadProgress || 0;
          download.downloadSpeed = download.downloadSpeed || '0 B/s';
          download.downloadEta = download.downloadEta || 'Unknown';
        }
      }
    };

    // Populate progress for season-level torrent downloads
    if (seasonWithProgress.torrentDownloads) {
      await Promise.all(seasonWithProgress.torrentDownloads.map(populateProgress));
    }

    // Populate progress for episode-level torrent downloads
    if (seasonWithProgress.episodes) {
      for (const episode of seasonWithProgress.episodes) {
        if (episode.torrentDownloads) {
          await Promise.all(episode.torrentDownloads.map(populateProgress));
        }
      }
    }

    return seasonWithProgress;
  }

  /**
   * Format download speed in human-readable format
   */
  private formatSpeed(speedBytes: number): string {
    if (speedBytes === 0) return '0 B/s';

    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let speed = speedBytes;
    let unitIndex = 0;

    while (speed >= 1024 && unitIndex < units.length - 1) {
      speed /= 1024;
      unitIndex++;
    }

    return `${speed.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Calculate estimated time of arrival
   */
  private calculateEta(totalLength: number, completedLength: number, downloadSpeed: number): string {
    if (downloadSpeed === 0 || totalLength === 0) return 'Unknown';

    const remainingBytes = totalLength - completedLength;
    const etaSeconds = Math.round(remainingBytes / downloadSpeed);

    if (etaSeconds < 60) return `${etaSeconds}s`;
    if (etaSeconds < 3600) return `${Math.round(etaSeconds / 60)}m`;
    if (etaSeconds < 86400) return `${Math.round(etaSeconds / 3600)}h`;
    return `${Math.round(etaSeconds / 86400)}d`;
  }
}
