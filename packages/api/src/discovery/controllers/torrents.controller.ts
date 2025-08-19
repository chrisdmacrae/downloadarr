import { Controller, Get, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JackettService } from '../services/jackett.service';
import { TorrentSearchDto, MovieTorrentSearchDto, TvTorrentSearchDto } from '../dto/torrent-search.dto';
import { TorrentResult } from '../interfaces/external-api.interface';

@ApiTags('Torrents')
@Controller('torrents')
export class TorrentsController {
  private readonly logger = new Logger(TorrentsController.name);

  constructor(private readonly jackettService: JackettService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search for torrents',
    description: 'Search for torrents across all configured Jackett indexers with filtering options',
  })
  @ApiResponse({
    status: 200,
    description: 'Torrent search results',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              link: { type: 'string' },
              magnetUri: { type: 'string' },
              size: { type: 'string' },
              seeders: { type: 'number' },
              leechers: { type: 'number' },
              category: { type: 'string' },
              indexer: { type: 'string' },
              publishDate: { type: 'string' },
              quality: { type: 'string' },
              format: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  @ApiResponse({ status: 503, description: 'Jackett service unavailable' })
  async searchTorrents(@Query() searchDto: TorrentSearchDto): Promise<{ success: boolean; data?: TorrentResult[]; error?: string }> {
    try {
      this.logger.log(`Searching torrents with query: "${searchDto.query}"`);
      
      const searchParams = {
        query: searchDto.query,
        category: searchDto.category,
        indexers: searchDto.indexers,
        minSeeders: searchDto.minSeeders,
        maxSize: searchDto.maxSize,
        quality: searchDto.quality,
        format: searchDto.format,
      };

      const result = await this.jackettService.searchTorrents(searchParams);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to search torrents',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Limit results
      const limitedResults = result.data?.slice(0, searchDto.limit || 20) || [];

      return {
        success: true,
        data: limitedResults,
      };
    } catch (error) {
      this.logger.error(`Error searching torrents: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while searching torrents',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('movies/search')
  @ApiOperation({
    summary: 'Search for movie torrents',
    description: 'Search for movie torrents with movie-specific filtering and query building',
  })
  @ApiResponse({
    status: 200,
    description: 'Movie torrent search results',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              link: { type: 'string' },
              magnetUri: { type: 'string' },
              size: { type: 'string' },
              seeders: { type: 'number' },
              leechers: { type: 'number' },
              category: { type: 'string' },
              indexer: { type: 'string' },
              publishDate: { type: 'string' },
              quality: { type: 'string' },
              format: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  @ApiResponse({ status: 503, description: 'Jackett service unavailable' })
  async searchMovieTorrents(@Query() searchDto: MovieTorrentSearchDto): Promise<{ success: boolean; data?: TorrentResult[]; error?: string }> {
    try {
      this.logger.log(`Searching movie torrents with query: "${searchDto.query}", year: ${searchDto.year}`);
      
      const result = await this.jackettService.searchMovieTorrents(searchDto);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to search movie torrents',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Limit results
      const limitedResults = result.data?.slice(0, searchDto.limit || 20) || [];

      return {
        success: true,
        data: limitedResults,
      };
    } catch (error) {
      this.logger.error(`Error searching movie torrents: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while searching movie torrents',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('tv/search')
  @ApiOperation({
    summary: 'Search for TV show torrents',
    description: 'Search for TV show torrents with season/episode specific filtering and query building',
  })
  @ApiResponse({
    status: 200,
    description: 'TV show torrent search results',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              link: { type: 'string' },
              magnetUri: { type: 'string' },
              size: { type: 'string' },
              seeders: { type: 'number' },
              leechers: { type: 'number' },
              category: { type: 'string' },
              indexer: { type: 'string' },
              publishDate: { type: 'string' },
              quality: { type: 'string' },
              format: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  @ApiResponse({ status: 503, description: 'Jackett service unavailable' })
  async searchTvTorrents(@Query() searchDto: TvTorrentSearchDto): Promise<{ success: boolean; data?: TorrentResult[]; error?: string }> {
    try {
      this.logger.log(`Searching TV torrents with query: "${searchDto.query}", season: ${searchDto.season}, episode: ${searchDto.episode}`);
      
      const result = await this.jackettService.searchTvTorrents(searchDto);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to search TV torrents',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Limit results
      const limitedResults = result.data?.slice(0, searchDto.limit || 20) || [];

      return {
        success: true,
        data: limitedResults,
      };
    } catch (error) {
      this.logger.error(`Error searching TV torrents: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while searching TV torrents',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
