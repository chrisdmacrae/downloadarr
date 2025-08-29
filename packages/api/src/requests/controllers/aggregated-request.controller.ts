import {
  Controller,
  Get,
  Query,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AggregatedRequestService, AggregatedRequest, AggregatedRequestQuery } from '../services/aggregated-request.service';
import { ContentType } from '../../../generated/prisma';

@ApiTags('Aggregated Requests')
@Controller('requests')
export class AggregatedRequestController {
  private readonly logger = new Logger(AggregatedRequestController.name);

  constructor(private readonly aggregatedRequestService: AggregatedRequestService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all requests (torrent and HTTP)',
    description: 'Retrieve a unified list of both torrent and HTTP download requests with filtering and pagination',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by request status' })
  @ApiQuery({ name: 'contentType', required: false, enum: ContentType, description: 'Filter by content type' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'search', required: false, description: 'Search query for title, filename, or URL' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of results to return (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of results to skip (default: 0)' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field (default: createdAt)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order (default: desc)' })
  @ApiResponse({ status: 200, description: 'List of aggregated requests' })
  async findAll(@Query() query: AggregatedRequestQuery): Promise<{
    success: boolean;
    data: AggregatedRequest[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      const { requests, total } = await this.aggregatedRequestService.findAll(query);

      return {
        success: true,
        data: requests,
        total,
        limit: query.limit || 20,
        offset: query.offset || 0,
      };
    } catch (error) {
      this.logger.error(`Error fetching aggregated requests: ${error.message}`, error.stack);

      throw new HttpException(
        `Failed to fetch requests: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get request statistics',
    description: 'Get counts of requests by status for both torrent and HTTP requests',
  })
  @ApiResponse({ status: 200, description: 'Request statistics' })
  async getStats(): Promise<{
    success: boolean;
    data: {
      torrent: Record<string, number>;
      http: Record<string, number>;
      total: Record<string, number>;
    };
  }> {
    try {
      const stats = await this.aggregatedRequestService.getStatusCounts();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Error fetching request statistics: ${error.message}`, error.stack);

      throw new HttpException(
        `Failed to fetch request statistics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':type/:id')
  @ApiOperation({
    summary: 'Get specific request by type and ID',
    description: 'Retrieve a specific torrent or HTTP request by its type and ID',
  })
  @ApiParam({ name: 'type', enum: ['torrent', 'http'], description: 'Request type' })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiResponse({ status: 200, description: 'Request details' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findOne(
    @Param('type') type: 'torrent' | 'http',
    @Param('id') id: string,
  ): Promise<{ success: boolean; data: AggregatedRequest }> {
    try {
      if (type !== 'torrent' && type !== 'http') {
        throw new HttpException('Invalid request type. Must be "torrent" or "http"', HttpStatus.BAD_REQUEST);
      }

      const request = await this.aggregatedRequestService.findOne(id, type);

      if (!request) {
        throw new HttpException(`${type} request with ID ${id} not found`, HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error fetching ${type} request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to fetch request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
