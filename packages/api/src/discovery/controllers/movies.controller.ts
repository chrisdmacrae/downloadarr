import { Controller, Get, Query, Param, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { OmdbService } from '../services/omdb.service';
import { TmdbService } from '../services/tmdb.service';
import { MovieSearchDto, PopularContentDto, GenreMoviesDto } from '../dto/search.dto';
import { SearchResult, MovieDetails } from '../interfaces/external-api.interface';

@ApiTags('Movies')
@Controller('movies')
export class MoviesController {
  private readonly logger = new Logger(MoviesController.name);

  constructor(
    private readonly omdbService: OmdbService,
    private readonly tmdbService: TmdbService,
  ) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search for movies',
    description: 'Search for movies using OMDB API with optional year filter and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Movies found successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'tt0133093' },
              title: { type: 'string', example: 'The Matrix' },
              year: { type: 'number', example: 1999 },
              poster: { type: 'string', example: 'https://...' },
              type: { type: 'string', example: 'movie' },
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
  async searchMovies(@Query() searchDto: MovieSearchDto): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
    try {
      this.logger.log(`Searching movies with query: "${searchDto.query}", year: ${searchDto.year}, page: ${searchDto.page}`);
      
      const result = await this.omdbService.searchMovies(
        searchDto.query,
        searchDto.year,
        searchDto.page || 1,
      );

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to search movies',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error searching movies: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Internal server error while searching movies',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('popular')
  @ApiOperation({
    summary: 'Get popular movies',
    description: 'Get popular movies from TMDB with pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Popular movies retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '550' },
              title: { type: 'string', example: 'Fight Club' },
              year: { type: 'number', example: 1999 },
              poster: { type: 'string', example: 'https://image.tmdb.org/t/p/w500/...' },
              overview: { type: 'string', example: 'A ticking-time-bomb insomniac...' },
              type: { type: 'string', example: 'movie' },
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
  async getPopularMovies(@Query() popularDto: PopularContentDto): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> {
    try {
      this.logger.log(`Getting popular movies, page: ${popularDto.page}`);

      const result = await this.tmdbService.getPopularMovies(popularDto.page || 1);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get popular movies',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting popular movies: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while getting popular movies',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get movie details',
    description: 'Get detailed information about a specific movie by IMDb ID',
  })
  @ApiParam({
    name: 'id',
    description: 'IMDb ID of the movie (e.g., tt0133093)',
    example: 'tt0133093',
  })
  @ApiResponse({
    status: 200,
    description: 'Movie details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'tt0133093' },
            title: { type: 'string', example: 'The Matrix' },
            year: { type: 'number', example: 1999 },
            poster: { type: 'string', example: 'https://...' },
            overview: { type: 'string', example: 'A computer hacker...' },
            type: { type: 'string', example: 'movie' },
            imdbId: { type: 'string', example: 'tt0133093' },
            runtime: { type: 'number', example: 136 },
            genre: { type: 'array', items: { type: 'string' }, example: ['Action', 'Sci-Fi'] },
            director: { type: 'string', example: 'Lana Wachowski, Lilly Wachowski' },
            actors: { type: 'string', example: 'Keanu Reeves, Laurence Fishburne' },
            rating: { type: 'number', example: 8.7 },
            released: { type: 'string', example: '31 Mar 1999' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid IMDb ID format',
  })
  @ApiResponse({
    status: 404,
    description: 'Movie not found',
  })
  @ApiResponse({
    status: 503,
    description: 'External API service unavailable',
  })
  async getMovieDetails(@Param('id') id: string): Promise<{ success: boolean; data?: MovieDetails; error?: string }> {
    try {
      this.logger.log(`Getting movie details for ID: ${id}`);
      
      if (!id || !id.startsWith('tt')) {
        throw new HttpException(
          'Invalid IMDb ID format. ID must start with "tt"',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.omdbService.getMovieDetails(id);

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? HttpStatus.NOT_FOUND : 
                          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE;
        
        throw new HttpException(
          result.error || 'Failed to get movie details',
          statusCode,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting movie details: ${error.message}`, error.stack);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Internal server error while getting movie details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('genres/list')
  @ApiOperation({
    summary: 'Get movie genres',
    description: 'Get list of all available movie genres from TMDB',
  })
  @ApiResponse({
    status: 200,
    description: 'Movie genres retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 28 },
              name: { type: 'string', example: 'Action' },
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
  async getMovieGenres(): Promise<{ success: boolean; data?: Array<{ id: number; name: string }>; error?: string }> {
    try {
      this.logger.log('Getting movie genres');

      const result = await this.tmdbService.getMovieGenres();

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get movie genres',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting movie genres: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while getting movie genres',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('genres/:genreId')
  @ApiOperation({
    summary: 'Get movies by genre',
    description: 'Get movies filtered by a specific genre with pagination',
  })
  @ApiParam({
    name: 'genreId',
    description: 'TMDB Genre ID',
    example: 28,
  })
  @ApiResponse({
    status: 200,
    description: 'Movies by genre retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '550' },
              title: { type: 'string', example: 'Fight Club' },
              year: { type: 'number', example: 1999 },
              poster: { type: 'string', example: 'https://image.tmdb.org/t/p/w500/...' },
              overview: { type: 'string', example: 'A ticking-time-bomb insomniac...' },
              type: { type: 'string', example: 'movie' },
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
  async getMoviesByGenre(
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

      this.logger.log(`Getting movies for genre: ${genreIdNum}, page: ${query.page}`);

      const result = await this.tmdbService.getMoviesByGenre(genreIdNum, query.page || 1);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get movies by genre',
          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Error getting movies by genre: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while getting movies by genre',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('tmdb/:tmdbId/poster')
  @ApiOperation({
    summary: 'Get movie poster URL',
    description: 'Get the poster URL for a movie by TMDB ID',
  })
  @ApiParam({
    name: 'tmdbId',
    description: 'TMDB ID of the movie',
    example: '550',
  })
  @ApiResponse({
    status: 200,
    description: 'Poster URL retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'string', example: 'https://image.tmdb.org/t/p/w500/...' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid TMDB ID',
  })
  @ApiResponse({
    status: 404,
    description: 'Movie not found',
  })
  @ApiResponse({
    status: 503,
    description: 'External API service unavailable',
  })
  async getMoviePosterUrl(@Param('tmdbId') tmdbId: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const id = parseInt(tmdbId);
      if (isNaN(id) || id <= 0) {
        throw new HttpException(
          'Invalid TMDB ID. Must be a positive number',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Getting poster URL for movie TMDB ID: ${id}`);

      const result = await this.tmdbService.getMovieDetails(id.toString());

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? HttpStatus.NOT_FOUND :
                          result.statusCode || HttpStatus.SERVICE_UNAVAILABLE;

        throw new HttpException(
          result.error || 'Failed to get movie details',
          statusCode,
        );
      }

      return {
        success: true,
        data: result.data?.poster,
      };
    } catch (error) {
      this.logger.error(`Error getting movie poster URL: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error while getting movie poster URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
