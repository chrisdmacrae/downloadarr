import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DownloadService } from './download.service';
import { CreateDownloadDto } from './dto/create-download.dto';

@ApiTags('downloads')
@Controller('downloads')
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new download job' })
  @ApiResponse({ status: 201, description: 'Download job created successfully' })
  async createDownload(@Body() createDownloadDto: CreateDownloadDto) {
    return this.downloadService.createDownload(createDownloadDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all download jobs' })
  @ApiResponse({ status: 200, description: 'List of download jobs' })
  async getDownloads() {
    return this.downloadService.getDownloads();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get download job by ID' })
  @ApiResponse({ status: 200, description: 'Download job details' })
  async getDownload(@Param('id') id: string) {
    return this.downloadService.getDownload(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get download job status' })
  @ApiResponse({ status: 200, description: 'Download job status' })
  async getDownloadStatus(@Param('id') id: string) {
    return this.downloadService.getDownloadStatus(id);
  }
}
