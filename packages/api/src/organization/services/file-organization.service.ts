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
   * Organize a downloaded file
   */
  async organizeFile(context: OrganizationContext, requestedTorrentId?: string): Promise<OrganizationResult> {
    try {
      this.logger.log(`Organizing file: ${context.originalPath} (${context.contentType})`);

      // Check if file exists
      try {
        await fs.access(context.originalPath);
        this.logger.log(`File exists: ${context.originalPath}`);
      } catch (error) {
        this.logger.error(`File not found: ${context.originalPath}`, error);
        return {
          success: false,
          originalPath: context.originalPath,
          error: 'File not found',
        };
      }

      // Get organization settings
      const settings = await this.organizationRulesService.getSettings();

      // Extract archives if enabled
      let filesToOrganize: string[] = [context.originalPath];
      let extractedFiles: string[] = [];

      if (settings.extractArchives && this.isArchiveFile(context.originalPath)) {
        const extractResult = await this.extractArchive(context.originalPath);
        if (extractResult.success && extractResult.extractedFiles) {
          filesToOrganize = extractResult.extractedFiles;
          extractedFiles = extractResult.extractedFiles;

          // Delete original archive if configured
          if (settings.deleteAfterExtraction) {
            try {
              await fs.unlink(context.originalPath);
              this.logger.log(`Deleted archive: ${context.originalPath}`);
            } catch (error) {
              this.logger.warn(`Failed to delete archive ${context.originalPath}:`, error);
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
      const files = await this.getFilesRecursively(directoryPath);
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
      this.logger.log(`Organizing individual file: ${context.originalPath}`);

      // Generate organized path
      const pathResult = await this.organizationRulesService.generateOrganizedPath(context);
      this.logger.log(`Generated organized path: ${pathResult.fullPath}`);

      // Create destination directory
      await fs.mkdir(path.dirname(pathResult.fullPath), { recursive: true });
      this.logger.log(`Created destination directory: ${path.dirname(pathResult.fullPath)}`);

      // Get file stats
      const stats = await fs.stat(context.originalPath);

      // Check if file already exists
      const settings = await this.organizationRulesService.getSettings();
      try {
        await fs.access(pathResult.fullPath);
        
        if (!settings.replaceExistingFiles) {
          this.logger.warn(`File already exists and replace is disabled: ${pathResult.fullPath}`);
          return {
            success: false,
            originalPath: context.originalPath,
            error: 'File already exists and replace is disabled',
          };
        }

        // Delete existing file
        await fs.unlink(pathResult.fullPath);
        this.logger.log(`Replaced existing file: ${pathResult.fullPath}`);
      } catch {
        // File doesn't exist, which is fine
      }

      // Move file to organized location
      try {
        await fs.rename(context.originalPath, pathResult.fullPath);
      } catch (error) {
        // If rename fails (e.g., cross-device link), fall back to copy + delete
        if (error.code === 'EXDEV') {
          this.logger.log(`Cross-device move detected, using copy+delete for: ${context.originalPath}`);
          await fs.copyFile(context.originalPath, pathResult.fullPath);
          await fs.unlink(context.originalPath);
        } else {
          throw error;
        }
      }

      // Record in database
      await this.prisma.organizedFile.create({
        data: {
          originalPath: context.originalPath,
          organizedPath: pathResult.fullPath,
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

      this.logger.log(`Successfully organized: ${context.originalPath} -> ${pathResult.fullPath}`);

      return {
        success: true,
        originalPath: context.originalPath,
        organizedPath: pathResult.fullPath,
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
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getFilesRecursively(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.error(`Error reading directory ${dirPath}:`, error);
    }
    
    return files;
  }
}
