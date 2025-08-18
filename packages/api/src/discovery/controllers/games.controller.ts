import { Controller, Get, Query, Param, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { IgdbService } from '../services/igdb.service';
import { GameSearchDto, PopularContentDto } from '../dto/search.dto';
import { SearchResult, GameDetails } from '../interfaces/external-api.interface';

@ApiTags('Games')
@Controller('games')
export class GamesController {
  private readonly logger = new Logger(GamesController.name);

  constructor(private readonly igdbService: IgdbService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search for games',
    description: 'Search for games using IGDB API with customizable result limit',
  })
  @ApiResponse({
    status: 200,
    description: 'Games found successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '1020' },
              title: { type: 'string', example: 'Super Mario Bros.' },
              year: { type: 'number', example: 1985 },
              poster: { type: 'string', example: 'https://...' },
              overview: { type: 'string', example: 'A classic platformer...' },
              type: { type: 'string', example: 'game' },
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
  async searchGames(@Query() searchDto: GameSearchDto): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
    try {
      this.logger.log(`Searching games with query: "${searchDto.query}", limit: ${searchDto.limit}`);
      
      const result = await this.igdbService.searchGames(
        searchDto.query,
        searchDto.limit || 20,
      );

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to search games',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error searching games: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Internal server error while searching games',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('popular')
  @ApiOperation({
    summary: 'Get popular games',
    description: 'Get a list of popular games from IGDB based on ratings',
  })
  @ApiResponse({
    status: 200,
    description: 'Popular games retrieved successfully',
  })
  @ApiResponse({
    status: 503,
    description: 'External API service unavailable',
  })
  async getPopularGames(@Query() popularDto: PopularContentDto): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
    try {
      this.logger.log(`Getting popular games, limit: ${popularDto.limit}`);
      
      const result = await this.igdbService.getPopularGames(popularDto.limit || 20);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get popular games',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting popular games: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Internal server error while getting popular games',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get game details',
    description: 'Get detailed information about a specific game by IGDB ID',
  })
  @ApiParam({
    name: 'id',
    description: 'IGDB ID of the game',
    example: '1020',
  })
  @ApiResponse({
    status: 200,
    description: 'Game details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1020' },
            title: { type: 'string', example: 'Super Mario Bros.' },
            year: { type: 'number', example: 1985 },
            poster: { type: 'string', example: 'https://...' },
            overview: { type: 'string', example: 'A classic platformer...' },
            type: { type: 'string', example: 'game' },
            igdbId: { type: 'number', example: 1020 },
            platforms: { type: 'array', items: { type: 'string' }, example: ['Nintendo Entertainment System'] },
            genre: { type: 'array', items: { type: 'string' }, example: ['Platform', 'Adventure'] },
            developer: { type: 'string', example: 'Nintendo' },
            publisher: { type: 'string', example: 'Nintendo' },
            releaseDate: { type: 'string', example: '1985-09-13' },
            rating: { type: 'number', example: 9 },
            screenshots: { type: 'array', items: { type: 'string' }, example: ['https://...'] },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid IGDB ID format',
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
  })
  @ApiResponse({
    status: 503,
    description: 'External API service unavailable',
  })
  async getGameDetails(@Param('id') id: string): Promise<{ success: boolean; data?: GameDetails; error?: string }> {
    try {
      this.logger.log(`Getting game details for ID: ${id}`);
      
      const numericId = parseInt(id);
      if (isNaN(numericId)) {
        throw new HttpException(
          'Invalid IGDB ID format. ID must be a number',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.igdbService.getGameDetails(id);

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? HttpStatus.NOT_FOUND : 
                          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE;
        
        throw new HttpException(
          result.error || 'Failed to get game details',
          statusCode,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting game details: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Internal server error while getting game details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('platforms/list')
  @ApiOperation({
    summary: 'Get supported gaming platforms',
    description: 'Get list of all supported gaming platforms/consoles',
  })
  @ApiResponse({
    status: 200,
    description: 'Gaming platforms retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'NES' },
              id: { type: 'number', example: 18 },
            },
          },
        },
      },
    },
  })
  async getSupportedPlatforms(): Promise<{ success: boolean; data?: Array<{ name: string; id: number }>; error?: string }> {
    try {
      this.logger.log('Getting supported gaming platforms');

      const result = await this.igdbService.getSupportedPlatforms();

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get supported platforms',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting supported platforms: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while getting supported platforms',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('platforms/:platformName')
  @ApiOperation({
    summary: 'Get games by platform',
    description: 'Get games filtered by a specific gaming platform/console',
  })
  @ApiParam({
    name: 'platformName',
    description: 'Gaming platform name (e.g., NES, SNES, PlayStation)',
    example: 'NES',
  })
  @ApiResponse({
    status: 200,
    description: 'Games by platform retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '1020' },
              title: { type: 'string', example: 'Super Mario Bros.' },
              year: { type: 'number', example: 1985 },
              poster: { type: 'string', example: 'https://images.igdb.com/...' },
              overview: { type: 'string', example: 'A classic platformer...' },
              type: { type: 'string', example: 'game' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid platform name',
  })
  @ApiResponse({
    status: 503,
    description: 'External API service unavailable',
  })
  async getGamesByPlatform(
    @Param('platformName') platformName: string,
    @Query() query: PopularContentDto,
  ): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
    try {
      this.logger.log(`Getting games for platform: ${platformName}, limit: ${query.limit}`);

      const result = await this.igdbService.getGamesByPlatform(platformName, query.limit || 20);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get games by platform',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting games by platform: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while getting games by platform',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
