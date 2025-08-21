import { Injectable, Logger } from '@nestjs/common';

export interface TorrentTitleMatch {
  type: 'complete-series' | 'multi-season' | 'season-pack' | 'individual-episode' | 'unknown';
  confidence: number; // 0-100, higher is more confident
  details: {
    seasons?: number[];
    seasonRange?: { start: number; end: number };
    season?: number;
    episode?: number;
    isComplete?: boolean;
  };
  matchedPattern: string;
  originalTitle: string;
}

@Injectable()
export class TorrentTitleMatcherService {
  private readonly logger = new Logger(TorrentTitleMatcherService.name);

  // Comprehensive regex patterns for different torrent types
  private readonly patterns = {
    // Complete series patterns
    completeSeries: [
      { pattern: /complete\s*series/i, confidence: 95 },
      { pattern: /complete\s*collection/i, confidence: 90 },
      { pattern: /all\s*seasons?/i, confidence: 85 },
      { pattern: /entire\s*series/i, confidence: 90 },
      { pattern: /full\s*series/i, confidence: 85 },
      { pattern: /seasons?\s*1[-\s]*\d+/i, confidence: 80 }, // "Seasons 1-8"
    ],

    // Multi-season patterns (specific ranges)
    multiSeason: [
      { pattern: /S(\d+)[-\s]*S(\d+)/i, confidence: 95 }, // S01-S03
      { pattern: /S(\d+)[-~](\d+)/i, confidence: 90 }, // S01-03 or S01~03 (explicit separators only)
      { pattern: /Season[s]?\s*(\d+)[-\s]*(\d+)/i, confidence: 85 }, // Seasons 1-3
      { pattern: /Season[s]?\s*(\d+)\s*(?:to|through)\s*(\d+)/i, confidence: 85 }, // Seasons 1 to 3
      { pattern: /(\d+)[-\s]*(\d+)\s*Season[s]?/i, confidence: 80 }, // 1-3 Seasons
    ],

    // Season pack patterns
    seasonPack: [
      { pattern: /S(\d+)(?!\d)(?![Ee])/i, confidence: 90 }, // S01 (not followed by episode)
      { pattern: /Season\s*(\d+)(?!\d)/i, confidence: 85 }, // Season 1
      { pattern: /(\d+)(?:st|nd|rd|th)\s*Season/i, confidence: 80 }, // 1st Season
      { pattern: /Season\s*(\d+)\s*Complete/i, confidence: 95 }, // Season 1 Complete
    ],

    // Individual episode patterns
    individualEpisode: [
      { pattern: /S(\d+)E(\d+)/i, confidence: 95 }, // S01E01
      { pattern: /S(\d+)\s*E(\d+)/i, confidence: 90 }, // S01 E01
      { pattern: /(\d+)x(\d+)/i, confidence: 85 }, // 1x01
      { pattern: /Season\s*(\d+).*Episode\s*(\d+)/i, confidence: 80 }, // Season 1 Episode 1
      { pattern: /S(\d+)\.E(\d+)/i, confidence: 85 }, // S01.E01
    ],
  };

  // Quality and format indicators (for additional context)
  private readonly qualityPatterns = [
    /720p/i, /1080p/i, /2160p/i, /4K/i, /8K/i,
    /HDTV/i, /WEB-DL/i, /BluRay/i, /BDRip/i, /DVDRip/i,
    /x264/i, /x265/i, /HEVC/i, /H\.264/i, /H\.265/i,
  ];

  // Release group patterns
  private readonly releaseGroupPatterns = [
    /-([A-Z0-9]+)$/i, // Group at end: -DIMENSION
    /\[([A-Z0-9]+)\]$/i, // Group in brackets: [DIMENSION]
  ];

  /**
   * Analyze a torrent title and determine its type and content
   */
  analyzeTorrentTitle(title: string, showTitle?: string): TorrentTitleMatch {
    const normalizedTitle = this.normalizeTitle(title);
    
    // Check if title contains the show name (if provided)
    if (showTitle && !this.containsShowTitle(normalizedTitle, showTitle)) {
      return {
        type: 'unknown',
        confidence: 0,
        details: {},
        matchedPattern: 'No show title match',
        originalTitle: title,
      };
    }

    // Try to match against each pattern type
    const matches = [
      ...this.matchCompleteSeries(normalizedTitle),
      ...this.matchMultiSeason(normalizedTitle),
      ...this.matchSeasonPack(normalizedTitle),
      ...this.matchIndividualEpisode(normalizedTitle),
    ];

    // Sort by confidence and return the best match
    matches.sort((a, b) => b.confidence - a.confidence);
    
    if (matches.length > 0) {
      return {
        ...matches[0],
        originalTitle: title,
      };
    }

    return {
      type: 'unknown',
      confidence: 0,
      details: {},
      matchedPattern: 'No pattern matched',
      originalTitle: title,
    };
  }

  /**
   * Batch analyze multiple torrent titles
   */
  analyzeTorrentTitles(titles: string[], showTitle?: string): TorrentTitleMatch[] {
    return titles.map(title => this.analyzeTorrentTitle(title, showTitle));
  }

  /**
   * Filter torrents by type and minimum confidence
   */
  filterByType(
    matches: TorrentTitleMatch[],
    type: TorrentTitleMatch['type'],
    minConfidence: number = 70
  ): TorrentTitleMatch[] {
    return matches.filter(match => 
      match.type === type && match.confidence >= minConfidence
    );
  }

  /**
   * Get the best match for a specific content need
   */
  getBestMatchForContent(
    matches: TorrentTitleMatch[],
    neededSeasons: number[],
    neededEpisodes: Array<{ season: number; episode: number }>
  ): TorrentTitleMatch | null {
    const scoredMatches = matches.map(match => ({
      match,
      score: this.calculateContentScore(match, neededSeasons, neededEpisodes),
    }));

    scoredMatches.sort((a, b) => b.score - a.score);
    
    return scoredMatches.length > 0 && scoredMatches[0].score > 0 
      ? scoredMatches[0].match 
      : null;
  }

  private normalizeTitle(title: string): string {
    return title
      .replace(/[._]/g, ' ') // Replace dots and underscores with spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim();
  }

  private containsShowTitle(title: string, showTitle: string): boolean {
    // First replace dots, underscores, and other separators with spaces
    // Then remove remaining punctuation and normalize spaces
    const normalizeForMatching = (str: string) => {
      return str
        .toLowerCase()
        .replace(/[._\-:]/g, ' ') // Replace common separators with spaces
        .replace(/[^\w\s]/g, '') // Remove remaining punctuation
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
        .trim();
    };

    const normalizedShow = normalizeForMatching(showTitle);
    const normalizedTitle = normalizeForMatching(title);

    return normalizedTitle.includes(normalizedShow);
  }

  private matchCompleteSeries(title: string): TorrentTitleMatch[] {
    const matches: TorrentTitleMatch[] = [];

    for (const { pattern, confidence } of this.patterns.completeSeries) {
      const match = title.match(pattern);
      if (match) {
        matches.push({
          type: 'complete-series',
          confidence,
          details: { isComplete: true },
          matchedPattern: pattern.source,
          originalTitle: '',
        });
      }
    }

    return matches;
  }

  private matchMultiSeason(title: string): TorrentTitleMatch[] {
    const matches: TorrentTitleMatch[] = [];

    for (const { pattern, confidence } of this.patterns.multiSeason) {
      const match = title.match(pattern);
      if (match && match[1] && match[2]) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        
        if (start < end && end - start <= 10) { // Reasonable season range
          const seasons = [];
          for (let i = start; i <= end; i++) {
            seasons.push(i);
          }

          matches.push({
            type: 'multi-season',
            confidence,
            details: { 
              seasons,
              seasonRange: { start, end }
            },
            matchedPattern: pattern.source,
            originalTitle: '',
          });
        }
      }
    }

    return matches;
  }

  private matchSeasonPack(title: string): TorrentTitleMatch[] {
    const matches: TorrentTitleMatch[] = [];

    for (const { pattern, confidence } of this.patterns.seasonPack) {
      const match = title.match(pattern);
      if (match && match[1]) {
        const season = parseInt(match[1]);
        
        if (season > 0 && season <= 50) { // Reasonable season number
          matches.push({
            type: 'season-pack',
            confidence,
            details: { season, seasons: [season] },
            matchedPattern: pattern.source,
            originalTitle: '',
          });
        }
      }
    }

    return matches;
  }

  private matchIndividualEpisode(title: string): TorrentTitleMatch[] {
    const matches: TorrentTitleMatch[] = [];

    for (const { pattern, confidence } of this.patterns.individualEpisode) {
      const match = title.match(pattern);
      if (match && match[1] && match[2]) {
        const season = parseInt(match[1]);
        const episode = parseInt(match[2]);
        
        if (season > 0 && season <= 50 && episode > 0 && episode <= 100) {
          matches.push({
            type: 'individual-episode',
            confidence,
            details: { season, episode },
            matchedPattern: pattern.source,
            originalTitle: '',
          });
        }
      }
    }

    return matches;
  }

  private calculateContentScore(
    match: TorrentTitleMatch,
    neededSeasons: number[],
    neededEpisodes: Array<{ season: number; episode: number }>
  ): number {
    let score = match.confidence;

    switch (match.type) {
      case 'complete-series':
        // Complete series gets bonus if we need multiple seasons
        if (neededSeasons.length > 1) {
          score += 50;
        }
        break;

      case 'multi-season':
        if (match.details.seasons) {
          const coveredSeasons = match.details.seasons.filter(s => 
            neededSeasons.includes(s)
          );
          score += coveredSeasons.length * 20;
        }
        break;

      case 'season-pack':
        if (match.details.season && neededSeasons.includes(match.details.season)) {
          score += 30;
        }
        break;

      case 'individual-episode':
        if (match.details.season && match.details.episode) {
          const isNeeded = neededEpisodes.some(ep => 
            ep.season === match.details.season && ep.episode === match.details.episode
          );
          if (isNeeded) {
            score += 20;
          }
        }
        break;
    }

    return score;
  }

  /**
   * Extract quality information from title
   */
  extractQuality(title: string): string[] {
    const qualities: string[] = [];
    
    for (const pattern of this.qualityPatterns) {
      const match = title.match(pattern);
      if (match) {
        qualities.push(match[0]);
      }
    }

    return qualities;
  }

  /**
   * Extract release group from title
   */
  extractReleaseGroup(title: string): string | null {
    for (const pattern of this.releaseGroupPatterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }
}
