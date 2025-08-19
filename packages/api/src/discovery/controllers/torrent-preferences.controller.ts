import { Controller, Get, Put, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { TorrentPreferencesService, TorrentPreferences } from '../services/torrent-preferences.service';

@ApiTags('Torrent Preferences')
@Controller('torrents/preferences')
export class TorrentPreferencesController {
  private readonly logger = new Logger(TorrentPreferencesController.name);

  constructor(private readonly preferencesService: TorrentPreferencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get torrent preferences',
    description: 'Retrieve current torrent search and filtering preferences',
  })
  @ApiResponse({
    status: 200,
    description: 'Current torrent preferences',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            defaultQualities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Preferred video qualities',
            },
            defaultFormats: {
              type: 'array',
              items: { type: 'string' },
              description: 'Preferred video formats/codecs',
            },
            defaultCategory: {
              type: 'string',
              description: 'Default torrent category',
            },
            minSeeders: {
              type: 'number',
              description: 'Minimum number of seeders required',
            },
            maxSizeGB: {
              type: 'number',
              description: 'Maximum file size in GB',
            },
            trustedIndexers: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of trusted indexer names',
            },
            blacklistedWords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Words to exclude from search results',
            },
            autoSelectBest: {
              type: 'boolean',
              description: 'Automatically select best quality torrent',
            },
            preferRemux: {
              type: 'boolean',
              description: 'Prefer remux releases',
            },
            preferSmallSize: {
              type: 'boolean',
              description: 'Prefer smaller file sizes',
            },
          },
        },
      },
    },
  })
  async getPreferences(): Promise<{ success: boolean; data: TorrentPreferences }> {
    try {
      this.logger.log('Retrieving torrent preferences');
      
      const preferences = this.preferencesService.getPreferences();

      return {
        success: true,
        data: preferences,
      };
    } catch (error) {
      this.logger.error(`Error retrieving preferences: ${error.message}`, error.stack);
      
      throw new HttpException(
        'Internal server error while retrieving preferences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put()
  @ApiOperation({
    summary: 'Update torrent preferences',
    description: 'Update torrent search and filtering preferences',
  })
  @ApiBody({
    description: 'Preference updates (partial object)',
    schema: {
      type: 'object',
      properties: {
        defaultQualities: {
          type: 'array',
          items: { type: 'string', enum: ['SD', '720p', '1080p', '4K', '8K'] },
          description: 'Preferred video qualities',
        },
        defaultFormats: {
          type: 'array',
          items: { type: 'string', enum: ['x264', 'x265', 'XviD', 'DivX', 'AV1', 'HEVC'] },
          description: 'Preferred video formats/codecs',
        },
        defaultCategory: {
          type: 'string',
          enum: ['Movies', 'TV', 'Movies/HD', 'Movies/SD', 'Movies/UHD', 'TV/HD', 'TV/SD', 'TV/UHD'],
          description: 'Default torrent category',
        },
        minSeeders: {
          type: 'number',
          minimum: 0,
          description: 'Minimum number of seeders required',
        },
        maxSizeGB: {
          type: 'number',
          minimum: 1,
          description: 'Maximum file size in GB',
        },
        trustedIndexers: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of trusted indexer names',
        },
        blacklistedWords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Words to exclude from search results',
        },
        autoSelectBest: {
          type: 'boolean',
          description: 'Automatically select best quality torrent',
        },
        preferRemux: {
          type: 'boolean',
          description: 'Prefer remux releases',
        },
        preferSmallSize: {
          type: 'boolean',
          description: 'Prefer smaller file sizes',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Updated torrent preferences',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          description: 'Updated preferences object',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid preference values' })
  async updatePreferences(
    @Body() updates: Partial<TorrentPreferences>,
  ): Promise<{ success: boolean; data: TorrentPreferences }> {
    try {
      this.logger.log('Updating torrent preferences', updates);
      
      // Validate updates
      this.validatePreferenceUpdates(updates);
      
      const updatedPreferences = this.preferencesService.updatePreferences(updates);

      return {
        success: true,
        data: updatedPreferences,
      };
    } catch (error) {
      this.logger.error(`Error updating preferences: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while updating preferences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('filter-criteria')
  @ApiOperation({
    summary: 'Get filter criteria',
    description: 'Get current preferences formatted as filter criteria for torrent searches',
  })
  @ApiResponse({
    status: 200,
    description: 'Filter criteria based on current preferences',
  })
  async getFilterCriteria(): Promise<{ success: boolean; data: any }> {
    try {
      this.logger.log('Retrieving filter criteria');
      
      const criteria = this.preferencesService.getFilterCriteria();

      return {
        success: true,
        data: criteria,
      };
    } catch (error) {
      this.logger.error(`Error retrieving filter criteria: ${error.message}`, error.stack);
      
      throw new HttpException(
        'Internal server error while retrieving filter criteria',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private validatePreferenceUpdates(updates: Partial<TorrentPreferences>): void {
    if (updates.minSeeders !== undefined && updates.minSeeders < 0) {
      throw new HttpException(
        'minSeeders must be a non-negative number',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (updates.maxSizeGB !== undefined && updates.maxSizeGB < 1) {
      throw new HttpException(
        'maxSizeGB must be at least 1',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (updates.defaultQualities !== undefined && !Array.isArray(updates.defaultQualities)) {
      throw new HttpException(
        'defaultQualities must be an array',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (updates.defaultFormats !== undefined && !Array.isArray(updates.defaultFormats)) {
      throw new HttpException(
        'defaultFormats must be an array',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (updates.trustedIndexers !== undefined && !Array.isArray(updates.trustedIndexers)) {
      throw new HttpException(
        'trustedIndexers must be an array',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (updates.blacklistedWords !== undefined && !Array.isArray(updates.blacklistedWords)) {
      throw new HttpException(
        'blacklistedWords must be an array',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
