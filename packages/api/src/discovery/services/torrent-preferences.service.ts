import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TorrentQuality, TorrentFormat, TorrentLanguage, TorrentCategory } from '../dto/torrent-search.dto';
import { PrismaService } from '../../database/prisma.service';
import {
  TorrentQuality as PrismaTorrentQuality,
  TorrentFormat as PrismaTorrentFormat,
  TorrentLanguage as PrismaTorrentLanguage,
} from '../../../generated/prisma';

export interface TorrentPreferences {
  defaultQualities: TorrentQuality[];
  defaultFormats: TorrentFormat[];
  defaultLanguages: TorrentLanguage[];
  defaultCategory: TorrentCategory;
  minSeeders: number;
  maxSizeGB: number;
  trustedIndexers: string[];
  blacklistedWords: string[];
  autoSelectBest: boolean;
  preferRemux: boolean;
  preferSmallSize: boolean;
}

/**
 * The API's enums use display values ('1080p', 'x265') while the database uses
 * the enum keys ('HD_1080P', 'X265'). These convert between the two.
 */
function toEnumKey<T extends Record<string, string>>(source: T, value: string): string | undefined {
  return Object.entries(source).find(([key, v]) => v === value || key === value)?.[0];
}

function toEnumValue<T extends Record<string, string>>(source: T, key: string): string | undefined {
  return (source as Record<string, string>)[key];
}

@Injectable()
export class TorrentPreferencesService implements OnModuleInit {
  private readonly logger = new Logger(TorrentPreferencesService.name);
  private preferences: TorrentPreferences;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.preferences = this.loadDefaultPreferences();
  }

  /**
   * Quality rules are edited in Settings and persist on AppConfiguration, so
   * they survive a restart. Env values remain the fallback for a fresh
   * install, and are used for any field the user has not set.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.reload();
    } catch (error) {
      this.logger.warn(`Could not load stored torrent preferences, using defaults: ${error.message}`);
    }
  }

  async reload(): Promise<TorrentPreferences> {
    const config = await this.prisma.appConfiguration.findFirst();
    if (!config) {
      return this.getPreferences();
    }

    const defaults = this.loadDefaultPreferences();
    this.preferences = {
      defaultQualities: config.defaultQualities?.length
        ? (config.defaultQualities
            .map(key => toEnumValue(TorrentQuality, key))
            .filter(Boolean) as TorrentQuality[])
        : defaults.defaultQualities,
      defaultFormats: config.defaultFormats?.length
        ? (config.defaultFormats
            .map(key => toEnumValue(TorrentFormat, key))
            .filter(Boolean) as TorrentFormat[])
        : defaults.defaultFormats,
      defaultLanguages: config.defaultLanguages?.length
        ? (config.defaultLanguages as unknown as TorrentLanguage[])
        : defaults.defaultLanguages,
      defaultCategory: defaults.defaultCategory,
      minSeeders: config.minSeeders ?? defaults.minSeeders,
      maxSizeGB: config.maxSizeGB ?? defaults.maxSizeGB,
      trustedIndexers: config.trustedIndexers?.length ? config.trustedIndexers : defaults.trustedIndexers,
      blacklistedWords: config.blacklistedWords?.length ? config.blacklistedWords : defaults.blacklistedWords,
      autoSelectBest: config.autoSelectBest ?? defaults.autoSelectBest,
      preferRemux: config.preferRemux ?? defaults.preferRemux,
      preferSmallSize: config.preferSmallSize ?? defaults.preferSmallSize,
    };

    return this.getPreferences();
  }

  getPreferences(): TorrentPreferences {
    return { ...this.preferences };
  }

  async updatePreferences(updates: Partial<TorrentPreferences>): Promise<TorrentPreferences> {
    this.preferences = { ...this.preferences, ...updates };

    const data: Record<string, unknown> = {};
    if (updates.defaultQualities) {
      data.defaultQualities = updates.defaultQualities
        .map(value => toEnumKey(TorrentQuality, value))
        .filter(Boolean) as PrismaTorrentQuality[];
    }
    if (updates.defaultFormats) {
      data.defaultFormats = updates.defaultFormats
        .map(value => toEnumKey(TorrentFormat, value))
        .filter(Boolean) as PrismaTorrentFormat[];
    }
    if (updates.defaultLanguages) {
      data.defaultLanguages = updates.defaultLanguages
        .map(value => toEnumKey(TorrentLanguage, value))
        .filter(Boolean) as PrismaTorrentLanguage[];
    }
    if (updates.minSeeders !== undefined) data.minSeeders = updates.minSeeders;
    if (updates.maxSizeGB !== undefined) data.maxSizeGB = updates.maxSizeGB;
    if (updates.trustedIndexers) data.trustedIndexers = updates.trustedIndexers;
    if (updates.blacklistedWords) data.blacklistedWords = updates.blacklistedWords;
    if (updates.autoSelectBest !== undefined) data.autoSelectBest = updates.autoSelectBest;
    if (updates.preferRemux !== undefined) data.preferRemux = updates.preferRemux;
    if (updates.preferSmallSize !== undefined) data.preferSmallSize = updates.preferSmallSize;

    if (Object.keys(data).length > 0) {
      const config = await this.prisma.appConfiguration.findFirst();
      if (config) {
        await this.prisma.appConfiguration.update({ where: { id: config.id }, data });
      } else {
        await this.prisma.appConfiguration.create({ data });
      }
    }

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
      preferredLanguages: this.preferences.defaultLanguages,
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
      defaultLanguages: this.configService
        .get('TORRENT_DEFAULT_LANGUAGES', TorrentLanguage.ENGLISH)
        .split(',') as TorrentLanguage[],
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
