import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

export interface GamePlatform {
  id: string;
  name: string;
  category: string;
  description: string;
  aliases: string[];
}

export interface PlatformCategory {
  id: string;
  name: string;
  description: string;
}

export interface GamePlatformsConfig {
  platforms: GamePlatform[];
  categories: PlatformCategory[];
}

@Injectable()
export class GamePlatformsService {
  private readonly logger = new Logger(GamePlatformsService.name);
  private config: GamePlatformsConfig;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      // Try mounted config path first (Docker), then fallback to local development path
      const configPaths = [
        '/app/config/game-platforms.yml',  // Docker mounted path
        join(process.cwd(), 'config', 'game-platforms.yml'),  // Local development
        join(process.cwd(), '..', '..', 'config', 'game-platforms.yml')  // Monorepo structure
      ];

      let configPath: string | null = null;
      for (const path of configPaths) {
        try {
          if (readFileSync(path, 'utf8')) {
            configPath = path;
            break;
          }
        } catch {
          // Continue to next path
        }
      }

      if (!configPath) {
        throw new Error('No config file found in any of the expected locations');
      }

      const fileContents = readFileSync(configPath, 'utf8');
      this.config = yaml.load(fileContents) as GamePlatformsConfig;
      this.logger.log(`Loaded ${this.config.platforms.length} game platforms and ${this.config.categories.length} categories from ${configPath}`);
    } catch (error) {
      this.logger.error('Failed to load game platforms config:', error);
      // Fallback to basic config
      this.config = {
        platforms: [
          {
            id: 'pc',
            name: 'PC',
            category: 'pc',
            description: 'Windows PC games',
            aliases: ['windows', 'win']
          }
        ],
        categories: [
          {
            id: 'pc',
            name: 'PC Platforms',
            description: 'Desktop computer platforms'
          }
        ]
      };
    }
  }

  /**
   * Get all available platforms
   */
  getAllPlatforms(): GamePlatform[] {
    return this.config.platforms;
  }

  /**
   * Get all platform categories
   */
  getAllCategories(): PlatformCategory[] {
    return this.config.categories;
  }

  /**
   * Get platforms by category
   */
  getPlatformsByCategory(categoryId: string): GamePlatform[] {
    return this.config.platforms.filter(platform => platform.category === categoryId);
  }

  /**
   * Get a specific platform by ID
   */
  getPlatformById(id: string): GamePlatform | undefined {
    return this.config.platforms.find(platform => platform.id === id);
  }

  /**
   * Find platform by name or alias
   */
  findPlatform(searchTerm: string): GamePlatform | undefined {
    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    // First try exact ID match
    let platform = this.config.platforms.find(p => p.id === normalizedSearch);
    if (platform) return platform;

    // Then try exact name match
    platform = this.config.platforms.find(p => p.name.toLowerCase() === normalizedSearch);
    if (platform) return platform;

    // Finally try alias match
    platform = this.config.platforms.find(p => 
      p.aliases.some(alias => alias.toLowerCase() === normalizedSearch)
    );
    
    return platform;
  }

  /**
   * Search platforms by partial name or alias
   */
  searchPlatforms(query: string): GamePlatform[] {
    const normalizedQuery = query.toLowerCase().trim();
    
    return this.config.platforms.filter(platform => 
      platform.id.toLowerCase().includes(normalizedQuery) ||
      platform.name.toLowerCase().includes(normalizedQuery) ||
      platform.description.toLowerCase().includes(normalizedQuery) ||
      platform.aliases.some(alias => alias.toLowerCase().includes(normalizedQuery))
    );
  }

  /**
   * Get platform options for frontend dropdowns
   */
  getPlatformOptions(): Array<{ value: string; label: string; category: string }> {
    return this.config.platforms.map(platform => ({
      value: platform.id,
      label: platform.name,
      category: platform.category
    }));
  }

  /**
   * Get grouped platform options by category
   */
  getGroupedPlatformOptions(): Record<string, Array<{ value: string; label: string }>> {
    const grouped: Record<string, Array<{ value: string; label: string }>> = {};
    
    this.config.categories.forEach(category => {
      grouped[category.name] = this.getPlatformsByCategory(category.id).map(platform => ({
        value: platform.id,
        label: platform.name
      }));
    });
    
    return grouped;
  }

  /**
   * Validate if a platform ID is supported
   */
  isValidPlatform(platformId: string): boolean {
    return this.config.platforms.some(platform => platform.id === platformId);
  }

  /**
   * Get Jackett category code for a platform
   */
  getJackettCategoryForPlatform(platformId: string): string {
    // Map platform IDs to Jackett category codes
    const platformCategoryMap: Record<string, string> = {
      // PC Platforms
      'pc': '4050',           // PC/Games
      'mac': '4030',          // PC/Mac
      'linux': '4050',        // PC/Games (Linux games are typically in PC/Games)
      'steam': '4050',        // PC/Games
      'gog': '4050',          // PC/Games
      'epic': '4050',         // PC/Games
      'origin': '4050',       // PC/Games
      'uplay': '4050',        // PC/Games

      // Mobile Platforms
      'ios': '4060',          // PC/Mobile-iOS
      'android': '4070',      // PC/Mobile-Android

      // Nintendo Platforms
      'nintendo-switch': '1000',    // Console (general, as there's no specific Switch category)
      'nintendo-3ds': '1110',       // Console/3DS
      'nintendo-ds': '1010',        // Console/NDS
      'wii-u': '1130',             // Console/WiiU
      'wii': '1030',               // Console/Wii
      'gamecube': '1000',          // Console (general)
      'n64': '1000',               // Console (general)
      'snes': '1000',              // Console (general)
      'nes': '1000',               // Console (general)
      'gameboy-advance': '1000',   // Console (general)
      'gameboy-color': '1000',     // Console (general)
      'gameboy': '1000',           // Console (general)

      // PlayStation Platforms
      'ps5': '1000',                // Console (general, as there's no specific PS5 category yet)
      'ps4': '1180',                // Console/PS4
      'ps3': '1080',                // Console/PS3
      'ps2': '1000',                // Console (general)
      'ps1': '1000',                // Console (general)
      'psp': '1020',                // Console/PSP
      'ps-vita': '1120',            // Console/PS Vita

      // Xbox Platforms
      'xbox-series-x': '1000',     // Console (general, as there's no specific Series X/S category yet)
      'xbox-one': '1140',          // Console/XBox One
      'xbox-360': '1050',          // Console/XBox 360
      'xbox': '1040',              // Console/XBox

      // Sega Platforms
      'dreamcast': '1000',         // Console (general)
      'saturn': '1000',            // Console (general)
      'genesis': '1000',           // Console (general)
      'master-system': '1000',     // Console (general)
      'game-gear': '1000',         // Console (general)

      // Other
      'arcade': '1000',             // Console (general)
    };

    return platformCategoryMap[platformId] || '4050'; // Default to PC/Games
  }

  /**
   * Normalize platform input to standard ID
   */
  normalizePlatform(input: string): string | null {
    const platform = this.findPlatform(input);
    return platform ? platform.id : null;
  }
}
