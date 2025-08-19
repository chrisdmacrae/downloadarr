import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ContentType, RequestStatus, TorrentQuality, TorrentFormat, RequestedTorrent } from '../../../generated/prisma';
import { CreateTorrentRequestDto, UpdateTorrentRequestDto } from '../dto/torrent-request.dto';
import { DownloadService } from '../../download/download.service';

@Injectable()
export class RequestedTorrentsService {
  private readonly logger = new Logger(RequestedTorrentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DownloadService))
    private readonly downloadService: DownloadService,
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
    this.logger.log(`Creating TV show torrent request for: ${dto.title} S${dto.season}${dto.episode ? `E${dto.episode}` : ''}`);

    // Check for existing requests to prevent duplicates
    const existingRequest = await this.findExistingTvShowRequest(dto);
    if (existingRequest) {
      this.logger.warn(`Duplicate TV show request detected for: ${dto.title} S${dto.season}${dto.episode ? `E${dto.episode}` : ''}. Existing request ID: ${existingRequest.id}`);
      throw new Error(`A request for "${dto.title}" S${dto.season}${dto.episode ? `E${dto.episode}` : ''} already exists with status: ${existingRequest.status}`);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Expire after 30 days

    const nextSearchAt = new Date();
    nextSearchAt.setMinutes(nextSearchAt.getMinutes() + 1); // Start searching in 1 minute

    return this.prisma.requestedTorrent.create({
      data: {
        contentType: ContentType.TV_SHOW,
        title: dto.title,
        year: dto.year,
        season: dto.season,
        episode: dto.episode,
        imdbId: dto.imdbId,
        tmdbId: dto.tmdbId,
        preferredQualities: dto.preferredQualities || [TorrentQuality.HD_1080P],
        preferredFormats: dto.preferredFormats || [TorrentFormat.X265],
        minSeeders: dto.minSeeders || 5,
        maxSizeGB: dto.maxSizeGB || 15, // Smaller default for TV shows
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
    
    return this.prisma.requestedTorrent.findMany({
      where: {
        status: {
          in: [RequestStatus.PENDING, RequestStatus.SEARCHING],
        },
        nextSearchAt: {
          lte: now,
        },
        searchAttempts: {
          lt: this.prisma.requestedTorrent.fields.maxSearchAttempts,
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
  }

  async updateRequest(id: string, dto: UpdateTorrentRequestDto): Promise<RequestedTorrent> {
    const request = await this.getRequestById(id);
    
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
    this.logger.log(`Updating torrent request ${id} status to: ${status}`);

    const updateData: any = {
      status,
      updatedAt: new Date(),
      ...additionalData,
    };

    // Set completion timestamp for completed status
    if (status === RequestStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    return this.prisma.requestedTorrent.update({
      where: { id },
      data: updateData,
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

    return this.updateRequestStatus(id, RequestStatus.FOUND, {
      foundTorrentTitle: torrentInfo.title,
      foundTorrentLink: torrentInfo.link,
      foundMagnetUri: torrentInfo.magnetUri,
      foundTorrentSize: torrentInfo.size,
      foundSeeders: torrentInfo.seeders,
      foundIndexer: torrentInfo.indexer,
    });
  }

  async markAsDownloading(id: string, downloadJobId: string, aria2Gid?: string): Promise<RequestedTorrent> {
    this.logger.log(`Marking torrent request ${id} as downloading with job ID: ${downloadJobId}`);

    return this.updateRequestStatus(id, RequestStatus.DOWNLOADING, {
      downloadJobId,
      aria2Gid,
    });
  }

  async updateDownloadProgress(id: string, progress: number, speed?: string, eta?: string): Promise<RequestedTorrent> {
    return this.prisma.requestedTorrent.update({
      where: { id },
      data: {
        downloadProgress: progress,
        downloadSpeed: speed,
        downloadEta: eta,
        updatedAt: new Date(),
      },
    });
  }

  async incrementSearchAttempt(id: string): Promise<RequestedTorrent> {
    const request = await this.getRequestById(id);
    const nextSearchAt = new Date();
    nextSearchAt.setMinutes(nextSearchAt.getMinutes() + request.searchIntervalMins);

    return this.prisma.requestedTorrent.update({
      where: { id },
      data: {
        searchAttempts: request.searchAttempts + 1,
        lastSearchAt: new Date(),
        nextSearchAt,
        status: RequestStatus.SEARCHING,
        updatedAt: new Date(),
      },
    });
  }

  async cancelRequest(id: string): Promise<RequestedTorrent> {
    this.logger.log(`Cancelling torrent request ${id}`);
    return this.updateRequestStatus(id, RequestStatus.CANCELLED);
  }

  async deleteRequest(id: string): Promise<void> {
    this.logger.log(`Deleting torrent request ${id}`);

    // Get the request to check if it has an active download
    const request = await this.getRequestById(id);

    // If the request has an active download, cancel it first
    if (request.status === RequestStatus.DOWNLOADING && request.downloadJobId) {
      this.logger.log(`Cancelling active download ${request.downloadJobId} for request ${id}`);

      try {
        await this.downloadService.cancelDownload(request.downloadJobId);
        this.logger.log(`Successfully cancelled download ${request.downloadJobId}`);
      } catch (error) {
        this.logger.warn(`Failed to cancel download ${request.downloadJobId}: ${error.message}`);
        // Continue with deletion even if download cancellation fails
      }
    }

    // Delete the torrent request
    await this.prisma.requestedTorrent.delete({
      where: { id },
    });

    this.logger.log(`Successfully deleted torrent request ${id}`);
  }

  async cleanupExpiredRequests(): Promise<number> {
    const result = await this.prisma.requestedTorrent.updateMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        status: {
          in: [RequestStatus.PENDING, RequestStatus.SEARCHING],
        },
      },
      data: {
        status: RequestStatus.EXPIRED,
        updatedAt: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} torrent requests as expired`);
    }

    return result.count;
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

    // Build base where clause (no user filtering - prevent all duplicates globally)
    const baseWhere = {
      contentType: ContentType.TV_SHOW,
      status: { notIn: excludedStatuses },
      season: dto.season,
      episode: dto.episode,
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
}
