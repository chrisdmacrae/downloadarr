import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TorrentSearchLog } from '../../../generated/prisma';

export interface CreateSearchLogDto {
  requestedTorrentId: string;
  searchQuery: string;
  indexersSearched: string[];
  resultsFound: number;
  bestResultTitle?: string;
  bestResultSeeders?: number;
  searchDurationMs: number;
}

@Injectable()
export class TorrentSearchLogService {
  private readonly logger = new Logger(TorrentSearchLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logSearch(dto: CreateSearchLogDto): Promise<TorrentSearchLog> {
    try {
      return await this.prisma.torrentSearchLog.create({
        data: {
          requestedTorrentId: dto.requestedTorrentId,
          searchQuery: dto.searchQuery,
          indexersSearched: dto.indexersSearched,
          resultsFound: dto.resultsFound,
          bestResultTitle: dto.bestResultTitle,
          bestResultSeeders: dto.bestResultSeeders,
          searchDurationMs: dto.searchDurationMs,
        },
      });
    } catch (error) {
      this.logger.error('Error logging torrent search:', error);
      throw error;
    }
  }

  async getSearchLogsForRequest(requestedTorrentId: string, limit = 20): Promise<TorrentSearchLog[]> {
    return this.prisma.torrentSearchLog.findMany({
      where: { requestedTorrentId },
      orderBy: { searchedAt: 'desc' },
      take: limit,
    });
  }

  async getRecentSearchLogs(limit = 50): Promise<TorrentSearchLog[]> {
    return this.prisma.torrentSearchLog.findMany({
      orderBy: { searchedAt: 'desc' },
      take: limit,
      include: {
        requestedTorrent: {
          select: {
            title: true,
            contentType: true,
            status: true,
          },
        },
      },
    });
  }

  async getSearchStats(requestedTorrentId?: string): Promise<{
    totalSearches: number;
    averageResultsFound: number;
    averageSearchDuration: number;
    successRate: number;
    lastSearchAt?: Date;
  }> {
    const where = requestedTorrentId ? { requestedTorrentId } : {};

    const logs = await this.prisma.torrentSearchLog.findMany({
      where,
      select: {
        resultsFound: true,
        searchDurationMs: true,
        searchedAt: true,
      },
    });

    if (logs.length === 0) {
      return {
        totalSearches: 0,
        averageResultsFound: 0,
        averageSearchDuration: 0,
        successRate: 0,
      };
    }

    const totalSearches = logs.length;
    const totalResults = logs.reduce((sum, log) => sum + log.resultsFound, 0);
    const totalDuration = logs.reduce((sum, log) => sum + log.searchDurationMs, 0);
    const successfulSearches = logs.filter(log => log.resultsFound > 0).length;

    return {
      totalSearches,
      averageResultsFound: Math.round((totalResults / totalSearches) * 100) / 100,
      averageSearchDuration: Math.round(totalDuration / totalSearches),
      successRate: Math.round((successfulSearches / totalSearches) * 100),
      lastSearchAt: logs[0]?.searchedAt,
    };
  }

  async cleanupOldLogs(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.torrentSearchLog.deleteMany({
      where: {
        searchedAt: {
          lt: cutoffDate,
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} old search logs`);
    }

    return result.count;
  }
}
