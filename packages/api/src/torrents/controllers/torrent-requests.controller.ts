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
  Logger 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RequestedTorrentsService } from '../services/requested-torrents.service';
import { TorrentSearchLogService } from '../services/torrent-search-log.service';
import { TorrentSearchResultsService } from '../services/torrent-search-results.service';
import { TorrentCheckerService } from '../services/torrent-checker.service';
import { DownloadProgressTrackerService } from '../services/download-progress-tracker.service';
import { CreateTorrentRequestDto, UpdateTorrentRequestDto, TorrentRequestQueryDto } from '../dto/torrent-request.dto';
import { RequestedTorrent, RequestStatus } from '../../../generated/prisma';

@ApiTags('Torrent Requests')
@Controller('torrent-requests')
export class TorrentRequestsController {
  private readonly logger = new Logger(TorrentRequestsController.name);

  constructor(
    private readonly requestedTorrentsService: RequestedTorrentsService,
    private readonly searchLogService: TorrentSearchLogService,
    private readonly searchResultsService: TorrentSearchResultsService,
    private readonly torrentCheckerService: TorrentCheckerService,
    private readonly downloadProgressTrackerService: DownloadProgressTrackerService,
  ) {}

  @Post('movies')
  @ApiOperation({
    summary: 'Request a movie download',
    description: 'Create a new movie torrent request that will be automatically searched for and downloaded',
  })
  @ApiResponse({ status: 201, description: 'Movie request created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 409, description: 'Duplicate request - movie already requested' })
  async requestMovie(@Body() dto: CreateTorrentRequestDto): Promise<{ success: boolean; data: RequestedTorrent }> {
    try {
      this.logger.log(`Creating movie request: ${dto.title} (${dto.year})`);

      const request = await this.requestedTorrentsService.createMovieRequest(dto);

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error creating movie request: ${error.message}`, error.stack);

      // Handle duplicate request error
      if (error.message.includes('already exists')) {
        throw new HttpException(
          error.message,
          HttpStatus.CONFLICT,
        );
      }

      throw new HttpException(
        'Failed to create movie request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('tv-shows')
  @ApiOperation({
    summary: 'Request a TV show download',
    description: 'Create a new TV show torrent request that will be automatically searched for and downloaded',
  })
  @ApiResponse({ status: 201, description: 'TV show request created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 409, description: 'Duplicate request - TV show already requested' })
  async requestTvShow(@Body() dto: CreateTorrentRequestDto): Promise<{ success: boolean; data: RequestedTorrent }> {
    try {
      this.logger.log(`Creating TV show request: ${dto.title} S${dto.season}${dto.episode ? `E${dto.episode}` : ''}`);

      const request = await this.requestedTorrentsService.createTvShowRequest(dto);

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error creating TV show request: ${error.message}`, error.stack);

      // Handle duplicate request error
      if (error.message.includes('already exists')) {
        throw new HttpException(
          error.message,
          HttpStatus.CONFLICT,
        );
      }

      throw new HttpException(
        'Failed to create TV show request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all torrent requests',
    description: 'Retrieve all torrent requests with optional filtering',
  })
  @ApiResponse({ status: 200, description: 'List of torrent requests' })
  async getAllRequests(@Query() query: TorrentRequestQueryDto): Promise<{ success: boolean; data: RequestedTorrent[] }> {
    try {
      let requests: RequestedTorrent[];

      if (query.status) {
        requests = await this.requestedTorrentsService.getRequestsByStatus(query.status, query.userId);
      } else {
        requests = await this.requestedTorrentsService.getAllRequests(query.userId);
      }

      // Apply pagination
      const startIndex = query.offset || 0;
      const endIndex = startIndex + (query.limit || 20);
      const paginatedRequests = requests.slice(startIndex, endIndex);

      return {
        success: true,
        data: paginatedRequests,
      };
    } catch (error) {
      this.logger.error(`Error retrieving torrent requests: ${error.message}`, error.stack);
      
      throw new HttpException(
        'Failed to retrieve torrent requests',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get torrent request statistics',
    description: 'Get statistics about torrent requests by status',
  })
  @ApiResponse({ status: 200, description: 'Torrent request statistics' })
  async getRequestStats(@Query('userId') userId?: string): Promise<{ success: boolean; data: any }> {
    try {
      const stats = await this.requestedTorrentsService.getRequestStats(userId);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Error retrieving request stats: ${error.message}`, error.stack);
      
      throw new HttpException(
        'Failed to retrieve request statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('search-status')
  @ApiOperation({
    summary: 'Get search status',
    description: 'Check if the torrent checker is currently searching',
  })
  @ApiResponse({ status: 200, description: 'Search status information' })
  async getSearchStatus(): Promise<{ success: boolean; data: { isSearching: boolean } }> {
    try {
      const status = this.torrentCheckerService.getSearchStatus();

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error(`Error retrieving search status: ${error.message}`, error.stack);
      
      throw new HttpException(
        'Failed to retrieve search status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('trigger-search')
  @ApiOperation({
    summary: 'Manually trigger torrent search',
    description: 'Manually trigger the torrent search process for testing purposes',
  })
  @ApiResponse({ status: 200, description: 'Search triggered successfully' })
  async triggerSearch(): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('Manually triggering torrent search');
      
      // Don't await to return immediately
      this.torrentCheckerService.triggerSearch().catch(error => {
        this.logger.error('Error in manual search trigger:', error);
      });

      return {
        success: true,
        message: 'Torrent search triggered successfully',
      };
    } catch (error) {
      this.logger.error(`Error triggering search: ${error.message}`, error.stack);
      
      throw new HttpException(
        'Failed to trigger search',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get torrent request by ID',
    description: 'Retrieve a specific torrent request with its search logs',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Torrent request details' })
  @ApiResponse({ status: 404, description: 'Torrent request not found' })
  async getRequestById(@Param('id') id: string): Promise<{ success: boolean; data: RequestedTorrent }> {
    try {
      const request = await this.requestedTorrentsService.getRequestById(id);

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error retrieving torrent request ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(
          `Torrent request with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        'Failed to retrieve torrent request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update torrent request',
    description: 'Update a torrent request settings or status',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Torrent request updated successfully' })
  @ApiResponse({ status: 404, description: 'Torrent request not found' })
  async updateRequest(
    @Param('id') id: string,
    @Body() dto: UpdateTorrentRequestDto,
  ): Promise<{ success: boolean; data: RequestedTorrent }> {
    try {
      this.logger.log(`Updating torrent request ${id}`);
      
      const request = await this.requestedTorrentsService.updateRequest(id, dto);

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error updating torrent request ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(
          `Torrent request with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        'Failed to update torrent request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id/cancel')
  @ApiOperation({
    summary: 'Cancel torrent request',
    description: 'Cancel a pending or searching torrent request',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Torrent request cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Torrent request not found' })
  async cancelRequest(@Param('id') id: string): Promise<{ success: boolean; data: RequestedTorrent }> {
    try {
      this.logger.log(`Cancelling torrent request ${id}`);
      
      const request = await this.requestedTorrentsService.cancelRequest(id);

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error cancelling torrent request ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(
          `Torrent request with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        'Failed to cancel torrent request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete torrent request',
    description: 'Permanently delete a torrent request and its search logs',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Torrent request deleted successfully' })
  @ApiResponse({ status: 404, description: 'Torrent request not found' })
  async deleteRequest(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Deleting torrent request ${id}`);
      
      await this.requestedTorrentsService.deleteRequest(id);

      return {
        success: true,
        message: 'Torrent request deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Error deleting torrent request ${id}: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException(
          `Torrent request with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        'Failed to delete torrent request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/search-logs')
  @ApiOperation({
    summary: 'Get search logs for torrent request',
    description: 'Retrieve search logs for a specific torrent request',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of logs to return' })
  @ApiResponse({ status: 200, description: 'Search logs for the torrent request' })
  async getSearchLogs(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; data: any[] }> {
    try {
      const logs = await this.searchLogService.getSearchLogsForRequest(id, limit);

      return {
        success: true,
        data: logs,
      };
    } catch (error) {
      this.logger.error(`Error retrieving search logs for ${id}: ${error.message}`, error.stack);
      
      throw new HttpException(
        'Failed to retrieve search logs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('download-stats')
  @ApiOperation({
    summary: 'Get download statistics',
    description: 'Get statistics about active downloads including speed and progress',
  })
  @ApiResponse({ status: 200, description: 'Download statistics' })
  async getDownloadStats(): Promise<{ success: boolean; data: any }> {
    try {
      const stats = await this.downloadProgressTrackerService.getDownloadStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Error retrieving download stats: ${error.message}`, error.stack);

      throw new HttpException(
        'Failed to retrieve download statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/sync-download')
  @ApiOperation({
    summary: 'Sync download status',
    description: 'Manually sync download status for a specific torrent request',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Download status synced successfully' })
  async syncDownloadStatus(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Syncing download status for request ${id}`);

      await this.downloadProgressTrackerService.syncDownloadStatus(id);

      return {
        success: true,
        message: 'Download status synced successfully',
      };
    } catch (error) {
      this.logger.error(`Error syncing download status for ${id}: ${error.message}`, error.stack);

      throw new HttpException(
        'Failed to sync download status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/search')
  @ApiOperation({
    summary: 'Trigger manual search',
    description: 'Manually trigger torrent search for a specific request',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Search triggered successfully' })
  async triggerRequestSearch(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Triggering manual search for request ${id}`);

      // Get the request to ensure it exists and is in a searchable state
      const request = await this.requestedTorrentsService.getRequestById(id);

      if (!request) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      // Only allow search for requests that are in searchable states
      const searchableStates: RequestStatus[] = ['PENDING', 'FAILED', 'EXPIRED'];
      if (!searchableStates.includes(request.status)) {
        throw new HttpException(
          `Cannot search for request in ${request.status} state`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Update the request to SEARCHING status and reset search attempts
      await this.requestedTorrentsService.updateRequestStatus(id, 'SEARCHING');

      // Trigger the torrent checker for this specific request
      await this.torrentCheckerService.searchForSpecificRequest(id);

      return {
        success: true,
        message: 'Search triggered successfully',
      };
    } catch (error) {
      this.logger.error(`Error triggering search for ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to trigger search',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('search-all')
  @ApiOperation({
    summary: 'Trigger search for all pending requests',
    description: 'Manually trigger torrent search for all pending, failed, and expired requests',
  })
  @ApiResponse({ status: 200, description: 'Batch search triggered successfully' })
  async triggerSearchAll(): Promise<{ success: boolean; message: string; searchedCount: number }> {
    try {
      this.logger.log('Triggering manual search for all pending requests');

      // Get all requests that can be searched
      const searchableStates: RequestStatus[] = ['PENDING', 'FAILED', 'EXPIRED'];
      const searchableRequests = await this.requestedTorrentsService.getRequestsByStatuses(searchableStates);

      if (searchableRequests.length === 0) {
        return {
          success: true,
          message: 'No requests available for search',
          searchedCount: 0,
        };
      }

      // Update all searchable requests to SEARCHING status
      const updatePromises = searchableRequests.map(request =>
        this.requestedTorrentsService.updateRequestStatus(request.id, 'SEARCHING')
      );
      await Promise.all(updatePromises);

      // Trigger the torrent checker for all requests
      await this.torrentCheckerService.searchForAllRequests();

      return {
        success: true,
        message: `Search triggered for ${searchableRequests.length} requests`,
        searchedCount: searchableRequests.length,
      };
    } catch (error) {
      this.logger.error(`Error triggering batch search: ${error.message}`, error.stack);

      throw new HttpException(
        'Failed to trigger batch search',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/search-results')
  @ApiOperation({
    summary: 'Get search results for a torrent request',
    description: 'Retrieve all found torrents for manual selection',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async getSearchResults(@Param('id') id: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const request = await this.requestedTorrentsService.getRequestById(id);
      if (!request) {
        throw new HttpException('Torrent request not found', HttpStatus.NOT_FOUND);
      }

      const results = await this.searchResultsService.getSearchResults(id);

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      this.logger.error(`Error getting search results for ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to get search results',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/select-torrent/:resultId')
  @ApiOperation({
    summary: 'Select and download a specific torrent',
    description: 'Manually select a torrent from search results and initiate download',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiParam({ name: 'resultId', description: 'Search result ID to select' })
  @ApiResponse({ status: 200, description: 'Torrent selected and download initiated' })
  async selectTorrent(
    @Param('id') id: string,
    @Param('resultId') resultId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const request = await this.requestedTorrentsService.getRequestById(id);
      if (!request) {
        throw new HttpException('Torrent request not found', HttpStatus.NOT_FOUND);
      }

      // Check if request is in a state that allows selection
      if (!['FOUND', 'PENDING', 'FAILED'].includes(request.status)) {
        throw new HttpException(
          `Cannot select torrent for request in ${request.status} state`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Select and download the torrent
      await this.torrentCheckerService.selectAndDownloadTorrent(id, resultId);

      return {
        success: true,
        message: 'Torrent selected and download initiated',
      };
    } catch (error) {
      this.logger.error(`Error selecting torrent ${resultId} for ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to select torrent',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
