import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class InitializationService implements OnModuleInit {
  private readonly logger = new Logger(InitializationService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.logger.log('🚀 Initializing Downloadarr API...');
    
    try {
      await this.createDownloadDirectories();
      await this.createLibraryDirectories();
      
      this.logger.log('✅ Initialization completed successfully');
    } catch (error) {
      this.logger.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create download subdirectories for different content types
   */
  private async createDownloadDirectories(): Promise<void> {
    const downloadPath = this.configService.get('DOWNLOAD_PATH', '/downloads');
    
    const subdirectories = [
      'movies',
      'tv-shows',
      'games',
      'music',
      'other'
    ];

    this.logger.log(`📁 Creating download directories in: ${downloadPath}`);

    for (const subdir of subdirectories) {
      const fullPath = join(downloadPath, subdir);
      
      try {
        await fs.mkdir(fullPath, { recursive: true });
        this.logger.log(`✅ Created directory: ${fullPath}`);
      } catch (error) {
        if (error.code === 'EEXIST') {
          this.logger.debug(`📁 Directory already exists: ${fullPath}`);
        } else {
          this.logger.error(`❌ Failed to create directory ${fullPath}:`, error);
          throw error;
        }
      }
    }
  }

  /**
   * Create library subdirectories for organized content
   */
  private async createLibraryDirectories(): Promise<void> {
    const libraryPath = this.configService.get('LIBRARY_PATH', '/library');
    
    const subdirectories = [
      'movies',
      'tv-shows',
      'games',
      'music'
    ];

    this.logger.log(`📚 Creating library directories in: ${libraryPath}`);

    for (const subdir of subdirectories) {
      const fullPath = join(libraryPath, subdir);
      
      try {
        await fs.mkdir(fullPath, { recursive: true });
        this.logger.log(`✅ Created directory: ${fullPath}`);
      } catch (error) {
        if (error.code === 'EEXIST') {
          this.logger.debug(`📚 Directory already exists: ${fullPath}`);
        } else {
          this.logger.error(`❌ Failed to create directory ${fullPath}:`, error);
          throw error;
        }
      }
    }
  }

  /**
   * Verify that all required directories exist and are writable
   */
  async verifyDirectories(): Promise<{ downloads: boolean; library: boolean }> {
    const downloadPath = this.configService.get('DOWNLOAD_PATH', '/downloads');
    const libraryPath = this.configService.get('LIBRARY_PATH', '/library');
    
    const result = {
      downloads: false,
      library: false
    };

    try {
      // Check download directories
      const downloadSubdirs = ['movies', 'tv-shows', 'games', 'music', 'other'];
      for (const subdir of downloadSubdirs) {
        const fullPath = join(downloadPath, subdir);
        await fs.access(fullPath, fs.constants.F_OK | fs.constants.W_OK);
      }
      result.downloads = true;
      this.logger.log('✅ All download directories are accessible and writable');
    } catch (error) {
      this.logger.warn('⚠️ Some download directories are not accessible:', error.message);
    }

    try {
      // Check library directories
      const librarySubdirs = ['movies', 'tv-shows', 'games', 'music'];
      for (const subdir of librarySubdirs) {
        const fullPath = join(libraryPath, subdir);
        await fs.access(fullPath, fs.constants.F_OK | fs.constants.W_OK);
      }
      result.library = true;
      this.logger.log('✅ All library directories are accessible and writable');
    } catch (error) {
      this.logger.warn('⚠️ Some library directories are not accessible:', error.message);
    }

    return result;
  }
}
