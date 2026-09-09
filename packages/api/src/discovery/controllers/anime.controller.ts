import { Controller, Get, Query, Param, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TmdbService } from '../services/tmdb.service';
import { TvSearchDto, PopularContentDto } from '../dto/search.dto';
import { SearchResult, TvShowDetails } from '../interfaces/external-api.interface';

/**
 * Anime browsing. TMDB models anime as animation produced in Japan rather than
 * as its own genre, so these endpoints are TV endpoints with that filter
 * applied — and the TV endpoints exclude the same set, so the two destinations
 * never show the same title.
 *
 * Details come from the TV endpoint: an anime series is a TV series, and
 * requests for one are created as TV_SHOW.
 */
@ApiTags('Anime')
@Controller('anime')
export class AnimeController {
  private readonly logger = new Logger(AnimeController.name);

  constructor(private readonly tmdbService: TmdbService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search for anime',
    description: 'Searches TV shows and keeps only anime',
  })
  @ApiResponse({ status: 200, description: 'Anime found successfully' })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  async searchAnime(
    @Query() searchDto: TvSearchDto,
  ): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
    try {
      this.logger.log(`Searching anime: ${searchDto.query}`);

      const result = await this.tmdbService.searchAnime(
        searchDto.query,
        searchDto.year,
        searchDto.page || 1,
      );

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to search anime',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return { success: true, data: result.data };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error searching anime: ${error.message}`, error.stack);
      throw new HttpException(
        'Internal server error while searching anime',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular anime' })
  @ApiResponse({ status: 200, description: 'Popular anime retrieved successfully' })
  async getPopularAnime(
    @Query() popularDto: PopularContentDto,
  ): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
    try {
      this.logger.log(`Getting popular anime, page: ${popularDto.page}`);

      const result = await this.tmdbService.getPopularAnime(popularDto.page || 1);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get popular anime',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return { success: true, data: result.data };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting popular anime: ${error.message}`, error.stack);
      throw new HttpException(
        'Internal server error while getting popular anime',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('genres/list')
  @ApiOperation({
    summary: 'Get anime genres',
    description: 'The TV genre list, without Animation itself — every anime carries it',
  })
  @ApiResponse({ status: 200, description: 'Genres retrieved successfully' })
  async getAnimeGenres(): Promise<{
    success: boolean;
    data?: Array<{ id: number; name: string }>;
    error?: string;
  }> {
    try {
      const result = await this.tmdbService.getTvGenres();

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get anime genres',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: (result.data || []).filter(genre => genre.name.toLowerCase() !== 'animation'),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting anime genres: ${error.message}`, error.stack);
      throw new HttpException(
        'Internal server error while getting anime genres',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('genres/:genreId')
  @ApiOperation({ summary: 'Get anime by genre' })
  @ApiParam({ name: 'genreId', description: 'TMDB genre ID', example: 10759 })
  @ApiResponse({ status: 200, description: 'Anime retrieved successfully' })
  async getAnimeByGenre(
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

      this.logger.log(`Getting anime for genre: ${genreIdNum}, page: ${query.page}`);

      const result = await this.tmdbService.getAnimeByGenre(genreIdNum, query.page || 1);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get anime by genre',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return { success: true, data: result.data };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting anime by genre: ${error.message}`, error.stack);
      throw new HttpException(
        'Internal server error while getting anime by genre',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get anime details',
    description: 'Anime are TV series, so details come from the TV endpoint',
  })
  @ApiParam({ name: 'id', description: 'TMDB TV show ID', example: '1429' })
  @ApiResponse({ status: 200, description: 'Anime details retrieved successfully' })
  async getAnimeDetails(
    @Param('id') id: string,
  ): Promise<{ success: boolean; data?: TvShowDetails; error?: string }> {
    try {
      const result = await this.tmdbService.getTvShowDetails(id);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get anime details',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return { success: true, data: result.data };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting anime details: ${error.message}`, error.stack);
      throw new HttpException(
        'Internal server error while getting anime details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
