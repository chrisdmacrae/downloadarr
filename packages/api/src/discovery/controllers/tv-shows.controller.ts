import { Controller, Get, Query, Param, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TmdbService } from '../services/tmdb.service';
import { TvSearchDto, PopularContentDto } from '../dto/search.dto';
import { SearchResult, TvShowDetails } from '../interfaces/external-api.interface';

@ApiTags('TV Shows')
@Controller('tv-shows')
export class TvShowsController {
  private readonly logger = new Logger(TvShowsController.name);

  constructor(private readonly tmdbService: TmdbService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search for TV shows',
    description: 'Search for TV shows using TMDB API with optional year filter and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'TV shows found successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '1399' },
              title: { type: 'string', example: 'Game of Thrones' },
              year: { type: 'number', example: 2011 },
              poster: { type: 'string', example: 'https://...' },
              overview: { type: 'string', example: 'Seven noble families...' },
              type: { type: 'string', example: 'tv' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search parameters',
  })
  @ApiResponse({
    status: 503,
    description: 'External API service unavailable',
  })
  async searchTvShows(@Query() searchDto: TvSearchDto): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
    try {
      this.logger.log(`Searching TV shows with query: "${searchDto.query}", year: ${searchDto.year}, page: ${searchDto.page}`);
      
      const result = await this.tmdbService.searchTvShows(
        searchDto.query,
        searchDto.year,
        searchDto.page || 1,
      );

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to search TV shows',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error searching TV shows: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Internal server error while searching TV shows',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('popular')
  @ApiOperation({
    summary: 'Get popular TV shows',
    description: 'Get a list of popular TV shows from TMDB',
  })
  @ApiResponse({
    status: 200,
    description: 'Popular TV shows retrieved successfully',
  })
  @ApiResponse({
    status: 503,
    description: 'External API service unavailable',
  })
  async getPopularTvShows(@Query() popularDto: PopularContentDto): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
    try {
      this.logger.log(`Getting popular TV shows, page: ${popularDto.page}`);
      
      const result = await this.tmdbService.getPopularTvShows(popularDto.page || 1);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get popular TV shows',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting popular TV shows: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Internal server error while getting popular TV shows',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get TV show details',
    description: 'Get detailed information about a specific TV show by TMDB ID',
  })
  @ApiParam({
    name: 'id',
    description: 'TMDB ID of the TV show',
    example: '1399',
  })
  @ApiResponse({
    status: 200,
    description: 'TV show details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1399' },
            title: { type: 'string', example: 'Game of Thrones' },
            year: { type: 'number', example: 2011 },
            poster: { type: 'string', example: 'https://...' },
            overview: { type: 'string', example: 'Seven noble families...' },
            type: { type: 'string', example: 'tv' },
            tmdbId: { type: 'number', example: 1399 },
            imdbId: { type: 'string', example: 'tt0944947' },
            seasons: { type: 'number', example: 8 },
            episodes: { type: 'number', example: 73 },
            genre: { type: 'array', items: { type: 'string' }, example: ['Drama', 'Fantasy'] },
            creator: { type: 'string', example: 'David Benioff, D. B. Weiss' },
            network: { type: 'string', example: 'HBO' },
            status: { type: 'string', example: 'Ended' },
            firstAirDate: { type: 'string', example: '2011-04-17' },
            lastAirDate: { type: 'string', example: '2019-05-19' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid TMDB ID format',
  })
  @ApiResponse({
    status: 404,
    description: 'TV show not found',
  })
  @ApiResponse({
    status: 503,
    description: 'External API service unavailable',
  })
  async getTvShowDetails(@Param('id') id: string): Promise<{ success: boolean; data?: TvShowDetails; error?: string }> {
    try {
      this.logger.log(`Getting TV show details for ID: ${id}`);
      
      const numericId = parseInt(id);
      if (isNaN(numericId)) {
        throw new HttpException(
          'Invalid TMDB ID format. ID must be a number',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.tmdbService.getTvShowDetails(id);

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? HttpStatus.NOT_FOUND : 
                          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE;
        
        throw new HttpException(
          result.error || 'Failed to get TV show details',
          statusCode,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting TV show details: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Internal server error while getting TV show details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('genres/list')
  @ApiOperation({
    summary: 'Get TV show genres',
    description: 'Get list of all available TV show genres from TMDB',
  })
  @ApiResponse({
    status: 200,
    description: 'TV show genres retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 18 },
              name: { type: 'string', example: 'Drama' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'External API service unavailable',
  })
  async getTvGenres(): Promise<{ success: boolean; data?: Array<{ id: number; name: string }>; error?: string }> {
    try {
      this.logger.log('Getting TV show genres');

      const result = await this.tmdbService.getTvGenres();

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get TV show genres',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting TV show genres: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while getting TV show genres',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('genres/:genreId')
  @ApiOperation({
    summary: 'Get TV shows by genre',
    description: 'Get TV shows filtered by a specific genre with pagination',
  })
  @ApiParam({
    name: 'genreId',
    description: 'TMDB Genre ID',
    example: 18,
  })
  @ApiResponse({
    status: 200,
    description: 'TV shows by genre retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '1399' },
              title: { type: 'string', example: 'Game of Thrones' },
              year: { type: 'number', example: 2011 },
              poster: { type: 'string', example: 'https://image.tmdb.org/t/p/w500/...' },
              overview: { type: 'string', example: 'Seven noble families...' },
              type: { type: 'string', example: 'tv' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid genre ID',
  })
  @ApiResponse({
    status: 503,
    description: 'External API service unavailable',
  })
  async getTvShowsByGenre(
    @Param('genreId') genreId: string,
    @Query() query: PopularContentDto,
  ): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
    try {
      const genreIdNum = parseInt(genreId);
      if (isNaN(genreIdNum) || genreIdNum <= 0) {
        throw new HttpException(
          'Invalid genre ID. Must be a positive number',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Getting TV shows for genre: ${genreIdNum}, page: ${query.page}`);

      const result = await this.tmdbService.getTvShowsByGenre(genreIdNum, query.page || 1);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get TV shows by genre',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting TV shows by genre: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while getting TV shows by genre',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
