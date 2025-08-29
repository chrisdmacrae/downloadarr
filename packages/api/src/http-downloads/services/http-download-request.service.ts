import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { HttpDownloadRequest, HttpDownloadRequestStatus } from '../../../generated/prisma';
import {
  CreateHttpDownloadRequestDto,
  UpdateHttpDownloadRequestDto,
  MatchMetadataDto,
  HttpDownloadRequestQueryDto,
} from '../dto/http-download-request.dto';

@Injectable()
export class HttpDownloadRequestService {
  private readonly logger = new Logger(HttpDownloadRequestService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHttpDownloadRequestDto): Promise<HttpDownloadRequest> {
    this.logger.log(`Creating HTTP download request for URL: ${dto.url}`);

    // Extract filename from URL if not provided
    let filename = dto.filename;
    if (!filename) {
      try {
        const url = new URL(dto.url);
        const pathname = url.pathname;
        filename = pathname.split('/').pop() || 'download';
      } catch (error) {
        filename = 'download';
      }
    }

    // Validate URL is HTTP/HTTPS
    if (!dto.url.startsWith('http://') && !dto.url.startsWith('https://')) {
      throw new BadRequestException('URL must be HTTP or HTTPS');
    }

    const request = await this.prisma.httpDownloadRequest.create({
      data: {
        url: dto.url,
        filename,
        destination: dto.destination,
        priority: dto.priority || 5,
        userId: dto.userId,
        status: HttpDownloadRequestStatus.PENDING_METADATA,
      },
    });

    this.logger.log(`Created HTTP download request with ID: ${request.id}`);
    return request;
  }

  async findAll(query: HttpDownloadRequestQueryDto): Promise<{
    requests: HttpDownloadRequest[];
    total: number;
  }> {
    const {
      status,
      contentType,
      userId,
      search,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (contentType) {
      where.contentType = contentType;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { filename: { contains: search, mode: 'insensitive' } },
        { url: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [requests, total] = await Promise.all([
      this.prisma.httpDownloadRequest.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.httpDownloadRequest.count({ where }),
    ]);

    return { requests, total };
  }

  async findOne(id: string): Promise<HttpDownloadRequest> {
    const request = await this.prisma.httpDownloadRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`HTTP download request with ID ${id} not found`);
    }

    return request;
  }

  async update(id: string, dto: UpdateHttpDownloadRequestDto): Promise<HttpDownloadRequest> {
    const existingRequest = await this.findOne(id);

    this.logger.log(`Updating HTTP download request ${id}`);

    const request = await this.prisma.httpDownloadRequest.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });

    return request;
  }

  async matchMetadata(id: string, dto: MatchMetadataDto): Promise<HttpDownloadRequest> {
    const existingRequest = await this.findOne(id);

    if (existingRequest.status !== HttpDownloadRequestStatus.PENDING_METADATA) {
      throw new BadRequestException(
        `Cannot match metadata for request in status: ${existingRequest.status}`,
      );
    }

    this.logger.log(`Matching metadata for HTTP download request ${id}: ${dto.title}`);

    const request = await this.prisma.httpDownloadRequest.update({
      where: { id },
      data: {
        contentType: dto.contentType,
        title: dto.title,
        year: dto.year,
        imdbId: dto.imdbId,
        tmdbId: dto.tmdbId,
        igdbId: dto.igdbId,
        platform: dto.platform,
        genre: dto.genre,
        season: dto.season,
        episode: dto.episode,
        status: HttpDownloadRequestStatus.METADATA_MATCHED,
        metadataMatchedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Metadata matched for HTTP download request ${id}`);
    return request;
  }

  async startDownload(id: string, downloadJobId: string, aria2Gid: string): Promise<HttpDownloadRequest> {
    const existingRequest = await this.findOne(id);

    if (existingRequest.status !== HttpDownloadRequestStatus.METADATA_MATCHED) {
      throw new BadRequestException(
        `Cannot start download for request in status: ${existingRequest.status}`,
      );
    }

    this.logger.log(`Starting download for HTTP download request ${id}`);

    const request = await this.prisma.httpDownloadRequest.update({
      where: { id },
      data: {
        downloadJobId,
        aria2Gid,
        status: HttpDownloadRequestStatus.DOWNLOADING,
        downloadStartedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Download started for HTTP download request ${id} with GID: ${aria2Gid}`);
    return request;
  }

  async markAsCompleted(id: string): Promise<HttpDownloadRequest> {
    const existingRequest = await this.findOne(id);

    if (existingRequest.status !== HttpDownloadRequestStatus.DOWNLOADING) {
      throw new BadRequestException(
        `Cannot mark as completed for request in status: ${existingRequest.status}`,
      );
    }

    this.logger.log(`Marking HTTP download request ${id} as completed`);

    const request = await this.prisma.httpDownloadRequest.update({
      where: { id },
      data: {
        status: HttpDownloadRequestStatus.COMPLETED,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    this.logger.log(`HTTP download request ${id} marked as completed`);
    return request;
  }

  async markAsFailed(id: string): Promise<HttpDownloadRequest> {
    const existingRequest = await this.findOne(id);

    this.logger.log(`Marking HTTP download request ${id} as failed`);

    const request = await this.prisma.httpDownloadRequest.update({
      where: { id },
      data: {
        status: HttpDownloadRequestStatus.FAILED,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`HTTP download request ${id} marked as failed`);
    return request;
  }

  async cancel(id: string): Promise<HttpDownloadRequest> {
    const existingRequest = await this.findOne(id);

    if (existingRequest.status === HttpDownloadRequestStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed request');
    }

    this.logger.log(`Cancelling HTTP download request ${id}`);

    const request = await this.prisma.httpDownloadRequest.update({
      where: { id },
      data: {
        status: HttpDownloadRequestStatus.CANCELLED,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`HTTP download request ${id} cancelled`);
    return request;
  }

  async delete(id: string): Promise<void> {
    const existingRequest = await this.findOne(id);

    this.logger.log(`Deleting HTTP download request ${id}`);

    await this.prisma.httpDownloadRequest.delete({
      where: { id },
    });

    this.logger.log(`HTTP download request ${id} deleted`);
  }
}
