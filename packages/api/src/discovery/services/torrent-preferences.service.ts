import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TorrentQuality, TorrentFormat, TorrentCategory } from '../dto/torrent-search.dto';

export interface TorrentPreferences {
  defaultQualities: TorrentQuality[];
  defaultFormats: TorrentFormat[];
  defaultCategory: TorrentCategory;
  minSeeders: number;
  maxSizeGB: number;
  trustedIndexers: string[];
  blacklistedWords: string[];
  autoSelectBest: boolean;
  preferRemux: boolean;
  preferSmallSize: boolean;
}

@Injectable()
export class TorrentPreferencesService {
  private readonly logger = new Logger(TorrentPreferencesService.name);
  private preferences: TorrentPreferences;

  constructor(private readonly configService: ConfigService) {
    this.preferences = this.loadDefaultPreferences();
  }

  getPreferences(): TorrentPreferences {
    return { ...this.preferences };
  }

  updatePreferences(updates: Partial<TorrentPreferences>): TorrentPreferences {
    this.preferences = { ...this.preferences, ...updates };
    this.logger.log('Torrent preferences updated');
    return this.getPreferences();
  }

  getQualityPreferences(): TorrentQuality[] {
    return this.preferences.defaultQualities;
  }

  getFormatPreferences(): TorrentFormat[] {
    return this.preferences.defaultFormats;
  }

  getFilterCriteria() {
    return {
      minSeeders: this.preferences.minSeeders,
      maxSize: `${this.preferences.maxSizeGB}GB`,
      preferredQualities: this.preferences.defaultQualities,
      preferredFormats: this.preferences.defaultFormats,
      trustedIndexers: this.preferences.trustedIndexers,
      blacklistedWords: this.preferences.blacklistedWords,
    };
  }

  // Quality ranking for automatic selection
  rankQualities(qualities: string[]): string[] {
    const qualityOrder = [
      TorrentQuality.UHD_4K,
      TorrentQuality.HD_1080P,
      TorrentQuality.HD_720P,
      TorrentQuality.SD,
    ];

    return qualities.sort((a, b) => {
      const aIndex = qualityOrder.findIndex(q => a.toLowerCase().includes(q.toLowerCase()));
      const bIndex = qualityOrder.findIndex(q => b.toLowerCase().includes(q.toLowerCase()));
      
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
  }

  // Format ranking for automatic selection
  rankFormats(formats: string[]): string[] {
    const formatOrder = [
      TorrentFormat.X265,
      TorrentFormat.HEVC,
      TorrentFormat.AV1,
      TorrentFormat.X264,
      TorrentFormat.XVID,
      TorrentFormat.DIVX,
    ];

    return formats.sort((a, b) => {
      const aIndex = formatOrder.findIndex(f => a.toLowerCase().includes(f.toLowerCase()));
      const bIndex = formatOrder.findIndex(f => b.toLowerCase().includes(f.toLowerCase()));
      
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
  }

  // Check if a torrent meets minimum quality standards
  meetsQualityStandards(torrentTitle: string): boolean {
    const titleLower = torrentTitle.toLowerCase();
    
    // Check for minimum quality
    const hasAcceptableQuality = this.preferences.defaultQualities.some(quality => 
      titleLower.includes(quality.toLowerCase())
    );

    // Check for blacklisted words
    const hasBlacklistedWords = this.preferences.blacklistedWords.some(word => 
      titleLower.includes(word.toLowerCase())
    );

    return hasAcceptableQuality && !hasBlacklistedWords;
  }

  // Get category-specific preferences
  getCategoryPreferences(category: TorrentCategory): Partial<TorrentPreferences> {
    const basePrefs = this.getPreferences();

    switch (category) {
      case TorrentCategory.MOVIES_UHD:
      case TorrentCategory.TV_UHD:
        return {
          ...basePrefs,
          defaultQualities: [TorrentQuality.UHD_4K],
          defaultFormats: [TorrentFormat.X265, TorrentFormat.HEVC],
          maxSizeGB: 50, // Larger files for UHD
        };

      case TorrentCategory.MOVIES_HD:
      case TorrentCategory.TV_HD:
        return {
          ...basePrefs,
          defaultQualities: [TorrentQuality.HD_1080P, TorrentQuality.HD_720P],
          defaultFormats: [TorrentFormat.X265, TorrentFormat.X264],
          maxSizeGB: 15,
        };

      case TorrentCategory.MOVIES_SD:
      case TorrentCategory.TV_SD:
        return {
          ...basePrefs,
          defaultQualities: [TorrentQuality.SD],
          defaultFormats: [TorrentFormat.X264, TorrentFormat.XVID],
          maxSizeGB: 5,
        };

      default:
        return basePrefs;
    }
  }

  private loadDefaultPreferences(): TorrentPreferences {
    return {
      defaultQualities: [
        TorrentQuality.HD_1080P,
        TorrentQuality.HD_720P,
        TorrentQuality.UHD_4K,
      ],
      defaultFormats: [
        TorrentFormat.X265,
        TorrentFormat.HEVC,
        TorrentFormat.X264,
      ],
      defaultCategory: TorrentCategory.MOVIES_HD,
      minSeeders: parseInt(this.configService.get('TORRENT_MIN_SEEDERS', '5')),
      maxSizeGB: parseInt(this.configService.get('TORRENT_MAX_SIZE_GB', '20')),
      trustedIndexers: this.configService.get('TORRENT_TRUSTED_INDEXERS', '1337x,RARBG,YTS').split(','),
      blacklistedWords: this.configService.get('TORRENT_BLACKLISTED_WORDS', 'cam,ts,hdcam,hdts').split(','),
      autoSelectBest: this.configService.get('TORRENT_AUTO_SELECT_BEST', 'true') === 'true',
      preferRemux: this.configService.get('TORRENT_PREFER_REMUX', 'false') === 'true',
      preferSmallSize: this.configService.get('TORRENT_PREFER_SMALL_SIZE', 'false') === 'true',
    };
  }
}
