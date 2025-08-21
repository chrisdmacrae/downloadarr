import { Controller, Get, Post, Put, Delete, Body, Param, Query, UsePipes, ValidationPipe, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { OrganizationRulesService } from '../services/organization-rules.service';
import { FileOrganizationService } from '../services/file-organization.service';
import { ReverseIndexingService } from '../services/reverse-indexing.service';
import { SeasonScanningService } from '../../torrents/services/season-scanning.service';
import { CreateOrganizationRuleDto, UpdateOrganizationRuleDto } from '../dto/organization-rule.dto';
import { UpdateOrganizationSettingsDto } from '../dto/organization-settings.dto';
import { ContentType } from '../../../generated/prisma';

@ApiTags('organization')
@Controller('organization')
export class OrganizationController {
  constructor(
    private readonly organizationRulesService: OrganizationRulesService,
    private readonly fileOrganizationService: FileOrganizationService,
    private readonly reverseIndexingService: ReverseIndexingService,
    @Inject(forwardRef(() => SeasonScanningService))
    private readonly seasonScanningService: SeasonScanningService,
  ) {}

  // Settings endpoints
  @Get('settings')
  @ApiOperation({ summary: 'Get organization settings' })
  @ApiResponse({ status: 200, description: 'Organization settings retrieved' })
  async getSettings() {
    return this.organizationRulesService.getSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiResponse({ status: 200, description: 'Organization settings updated' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateSettings(@Body() dto: UpdateOrganizationSettingsDto) {
    return this.organizationRulesService.updateSettings(dto);
  }

  // Rules endpoints
  @Get('rules')
  @ApiOperation({ summary: 'Get all organization rules' })
  @ApiResponse({ status: 200, description: 'Organization rules retrieved' })
  async getAllRules() {
    return this.organizationRulesService.getAllRules();
  }

  @Get('rules/:contentType')
  @ApiOperation({ summary: 'Get organization rule for content type' })
  @ApiParam({ name: 'contentType', enum: ContentType })
  @ApiQuery({ name: 'platform', required: false, description: 'Platform for game rules' })
  @ApiResponse({ status: 200, description: 'Organization rule retrieved' })
  async getRuleForContentType(
    @Param('contentType') contentType: ContentType,
    @Query('platform') platform?: string
  ) {
    return this.organizationRulesService.getRuleForContentType(contentType, platform);
  }

  @Post('rules')
  @ApiOperation({ summary: 'Create a new organization rule' })
  @ApiResponse({ status: 201, description: 'Organization rule created' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createRule(@Body() dto: CreateOrganizationRuleDto) {
    return this.organizationRulesService.createRule(dto);
  }

  @Put('rules/:id')
  @ApiOperation({ summary: 'Update an organization rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Organization rule updated' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateRule(@Param('id') id: string, @Body() dto: UpdateOrganizationRuleDto) {
    return this.organizationRulesService.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Delete an organization rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Organization rule deleted' })
  async deleteRule(@Param('id') id: string) {
    await this.organizationRulesService.deleteRule(id);
    return { success: true };
  }

  // Path generation endpoint
  @Post('preview-path')
  @ApiOperation({ summary: 'Preview organized path for given metadata' })
  @ApiResponse({ status: 200, description: 'Path preview generated' })
  async previewPath(@Body() context: {
    contentType: ContentType;
    title: string;
    year?: number;
    season?: number;
    episode?: number;
    platform?: string;
    quality?: string;
    format?: string;
    edition?: string;
  }) {
    const organizationContext = {
      ...context,
      originalPath: '/tmp/example.mkv',
      fileName: 'example.mkv',
    };
    
    return this.organizationRulesService.generateOrganizedPath(organizationContext);
  }

  // Manual organization endpoint
  @Post('organize')
  @ApiOperation({ summary: 'Manually organize a file or directory' })
  @ApiResponse({ status: 200, description: 'File(s) organized' })
  async organizeFile(@Body() request: {
    path: string;
    contentType: ContentType;
    title: string;
    year?: number;
    season?: number;
    episode?: number;
    platform?: string;
    quality?: string;
    format?: string;
    edition?: string;
    requestedTorrentId?: string;
  }) {
    const context = {
      contentType: request.contentType,
      title: request.title,
      year: request.year,
      season: request.season,
      episode: request.episode,
      platform: request.platform,
      quality: request.quality,
      format: request.format,
      edition: request.edition,
      originalPath: request.path,
      fileName: request.path.split('/').pop() || 'unknown',
    };

    return this.fileOrganizationService.organizeFile(context, request.requestedTorrentId);
  }

  // Metadata extraction endpoint
  @Get('extract-metadata')
  @ApiOperation({ summary: 'Extract metadata from file name' })
  @ApiQuery({ name: 'fileName', description: 'File name to extract metadata from' })
  @ApiQuery({ name: 'contentType', enum: ContentType, description: 'Content type' })
  @ApiResponse({ status: 200, description: 'Metadata extracted' })
  async extractMetadata(
    @Query('fileName') fileName: string,
    @Query('contentType') contentType: ContentType,
  ) {
    return this.organizationRulesService.extractMetadataFromFileName(fileName, contentType);
  }

  // Reverse indexing endpoints
  @Post('reverse-index')
  @ApiOperation({ summary: 'Manually trigger reverse indexing' })
  @ApiResponse({ status: 200, description: 'Reverse indexing triggered' })
  async triggerReverseIndexing() {
    return this.reverseIndexingService.triggerReverseIndexing();
  }

  @Get('reverse-index/status')
  @ApiOperation({ summary: 'Get reverse indexing status' })
  @ApiResponse({ status: 200, description: 'Reverse indexing status retrieved' })
  async getReverseIndexingStatus() {
    return this.reverseIndexingService.getStatus();
  }

  // Season scanning endpoints
  @Post('season-scan')
  @ApiOperation({ summary: 'Manually trigger season scanning' })
  @ApiResponse({ status: 200, description: 'Season scanning triggered' })
  async triggerSeasonScanning() {
    try {
      const results = await this.seasonScanningService.scanAllSeasons();
      return {
        success: true,
        message: `Season scanning completed. Scanned ${results.seasonsScanned} seasons, updated ${results.episodesUpdated} episodes, marked ${results.episodesMarkedMissing} episodes as missing.`,
        results,
      };
    } catch (error) {
      return {
        success: false,
        message: `Season scanning failed: ${error.message}`,
      };
    }
  }

  @Post('season-scan/:requestId')
  @ApiOperation({ summary: 'Manually trigger season scanning for a specific request' })
  @ApiParam({ name: 'requestId', description: 'Torrent request ID' })
  @ApiResponse({ status: 200, description: 'Season scanning triggered for specific request' })
  async triggerSeasonScanningForRequest(@Param('requestId') requestId: string) {
    try {
      const results = await this.seasonScanningService.scanTvShowRequest(requestId);
      return {
        success: true,
        message: `Season scanning completed for request. Updated ${results.episodesUpdated} episodes, marked ${results.episodesMarkedMissing} episodes as missing.`,
        results,
      };
    } catch (error) {
      return {
        success: false,
        message: `Season scanning failed: ${error.message}`,
      };
    }
  }

  // Organize queue endpoints
  @Get('queue')
  @ApiOperation({ summary: 'Get organize queue items' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'contentType', required: false, description: 'Filter by content type' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of results' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination' })
  @ApiResponse({ status: 200, description: 'Organize queue items retrieved' })
  async getOrganizeQueue(
    @Query('status') status?: string,
    @Query('contentType') contentType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.reverseIndexingService.getOrganizeQueue({
      status,
      contentType,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('queue/stats')
  @ApiOperation({ summary: 'Get organize queue statistics' })
  @ApiResponse({ status: 200, description: 'Organize queue statistics retrieved' })
  async getOrganizeQueueStats() {
    return this.reverseIndexingService.getOrganizeQueueStats();
  }

  @Post('queue/:id/process')
  @ApiOperation({ summary: 'Process an organize queue item' })
  @ApiParam({ name: 'id', description: 'Queue item ID' })
  @ApiResponse({ status: 200, description: 'Queue item processed' })
  async processOrganizeQueueItem(
    @Param('id') id: string,
    @Body() data: {
      selectedTmdbId?: string;
      selectedIgdbId?: string;
      selectedTitle?: string;
      selectedYear?: number;
      selectedPlatform?: string;
    },
  ) {
    return this.reverseIndexingService.processOrganizeQueueItem(id, data);
  }

  @Post('queue/:id/skip')
  @ApiOperation({ summary: 'Skip an organize queue item' })
  @ApiParam({ name: 'id', description: 'Queue item ID' })
  @ApiResponse({ status: 200, description: 'Queue item skipped' })
  async skipOrganizeQueueItem(@Param('id') id: string) {
    return this.reverseIndexingService.skipOrganizeQueueItem(id);
  }

  @Delete('queue/:id')
  @ApiOperation({ summary: 'Delete an organize queue item' })
  @ApiParam({ name: 'id', description: 'Queue item ID' })
  @ApiResponse({ status: 200, description: 'Queue item deleted' })
  async deleteOrganizeQueueItem(@Param('id') id: string) {
    return this.reverseIndexingService.deleteOrganizeQueueItem(id);
  }
}
