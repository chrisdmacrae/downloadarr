import { Injectable, Logger } from '@nestjs/common';
import { TorrentResult } from '../interfaces/external-api.interface';
import { TorrentQuality, TorrentFormat } from '../dto/torrent-search.dto';

export interface TorrentScore {
  torrent: TorrentResult;
  score: number;
  reasons: string[];
}

export interface FilterCriteria {
  minSeeders?: number;
  maxSize?: string;
  preferredQualities?: (TorrentQuality | string)[];
  preferredFormats?: (TorrentFormat | string)[];
  blacklistedWords?: string[];
  trustedIndexers?: string[];
}

@Injectable()
export class TorrentFilterService {
  private readonly logger = new Logger(TorrentFilterService.name);

  // Quality scoring weights
  private readonly qualityScores: Record<string, number> = {
    '8K': 120,
    '4K': 100,
    '2160p': 100,
    '1080p': 80,
    '720p': 60,
    '480p': 40,
    'SD': 20,
  };

  // Format scoring weights
  private readonly formatScores: Record<string, number> = {
    'x265': 90,
    'HEVC': 90,
    'AV1': 85,
    'x264': 70,
    'XviD': 40,
    'DivX': 30,
  };

  // Trusted indexers (higher score)
  private readonly trustedIndexers: string[] = [
    '1337x',
    'RARBG',
    'The Pirate Bay',
    'Torrentz2',
    'YTS',
    'EZTV',
  ];

  filterAndRankTorrents(
    torrents: TorrentResult[],
    criteria: FilterCriteria = {},
  ): TorrentResult[] {
    this.logger.debug(`Filtering and ranking ${torrents.length} torrents`);

    // First, apply hard filters
    let filteredTorrents = this.applyHardFilters(torrents, criteria);
    
    // Then score and rank
    const scoredTorrents = this.scoreTorrents(filteredTorrents, criteria);
    
    // Sort by score (descending)
    scoredTorrents.sort((a, b) => b.score - a.score);
    
    this.logger.debug(`Filtered down to ${scoredTorrents.length} torrents`);
    
    return scoredTorrents.map(st => st.torrent);
  }

  private applyHardFilters(torrents: TorrentResult[], criteria: FilterCriteria): TorrentResult[] {
    const rejectionReasons: Record<string, number> = {};

    const filtered = torrents.filter(torrent => {
      // Minimum seeders filter
      if (criteria.minSeeders && torrent.seeders < criteria.minSeeders) {
        rejectionReasons['minSeeders'] = (rejectionReasons['minSeeders'] || 0) + 1;
        return false;
      }

      // Maximum size filter
      if (criteria.maxSize) {
        const maxSizeBytes = this.parseSize(criteria.maxSize);
        const torrentSizeBytes = this.parseSize(torrent.size);
        if (torrentSizeBytes > maxSizeBytes) {
          rejectionReasons['maxSize'] = (rejectionReasons['maxSize'] || 0) + 1;
          return false;
        }
      }

      // Blacklisted words filter
      if (criteria.blacklistedWords && criteria.blacklistedWords.length > 0) {
        const titleLower = torrent.title.toLowerCase();
        const hasBlacklistedWord = criteria.blacklistedWords.some(word =>
          titleLower.includes(word.toLowerCase())
        );
        if (hasBlacklistedWord) {
          rejectionReasons['blacklistedWords'] = (rejectionReasons['blacklistedWords'] || 0) + 1;
          return false;
        }
      }

      // Preferred qualities filter (hard filter - reject if no accepted quality found)
      if (criteria.preferredQualities && criteria.preferredQualities.length > 0) {
        const detectedQuality = this.detectQuality(torrent.title);
        if (!detectedQuality) {
          // No quality detected - reject
          rejectionReasons['noQualityDetected'] = (rejectionReasons['noQualityDetected'] || 0) + 1;
          return false;
        }

        const hasAcceptedQuality = criteria.preferredQualities.some(pq =>
          detectedQuality.toLowerCase().includes(pq.toLowerCase()) ||
          pq.toLowerCase().includes(detectedQuality.toLowerCase())
        );

        if (!hasAcceptedQuality) {
          // Quality detected but not in accepted list - reject
          rejectionReasons['unacceptedQuality'] = (rejectionReasons['unacceptedQuality'] || 0) + 1;
          this.logger.debug(`Rejected torrent "${torrent.title}" - detected quality "${detectedQuality}" not in accepted list: [${criteria.preferredQualities.join(', ')}]`);
          return false;
        }
      }

      // Preferred formats filter (hard filter - reject if no accepted format found)
      if (criteria.preferredFormats && criteria.preferredFormats.length > 0) {
        const detectedFormat = this.detectFormat(torrent.title);
        if (!detectedFormat) {
          // No format detected - reject
          rejectionReasons['noFormatDetected'] = (rejectionReasons['noFormatDetected'] || 0) + 1;
          return false;
        }

        const hasAcceptedFormat = criteria.preferredFormats.some(pf =>
          detectedFormat.toLowerCase().includes(pf.toLowerCase()) ||
          pf.toLowerCase().includes(detectedFormat.toLowerCase())
        );

        if (!hasAcceptedFormat) {
          // Format detected but not in accepted list - reject
          rejectionReasons['unacceptedFormat'] = (rejectionReasons['unacceptedFormat'] || 0) + 1;
          this.logger.debug(`Rejected torrent "${torrent.title}" - detected format "${detectedFormat}" not in accepted list: [${criteria.preferredFormats.join(', ')}]`);
          return false;
        }
      }

      return true;
    });

    // Log filtering summary
    if (Object.keys(rejectionReasons).length > 0) {
      this.logger.debug(`Hard filter rejections: ${JSON.stringify(rejectionReasons)}`);
    }

    return filtered;
  }

  private scoreTorrents(torrents: TorrentResult[], criteria: FilterCriteria): TorrentScore[] {
    return torrents.map(torrent => {
      let score = 0;
      const reasons: string[] = [];

      // Base score from seeders (logarithmic scale)
      const seederScore = Math.min(Math.log10(torrent.seeders + 1) * 10, 50);
      score += seederScore;
      if (seederScore > 0) {
        reasons.push(`Seeders: +${seederScore.toFixed(1)}`);
      }

      // Quality scoring
      const qualityScore = this.getQualityScore(torrent, criteria.preferredQualities);
      score += qualityScore;
      if (qualityScore > 0) {
        reasons.push(`Quality: +${qualityScore}`);
      }

      // Format scoring
      const formatScore = this.getFormatScore(torrent, criteria.preferredFormats);
      score += formatScore;
      if (formatScore > 0) {
        reasons.push(`Format: +${formatScore}`);
      }

      // Indexer trust scoring
      const indexerScore = this.getIndexerScore(torrent, criteria.trustedIndexers);
      score += indexerScore;
      if (indexerScore > 0) {
        reasons.push(`Indexer: +${indexerScore}`);
      }

      // Size preference (penalize very large files)
      const sizeScore = this.getSizeScore(torrent);
      score += sizeScore;
      if (sizeScore !== 0) {
        reasons.push(`Size: ${sizeScore > 0 ? '+' : ''}${sizeScore}`);
      }

      // Recency bonus (newer torrents get slight boost)
      const recencyScore = this.getRecencyScore(torrent);
      score += recencyScore;
      if (recencyScore > 0) {
        reasons.push(`Recency: +${recencyScore}`);
      }

      return {
        torrent,
        score: Math.round(score * 10) / 10, // Round to 1 decimal place
        reasons,
      };
    });
  }

  private getQualityScore(torrent: TorrentResult, preferredQualities?: (TorrentQuality | string)[]): number {
    const detectedQuality = this.detectQuality(torrent.title);

    if (!detectedQuality) return 0;

    let baseScore = this.qualityScores[detectedQuality] || 0;

    // Bonus if it matches preferred qualities (no penalty since hard filtering handles rejection)
    if (preferredQualities && preferredQualities.length > 0) {
      const isPreferred = preferredQualities.some(pq =>
        detectedQuality.toLowerCase().includes(pq.toLowerCase()) ||
        pq.toLowerCase().includes(detectedQuality.toLowerCase())
      );
      if (isPreferred) {
        baseScore *= 1.5; // 50% bonus for preferred quality
      }
      // Note: No penalty for non-preferred since hard filtering already rejected those
    }

    return Math.round(baseScore);
  }

  private getFormatScore(torrent: TorrentResult, preferredFormats?: (TorrentFormat | string)[]): number {
    const detectedFormat = this.detectFormat(torrent.title);

    if (!detectedFormat) return 0;

    let baseScore = this.formatScores[detectedFormat] || 0;

    // Bonus if it matches preferred formats (no penalty since hard filtering handles rejection)
    if (preferredFormats && preferredFormats.length > 0) {
      const isPreferred = preferredFormats.some(pf =>
        detectedFormat.toLowerCase().includes(pf.toLowerCase()) ||
        pf.toLowerCase().includes(detectedFormat.toLowerCase())
      );
      if (isPreferred) {
        baseScore *= 1.3; // 30% bonus for preferred format
      }
      // Note: No penalty for non-preferred since hard filtering already rejected those
    }

    return Math.round(baseScore);
  }

  private getIndexerScore(torrent: TorrentResult, trustedIndexers?: string[]): number {
    const indexersToCheck = trustedIndexers || this.trustedIndexers;
    
    const isTrusted = indexersToCheck.some(trusted => 
      torrent.indexer.toLowerCase().includes(trusted.toLowerCase())
    );

    return isTrusted ? 20 : 0;
  }

  private getSizeScore(torrent: TorrentResult): number {
    const sizeBytes = this.parseSize(torrent.size);
    const sizeGB = sizeBytes / (1024 * 1024 * 1024);

    // Penalize extremely large files (>50GB gets penalty)
    if (sizeGB > 50) {
      return -10;
    }
    
    // Slight bonus for reasonable sizes (1-10GB)
    if (sizeGB >= 1 && sizeGB <= 10) {
      return 5;
    }

    return 0;
  }

  private getRecencyScore(torrent: TorrentResult): number {
    try {
      const publishDate = new Date(torrent.publishDate);
      const now = new Date();
      const daysDiff = (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);

      // Bonus for torrents published within last 30 days
      if (daysDiff <= 30) {
        return Math.max(10 - daysDiff / 3, 0);
      }

      return 0;
    } catch {
      return 0;
    }
  }

  private detectQuality(title: string): string | undefined {
    const titleLower = title.toLowerCase();

    // Check for specific quality indicators (ordered by priority - higher quality first)
    if (titleLower.includes('2160p') || titleLower.includes('4k') || titleLower.includes('uhd')) return '4K';
    if (titleLower.includes('8k')) return '8K';
    if (titleLower.includes('1080p') || titleLower.includes('fhd')) return '1080p';
    if (titleLower.includes('720p') || titleLower.includes('hd')) return '720p';
    if (titleLower.includes('480p')) return '480p';
    if (titleLower.includes('sd') || titleLower.includes('dvdrip') || titleLower.includes('480i')) return 'SD';

    return undefined;
  }

  private detectFormat(title: string): string | undefined {
    const titleLower = title.toLowerCase();

    // Check for format indicators (ordered by preference - newer/better codecs first)
    if (titleLower.includes('av1')) return 'AV1';
    if (titleLower.includes('x265') || titleLower.includes('h265') || titleLower.includes('h.265')) return 'x265';
    if (titleLower.includes('hevc')) return 'HEVC';
    if (titleLower.includes('x264') || titleLower.includes('h264') || titleLower.includes('h.264')) return 'x264';
    if (titleLower.includes('xvid')) return 'XviD';
    if (titleLower.includes('divx')) return 'DivX';

    return undefined;
  }

  private parseSize(sizeString: string): number {
    const match = sizeString.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 0);
  }
}
