import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationRulesService } from './organization-rules.service';
import { OrganizationContext, OrganizationResult } from '../interfaces/organization.interface';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FileOrganizationService {
  private readonly logger = new Logger(FileOrganizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationRulesService: OrganizationRulesService,
  ) {}

  /**
   * Ensure path is absolute and resolve it properly
   * This is important because the API runs from /app/packages/api but files are at /app/downloads, /app/library
   */
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return path.resolve(filePath);
    }

    // If it's a relative path, resolve it from the app root (/app) not the current working directory
    return path.resolve('/app', filePath);
  }

  /**
   * Organize a downloaded file
   */
  async organizeFile(context: OrganizationContext, requestedTorrentId?: string): Promise<OrganizationResult> {
    try {
      const resolvedOriginalPath = this.resolvePath(context.originalPath);
      this.logger.log(`Organizing file: ${context.originalPath} -> resolved: ${resolvedOriginalPath} (${context.contentType})`);

      // Check if file exists
      try {
        await fs.access(resolvedOriginalPath);
        this.logger.log(`File exists: ${resolvedOriginalPath}`);
      } catch (error) {
        this.logger.error(`File not found: ${resolvedOriginalPath}`, error);
        return {
          success: false,
          originalPath: context.originalPath,
          error: 'File not found',
        };
      }

      // Get organization settings
      const settings = await this.organizationRulesService.getSettings();

      // Extract archives if enabled
      let filesToOrganize: string[] = [resolvedOriginalPath];
      let extractedFiles: string[] = [];

      if (settings.extractArchives && this.isArchiveFile(resolvedOriginalPath)) {
        const extractResult = await this.extractArchive(resolvedOriginalPath);
        if (extractResult.success && extractResult.extractedFiles) {
          filesToOrganize = extractResult.extractedFiles;
          extractedFiles = extractResult.extractedFiles;

          // Delete original archive if configured
          if (settings.deleteAfterExtraction) {
            try {
              await fs.unlink(resolvedOriginalPath);
              this.logger.log(`Deleted archive: ${resolvedOriginalPath}`);
            } catch (error) {
              this.logger.warn(`Failed to delete archive ${resolvedOriginalPath}:`, error);
            }
          }
        }
      }

      // Organize each file
      const results: OrganizationResult[] = [];
      for (const filePath of filesToOrganize) {
        const fileContext: OrganizationContext = {
          ...context,
          originalPath: filePath,
          fileName: path.basename(filePath),
        };

        const result = await this.organizeIndividualFile(fileContext, requestedTorrentId);
        results.push(result);
      }

      // Aggregate results
      const successfulResults = results.filter(r => r.success);
      const failedResults = results.filter(r => !r.success);

      if (failedResults.length > 0) {
        this.logger.warn(`Some files failed to organize: ${failedResults.map(r => r.error).join(', ')}`);
      }

      return {
        success: successfulResults.length > 0,
        originalPath: context.originalPath,
        organizedPath: successfulResults[0]?.organizedPath,
        filesProcessed: successfulResults.length,
        extractedFiles: extractedFiles.length > 0 ? extractedFiles : undefined,
        error: failedResults.length > 0 ? `${failedResults.length} files failed to organize` : undefined,
      };

    } catch (error) {
      this.logger.error(`Error organizing file ${context.originalPath}:`, error);
      return {
        success: false,
        originalPath: context.originalPath,
        error: error.message,
      };
    }
  }

  /**
   * Organize multiple files from a directory
   */
  async organizeDirectory(directoryPath: string, context: Omit<OrganizationContext, 'originalPath' | 'fileName'>, requestedTorrentId?: string): Promise<OrganizationResult[]> {
    try {
      const resolvedDirectoryPath = this.resolvePath(directoryPath);
      this.logger.log(`Organizing directory: ${directoryPath} -> resolved: ${resolvedDirectoryPath}`);

      const files = await this.getFilesRecursively(resolvedDirectoryPath);
      const results: OrganizationResult[] = [];

      for (const filePath of files) {
        const fileContext: OrganizationContext = {
          ...context,
          originalPath: filePath,
          fileName: path.basename(filePath),
        };

        const result = await this.organizeFile(fileContext, requestedTorrentId);
        results.push(result);
      }

      return results;
    } catch (error) {
      this.logger.error(`Error organizing directory ${directoryPath}:`, error);
      return [{
        success: false,
        originalPath: directoryPath,
        error: error.message,
      }];
    }
  }

  private async organizeIndividualFile(context: OrganizationContext, requestedTorrentId?: string): Promise<OrganizationResult> {
    try {
      // Resolve paths to ensure they're absolute and correct
      const resolvedOriginalPath = this.resolvePath(context.originalPath);
      this.logger.log(`Organizing individual file: ${context.originalPath} -> resolved: ${resolvedOriginalPath}`);

      // Generate organized path
      const pathResult = await this.organizationRulesService.generateOrganizedPath(context);
      const resolvedDestinationPath = this.resolvePath(pathResult.fullPath);
      this.logger.log(`Generated organized path: ${pathResult.fullPath} -> resolved: ${resolvedDestinationPath}`);

      // Create destination directory
      const destinationDir = path.dirname(resolvedDestinationPath);
      await fs.mkdir(destinationDir, { recursive: true });
      this.logger.log(`Created destination directory: ${destinationDir}`);

      // Get file stats
      const stats = await fs.stat(resolvedOriginalPath);

      // Check if file already exists
      const settings = await this.organizationRulesService.getSettings();
      try {
        await fs.access(resolvedDestinationPath);

        if (!settings.replaceExistingFiles) {
          this.logger.warn(`File already exists and replace is disabled: ${resolvedDestinationPath}`);
          return {
            success: false,
            originalPath: context.originalPath,
            error: 'File already exists and replace is disabled',
          };
        }

        // Delete existing file
        await fs.unlink(resolvedDestinationPath);
        this.logger.log(`Replaced existing file: ${resolvedDestinationPath}`);
      } catch {
        // File doesn't exist, which is fine
      }

      // Move file to organized location
      try {
        await fs.rename(resolvedOriginalPath, resolvedDestinationPath);
        this.logger.log(`Successfully moved: ${resolvedOriginalPath} -> ${resolvedDestinationPath}`);
      } catch (error) {
        // If rename fails (e.g., cross-device link), fall back to copy + delete
        if (error.code === 'EXDEV') {
          this.logger.log(`Cross-device move detected, using copy+delete for: ${resolvedOriginalPath}`);
          await fs.copyFile(resolvedOriginalPath, resolvedDestinationPath);
          await fs.unlink(resolvedOriginalPath);
        } else {
          throw error;
        }
      }

      // Record in database
      await this.prisma.organizedFile.create({
        data: {
          originalPath: context.originalPath,
          organizedPath: resolvedDestinationPath,
          fileName: pathResult.fileName,
          fileSize: BigInt(stats.size),
          contentType: context.contentType,
          title: context.title,
          year: context.year,
          season: context.season,
          episode: context.episode,
          platform: context.platform,
          quality: context.quality,
          format: context.format,
          edition: context.edition,
          requestedTorrentId,
          isReverseIndexed: false,
        },
      });

      this.logger.log(`Successfully organized: ${context.originalPath} -> ${resolvedDestinationPath}`);

      return {
        success: true,
        originalPath: context.originalPath,
        organizedPath: resolvedDestinationPath,
        filesProcessed: 1,
      };

    } catch (error) {
      this.logger.error(`Error organizing individual file ${context.originalPath}:`, error);
      return {
        success: false,
        originalPath: context.originalPath,
        error: error.message,
      };
    }
  }

  private async extractArchive(archivePath: string): Promise<{ success: boolean; extractedFiles?: string[]; error?: string }> {
    try {
      const extractDir = path.join(path.dirname(archivePath), 'extracted');
      await fs.mkdir(extractDir, { recursive: true });

      // For now, we'll implement basic ZIP extraction
      // In a production environment, you'd want to use a proper archive library
      if (archivePath.toLowerCase().endsWith('.zip')) {
        // Use a proper ZIP extraction library here
        // For now, return the original file
        return {
          success: false,
          error: 'ZIP extraction not implemented yet',
        };
      }

      return {
        success: false,
        error: 'Unsupported archive format',
      };

    } catch (error) {
      this.logger.error(`Error extracting archive ${archivePath}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private isArchiveFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.zip', '.rar', '.7z', '.tar', '.tar.gz', '.tgz'].includes(ext);
  }

  private async getFilesRecursively(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const resolvedDirPath = this.resolvePath(dirPath);

    try {
      const entries = await fs.readdir(resolvedDirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(resolvedDirPath, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.getFilesRecursively(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.error(`Error reading directory ${resolvedDirPath}:`, error);
    }

    return files;
  }
}
