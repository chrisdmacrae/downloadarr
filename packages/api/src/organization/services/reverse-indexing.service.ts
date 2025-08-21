import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationRulesService } from './organization-rules.service';
import { FileOrganizationService } from './file-organization.service';
import { SeasonScanningService } from '../../torrents/services/season-scanning.service';
import { TmdbService } from '../../discovery/services/tmdb.service';
import { IgdbService } from '../../discovery/services/igdb.service';
import { ContentType } from '../../../generated/prisma';
import { OrganizationContext } from '../interfaces/organization.interface';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ReverseIndexingService {
  private readonly logger = new Logger(ReverseIndexingService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationRulesService: OrganizationRulesService,
    private readonly fileOrganizationService: FileOrganizationService,
    private readonly seasonScanningService: SeasonScanningService,
    private readonly tmdbService: TmdbService,
    private readonly igdbService: IgdbService,
  ) {}

  /**
   * Cron job that runs reverse indexing
   * Default: every hour (0 * * * *)
   */
  @Cron('0 * * * *')
  async runReverseIndexing(): Promise<void> {
    if (this.isRunning) {
      this.logger.log('Reverse indexing already running, skipping...');
      return;
    }

    const settings = await this.organizationRulesService.getSettings();
    if (!settings.enableReverseIndexing) {
      this.logger.debug('Reverse indexing is disabled');
      return;
    }

    this.isRunning = true;
    try {
      this.logger.log('Starting reverse indexing...');
      const startTime = Date.now();

      const results = await this.scanLibraryDirectories();

      // Also run season scanning to update episode progress
      this.logger.log('Running season scanning to update episode progress...');
      const seasonResults = await this.seasonScanningService.scanAllSeasons();

      const duration = Date.now() - startTime;
      this.logger.log(`Reverse indexing completed in ${duration}ms. Found ${results.totalFolders} folders, processed ${results.newFolders} new folders. Updated ${seasonResults.episodesUpdated} episodes.`);

      if (results.errors > 0 || seasonResults.errors > 0) {
        this.logger.warn(`Reverse indexing completed with ${results.errors + seasonResults.errors} errors`);
      }

    } catch (error) {
      this.logger.error('Error during reverse indexing:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger reverse indexing
   */
  async triggerReverseIndexing(): Promise<{ success: boolean; message: string; results?: any }> {
    if (this.isRunning) {
      return {
        success: false,
        message: 'Reverse indexing is already running',
      };
    }

    try {
      this.isRunning = true;
      const startTime = Date.now();

      const results = await this.scanLibraryDirectories();

      // Also run season scanning to update episode progress
      this.logger.log('Running season scanning to update episode progress...');
      const seasonResults = await this.seasonScanningService.scanAllSeasons();

      const duration = Date.now() - startTime;

      return {
        success: true,
        message: `Reverse indexing completed in ${duration}ms. Found ${results.totalFolders} folders, processed ${results.newFolders} new folders. Updated ${seasonResults.episodesUpdated} episodes.`,
        results: {
          ...results,
          seasonScanning: seasonResults,
          duration,
        },
      };
    } catch (error) {
      this.logger.error('Error during manual reverse indexing:', error);
      return {
        success: false,
        message: `Reverse indexing failed: ${error.message}`,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get reverse indexing status
   */
  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }

  private async scanLibraryDirectories(): Promise<{ totalFolders: number; newFolders: number; queuedFolders: number; errors: number }> {
    const settings = await this.organizationRulesService.getSettings();
    const results = { totalFolders: 0, newFolders: 0, queuedFolders: 0, errors: 0 };

    // Scan each content type directory
    const contentTypes = [
      { type: ContentType.MOVIE, path: settings.moviesPath || `${settings.libraryPath}/movies` },
      { type: ContentType.TV_SHOW, path: settings.tvShowsPath || `${settings.libraryPath}/tv-shows` },
      { type: ContentType.GAME, path: settings.gamesPath || `${settings.libraryPath}/games` },
    ];

    for (const { type, path: dirPath } of contentTypes) {
      try {
        const dirResults = await this.scanDirectory(dirPath, type);
        results.totalFolders += dirResults.totalFolders;
        results.newFolders += dirResults.newFolders;
        results.queuedFolders += dirResults.queuedFolders;
        results.errors += dirResults.errors;
      } catch (error) {
        this.logger.warn(`Error scanning directory ${dirPath}:`, error);
        results.errors++;
      }
    }

    return results;
  }

  private async scanDirectory(dirPath: string, contentType: ContentType): Promise<{ totalFolders: number; newFolders: number; queuedFolders: number; errors: number }> {
    const results = { totalFolders: 0, newFolders: 0, queuedFolders: 0, errors: 0 };

    try {
      // Check if directory exists
      await fs.access(dirPath);
    } catch {
      this.logger.debug(`Directory does not exist: ${dirPath}`);
      return results;
    }

    this.logger.log(`Scanning directory: ${dirPath} for ${contentType}`);

    // Get organization rules to understand expected folder patterns
    const rules = await this.organizationRulesService.getAllRules();
    const contentRules = rules.filter(rule => rule.contentType === contentType && rule.isActive);

    // Scan for content folders using both simple and nested patterns
    const contentFolders = await this.findContentFolders(dirPath, contentType, contentRules);
    results.totalFolders = contentFolders.length;

    for (const folderInfo of contentFolders) {
      try {
        const wasProcessed = await this.processFolderIfNew(folderInfo.path, contentType, folderInfo.metadata);
        if (wasProcessed) {
          results.queuedFolders++; // Folder was added to queue
        }
      } catch (error) {
        this.logger.warn(`Error processing folder ${folderInfo.path}:`, error);
        results.errors++;
      }
    }

    return results;
  }

  private async indexFileIfNew(filePath: string, contentType: ContentType): Promise<boolean> {
    // Check if file is already indexed
    const existingFile = await this.prisma.organizedFile.findFirst({
      where: {
        organizedPath: filePath,
      },
    });

    if (existingFile) {
      return false; // File already indexed
    }

    // Extract metadata from file path and name
    const fileName = path.basename(filePath);
    const metadata = this.organizationRulesService.extractMetadataFromFileName(fileName, contentType);

    // Get file stats
    const stats = await fs.stat(filePath);

    // Try to find matching torrent request
    const matchingRequest = await this.findMatchingRequest(metadata, contentType);
    let requestedTorrentId: string | undefined;

    if (matchingRequest) {
      requestedTorrentId = matchingRequest.id;
      this.logger.log(`Found matching request for reverse-indexed file: ${metadata.title} -> ${matchingRequest.id}`);

      // Update request status to COMPLETED if it's not already
      if (matchingRequest.status !== 'COMPLETED') {
        await this.prisma.requestedTorrent.update({
          where: { id: matchingRequest.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Updated request ${matchingRequest.id} status to COMPLETED via reverse indexing`);
      }
    } else {
      // No matching request found - create a completed request for this file
      const newRequest = await this.createCompletedRequest(metadata, contentType);
      requestedTorrentId = newRequest.id;
      this.logger.log(`Created completed request for reverse-indexed file: ${metadata.title} -> ${newRequest.id}`);
    }

    // Create organized file record
    await this.prisma.organizedFile.create({
      data: {
        originalPath: filePath, // For reverse-indexed files, original and organized paths are the same
        organizedPath: filePath,
        fileName,
        fileSize: BigInt(stats.size),
        contentType,
        title: metadata.title,
        year: metadata.year,
        season: metadata.season,
        episode: metadata.episode,
        platform: metadata.platform,
        quality: metadata.quality,
        format: metadata.format,
        edition: metadata.edition,
        requestedTorrentId,
        isReverseIndexed: true,
      },
    });

    this.logger.debug(`Indexed new file: ${filePath}`);
    return true;
  }

  /**
   * Process a folder if it's new and follows naming conventions
   */
  private async processFolderIfNew(folderPath: string, contentType: ContentType, providedMetadata?: any): Promise<boolean> {
    const folderName = path.basename(folderPath);

    // Use provided metadata or extract from folder name
    let metadata = providedMetadata;
    if (!metadata) {
      metadata = this.organizationRulesService.extractMetadataFromFileName(folderName, contentType);
    }

    // Enhance metadata with external API data for better identification
    const enhancedMetadata = await this.enhanceMetadataWithExternalAPIs(metadata, contentType);

    // Check if there's already a matching completed request for this content
    const existingRequest = await this.findMatchingRequest(enhancedMetadata, contentType);

    if (existingRequest) {
      this.logger.debug(`Folder already has matching request: ${folderPath} -> Request ID: ${existingRequest.id}`);
      return false; // Already has a matching request
    }

    // Check if folder matches naming convention or has valid metadata
    if (!this.isValidContentFolder(folderPath, contentType, enhancedMetadata)) {
      this.logger.debug(`Folder doesn't contain valid content, skipping: ${folderPath}`);
      return false;
    }

    // Check if folder is already in organize queue
    const existingQueueItem = await this.prisma.organizeQueue.findFirst({
      where: {
        folderPath: folderPath,
      },
    });

    if (existingQueueItem) {
      // If the item was previously completed but we're finding it again,
      // it means there's no matching request, so mark it as pending again
      if (existingQueueItem.status === 'COMPLETED') {
        await this.prisma.organizeQueue.update({
          where: { id: existingQueueItem.id },
          data: {
            status: 'PENDING',
            processedAt: null,
            // Update detected metadata in case it improved
            detectedTitle: enhancedMetadata.title,
            detectedYear: enhancedMetadata.year,
            detectedSeason: enhancedMetadata.season,
            detectedEpisode: enhancedMetadata.episode,
            detectedPlatform: enhancedMetadata.platform,
            detectedQuality: enhancedMetadata.quality,
            detectedFormat: enhancedMetadata.format,
            detectedEdition: enhancedMetadata.edition,
          },
        });
        this.logger.log(`Re-queued completed item (no matching request found): ${folderPath}`);
        return true; // Count as a queued folder
      } else {
        this.logger.debug(`Folder already in organize queue with status ${existingQueueItem.status}: ${folderPath}`);
        return false;
      }
    }

    // Add to organize queue for manual processing
    await this.prisma.organizeQueue.create({
      data: {
        folderPath,
        contentType,
        detectedTitle: enhancedMetadata.title,
        detectedYear: enhancedMetadata.year,
        detectedSeason: enhancedMetadata.season,
        detectedEpisode: enhancedMetadata.episode,
        detectedPlatform: enhancedMetadata.platform,
        detectedQuality: enhancedMetadata.quality,
        detectedFormat: enhancedMetadata.format,
        detectedEdition: enhancedMetadata.edition,
        status: 'PENDING',
      },
    });

    this.logger.debug(`Added folder to organize queue for manual processing: ${folderPath}`);
    return true;
  }

  /**
   * Check if folder name matches expected naming conventions
   */
  private doesFolderMatchNamingConvention(folderName: string, contentType: ContentType, metadata: any): boolean {
    // Basic validation - folder must have a title
    if (!metadata.title || metadata.title === 'Unknown') {
      return false;
    }

    // Content type specific validation
    switch (contentType) {
      case ContentType.MOVIE:
        // Movies should have title and year: "Movie Title (2023)"
        return !!(metadata.title && metadata.year);

      case ContentType.TV_SHOW:
        // TV shows should have title and either season or year: "Show Title (2023)" or "Show Title S01"
        return !!(metadata.title && (metadata.year || metadata.season));

      case ContentType.GAME:
        // Games should have title and platform: "Game Title (Platform)"
        return !!(metadata.title && metadata.platform);

      default:
        return false;
    }
  }

  private async getMediaFilesRecursively(dirPath: string): Promise<string[]> {
    const mediaExtensions = [
      // Video files
      '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v',
      // Audio files
      '.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a',
      // Game files (common ROM extensions)
      '.iso', '.rom', '.bin', '.cue', '.img', '.nrg', '.mdf', '.mds',
      '.nes', '.smc', '.sfc', '.gb', '.gbc', '.gba', '.nds', '.3ds',
      '.z64', '.n64', '.v64', '.psx', '.ps2', '.gcm', '.wbfs', '.rvz',
    ];

    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getMediaFilesRecursively(fullPath);
          files.push(...subFiles);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (mediaExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error reading directory ${dirPath}:`, error);
    }
    
    return files;
  }

  /**
   * Get folders in a directory (not recursive, only direct children)
   */
  private async getFoldersInDirectory(dirPath: string): Promise<string[]> {
    const folders: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);
          folders.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.error(`Error reading directory ${dirPath}:`, error);
    }

    return folders;
  }

  /**
   * Find content folders in a directory, handling both simple and nested patterns
   */
  private async findContentFolders(dirPath: string, contentType: ContentType, rules: any[]): Promise<Array<{ path: string; metadata: any }>> {
    const contentFolders: Array<{ path: string; metadata: any }> = [];

    // First, scan for simple top-level folders
    const topLevelFolders = await this.getFoldersInDirectory(dirPath);

    for (const folderPath of topLevelFolders) {
      const folderName = path.basename(folderPath);
      const metadata = this.extractMetadataFromPath(folderPath, contentType);

      // Check if this folder contains media files
      const hasMediaFiles = await this.hasMediaFiles(folderPath);

      if (hasMediaFiles) {
        contentFolders.push({ path: folderPath, metadata });
      } else {
        // Check for nested content (e.g., TV shows with season folders)
        const nestedContent = await this.findNestedContent(folderPath, contentType, rules);
        contentFolders.push(...nestedContent);
      }
    }

    return contentFolders;
  }

  /**
   * Find nested content in a folder (e.g., TV show seasons)
   */
  private async findNestedContent(parentPath: string, contentType: ContentType, rules: any[]): Promise<Array<{ path: string; metadata: any }>> {
    const nestedContent: Array<{ path: string; metadata: any }> = [];

    // For TV shows, look for season folders
    if (contentType === ContentType.TV_SHOW) {
      const subFolders = await this.getFoldersInDirectory(parentPath);

      for (const subFolder of subFolders) {
        const subFolderName = path.basename(subFolder);

        // Check if this looks like a season folder
        if (this.isSeasonFolder(subFolderName)) {
          const hasMediaFiles = await this.hasMediaFiles(subFolder);

          if (hasMediaFiles) {
            const metadata = this.extractMetadataFromPath(parentPath, contentType);
            // Extract season number from folder name
            const seasonMatch = subFolderName.match(/season\s*(\d+)/i) || subFolderName.match(/s(\d+)/i);
            if (seasonMatch) {
              metadata.season = parseInt(seasonMatch[1]);
            }

            nestedContent.push({ path: parentPath, metadata }); // Use parent path as the main content folder
            break; // Found at least one season, don't need to check more
          }
        }
      }
    }

    return nestedContent;
  }

  /**
   * Check if a folder name looks like a season folder
   */
  private isSeasonFolder(folderName: string): boolean {
    const seasonPatterns = [
      /^season\s*\d+$/i,
      /^s\d+$/i,
      /^season\s*\d+/i,
      /^s\d+/i,
    ];

    return seasonPatterns.some(pattern => pattern.test(folderName));
  }

  /**
   * Check if a folder contains media files
   */
  private async hasMediaFiles(folderPath: string): Promise<boolean> {
    const mediaFiles = await this.getMediaFilesRecursively(folderPath);
    return mediaFiles.length > 0;
  }

  /**
   * Extract metadata from folder path, considering nested structures
   */
  private extractMetadataFromPath(folderPath: string, contentType: ContentType): any {
    const folderName = path.basename(folderPath);

    // Start with basic extraction
    let metadata = this.organizationRulesService.extractMetadataFromFileName(folderName, contentType);

    // Enhanced extraction for better identification
    metadata = this.enhanceBasicMetadataExtraction(folderName, contentType, metadata);

    return metadata;
  }

  /**
   * Enhanced metadata extraction with better patterns
   */
  private enhanceBasicMetadataExtraction(folderName: string, contentType: ContentType, metadata: any): any {
    // More flexible year extraction
    const yearMatch = folderName.match(/\((\d{4})\)|\[(\d{4})\]|(\d{4})/);
    if (yearMatch) {
      metadata.year = parseInt(yearMatch[1] || yearMatch[2] || yearMatch[3]);
    }

    // Extract title more intelligently
    if (contentType === ContentType.MOVIE) {
      // Remove common movie suffixes and quality indicators
      let title = folderName
        .replace(/\(\d{4}\)/, '') // Remove year
        .replace(/\[\d{4}\]/, '') // Remove year in brackets
        .replace(/\d{4}/, '') // Remove standalone year
        .replace(/\.(720p|1080p|2160p|4K|BluRay|WEBRip|DVDRip|HDTV|WEB-DL).*$/i, '') // Remove quality
        .replace(/\.(mkv|mp4|avi|mov)$/i, '') // Remove extensions
        .replace(/[\.\-_]/g, ' ') // Replace dots, dashes, underscores with spaces
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();

      if (title && title !== 'Unknown') {
        metadata.title = title;
      }
    } else if (contentType === ContentType.TV_SHOW) {
      // Similar for TV shows
      let title = folderName
        .replace(/\(\d{4}\)/, '')
        .replace(/\[\d{4}\]/, '')
        .replace(/\d{4}/, '')
        .replace(/[Ss]\d+([Ee]\d+)?.*$/, '') // Remove season/episode info
        .replace(/[\.\-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (title && title !== 'Unknown') {
        metadata.title = title;
      }
    } else if (contentType === ContentType.GAME) {
      // Extract platform from parentheses
      const platformMatch = folderName.match(/\(([^)]+)\)/);
      if (platformMatch) {
        metadata.platform = platformMatch[1];

        // Remove platform from title
        let title = folderName
          .replace(/\([^)]+\)/, '')
          .replace(/[\.\-_]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (title && title !== 'Unknown') {
          metadata.title = title;
        }
      }
    }

    return metadata;
  }

  /**
   * Enhance metadata with external API data
   */
  private async enhanceMetadataWithExternalAPIs(metadata: any, contentType: ContentType): Promise<any> {
    if (!metadata.title || metadata.title === 'Unknown') {
      return metadata;
    }

    try {
      const enrichedMetadata = await this.fetchExternalMetadata(metadata, contentType);
      return { ...metadata, ...enrichedMetadata };
    } catch (error) {
      this.logger.debug(`Failed to enhance metadata for ${metadata.title}:`, error.message);
      return metadata;
    }
  }

  /**
   * Check if a folder contains valid content
   */
  private async isValidContentFolder(folderPath: string, contentType: ContentType, metadata: any): Promise<boolean> {
    // Must have a title
    if (!metadata.title || metadata.title === 'Unknown') {
      return false;
    }

    // Must contain media files
    const hasMedia = await this.hasMediaFiles(folderPath);
    if (!hasMedia) {
      return false;
    }

    // Content type specific validation
    if (contentType === ContentType.MOVIE) {
      // Movies should have a year
      return metadata.year && metadata.year > 1900 && metadata.year <= new Date().getFullYear() + 5;
    } else if (contentType === ContentType.TV_SHOW) {
      // TV shows should have a title, year is optional
      return true;
    } else if (contentType === ContentType.GAME) {
      // Games should have a title, platform is optional
      return true;
    }

    return true;
  }

  /**
   * Determine if content can be auto-imported based on metadata confidence
   */
  private async canAutoImportContent(metadata: any, contentType: ContentType): Promise<boolean> {
    // Must have a title
    if (!metadata.title || metadata.title === 'Unknown' || metadata.title.trim().length < 2) {
      return false;
    }

    // First check if the title itself is problematic (before even checking external APIs)
    if (!this.isTitleSuitableForAutoImport(metadata.title)) {
      return false;
    }

    // Content type specific validation
    if (contentType === ContentType.MOVIE) {
      // Movies need a valid year for confident identification
      if (!metadata.year || metadata.year < 1900 || metadata.year > new Date().getFullYear() + 2) {
        return false;
      }

      // Even with external API data, be more conservative
      if (metadata.tmdbId || metadata.imdbId) {
        // Still check if the title is well-formatted
        return this.isWellFormattedMovieTitle(metadata.title, metadata.year);
      }

      // For movies without external API confirmation, be very strict
      return this.isWellFormattedMovieTitle(metadata.title, metadata.year);
    } else if (contentType === ContentType.TV_SHOW) {
      // TV shows are trickier - be very conservative
      // Only auto-import if we have external API confirmation AND well-formatted title
      if ((metadata.tmdbId || metadata.imdbId) && this.isWellFormattedTvTitle(metadata.title, metadata.year)) {
        return true;
      }

      return false; // Default to manual processing for TV shows
    } else if (contentType === ContentType.GAME) {
      // Games need platform for confident identification
      if (!metadata.platform) {
        return false;
      }

      // Even with IGDB data, check title quality
      if (metadata.igdbId && this.isWellFormattedGameTitle(metadata.title, metadata.platform)) {
        return true;
      }

      return false; // Default to manual processing for games without API confirmation
    }

    return false; // Default to manual processing
  }

  /**
   * Check if a title is suitable for auto-import (basic quality check)
   */
  private isTitleSuitableForAutoImport(title: string): boolean {
    // Title should be reasonable length
    if (title.length < 3 || title.length > 100) {
      return false;
    }

    // Reject titles that are clearly problematic
    const rejectPatterns = [
      /^(unknown|movie|film|video|sample|trailer|extras|bonus)$/i,
      /^(unknown|movie|film)[\.\-_\s]/i,
      /\b(720p|1080p|2160p|4k|bluray|webrip|dvdrip|hdtv|web-dl|x264|x265|hevc|aac|ac3)\b/i,
      /\b(sample|trailer|extras|bonus|rarbg|yify|eztv)\b/i,
      /\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i,
      /\b(disc|disk|cd|dvd)\s*\d+/i,
      /^[^a-zA-Z]/, // Must start with a letter
      /^\w{1,3}$/, // Too short (1-3 characters)
    ];

    if (rejectPatterns.some(pattern => pattern.test(title))) {
      return false;
    }

    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(title)) {
      return false;
    }

    // Should not be mostly numbers or special characters
    const letterCount = (title.match(/[a-zA-Z]/g) || []).length;
    const totalLength = title.length;
    if (letterCount / totalLength < 0.5) {
      return false;
    }

    return true;
  }

  /**
   * Check if a movie title is well-formatted and likely correct
   */
  private isWellFormattedMovieTitle(title: string, year: number): boolean {
    // Title should be reasonable length (more strict than basic check)
    if (title.length < 3 || title.length > 80) {
      return false;
    }

    // Additional strict patterns for movies
    const strictBadPatterns = [
      /\b(rip|cam|ts|tc|scr|dvdscr|brrip|hdrip)\b/i,
      /\b(repack|proper|internal|limited|unrated|extended|directors?\.cut)\b/i,
      /\b(multi|dual|audio|subs?|subtitles?)\b/i,
      /[\[\(].*?(group|team|release).*?[\]\)]/i,
      /\b\d{4}\b.*\b\d{4}\b/, // Multiple years
    ];

    if (strictBadPatterns.some(pattern => pattern.test(title))) {
      return false;
    }

    // Should look like a proper movie title
    // Must have at least 2 words or be a well-known single word
    const words = title.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 2) {
      // Single word titles must be at least 4 characters and not common words
      const commonWords = ['movie', 'film', 'video', 'show', 'series', 'game'];
      if (title.length < 4 || commonWords.includes(title.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a TV show title is well-formatted and likely correct
   */
  private isWellFormattedTvTitle(title: string, year: number): boolean {
    // Very strict validation for TV shows
    if (title.length < 3 || title.length > 80) {
      return false;
    }

    // Should not contain season/episode info or quality indicators
    const badPatterns = [
      /\b(s\d+|season\s*\d+|e\d+|episode\s*\d+)\b/i,
      /\b(720p|1080p|2160p|4k|bluray|webrip|dvdrip|hdtv|web-dl|x264|x265)\b/i,
      /\.(mkv|mp4|avi|mov)$/i,
      /\b(complete|series|collection)\b/i,
    ];

    if (badPatterns.some(pattern => pattern.test(title))) {
      return false;
    }

    // Must have at least 2 words for TV shows (more conservative)
    const words = title.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 2) {
      return false;
    }

    return true;
  }

  /**
   * Check if a game title is well-formatted and likely correct
   */
  private isWellFormattedGameTitle(title: string, platform: string): boolean {
    if (title.length < 3 || title.length > 80) {
      return false;
    }

    // Should not contain ROM or file artifacts
    const badPatterns = [
      /\b(rom|iso|bin|cue|img|nrg)\b/i,
      /\b(crack|keygen|patch|trainer)\b/i,
      /\.(zip|rar|7z|exe)$/i,
    ];

    if (badPatterns.some(pattern => pattern.test(title))) {
      return false;
    }

    // Platform should be recognizable
    const knownPlatforms = [
      'PC', 'PlayStation', 'PS1', 'PS2', 'PS3', 'PS4', 'PS5',
      'Xbox', 'Xbox 360', 'Xbox One', 'Xbox Series X', 'Xbox Series S',
      'Nintendo Switch', 'Nintendo 3DS', 'Nintendo DS', 'Wii', 'Wii U',
      'GameCube', 'N64', 'SNES', 'NES', 'Game Boy', 'PSP', 'PS Vita'
    ];

    const platformRecognized = knownPlatforms.some(known =>
      platform.toLowerCase().includes(known.toLowerCase()) ||
      known.toLowerCase().includes(platform.toLowerCase())
    );

    if (!platformRecognized) {
      return false;
    }

    // Must have at least 2 words or be a well-known single word game
    const words = title.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 2 && title.length < 6) {
      return false;
    }

    return true;
  }

  /**
   * Find a matching torrent request for the given metadata
   */
  private async findMatchingRequest(metadata: any, contentType: ContentType): Promise<any> {
    const whereClause: any = {
      contentType,
      title: {
        contains: metadata.title,
        mode: 'insensitive',
      },
    };

    // Add year filter if available
    if (metadata.year) {
      whereClause.year = metadata.year;
    }

    // Add season/episode filters for TV shows
    if (contentType === ContentType.TV_SHOW) {
      if (metadata.season) {
        whereClause.season = metadata.season;
      }
      if (metadata.episode) {
        whereClause.episode = metadata.episode;
      }
    }

    // Add platform filter for games
    if (contentType === ContentType.GAME && metadata.platform) {
      whereClause.platform = {
        contains: metadata.platform,
        mode: 'insensitive',
      };
    }

    return this.prisma.requestedTorrent.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a request for reverse-indexed content with proper metadata
   * TV shows are created as PENDING to search for missing episodes
   * Other content types are created as COMPLETED
   */
  private async createCompletedRequest(metadata: any, contentType: ContentType): Promise<any> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Try to fetch proper metadata from external APIs
    const enrichedMetadata = await this.fetchExternalMetadata(metadata, contentType);

    // TV shows should be PENDING to search for missing episodes
    const isCompleted = contentType !== ContentType.TV_SHOW;
    const status = isCompleted ? 'COMPLETED' : 'PENDING';

    const requestData: any = {
      contentType,
      title: enrichedMetadata.title || metadata.title || 'Unknown',
      status,
      priority: 5,
      preferredQualities: ['HD_1080P'],
      preferredFormats: ['X265'],
      minSeeders: 0,
      maxSizeGB: contentType === ContentType.GAME ? 50 : 20,
      blacklistedWords: [],
      trustedIndexers: [],
      searchAttempts: 0,
      maxSearchAttempts: contentType === ContentType.TV_SHOW ? 10 : 1,
      searchIntervalMins: 30,
      expiresAt,
      foundTorrentTitle: enrichedMetadata.title || metadata.title || 'Unknown',
      foundIndexer: 'Reverse Index',
    };

    // Only set completion data for non-TV shows
    if (isCompleted) {
      requestData.completedAt = now;
    }

    // Add enriched metadata
    if (enrichedMetadata.year || metadata.year) {
      requestData.year = enrichedMetadata.year || metadata.year;
    }

    if (enrichedMetadata.tmdbId) {
      requestData.tmdbId = parseInt(enrichedMetadata.tmdbId);
    }

    if (enrichedMetadata.imdbId) {
      requestData.imdbId = enrichedMetadata.imdbId;
    }

    if (enrichedMetadata.genre) {
      requestData.genre = Array.isArray(enrichedMetadata.genre)
        ? enrichedMetadata.genre.join(', ')
        : enrichedMetadata.genre;
    }

    if (contentType === ContentType.TV_SHOW) {
      // TV shows should always be ongoing requests for reverse indexing
      requestData.isOngoing = true;

      if (metadata.season) {
        requestData.season = metadata.season;
      }
      if (metadata.episode) {
        requestData.episode = metadata.episode;
      }
    }

    if (contentType === ContentType.GAME) {
      if (enrichedMetadata.igdbId) {
        requestData.igdbId = parseInt(enrichedMetadata.igdbId);
      }
      if (metadata.platform || enrichedMetadata.platform) {
        requestData.platform = metadata.platform || enrichedMetadata.platform;
      }
    }

    const createdRequest = await this.prisma.requestedTorrent.create({
      data: requestData,
    });

    this.logger.log(`Created completed request for reverse-indexed content: ${createdRequest.title} (ID: ${createdRequest.id})`);

    // For TV shows, populate seasons and scan for episodes
    if (contentType === ContentType.TV_SHOW) {
      try {
        this.logger.log(`Populating seasons and scanning episodes for TV show: ${createdRequest.title}`);
        await this.seasonScanningService.scanTvShowRequest(createdRequest.id);
      } catch (error) {
        this.logger.warn(`Failed to populate seasons for TV show ${createdRequest.title}:`, error);
      }
    }

    return createdRequest;
  }

  /**
   * Fetch metadata from external APIs (TMDB/IGDB)
   */
  private async fetchExternalMetadata(metadata: any, contentType: ContentType): Promise<any> {
    try {
      if (contentType === ContentType.MOVIE) {
        return await this.fetchMovieMetadata(metadata);
      } else if (contentType === ContentType.TV_SHOW) {
        return await this.fetchTvShowMetadata(metadata);
      } else if (contentType === ContentType.GAME) {
        return await this.fetchGameMetadata(metadata);
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch external metadata for ${metadata.title}:`, error.message);
    }

    return metadata; // Return original metadata if external fetch fails
  }

  /**
   * Fetch movie metadata from TMDB
   */
  private async fetchMovieMetadata(metadata: any): Promise<any> {
    const searchResponse = await this.tmdbService.searchMovies(metadata.title, metadata.year);

    if (searchResponse.success && searchResponse.data && searchResponse.data.length > 0) {
      const movie = searchResponse.data[0];

      // Get detailed metadata
      const detailsResponse = await this.tmdbService.getMovieDetails(movie.id);
      if (detailsResponse.success && detailsResponse.data) {
        return {
          ...metadata,
          title: detailsResponse.data.title,
          year: detailsResponse.data.year,
          tmdbId: detailsResponse.data.id,
          imdbId: detailsResponse.data.imdbId,
          genre: detailsResponse.data.genre,
        };
      }
    }

    return metadata;
  }

  /**
   * Fetch TV show metadata from TMDB
   */
  private async fetchTvShowMetadata(metadata: any): Promise<any> {
    const searchResponse = await this.tmdbService.searchTvShows(metadata.title, metadata.year);

    if (searchResponse.success && searchResponse.data && searchResponse.data.length > 0) {
      const tvShow = searchResponse.data[0];

      // Get detailed metadata
      const detailsResponse = await this.tmdbService.getTvShowDetails(tvShow.id);
      if (detailsResponse.success && detailsResponse.data) {
        return {
          ...metadata,
          title: detailsResponse.data.title,
          year: detailsResponse.data.year,
          tmdbId: detailsResponse.data.id,
          imdbId: detailsResponse.data.imdbId,
          genre: detailsResponse.data.genre,
        };
      }
    }

    return metadata;
  }

  /**
   * Fetch game metadata from IGDB
   */
  private async fetchGameMetadata(metadata: any): Promise<any> {
    const searchResponse = await this.igdbService.searchGames(metadata.title, metadata.platform);

    if (searchResponse.success && searchResponse.data && searchResponse.data.length > 0) {
      const game = searchResponse.data[0];

      // Get detailed metadata
      const detailsResponse = await this.igdbService.getGameDetails(game.id);
      if (detailsResponse.success && detailsResponse.data) {
        return {
          ...metadata,
          title: detailsResponse.data.title,
          year: detailsResponse.data.year,
          igdbId: detailsResponse.data.id,
          genre: detailsResponse.data.genre,
          platform: detailsResponse.data.platforms?.[0] || metadata.platform,
        };
      }
    }

    return metadata;
  }

  /**
   * Get organize queue items with optional filtering
   */
  async getOrganizeQueue(params?: {
    status?: string;
    contentType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: any[]; total: number }> {
    const where: any = {};

    // By default, exclude completed items from the organize queue
    if (params?.status) {
      where.status = params.status;
    } else {
      // Only show items that need action: PENDING, PROCESSING, FAILED
      where.status = {
        in: ['PENDING', 'PROCESSING', 'FAILED']
      };
    }

    if (params?.contentType) {
      where.contentType = params.contentType;
    }

    const [items, total] = await Promise.all([
      this.prisma.organizeQueue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit || 50,
        skip: params?.offset || 0,
      }),
      this.prisma.organizeQueue.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get organize queue statistics
   */
  async getOrganizeQueueStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    skipped: number;
  }> {
    const [totalActionable, pending, processing, completed, failed, skipped] = await Promise.all([
      // Total actionable items (excluding completed and skipped)
      this.prisma.organizeQueue.count({
        where: {
          status: { in: ['PENDING', 'PROCESSING', 'FAILED'] }
        }
      }),
      this.prisma.organizeQueue.count({ where: { status: 'PENDING' } }),
      this.prisma.organizeQueue.count({ where: { status: 'PROCESSING' } }),
      this.prisma.organizeQueue.count({ where: { status: 'COMPLETED' } }),
      this.prisma.organizeQueue.count({ where: { status: 'FAILED' } }),
      this.prisma.organizeQueue.count({ where: { status: 'SKIPPED' } }),
    ]);

    return {
      total: totalActionable, // Only count actionable items in the main total
      pending,
      processing,
      completed,
      failed,
      skipped
    };
  }

  /**
   * Process an organize queue item
   */
  async processOrganizeQueueItem(id: string, data: {
    selectedTmdbId?: string;
    selectedIgdbId?: string;
    selectedTitle?: string;
    selectedYear?: number;
    selectedPlatform?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const item = await this.prisma.organizeQueue.findUnique({
        where: { id },
      });

      if (!item) {
        throw new Error('Queue item not found');
      }

      // Update the item with selected metadata
      await this.prisma.organizeQueue.update({
        where: { id },
        data: {
          status: 'PROCESSING',
          selectedTmdbId: data.selectedTmdbId,
          selectedIgdbId: data.selectedIgdbId,
          selectedTitle: data.selectedTitle,
          selectedYear: data.selectedYear,
          selectedPlatform: data.selectedPlatform,
        },
      });

      // Create a completed request with the selected metadata
      const metadata = {
        title: data.selectedTitle || item.detectedTitle,
        year: data.selectedYear || item.detectedYear,
        season: item.detectedSeason,
        episode: item.detectedEpisode,
        platform: data.selectedPlatform || item.detectedPlatform,
        quality: item.detectedQuality,
        format: item.detectedFormat,
        edition: item.detectedEdition,
      };

      const createdRequest = await this.createCompletedRequest(metadata, item.contentType);

      // Re-organize files in the folder to match organization rules
      await this.reorganizeFilesInFolder(item.folderPath, metadata, item.contentType, createdRequest.id);

      // Mark as completed
      await this.prisma.organizeQueue.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      this.logger.log(`Successfully processed organize queue item: ${item.detectedTitle} -> Request ID: ${createdRequest.id}`);

      this.logger.log(`Processed organize queue item: ${item.folderPath}`);
      return { success: true, message: 'Item processed successfully' };
    } catch (error) {
      this.logger.error(`Failed to process organize queue item ${id}:`, error);

      // Mark as failed
      await this.prisma.organizeQueue.update({
        where: { id },
        data: {
          status: 'FAILED',
          processedAt: new Date(),
        },
      });

      return { success: false, message: error.message || 'Failed to process item' };
    }
  }

  /**
   * Skip an organize queue item
   */
  async skipOrganizeQueueItem(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.prisma.organizeQueue.update({
        where: { id },
        data: {
          status: 'SKIPPED',
          processedAt: new Date(),
        },
      });

      this.logger.log(`Skipped organize queue item: ${id}`);
      return { success: true, message: 'Item skipped successfully' };
    } catch (error) {
      this.logger.error(`Failed to skip organize queue item ${id}:`, error);
      return { success: false, message: 'Failed to skip item' };
    }
  }

  /**
   * Delete an organize queue item
   */
  async deleteOrganizeQueueItem(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.prisma.organizeQueue.delete({
        where: { id },
      });

      this.logger.log(`Deleted organize queue item: ${id}`);
      return { success: true, message: 'Item deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete organize queue item ${id}:`, error);
      return { success: false, message: 'Failed to delete item' };
    }
  }

  /**
   * Re-organize files in a folder to match organization rules
   */
  private async reorganizeFilesInFolder(folderPath: string, metadata: any, contentType: ContentType, requestedTorrentId: string): Promise<void> {
    try {
      this.logger.log(`Re-organizing files in folder: ${folderPath}`);

      // Check if folder exists
      try {
        await fs.access(folderPath);
      } catch {
        this.logger.warn(`Folder does not exist, skipping reorganization: ${folderPath}`);
        return;
      }

      // Get all media files in the folder recursively
      const mediaFiles = await this.getMediaFilesRecursively(folderPath);

      if (mediaFiles.length === 0) {
        this.logger.warn(`No media files found in folder: ${folderPath}`);
        return;
      }

      this.logger.log(`Found ${mediaFiles.length} media files to reorganize in: ${folderPath}`);

      // Organize each media file
      let reorganizedCount = 0;
      let skippedCount = 0;

      for (const filePath of mediaFiles) {
        try {
          // Check if file is already organized (has an organized file record)
          const existingOrganizedFile = await this.prisma.organizedFile.findFirst({
            where: {
              OR: [
                { originalPath: filePath },
                { organizedPath: filePath },
              ],
            },
          });

          // Create organization context for the file
          const fileName = path.basename(filePath);
          const fileMetadata = this.organizationRulesService.extractMetadataFromFileName(fileName, contentType);

          // For TV shows, also try to extract season/episode info from the folder structure
          let enhancedMetadata = { ...fileMetadata };
          if (contentType === ContentType.TV_SHOW) {
            enhancedMetadata = this.extractTvShowMetadataFromPath(filePath, fileMetadata);
          }

          // Use the selected metadata from the queue item, falling back to enhanced detected metadata
          const organizationContext: OrganizationContext = {
            originalPath: filePath,
            fileName,
            contentType,
            title: metadata.title || enhancedMetadata.title || 'Unknown',
            year: metadata.year || enhancedMetadata.year,
            season: metadata.season || enhancedMetadata.season,
            episode: metadata.episode || enhancedMetadata.episode,
            platform: metadata.platform || enhancedMetadata.platform,
            quality: metadata.quality || enhancedMetadata.quality,
            format: metadata.format || enhancedMetadata.format,
            edition: metadata.edition || enhancedMetadata.edition,
          };

          // Use the file organization service to move the file
          const result = await this.fileOrganizationService.organizeFile(organizationContext, requestedTorrentId);

          if (result.success) {
            this.logger.log(`Successfully reorganized: ${filePath} -> ${result.organizedPath}`);
            reorganizedCount++;

            // If there was an existing organized file record, update it
            if (existingOrganizedFile) {
              await this.prisma.organizedFile.update({
                where: { id: existingOrganizedFile.id },
                data: {
                  organizedPath: result.organizedPath,
                  isReverseIndexed: false, // Now it's properly organized
                },
              });
            }
          } else {
            this.logger.warn(`Failed to reorganize ${filePath}: ${result.error}`);
            skippedCount++;
          }

        } catch (error) {
          this.logger.error(`Error reorganizing file ${filePath}:`, error);
          skippedCount++;
        }
      }

      this.logger.log(`Reorganization complete for folder ${folderPath}: ${reorganizedCount} reorganized, ${skippedCount} skipped`);

      // Clean up empty directories after reorganization
      if (reorganizedCount > 0) {
        await this.cleanupEmptyDirectories(folderPath);
      }

    } catch (error) {
      this.logger.error(`Error reorganizing files in folder ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * Extract TV show metadata from file path, including season/episode info from folder structure
   */
  private extractTvShowMetadataFromPath(filePath: string, baseMetadata: any): any {
    const enhancedMetadata = { ...baseMetadata };

    // Get the directory path and file name
    const dirPath = path.dirname(filePath);
    const fileName = path.basename(filePath);

    // Try to extract season from the parent directory name
    const parentDirName = path.basename(dirPath);
    const seasonMatch = parentDirName.match(/season\s*(\d+)/i) || parentDirName.match(/s(\d+)/i);

    if (seasonMatch) {
      enhancedMetadata.season = parseInt(seasonMatch[1]);
      this.logger.debug(`Extracted season ${enhancedMetadata.season} from directory: ${parentDirName}`);
    }

    // Try to extract episode from the file name if not already extracted
    if (!enhancedMetadata.episode) {
      // Look for episode patterns in the filename
      const episodePatterns = [
        /[Ss](\d+)[Ee](\d+)/,  // S01E01
        /[Ss](\d+)\s*[Ee](\d+)/, // S01 E01
        /Season\s*(\d+).*Episode\s*(\d+)/i, // Season 1 Episode 1
        /(\d+)x(\d+)/, // 1x01
      ];

      for (const pattern of episodePatterns) {
        const match = fileName.match(pattern);
        if (match) {
          if (!enhancedMetadata.season && match[1]) {
            enhancedMetadata.season = parseInt(match[1]);
          }
          if (match[2]) {
            enhancedMetadata.episode = parseInt(match[2]);
          }
          this.logger.debug(`Extracted S${enhancedMetadata.season}E${enhancedMetadata.episode} from filename: ${fileName}`);
          break;
        }
      }
    }

    // If we still don't have season info, try to extract from the show folder structure
    if (!enhancedMetadata.season) {
      // Look at the grandparent directory (show folder) and parent directory (season folder)
      const pathParts = filePath.split(path.sep);

      // Find season folder in the path
      for (let i = pathParts.length - 2; i >= 0; i--) {
        const folderName = pathParts[i];
        const seasonMatch = folderName.match(/season\s*(\d+)/i) || folderName.match(/s(\d+)$/i);
        if (seasonMatch) {
          enhancedMetadata.season = parseInt(seasonMatch[1]);
          this.logger.debug(`Extracted season ${enhancedMetadata.season} from path part: ${folderName}`);
          break;
        }
      }
    }

    return enhancedMetadata;
  }

  /**
   * Clean up empty directories recursively after file reorganization
   */
  private async cleanupEmptyDirectories(startPath: string): Promise<void> {
    try {
      await this.cleanupEmptyDirectoriesRecursive(startPath);
    } catch (error) {
      this.logger.warn(`Error during directory cleanup for ${startPath}:`, error);
    }
  }

  /**
   * Recursively clean up empty directories, working from deepest to shallowest
   */
  private async cleanupEmptyDirectoriesRecursive(dirPath: string): Promise<boolean> {
    try {
      // Check if directory exists
      try {
        await fs.access(dirPath);
      } catch {
        // Directory doesn't exist, consider it "cleaned"
        return true;
      }

      // Get directory contents
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      // Track if any subdirectories were removed
      let removedSubdirs = false;

      // First, recursively clean up subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(dirPath, entry.name);
          const wasRemoved = await this.cleanupEmptyDirectoriesRecursive(subDirPath);
          if (wasRemoved) {
            removedSubdirs = true;
          }
        }
      }

      // If we removed subdirectories, re-read the directory contents
      if (removedSubdirs) {
        const updatedEntries = await fs.readdir(dirPath, { withFileTypes: true });

        // Check if directory is now empty
        if (updatedEntries.length === 0) {
          await fs.rmdir(dirPath);
          this.logger.log(`Removed empty directory: ${dirPath}`);
          return true;
        }
      } else {
        // Check if directory is empty (no files or subdirectories)
        if (entries.length === 0) {
          await fs.rmdir(dirPath);
          this.logger.log(`Removed empty directory: ${dirPath}`);
          return true;
        }

        // Check if directory only contains empty subdirectories or hidden files
        const hasRealContent = entries.some(entry => {
          // Skip hidden files/directories (starting with .)
          if (entry.name.startsWith('.')) {
            return false;
          }
          // If it's a file, it's real content
          if (entry.isFile()) {
            return true;
          }
          // For directories, we'll check them recursively above
          return false;
        });

        if (!hasRealContent) {
          // Directory only has hidden files or empty subdirectories
          // Remove any remaining hidden files first
          for (const entry of entries) {
            if (entry.isFile() && entry.name.startsWith('.')) {
              const hiddenFilePath = path.join(dirPath, entry.name);
              try {
                await fs.unlink(hiddenFilePath);
                this.logger.debug(`Removed hidden file: ${hiddenFilePath}`);
              } catch (error) {
                this.logger.warn(`Failed to remove hidden file ${hiddenFilePath}:`, error);
              }
            }
          }

          // Try to remove the directory
          try {
            await fs.rmdir(dirPath);
            this.logger.log(`Removed empty directory: ${dirPath}`);
            return true;
          } catch (error) {
            // Directory might not be empty due to system files or permissions
            this.logger.debug(`Could not remove directory ${dirPath}:`, error.message);
          }
        }
      }

      return false;
    } catch (error) {
      this.logger.warn(`Error cleaning up directory ${dirPath}:`, error);
      return false;
    }
  }
}
