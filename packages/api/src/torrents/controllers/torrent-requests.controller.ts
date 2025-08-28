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
import { TvShowMetadataService } from '../services/tv-show-metadata.service';
import { TorrentSearchLogService } from '../services/torrent-search-log.service';
import { TorrentSearchResultsService } from '../services/torrent-search-results.service';
import { TorrentCheckerService } from '../services/torrent-checker.service';
import { DownloadProgressTrackerService } from '../services/download-progress-tracker.service';
import { RequestLifecycleOrchestrator } from '../services/request-lifecycle-orchestrator.service';
import { DownloadService } from '../../download/download.service';
import { DownloadType } from '../../download/dto/create-download.dto';
import { PrismaService } from '../../database/prisma.service';
import { CreateTorrentRequestDto, UpdateTorrentRequestDto, TorrentRequestQueryDto } from '../dto/torrent-request.dto';
import {
  CreateTvShowSeasonDto,
  UpdateTvShowSeasonDto,
  CreateTvShowEpisodeDto,
  UpdateTvShowEpisodeDto,
  CreateTorrentDownloadDto,
  UpdateTorrentDownloadDto,
  TvShowSeasonQueryDto,
  TvShowEpisodeQueryDto
} from '../dto/tv-show-season.dto';
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
    private readonly tvShowMetadataService: TvShowMetadataService,
    private readonly orchestrator: RequestLifecycleOrchestrator,
    private readonly downloadService: DownloadService,
    private readonly prisma: PrismaService,
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

  @Post('games')
  @ApiOperation({
    summary: 'Request game download',
    description: 'Create a new torrent request for a game',
  })
  @ApiResponse({ status: 201, description: 'Game request created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 409, description: 'Duplicate request - game already requested' })
  async requestGame(@Body() dto: CreateTorrentRequestDto): Promise<{ success: boolean; data: RequestedTorrent }> {
    try {
      this.logger.log(`Creating game request: ${dto.title} (${dto.platform || 'Unknown Platform'})`);

      const request = await this.requestedTorrentsService.createGameRequest(dto);

      return {
        success: true,
        data: request,
      };
    } catch (error) {
      this.logger.error(`Error creating game request: ${error.message}`, error.stack);

      if (error.message.includes('already exists')) {
        throw new HttpException(
          error.message,
          HttpStatus.CONFLICT,
        );
      }

      throw new HttpException(
        'Failed to create game request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('counts')
  @ApiOperation({
    summary: 'Get torrent request counts by status',
    description: 'Retrieve counts of torrent requests grouped by status',
  })
  @ApiResponse({
    status: 200,
    description: 'Status counts',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          additionalProperties: { type: 'number' }
        }
      }
    }
  })
  async getStatusCounts(@Query() query: Pick<TorrentRequestQueryDto, 'userId' | 'search'>): Promise<{
    success: boolean;
    data: Record<string, number>;
  }> {
    try {
      const counts = await this.requestedTorrentsService.getStatusCounts({
        userId: query.userId,
        search: query.search,
      });

      return {
        success: true,
        data: counts,
      };
    } catch (error) {
      this.logger.error(`Error retrieving status counts: ${error.message}`, error.stack);

      throw new HttpException(
        'Failed to retrieve status counts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all torrent requests',
    description: 'Retrieve all torrent requests with optional filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of torrent requests',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'array' },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            limit: { type: 'number' },
            offset: { type: 'number' },
            hasMore: { type: 'boolean' }
          }
        }
      }
    }
  })
  async getAllRequests(@Query() query: TorrentRequestQueryDto): Promise<{
    success: boolean;
    data: RequestedTorrent[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    }
  }> {
    try {
      const limit = query.limit || 20;
      const offset = query.offset || 0;

      const result = await this.requestedTorrentsService.getRequestsPaginated({
        status: query.status,
        userId: query.userId,
        search: query.search,
        limit,
        offset,
      });

      return {
        success: true,
        data: result.requests,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + limit < result.total,
        },
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
    description: 'Manually sync download status for a specific torrent request (now fetches live from aria2)',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Download status synced successfully' })
  async syncDownloadStatus(@Param('id') id: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      this.logger.log(`Getting live download status for request ${id}`);

      // Get live download status instead of syncing stored data
      const status = await this.orchestrator.getRequestDownloadStatus(id);

      return {
        success: true,
        message: 'Live download status retrieved successfully',
        data: status,
      };
    } catch (error) {
      this.logger.error(`Error getting download status for ${id}: ${error.message}`, error.stack);

      throw new HttpException(
        'Failed to get download status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/re-search')
  @ApiOperation({
    summary: 'Re-search a cancelled request',
    description: 'Reset a cancelled request to PENDING status and trigger a new search',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Re-search triggered successfully' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 400, description: 'Request is not in cancelled state' })
  async reSearchCancelledRequest(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`[RE-SEARCH] Starting re-search for request ${id}`);

      // Get the request to ensure it exists and is cancelled
      const request = await this.requestedTorrentsService.getRequestById(id);
      this.logger.log(`[RE-SEARCH] Found request: ${request ? request.title : 'null'} with status: ${request?.status}`);

      if (!request) {
        this.logger.warn(`[RE-SEARCH] Request ${id} not found`);
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      // Only allow re-search for cancelled requests
      if (request.status !== RequestStatus.CANCELLED) {
        throw new HttpException(
          `Cannot re-search request in ${request.status} state. Only cancelled requests can be re-searched.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Reset the request to PENDING status and clear cancellation data
      await this.requestedTorrentsService.updateRequestStatus(id, RequestStatus.PENDING, {
        searchAttempts: 0, // Reset search attempts
        nextSearchAt: new Date(), // Allow immediate search
        lastSearchAt: null, // Clear last search timestamp
        foundTorrentTitle: null, // Clear any previous found torrent
        foundTorrentLink: null,
        foundMagnetUri: null,
        foundTorrentSize: null,
        foundSeeders: null,
        foundIndexer: null,
      });

      // Trigger the torrent checker for this specific request
      await this.torrentCheckerService.searchForSpecificRequest(id);

      return {
        success: true,
        message: 'Cancelled request reset and search triggered successfully',
      };
    } catch (error) {
      this.logger.error(`Error re-searching cancelled request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to re-search cancelled request',
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
      const searchableStates: RequestStatus[] = ['PENDING', 'FAILED', 'EXPIRED', 'CANCELLED'];
      if (!searchableStates.includes(request.status)) {
        throw new HttpException(
          `Cannot search for request in ${request.status} state`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Trigger the torrent checker for this specific request
      // Note: processRequest will handle updating the status to SEARCHING via incrementSearchAttempt
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
      const searchableStates: RequestStatus[] = ['PENDING', 'FAILED', 'EXPIRED', 'CANCELLED'];
      const searchableRequests = await this.requestedTorrentsService.getRequestsByStatuses(searchableStates);

      if (searchableRequests.length === 0) {
        return {
          success: true,
          message: 'No requests available for search',
          searchedCount: 0,
        };
      }

      // Trigger the torrent checker for all requests
      // Note: processRequest will handle updating the status to SEARCHING via incrementSearchAttempt
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

  // TV Show Season Management Endpoints

  @Get(':id/seasons')
  @ApiOperation({
    summary: 'Get TV show seasons',
    description: 'Get all seasons for a TV show request',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by season status' })
  @ApiQuery({ name: 'includeEpisodes', required: false, description: 'Include episode details' })
  @ApiResponse({ status: 200, description: 'TV show seasons retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Torrent request not found' })
  async getTvShowSeasons(
    @Param('id') id: string,
    @Query() query: TvShowSeasonQueryDto,
  ): Promise<{ success: boolean; data: any[] }> {
    try {
      this.logger.log(`Getting TV show seasons for request ${id}`);

      // This will be implemented in the service
      const seasons = await this.requestedTorrentsService.getTvShowSeasons(id, query);

      return {
        success: true,
        data: seasons,
      };
    } catch (error) {
      this.logger.error(`Error getting TV show seasons for ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to get TV show seasons',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/seasons/:seasonNumber')
  @ApiOperation({
    summary: 'Get TV show season details',
    description: 'Get details for a specific season of a TV show request',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiParam({ name: 'seasonNumber', description: 'Season number' })
  @ApiResponse({ status: 200, description: 'TV show season retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Season not found' })
  async getTvShowSeason(
    @Param('id') id: string,
    @Param('seasonNumber') seasonNumber: string,
  ): Promise<{ success: boolean; data: any }> {
    try {
      const seasonNum = parseInt(seasonNumber, 10);
      this.logger.log(`Getting TV show season ${seasonNum} for request ${id}`);

      const season = await this.requestedTorrentsService.getTvShowSeason(id, seasonNum);

      return {
        success: true,
        data: season,
      };
    } catch (error) {
      this.logger.error(`Error getting TV show season ${seasonNumber} for ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to get TV show season',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/seasons/:seasonNumber/episodes')
  @ApiOperation({
    summary: 'Get TV show episodes',
    description: 'Get all episodes for a specific season of a TV show request',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiParam({ name: 'seasonNumber', description: 'Season number' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by episode status' })
  @ApiResponse({ status: 200, description: 'TV show episodes retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Season not found' })
  async getTvShowEpisodes(
    @Param('id') id: string,
    @Param('seasonNumber') seasonNumber: string,
    @Query() query: TvShowEpisodeQueryDto,
  ): Promise<{ success: boolean; data: any[] }> {
    try {
      const seasonNum = parseInt(seasonNumber, 10);
      this.logger.log(`Getting TV show episodes for season ${seasonNum} of request ${id}`);

      const episodes = await this.requestedTorrentsService.getTvShowEpisodes(id, seasonNum, query);

      return {
        success: true,
        data: episodes,
      };
    } catch (error) {
      this.logger.error(`Error getting TV show episodes for season ${seasonNumber} of ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to get TV show episodes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/downloads')
  @ApiOperation({
    summary: 'Get torrent downloads',
    description: 'Get all torrent downloads for a TV show request',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Torrent downloads retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Torrent request not found' })
  async getTorrentDownloads(
    @Param('id') id: string,
  ): Promise<{ success: boolean; data: any[] }> {
    try {
      this.logger.log(`Getting torrent downloads for request ${id}`);

      const downloads = await this.requestedTorrentsService.getTorrentDownloads(id);

      return {
        success: true,
        data: downloads,
      };
    } catch (error) {
      this.logger.error(`Error getting torrent downloads for ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to get torrent downloads',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/populate-metadata')
  @ApiOperation({
    summary: 'Populate TV show metadata',
    description: 'Manually trigger metadata population for an ongoing TV show request',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Metadata population triggered successfully' })
  @ApiResponse({ status: 404, description: 'Torrent request not found' })
  async populateMetadata(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Manually triggering metadata population for request ${id}`);

      await this.tvShowMetadataService.populateSeasonData(id);

      return {
        success: true,
        message: 'Metadata population completed successfully',
      };
    } catch (error) {
      this.logger.error(`Error populating metadata for ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to populate metadata',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('scan-tv-episodes')
  @ApiOperation({
    summary: 'Scan for new episodes in all ongoing TV shows',
    description: 'Manually trigger episode scanning for all ongoing TV show requests',
  })
  @ApiResponse({ status: 200, description: 'TV episode scan completed successfully' })
  async scanAllTvEpisodes(): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('Manually triggering TV episode scan for all ongoing shows');

      await this.tvShowMetadataService.updateAllOngoingShows();

      return {
        success: true,
        message: 'TV episode scan completed successfully',
      };
    } catch (error) {
      this.logger.error(`Error scanning TV episodes: ${error.message}`, error.stack);

      throw new HttpException(
        'Failed to scan TV episodes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/scan-episodes')
  @ApiOperation({
    summary: 'Scan for new episodes in a specific TV show',
    description: 'Manually trigger episode scanning for a specific TV show request',
  })
  @ApiParam({ name: 'id', description: 'TV show request ID' })
  @ApiResponse({ status: 200, description: 'TV show episode scan completed successfully' })
  @ApiResponse({ status: 404, description: 'TV show request not found' })
  async scanTvShowEpisodes(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Manually triggering episode scan for TV show request ${id}`);

      await this.tvShowMetadataService.populateSeasonData(id);

      return {
        success: true,
        message: 'TV show episode scan completed successfully',
      };
    } catch (error) {
      this.logger.error(`Error scanning episodes for TV show ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to scan TV show episodes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/download-status')
  @ApiOperation({
    summary: 'Get live download status',
    description: 'Get real-time download status for a request, fetched live from aria2',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Download status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Torrent request not found' })
  async getDownloadStatus(@Param('id') id: string) {
    try {
      this.logger.log(`Getting live download status for request ${id}`);

      const status = await this.orchestrator.getRequestDownloadStatus(id);

      if (!status) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error(`Error getting download status for ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to get download status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('download-summary')
  @ApiOperation({
    summary: 'Get download summary',
    description: 'Get aggregated download statistics for all requests',
  })
  @ApiResponse({ status: 200, description: 'Download summary retrieved successfully' })
  async getDownloadSummary() {
    try {
      this.logger.log('Getting download summary');

      const summary = await this.orchestrator.getDownloadSummary();

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      this.logger.error(`Error getting download summary: ${error.message}`, error.stack);

      throw new HttpException(
        'Failed to get download summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/link-download')
  @ApiOperation({
    summary: 'Link a manual download to a torrent request',
    description: 'Link an existing download job to a torrent request for tracking purposes',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Download linked successfully' })
  @ApiResponse({ status: 404, description: 'Torrent request not found' })
  async linkDownload(
    @Param('id') id: string,
    @Body() body: { downloadJobId: string; aria2Gid?: string; torrentTitle?: string }
  ) {
    try {
      this.logger.log(`Linking download ${body.downloadJobId} to request ${id}`);

      // Get the request to extract torrent info
      const request = await this.requestedTorrentsService.getRequestById(id);

      // Follow proper state transitions based on current status
      if (request.status === 'PENDING') {
        // First transition to SEARCHING
        await this.orchestrator.startSearch(id);

        // Then mark as found
        await this.orchestrator.markAsFound(id, {
          title: body.torrentTitle || 'Manual Download',
          link: '',
          magnetUri: undefined,
          size: 'Unknown',
          seeders: 0,
          indexer: 'Manual',
        });
      } else if (request.status === 'SEARCHING') {
        // Just mark as found
        await this.orchestrator.markAsFound(id, {
          title: body.torrentTitle || 'Manual Download',
          link: '',
          magnetUri: undefined,
          size: 'Unknown',
          seeders: 0,
          indexer: 'Manual',
        });
      } else if (request.status === 'CANCELLED') {
        // Reactivate cancelled request: CANCELLED → SEARCHING → FOUND
        await this.orchestrator.startSearch(id);

        // Then mark as found
        await this.orchestrator.markAsFound(id, {
          title: body.torrentTitle || 'Manual Download',
          link: '',
          magnetUri: undefined,
          size: 'Unknown',
          seeders: 0,
          indexer: 'Manual',
        });
      } else if (request.status === 'FOUND') {
        // Request is already found, no need to change status before downloading
        this.logger.log(`Request ${id} is already in FOUND status, proceeding to download`);
      } else if (request.status === 'FAILED' || request.status === 'EXPIRED') {
        // Reactivate failed/expired request: FAILED/EXPIRED → SEARCHING → FOUND
        this.logger.log(`Reactivating ${request.status} request ${id} for manual download`);
        await this.orchestrator.startSearch(id);

        // Then mark as found
        await this.orchestrator.markAsFound(id, {
          title: body.torrentTitle || 'Manual Download',
          link: '',
          magnetUri: undefined,
          size: 'Unknown',
          seeders: 0,
          indexer: 'Manual',
        });
      } else if (request.status === 'DOWNLOADING') {
        // Request is already downloading, this might be a duplicate link attempt
        this.logger.warn(`Request ${id} is already in DOWNLOADING status, proceeding anyway`);
      } else if (request.status === 'COMPLETED') {
        // Request is already completed, this is unusual but we'll allow it
        this.logger.warn(`Request ${id} is already COMPLETED, but linking new download anyway`);
      } else {
        // Unexpected status
        this.logger.warn(`Unexpected request status ${request.status} for request ${id}, attempting to proceed`);
      }

      // Follow proper state machine transitions based on current status
      let updatedRequest = request;
      this.logger.log(`Initial request status: ${request.status}`);

      // If the request is cancelled, expired, or failed, first transition to searching
      if (request.status === 'CANCELLED' || request.status === 'EXPIRED' || request.status === 'FAILED') {
        this.logger.log(`Reactivating ${request.status.toLowerCase()} request ${id} for manual download`);
        updatedRequest = await this.orchestrator.startSearch(id);
        this.logger.log(`After startSearch, status is: ${updatedRequest.status}`);
      }

      // If not already found, mark as found (but only if we're not already in FOUND status)
      this.logger.log(`Checking if should mark as found. Current status: ${updatedRequest.status}`);
      if (updatedRequest.status !== 'FOUND' && updatedRequest.status !== 'DOWNLOADING' && updatedRequest.status !== 'COMPLETED') {
        this.logger.log(`Marking request ${id} as found with torrent info (current status: ${updatedRequest.status})`);
        const torrentInfo = {
          title: body.torrentTitle || 'Manual Download',
          link: '',
          magnetUri: undefined,
          size: 'Unknown',
          seeders: 0,
          indexer: 'Manual',
        };
        updatedRequest = await this.orchestrator.markAsFound(id, torrentInfo);
        this.logger.log(`After markAsFound, status is: ${updatedRequest.status}`);
      } else {
        this.logger.log(`Request ${id} is already in ${updatedRequest.status} status, skipping markAsFound`);
      }

      // Create a torrent download record for proper completion tracking
      await this.prisma.torrentDownload.create({
        data: {
          requestedTorrentId: id,
          torrentTitle: body.torrentTitle || 'Manual Download',
          torrentLink: '',
          magnetUri: undefined,
          torrentSize: 'Unknown',
          seeders: 0,
          indexer: 'Manual',
          downloadJobId: body.downloadJobId,
          aria2Gid: body.aria2Gid,
          status: 'DOWNLOADING',
        },
      });

      // Now start the download
      this.logger.log(`Starting download for request ${id}`);
      await this.orchestrator.startDownload(id, {
        downloadJobId: body.downloadJobId,
        aria2Gid: body.aria2Gid,
        torrentInfo: {
          title: body.torrentTitle || 'Manual Download',
          link: '',
          magnetUri: undefined,
          size: 'Unknown',
          seeders: 0,
          indexer: 'Manual',
        },
      });

      return {
        success: true,
        message: 'Download linked successfully',
      };
    } catch (error) {
      this.logger.error(`Error linking download to request ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to link download: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/start-download')
  @ApiOperation({
    summary: 'Manually start download for found request',
    description: 'Manually initiate download for a request that is in FOUND status',
  })
  @ApiParam({ name: 'id', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Download started successfully' })
  @ApiResponse({ status: 404, description: 'Torrent request not found' })
  @ApiResponse({ status: 400, description: 'Request is not in FOUND status' })
  async startDownload(@Param('id') id: string) {
    try {
      this.logger.log(`Manually starting download for request ${id}`);

      // Get the request to check its current status
      const request = await this.requestedTorrentsService.getRequestById(id);

      if (request.status !== 'FOUND') {
        throw new HttpException(
          `Request is in ${request.status} status, not FOUND. Cannot start download.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if we have torrent info
      if (!request.foundTorrentLink && !request.foundMagnetUri) {
        throw new HttpException(
          'No torrent information found for this request',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if there are already torrent downloads with placeholder GIDs
      const existingDownloads = await this.requestedTorrentsService.getTorrentDownloads(id);

      if (existingDownloads.length > 0) {
        // Update existing download with real aria2 GID
        const existingDownload = existingDownloads[0];

        // Create the actual download
        const downloadUrl = request.foundMagnetUri || request.foundTorrentLink;
        const downloadType = request.foundMagnetUri ? DownloadType.MAGNET : DownloadType.TORRENT;

        const downloadJob = await this.downloadService.createDownload({
          url: downloadUrl,
          type: downloadType,
          name: this.sanitizeFilename(request.foundTorrentTitle || request.title),
          destination: this.getDownloadDestination(request),
        });

        // Update the existing torrent download record with real aria2 GID
        await this.prisma.torrentDownload.update({
          where: { id: existingDownload.id },
          data: {
            downloadJobId: downloadJob.id.toString(),
            aria2Gid: downloadJob.aria2Gid,
            status: 'DOWNLOADING',
          },
        });

        // Use the orchestrator to transition to downloading
        await this.orchestrator.startDownload(id, {
          downloadJobId: downloadJob.id.toString(),
          aria2Gid: downloadJob.aria2Gid,
          torrentInfo: {
            title: request.foundTorrentTitle || 'Unknown',
            link: request.foundTorrentLink || '',
            magnetUri: request.foundMagnetUri,
            size: request.foundTorrentSize || '0',
            seeders: request.foundSeeders || 0,
            indexer: request.foundIndexer || 'Unknown',
          },
        });
      } else {
        // Create new download
        const downloadUrl = request.foundMagnetUri || request.foundTorrentLink;
        const downloadType = request.foundMagnetUri ? DownloadType.MAGNET : DownloadType.TORRENT;

        const downloadJob = await this.downloadService.createDownload({
          url: downloadUrl,
          type: downloadType,
          name: this.sanitizeFilename(request.foundTorrentTitle || request.title),
          destination: this.getDownloadDestination(request),
        });

        // Use the orchestrator to start the download
        await this.orchestrator.startDownload(id, {
          downloadJobId: downloadJob.id.toString(),
          aria2Gid: downloadJob.aria2Gid,
          torrentInfo: {
            title: request.foundTorrentTitle || 'Unknown',
            link: request.foundTorrentLink || '',
            magnetUri: request.foundMagnetUri,
            size: request.foundTorrentSize || '0',
            seeders: request.foundSeeders || 0,
            indexer: request.foundIndexer || 'Unknown',
          },
        });
      }

      return {
        success: true,
        message: 'Download started successfully',
      };
    } catch (error) {
      this.logger.error(`Error starting download for ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to start download: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getDownloadDestination(request: any): string {
    const baseDir = process.env.DOWNLOAD_PATH || '/downloads';

    if (request.contentType === 'MOVIE') {
      return `${baseDir}/movies`;
    } else if (request.contentType === 'TV_SHOW') {
      return `${baseDir}/tv-shows`;
    } else if (request.contentType === 'GAME') {
      return `${baseDir}/games`;
    } else {
      return `${baseDir}/other`;
    }
  }
}
