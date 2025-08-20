import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ContentType, OrganizationRule, OrganizationSettings } from '../../../generated/prisma';
import { CreateOrganizationRuleDto, UpdateOrganizationRuleDto } from '../dto/organization-rule.dto';
import { UpdateOrganizationSettingsDto } from '../dto/organization-settings.dto';
import { OrganizationContext, PathGenerationResult, FileMetadata } from '../interfaces/organization.interface';

@Injectable()
export class OrganizationRulesService {
  private readonly logger = new Logger(OrganizationRulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get organization settings, creating default if none exist
   */
  async getSettings(): Promise<OrganizationSettings> {
    let settings = await this.prisma.organizationSettings.findFirst();
    
    if (!settings) {
      settings = await this.createDefaultSettings();
    }
    
    return settings;
  }

  /**
   * Update organization settings
   */
  async updateSettings(dto: UpdateOrganizationSettingsDto): Promise<OrganizationSettings> {
    const existingSettings = await this.getSettings();
    
    return this.prisma.organizationSettings.update({
      where: { id: existingSettings.id },
      data: dto,
    });
  }

  /**
   * Get organization rule for content type
   */
  async getRuleForContentType(contentType: ContentType, platform?: string): Promise<OrganizationRule> {
    // For games with platform, first try to find a platform-specific rule
    if (contentType === ContentType.GAME && platform) {
      const platformRule = await this.prisma.organizationRule.findFirst({
        where: {
          contentType,
          isActive: true,
          platform,
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      if (platformRule) {
        return platformRule;
      }
    }

    // Fall back to general rules (platform is null)
    let rule = await this.prisma.organizationRule.findFirst({
      where: {
        contentType,
        isActive: true,
        platform: null,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (!rule) {
      rule = await this.createDefaultRule(contentType);
    }

    return rule;
  }

  /**
   * Get all organization rules
   */
  async getAllRules(): Promise<OrganizationRule[]> {
    return this.prisma.organizationRule.findMany({
      orderBy: [
        { contentType: 'asc' },
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Create a new organization rule
   */
  async createRule(dto: CreateOrganizationRuleDto): Promise<OrganizationRule> {
    // If this is set as default, unset other defaults for the same content type
    if (dto.isDefault) {
      await this.prisma.organizationRule.updateMany({
        where: {
          contentType: dto.contentType,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return this.prisma.organizationRule.create({
      data: dto,
    });
  }

  /**
   * Update an organization rule
   */
  async updateRule(id: string, dto: UpdateOrganizationRuleDto): Promise<OrganizationRule> {
    // If this is being set as default, unset other defaults for the same content type
    if (dto.isDefault) {
      // First get the current rule to know its content type
      const currentRule = await this.prisma.organizationRule.findUnique({
        where: { id },
      });

      if (currentRule) {
        await this.prisma.organizationRule.updateMany({
          where: {
            contentType: currentRule.contentType,
            isDefault: true,
            id: { not: id }, // Don't update the current rule
          },
          data: {
            isDefault: false,
          },
        });
      }
    }

    return this.prisma.organizationRule.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete an organization rule
   */
  async deleteRule(id: string): Promise<void> {
    await this.prisma.organizationRule.delete({
      where: { id },
    });
  }

  /**
   * Generate organized path for content
   */
  async generateOrganizedPath(context: OrganizationContext): Promise<PathGenerationResult> {
    const rule = await this.getRuleForContentType(context.contentType, context.platform);
    const settings = await this.getSettings();

    // Get base path
    const basePath = this.getBasePath(context.contentType, rule, settings);

    // Generate folder path
    const folderPath = this.generateFolderPath(context, rule, basePath);

    // Generate file name
    const fileName = this.generateFileName(context, rule);

    // Combine for full path
    const fullPath = `${folderPath}/${fileName}`;

    return {
      folderPath,
      fileName,
      fullPath,
    };
  }

  /**
   * Extract metadata from file name
   */
  extractMetadataFromFileName(fileName: string, contentType: ContentType): FileMetadata {
    const metadata: FileMetadata = {
      title: 'Unknown',
    };

    // Remove file extension
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

    if (contentType === ContentType.MOVIE) {
      // Movie pattern: Title (Year) - Quality - Format
      const movieMatch = nameWithoutExt.match(/^(.+?)\s*\((\d{4})\)(?:\s*-\s*(.+?))?(?:\s*-\s*(.+?))?(?:\s*-\s*(.+?))?$/);
      if (movieMatch) {
        metadata.title = movieMatch[1].trim();
        metadata.year = parseInt(movieMatch[2]);
        metadata.quality = movieMatch[3]?.trim();
        metadata.format = movieMatch[4]?.trim();
        metadata.edition = movieMatch[5]?.trim();
      }
    } else if (contentType === ContentType.TV_SHOW) {
      // TV Show pattern: Title - S01E01 - Quality - Format
      const tvMatch = nameWithoutExt.match(/^(.+?)\s*-\s*S(\d+)E(\d+)(?:\s*-\s*(.+?))?(?:\s*-\s*(.+?))?(?:\s*-\s*(.+?))?$/);
      if (tvMatch) {
        metadata.title = tvMatch[1].trim();
        metadata.season = parseInt(tvMatch[2]);
        metadata.episode = parseInt(tvMatch[3]);
        metadata.quality = tvMatch[4]?.trim();
        metadata.format = tvMatch[5]?.trim();
        metadata.edition = tvMatch[6]?.trim();
      }
    } else if (contentType === ContentType.GAME) {
      // Game pattern: Title (Platform) - Edition
      const gameMatch = nameWithoutExt.match(/^(.+?)\s*\((.+?)\)(?:\s*-\s*(.+?))?$/);
      if (gameMatch) {
        metadata.title = gameMatch[1].trim();
        metadata.platform = gameMatch[2].trim();
        metadata.edition = gameMatch[3]?.trim();
      }
    }

    return metadata;
  }

  private async createDefaultSettings(): Promise<OrganizationSettings> {
    const libraryPath = this.configService.get('LIBRARY_PATH', '/library');
    
    return this.prisma.organizationSettings.create({
      data: {
        libraryPath,
        organizeOnComplete: true,
        replaceExistingFiles: true,
        extractArchives: true,
        deleteAfterExtraction: true,
        enableReverseIndexing: true,
        reverseIndexingCron: '0 * * * *', // Every hour
      },
    });
  }

  private async createDefaultRule(contentType: ContentType): Promise<OrganizationRule> {
    let folderNamePattern: string;
    let fileNamePattern: string;
    let seasonFolderPattern: string | undefined;

    switch (contentType) {
      case ContentType.MOVIE:
        folderNamePattern = '{title} ({year})';
        fileNamePattern = '{title} ({year}) - {edition} - {quality} - {format}';
        break;
      case ContentType.TV_SHOW:
        folderNamePattern = '{title} ({year})';
        fileNamePattern = '{title} - S{seasonNumber}E{episodeNumber} - {edition} - {quality} - {format}';
        seasonFolderPattern = 'Season {seasonNumber}';
        break;
      case ContentType.GAME:
        folderNamePattern = '{title} ({platform})';
        fileNamePattern = '{title} ({platform}) - {edition}';
        break;
      default:
        folderNamePattern = '{title}';
        fileNamePattern = '{title}';
    }

    return this.prisma.organizationRule.create({
      data: {
        contentType,
        isDefault: true,
        isActive: true,
        folderNamePattern,
        fileNamePattern,
        seasonFolderPattern,
      },
    });
  }

  private getBasePath(contentType: ContentType, rule: OrganizationRule, settings: OrganizationSettings): string {
    // Rule-specific base path takes precedence
    if (rule.basePath) {
      return rule.basePath;
    }

    // Content-specific path overrides
    switch (contentType) {
      case ContentType.MOVIE:
        return settings.moviesPath || `${settings.libraryPath}/movies`;
      case ContentType.TV_SHOW:
        return settings.tvShowsPath || `${settings.libraryPath}/tv-shows`;
      case ContentType.GAME:
        return settings.gamesPath || `${settings.libraryPath}/games`;
      default:
        return settings.libraryPath;
    }
  }

  private generateFolderPath(context: OrganizationContext, rule: OrganizationRule, basePath: string): string {
    let folderPath = basePath;

    // Generate main folder name
    const mainFolderName = this.applyPattern(rule.folderNamePattern, context);
    folderPath = `${folderPath}/${this.sanitizePath(mainFolderName)}`;

    // Add season folder for TV shows
    if (context.contentType === ContentType.TV_SHOW && context.season && rule.seasonFolderPattern) {
      const seasonFolderName = this.applyPattern(rule.seasonFolderPattern, context);
      folderPath = `${folderPath}/${this.sanitizePath(seasonFolderName)}`;
    }

    return folderPath;
  }

  private generateFileName(context: OrganizationContext, rule: OrganizationRule): string {
    const fileName = this.applyPattern(rule.fileNamePattern, context);
    const sanitizedName = this.sanitizeFileName(fileName);

    // Extract and preserve the original file extension
    const originalExtension = this.getFileExtension(context.fileName);

    return originalExtension ? `${sanitizedName}.${originalExtension}` : sanitizedName;
  }

  private getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(lastDotIndex + 1) : '';
  }

  private applyPattern(pattern: string, context: OrganizationContext): string {
    // Extract filename without extension for the {filename} variable
    const filenameWithoutExt = this.getFilenameWithoutExtension(context.fileName);

    return pattern
      .replace(/{title}/g, context.title || 'Unknown')
      .replace(/{year}/g, context.year?.toString() || '')
      .replace(/{season}/g, context.season?.toString() || '')
      .replace(/{seasonNumber}/g, context.season?.toString().padStart(2, '0') || '')
      .replace(/{episode}/g, context.episode?.toString() || '')
      .replace(/{episodeNumber}/g, context.episode?.toString().padStart(2, '0') || '')
      .replace(/{platform}/g, context.platform || '')
      .replace(/{quality}/g, context.quality || '')
      .replace(/{format}/g, context.format || '')
      .replace(/{edition}/g, context.edition || '')
      .replace(/{filename}/g, filenameWithoutExt || 'Unknown')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getFilenameWithoutExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  }

  private sanitizePath(path: string): string {
    return path
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
