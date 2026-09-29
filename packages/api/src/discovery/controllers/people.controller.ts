import { Controller, Get, Param, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TmdbService } from '../services/tmdb.service';
import { PersonDetails } from '../interfaces/external-api.interface';

@ApiTags('People')
@Controller('people')
export class PeopleController {
  private readonly logger = new Logger(PeopleController.name);

  constructor(private readonly tmdbService: TmdbService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get person details',
    description: 'An actor, director or creator by TMDB person ID: biography, photo, and their movies and shows, most popular first',
  })
  @ApiParam({
    name: 'id',
    description: 'TMDB ID of the person',
    example: '287',
  })
  @ApiResponse({ status: 200, description: 'Person details retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid TMDB ID format' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  @ApiResponse({ status: 503, description: 'External API service unavailable' })
  async getPersonDetails(@Param('id') id: string): Promise<{ success: boolean; data?: PersonDetails; error?: string }> {
    try {
      this.logger.log(`Getting person details for ID: ${id}`);

      if (isNaN(parseInt(id))) {
        throw new HttpException('Invalid TMDB ID format. ID must be a number', HttpStatus.BAD_REQUEST);
      }

      const result = await this.tmdbService.getPersonDetails(id);

      if (!result.success) {
        const statusCode = result.error?.includes('not found')
          ? HttpStatus.NOT_FOUND
          : result.statusCode || HttpStatus.SERVICE_UNAVAILABLE;
        throw new HttpException(result.error || 'Failed to get person details', statusCode);
      }

      return { success: true, data: result.data };
    } catch (error) {
      this.logger.error(`Error getting person details: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal server error while getting person details', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
