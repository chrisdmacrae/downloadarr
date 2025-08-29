import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { HttpDownloadRequestService } from '../services/http-download-request.service';
import { HttpDownloadProgressTrackerService } from '../services/http-download-progress-tracker.service';
import { DownloadService } from '../../download/download.service';
import { DownloadType } from '../../download/dto/create-download.dto';
import {
  CreateHttpDownloadRequestDto,
  UpdateHttpDownloadRequestDto,
  MatchMetadataDto,
  HttpDownloadRequestQueryDto,
} from '../dto/http-download-request.dto';
import { HttpDownloadRequest } from '../../../generated/prisma';

@ApiTags('HTTP Download Requests')
@Controller('http-download-requests')
export class HttpDownloadRequestController {
  private readonly logger = new Logger(HttpDownloadRequestController.name);

  constructor(
    private readonly httpDownloadRequestService: HttpDownloadRequestService,
    private readonly httpDownloadProgressTrackerService: HttpDownloadProgressTrackerService,
    private readonly downloadService: DownloadService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new HTTP download request',
    description: 'Create a new HTTP download request from a direct download URL',
  })
  @ApiResponse({ status: 201, description: 'HTTP download request created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async create(@Body() dto: CreateHttpDownloadRequestDto): Promise<{ success: boolean; data: HttpDownloadRequest }> {
    try {
      this.logger.log(`Creating HTTP download request for URL: ${dto.url}`);

      const request = await this.httpDownloadRequestService.create(dto);

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error creating HTTP download request: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to create HTTP download request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all HTTP download requests',
    description: 'Retrieve a list of HTTP download requests with optional filtering and pagination',
  })
  @ApiResponse({ status: 200, description: 'List of HTTP download requests' })
  async findAll(@Query() query: HttpDownloadRequestQueryDto): Promise<{
    success: boolean;
    data: HttpDownloadRequest[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      const { requests, total } = await this.httpDownloadRequestService.findAll(query);

      return {
        success: true,
        data: requests,
        total,
        limit: query.limit || 20,
        offset: query.offset || 0,
      };
    } catch (error) {
      this.logger.error(`Error fetching HTTP download requests: ${error.message}`, error.stack);

      throw new HttpException(
        `Failed to fetch HTTP download requests: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get HTTP download request by ID',
    description: 'Retrieve a specific HTTP download request by its ID',
  })
  @ApiParam({ name: 'id', description: 'HTTP download request ID' })
  @ApiResponse({ status: 200, description: 'HTTP download request details' })
  @ApiResponse({ status: 404, description: 'HTTP download request not found' })
  async findOne(@Param('id') id: string): Promise<{ success: boolean; data: HttpDownloadRequest }> {
    try {
      const request = await this.httpDownloadRequestService.findOne(id);

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error fetching HTTP download request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to fetch HTTP download request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update HTTP download request',
    description: 'Update an existing HTTP download request',
  })
  @ApiParam({ name: 'id', description: 'HTTP download request ID' })
  @ApiResponse({ status: 200, description: 'HTTP download request updated successfully' })
  @ApiResponse({ status: 404, description: 'HTTP download request not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateHttpDownloadRequestDto,
  ): Promise<{ success: boolean; data: HttpDownloadRequest }> {
    try {
      this.logger.log(`Updating HTTP download request ${id}`);

      const request = await this.httpDownloadRequestService.update(id, dto);

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error updating HTTP download request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to update HTTP download request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/match-metadata')
  @ApiOperation({
    summary: 'Match metadata for HTTP download request',
    description: 'Associate metadata (movie, TV show, or game info) with an HTTP download request',
  })
  @ApiParam({ name: 'id', description: 'HTTP download request ID' })
  @ApiResponse({ status: 200, description: 'Metadata matched successfully' })
  @ApiResponse({ status: 400, description: 'Invalid metadata or request state' })
  @ApiResponse({ status: 404, description: 'HTTP download request not found' })
  async matchMetadata(
    @Param('id') id: string,
    @Body() dto: MatchMetadataDto,
  ): Promise<{ success: boolean; data: HttpDownloadRequest }> {
    try {
      this.logger.log(`Matching metadata for HTTP download request ${id}: ${dto.title}`);

      const request = await this.httpDownloadRequestService.matchMetadata(id, dto);

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error matching metadata for HTTP download request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to match metadata: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/start-download')
  @ApiOperation({
    summary: 'Start download for HTTP download request',
    description: 'Begin the actual download process for an HTTP download request with matched metadata',
  })
  @ApiParam({ name: 'id', description: 'HTTP download request ID' })
  @ApiResponse({ status: 200, description: 'Download started successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request state' })
  @ApiResponse({ status: 404, description: 'HTTP download request not found' })
  async startDownload(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Starting download for HTTP download request ${id}`);

      const request = await this.httpDownloadRequestService.findOne(id);

      // Create the actual download job with metadata if available
      const downloadJob = await this.downloadService.createDownload({
        url: request.url,
        type: request.url.startsWith('https://') ? DownloadType.HTTPS : DownloadType.HTTP,
        name: request.filename || undefined,
        destination: request.destination || undefined,
        // Pass metadata if available
        mediaType: request.contentType?.toLowerCase() as 'movie' | 'tv' | 'game' | undefined,
        mediaTitle: request.title || undefined,
        mediaYear: request.year || undefined,
      });

      // Update the request with download job info
      await this.httpDownloadRequestService.startDownload(
        id,
        downloadJob.id.toString(),
        downloadJob.aria2Gid,
      );

      return {
        success: true,
        message: 'Download started successfully',
      };
    } catch (error) {
      this.logger.error(`Error starting download for HTTP download request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to start download: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/progress')
  @ApiOperation({
    summary: 'Get HTTP download progress',
    description: 'Get real-time progress information for an HTTP download request',
  })
  @ApiParam({ name: 'id', description: 'HTTP download request ID' })
  @ApiResponse({ status: 200, description: 'Download progress information' })
  @ApiResponse({ status: 404, description: 'HTTP download request not found' })
  async getProgress(@Param('id') id: string): Promise<{
    success: boolean;
    data: {
      status: string;
      progress: number;
      downloadSpeed: string;
      eta: string;
      totalSize: number;
      completedSize: number;
      filename?: string;
    } | null;
  }> {
    try {
      const progress = await this.httpDownloadProgressTrackerService.getHttpDownloadProgress(id);

      return {
        success: true,
        data: progress,
      };
    } catch (error) {
      this.logger.error(`Error getting progress for HTTP download request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to get progress: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel HTTP download request',
    description: 'Cancel an HTTP download request and stop any associated download',
  })
  @ApiParam({ name: 'id', description: 'HTTP download request ID' })
  @ApiResponse({ status: 200, description: 'Request cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel completed request' })
  @ApiResponse({ status: 404, description: 'HTTP download request not found' })
  async cancel(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Cancelling HTTP download request ${id}`);

      // Use the progress tracker service to handle cancellation
      await this.httpDownloadProgressTrackerService.cancelHttpDownload(id);

      return {
        success: true,
        message: 'Request cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Error cancelling HTTP download request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to cancel request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/retry')
  @ApiOperation({
    summary: 'Retry failed HTTP download request',
    description: 'Retry a failed HTTP download request',
  })
  @ApiParam({ name: 'id', description: 'HTTP download request ID' })
  @ApiResponse({ status: 200, description: 'Download restarted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot retry request in current state' })
  @ApiResponse({ status: 404, description: 'HTTP download request not found' })
  async retry(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Retrying HTTP download request ${id}`);

      const request = await this.httpDownloadRequestService.findOne(id);

      // Create a new download job with metadata
      const downloadJob = await this.downloadService.createDownload({
        url: request.url,
        type: request.url.startsWith('https://') ? DownloadType.HTTPS : DownloadType.HTTP,
        name: request.filename || undefined,
        destination: request.destination || undefined,
        // Pass metadata if available
        mediaType: request.contentType?.toLowerCase() as 'movie' | 'tv' | 'game' | undefined,
        mediaTitle: request.title || undefined,
        mediaYear: request.year || undefined,
      });

      // Update the request with new download job info
      await this.httpDownloadRequestService.startDownload(
        id,
        downloadJob.id.toString(),
        downloadJob.aria2Gid,
      );

      return {
        success: true,
        message: 'Download restarted successfully',
      };
    } catch (error) {
      this.logger.error(`Error retrying HTTP download request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to retry request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete HTTP download request',
    description: 'Permanently delete an HTTP download request',
  })
  @ApiParam({ name: 'id', description: 'HTTP download request ID' })
  @ApiResponse({ status: 200, description: 'Request deleted successfully' })
  @ApiResponse({ status: 404, description: 'HTTP download request not found' })
  async delete(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Deleting HTTP download request ${id}`);

      await this.httpDownloadRequestService.delete(id);

      return {
        success: true,
        message: 'Request deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Error deleting HTTP download request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to delete request: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
