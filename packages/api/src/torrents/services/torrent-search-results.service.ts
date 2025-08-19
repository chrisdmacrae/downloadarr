import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TorrentSearchResult } from '../../../generated/prisma';
import { TorrentResult } from '../../discovery/interfaces/external-api.interface';

export interface TorrentSearchResultResponse extends Omit<TorrentSearchResult, 'sizeBytes'> {
  sizeBytes?: string | null;
}

export interface CreateSearchResultDto {
  requestedTorrentId: string;
  title: string;
  link: string;
  magnetUri?: string;
  size: string;
  sizeBytes?: bigint;
  seeders: number;
  leechers: number;
  category: string;
  indexer: string;
  publishDate: string;
  quality?: string;
  format?: string;
  rankingScore?: number;
  isAutoSelected?: boolean;
}

@Injectable()
export class TorrentSearchResultsService {
  private readonly logger = new Logger(TorrentSearchResultsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveSearchResults(
    requestedTorrentId: string,
    torrents: TorrentResult[],
    rankingScores: number[] = []
  ): Promise<TorrentSearchResult[]> {
    try {
      // Clear existing results for this request
      await this.clearSearchResults(requestedTorrentId);

      // Convert TorrentResult to Prisma create data with relation
      const searchResultsData = torrents.map((torrent, index) => ({
        title: torrent.title,
        link: torrent.link,
        magnetUri: torrent.magnetUri,
        size: torrent.size,
        sizeBytes: this.parseSizeToBytes(torrent.size),
        seeders: torrent.seeders,
        leechers: torrent.leechers,
        category: torrent.category,
        indexer: torrent.indexer,
        publishDate: torrent.publishDate,
        quality: torrent.quality,
        format: torrent.format,
        rankingScore: rankingScores[index] || 0,
        isAutoSelected: false,
        requestedTorrent: {
          connect: { id: requestedTorrentId }
        }
      }));

      // Save all results
      const results = await Promise.all(
        searchResultsData.map(data => 
          this.prisma.torrentSearchResult.create({ data })
        )
      );

      this.logger.log(`Saved ${results.length} search results for request ${requestedTorrentId}`);
      return results;
    } catch (error) {
      this.logger.error(`Error saving search results for request ${requestedTorrentId}:`, error);
      throw error;
    }
  }

  async getSearchResults(requestedTorrentId: string): Promise<TorrentSearchResultResponse[]> {
    const results = await this.prisma.torrentSearchResult.findMany({
      where: { requestedTorrentId },
      orderBy: [
        { rankingScore: 'desc' },
        { seeders: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    // Convert BigInt to string to avoid JSON serialization issues
    return results.map(result => ({
      ...result,
      sizeBytes: result.sizeBytes ? result.sizeBytes.toString() : null,
    }));
  }

  async selectTorrent(resultId: string): Promise<TorrentSearchResult> {
    // First, unselect any previously selected torrents for this request
    const result = await this.prisma.torrentSearchResult.findUnique({
      where: { id: resultId },
    });

    if (!result) {
      throw new Error(`Search result ${resultId} not found`);
    }

    // Unselect all other results for this request
    await this.prisma.torrentSearchResult.updateMany({
      where: { 
        requestedTorrentId: result.requestedTorrentId,
        id: { not: resultId }
      },
      data: { isSelected: false },
    });

    // Select this result
    return this.prisma.torrentSearchResult.update({
      where: { id: resultId },
      data: { isSelected: true },
    });
  }

  async markAsAutoSelected(resultId: string): Promise<TorrentSearchResult> {
    return this.prisma.torrentSearchResult.update({
      where: { id: resultId },
      data: { 
        isSelected: true,
        isAutoSelected: true 
      },
    });
  }

  async getSelectedResult(requestedTorrentId: string): Promise<TorrentSearchResult | null> {
    return this.prisma.torrentSearchResult.findFirst({
      where: { 
        requestedTorrentId,
        isSelected: true 
      },
    });
  }

  async clearSearchResults(requestedTorrentId: string): Promise<void> {
    await this.prisma.torrentSearchResult.deleteMany({
      where: { requestedTorrentId },
    });
  }

  async hasSearchResults(requestedTorrentId: string): Promise<boolean> {
    const count = await this.prisma.torrentSearchResult.count({
      where: { requestedTorrentId },
    });
    return count > 0;
  }

  private parseSizeToBytes(sizeString: string): bigint | undefined {
    try {
      const match = sizeString.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
      if (!match) return undefined;

      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();

      const multipliers = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024,
        'TB': 1024 * 1024 * 1024 * 1024,
      };

      const multiplier = multipliers[unit as keyof typeof multipliers];
      if (!multiplier) return undefined;

      return BigInt(Math.round(value * multiplier));
    } catch (error) {
      this.logger.warn(`Failed to parse size string: ${sizeString}`, error);
      return undefined;
    }
  }
}
