import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationRulesService } from './organization-rules.service';
import { ContentType } from '../../../generated/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ReverseIndexingService {
  private readonly logger = new Logger(ReverseIndexingService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationRulesService: OrganizationRulesService,
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
      
      const duration = Date.now() - startTime;
      this.logger.log(`Reverse indexing completed in ${duration}ms. Found ${results.totalFiles} files, indexed ${results.newFiles} new files`);

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
      const results = await this.scanLibraryDirectories();
      
      return {
        success: true,
        message: `Reverse indexing completed. Found ${results.totalFiles} files, indexed ${results.newFiles} new files`,
        results,
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

  private async scanLibraryDirectories(): Promise<{ totalFiles: number; newFiles: number; errors: number }> {
    const settings = await this.organizationRulesService.getSettings();
    const results = { totalFiles: 0, newFiles: 0, errors: 0 };

    // Scan each content type directory
    const contentTypes = [
      { type: ContentType.MOVIE, path: settings.moviesPath || `${settings.libraryPath}/movies` },
      { type: ContentType.TV_SHOW, path: settings.tvShowsPath || `${settings.libraryPath}/tv-shows` },
      { type: ContentType.GAME, path: settings.gamesPath || `${settings.libraryPath}/games` },
    ];

    for (const { type, path: dirPath } of contentTypes) {
      try {
        const dirResults = await this.scanDirectory(dirPath, type);
        results.totalFiles += dirResults.totalFiles;
        results.newFiles += dirResults.newFiles;
        results.errors += dirResults.errors;
      } catch (error) {
        this.logger.warn(`Error scanning directory ${dirPath}:`, error);
        results.errors++;
      }
    }

    return results;
  }

  private async scanDirectory(dirPath: string, contentType: ContentType): Promise<{ totalFiles: number; newFiles: number; errors: number }> {
    const results = { totalFiles: 0, newFiles: 0, errors: 0 };

    try {
      // Check if directory exists
      await fs.access(dirPath);
    } catch {
      this.logger.debug(`Directory does not exist: ${dirPath}`);
      return results;
    }

    this.logger.log(`Scanning directory: ${dirPath} for ${contentType}`);

    const files = await this.getMediaFilesRecursively(dirPath);
    results.totalFiles = files.length;

    for (const filePath of files) {
      try {
        const isNewFile = await this.indexFileIfNew(filePath, contentType);
        if (isNewFile) {
          results.newFiles++;
        }
      } catch (error) {
        this.logger.warn(`Error indexing file ${filePath}:`, error);
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
   * Create a completed request for a reverse-indexed file
   */
  private async createCompletedRequest(metadata: any, contentType: ContentType): Promise<any> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    const requestData: any = {
      contentType,
      title: metadata.title || 'Unknown',
      status: 'COMPLETED',
      priority: 5,
      preferredQualities: ['HD_1080P'],
      preferredFormats: ['X265'],
      minSeeders: 0,
      maxSizeGB: contentType === ContentType.GAME ? 50 : 20,
      blacklistedWords: [],
      trustedIndexers: [],
      searchAttempts: 0,
      maxSearchAttempts: 1,
      searchIntervalMins: 30,
      completedAt: now,
      expiresAt,
      foundTorrentTitle: metadata.title || 'Unknown',
      foundIndexer: 'Reverse Index',
    };

    // Add content-specific fields
    if (metadata.year) {
      requestData.year = metadata.year;
    }

    if (contentType === ContentType.TV_SHOW) {
      if (metadata.season) {
        requestData.season = metadata.season;
      }
      if (metadata.episode) {
        requestData.episode = metadata.episode;
      }
    }

    if (contentType === ContentType.GAME && metadata.platform) {
      requestData.platform = metadata.platform;
    }

    return this.prisma.requestedTorrent.create({
      data: requestData,
    });
  }
}
