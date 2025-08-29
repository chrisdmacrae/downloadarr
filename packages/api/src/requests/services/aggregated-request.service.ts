import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RequestedTorrentsService } from '../../torrents/services/requested-torrents.service';
import { HttpDownloadRequestService } from '../../http-downloads/services/http-download-request.service';
import { ContentType, RequestStatus, HttpDownloadRequestStatus } from '../../../generated/prisma';

export interface AggregatedRequest {
  id: string;
  type: 'torrent' | 'http';
  contentType: ContentType | null;
  title: string | null;
  year: number | null;
  status: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  // Additional fields for display
  url?: string; // For HTTP requests
  filename?: string; // For HTTP requests
  foundTorrentTitle?: string; // For torrent requests
  downloadJobId?: string;
  aria2Gid?: string;
  // Metadata fields
  imdbId?: string;
  tmdbId?: number;
  igdbId?: number;
  platform?: string;
  season?: number;
  episode?: number;
}

export interface AggregatedRequestQuery {
  status?: string;
  contentType?: ContentType;
  userId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class AggregatedRequestService {
  private readonly logger = new Logger(AggregatedRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly torrentRequestService: RequestedTorrentsService,
    private readonly httpRequestService: HttpDownloadRequestService,
  ) {}

  async findAll(query: AggregatedRequestQuery): Promise<{
    requests: AggregatedRequest[];
    total: number;
  }> {
    const {
      status,
      contentType,
      userId,
      search,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build where conditions for both request types
    const torrentWhere: any = {};
    const httpWhere: any = {};

    if (contentType) {
      torrentWhere.contentType = contentType;
      httpWhere.contentType = contentType;
    }

    if (userId) {
      torrentWhere.userId = userId;
      httpWhere.userId = userId;
    }

    if (status) {
      // Map status for both request types
      if (this.isTorrentStatus(status)) {
        torrentWhere.status = status;
      }
      if (this.isHttpStatus(status)) {
        httpWhere.status = status;
      }
    }

    if (search) {
      torrentWhere.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { foundTorrentTitle: { contains: search, mode: 'insensitive' } },
      ];
      httpWhere.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { filename: { contains: search, mode: 'insensitive' } },
        { url: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch both types of requests
    const [torrentRequests, httpRequests, torrentTotal, httpTotal] = await Promise.all([
      this.prisma.requestedTorrent.findMany({
        where: torrentWhere,
        orderBy: { [sortBy]: sortOrder },
        take: limit * 2, // Get more to ensure we have enough after merging
        skip: 0, // We'll handle pagination after merging
      }),
      this.prisma.httpDownloadRequest.findMany({
        where: httpWhere,
        orderBy: { [sortBy]: sortOrder },
        take: limit * 2, // Get more to ensure we have enough after merging
        skip: 0, // We'll handle pagination after merging
      }),
      this.prisma.requestedTorrent.count({ where: torrentWhere }),
      this.prisma.httpDownloadRequest.count({ where: httpWhere }),
    ]);

    // Convert to aggregated format
    const aggregatedTorrentRequests: AggregatedRequest[] = torrentRequests.map(req => ({
      id: req.id,
      type: 'torrent' as const,
      contentType: req.contentType,
      title: req.title,
      year: req.year,
      status: req.status,
      priority: req.priority,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      foundTorrentTitle: req.foundTorrentTitle,
      downloadJobId: req.downloadJobId,
      aria2Gid: req.aria2Gid,
      imdbId: req.imdbId,
      tmdbId: req.tmdbId,
      igdbId: req.igdbId,
      platform: req.platform,
      season: req.season,
      episode: req.episode,
    }));

    const aggregatedHttpRequests: AggregatedRequest[] = httpRequests.map(req => ({
      id: req.id,
      type: 'http' as const,
      contentType: req.contentType,
      title: req.title,
      year: req.year,
      status: req.status,
      priority: req.priority,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      url: req.url,
      filename: req.filename,
      downloadJobId: req.downloadJobId,
      aria2Gid: req.aria2Gid,
      imdbId: req.imdbId,
      tmdbId: req.tmdbId,
      igdbId: req.igdbId,
      platform: req.platform,
      season: req.season,
      episode: req.episode,
    }));

    // Merge and sort all requests
    const allRequests = [...aggregatedTorrentRequests, ...aggregatedHttpRequests];
    
    // Sort the merged results
    allRequests.sort((a, b) => {
      const aValue = a[sortBy as keyof AggregatedRequest];
      const bValue = b[sortBy as keyof AggregatedRequest];
      
      if (sortOrder === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });

    // Apply pagination to merged results
    const paginatedRequests = allRequests.slice(offset, offset + limit);
    const total = torrentTotal + httpTotal;

    return {
      requests: paginatedRequests,
      total,
    };
  }

  async findOne(id: string, type: 'torrent' | 'http'): Promise<AggregatedRequest | null> {
    if (type === 'torrent') {
      try {
        // Use prisma directly since RequestedTorrentsService doesn't have findOne method
        const req = await this.prisma.requestedTorrent.findUnique({
          where: { id },
        });

        if (!req) return null;
        return {
          id: req.id,
          type: 'torrent' as const,
          contentType: req.contentType,
          title: req.title,
          year: req.year,
          status: req.status,
          priority: req.priority,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
          foundTorrentTitle: req.foundTorrentTitle,
          downloadJobId: req.downloadJobId,
          aria2Gid: req.aria2Gid,
          imdbId: req.imdbId,
          tmdbId: req.tmdbId,
          igdbId: req.igdbId,
          platform: req.platform,
          season: req.season,
          episode: req.episode,
        };
      } catch (error) {
        return null;
      }
    } else {
      try {
        const req = await this.httpRequestService.findOne(id);
        return {
          id: req.id,
          type: 'http' as const,
          contentType: req.contentType,
          title: req.title,
          year: req.year,
          status: req.status,
          priority: req.priority,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
          url: req.url,
          filename: req.filename,
          downloadJobId: req.downloadJobId,
          aria2Gid: req.aria2Gid,
          imdbId: req.imdbId,
          tmdbId: req.tmdbId,
          igdbId: req.igdbId,
          platform: req.platform,
          season: req.season,
          episode: req.episode,
        };
      } catch (error) {
        return null;
      }
    }
  }

  private isTorrentStatus(status: string): status is RequestStatus {
    return Object.values(RequestStatus).includes(status as RequestStatus);
  }

  private isHttpStatus(status: string): status is HttpDownloadRequestStatus {
    return Object.values(HttpDownloadRequestStatus).includes(status as HttpDownloadRequestStatus);
  }

  async getStatusCounts(): Promise<{
    torrent: Record<string, number>;
    http: Record<string, number>;
    total: Record<string, number>;
  }> {
    const [torrentCounts, httpCounts] = await Promise.all([
      this.prisma.requestedTorrent.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.httpDownloadRequest.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    const torrentStatusCounts: Record<string, number> = {};
    const httpStatusCounts: Record<string, number> = {};
    const totalStatusCounts: Record<string, number> = {};

    // Process torrent counts
    torrentCounts.forEach(({ status, _count }) => {
      torrentStatusCounts[status] = _count.status;
      totalStatusCounts[status] = (totalStatusCounts[status] || 0) + _count.status;
    });

    // Process HTTP counts
    httpCounts.forEach(({ status, _count }) => {
      httpStatusCounts[status] = _count.status;
      totalStatusCounts[status] = (totalStatusCounts[status] || 0) + _count.status;
    });

    return {
      torrent: torrentStatusCounts,
      http: httpStatusCounts,
      total: totalStatusCounts,
    };
  }
}
