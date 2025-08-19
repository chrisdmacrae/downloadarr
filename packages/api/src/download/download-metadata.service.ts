import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Aria2Service } from './aria2.service';

export interface GroupedDownload {
  id: string;
  name: string;
  originalUrl: string;
  type: string;
  mediaType?: string;
  mediaTitle?: string;
  mediaYear?: number;
  mediaPoster?: string;
  mediaOverview?: string;
  status: string;
  totalSize: number;
  completedSize: number;
  progress: number;
  downloadSpeed: number;
  files: Array<{
    name: string;
    size: number;
    completed: number;
    progress: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DownloadMetadataService {
  constructor(
    private prisma: PrismaService,
    private aria2Service: Aria2Service,
  ) {}

  async createDownloadMetadata(data: {
    name: string;
    originalUrl: string;
    type: 'magnet' | 'torrent' | 'http' | 'https';
    aria2Gid: string;
    destination?: string;
    mediaType?: 'movie' | 'tv' | 'game';
    mediaTitle?: string;
    mediaYear?: number;
    mediaPoster?: string;
    mediaOverview?: string;
  }) {
    const typeMap: Record<string, string> = {
      'magnet': 'MAGNET',
      'torrent': 'TORRENT',
      'http': 'HTTP',
      'https': 'HTTPS',
    };

    const mediaTypeMap: Record<string, string> = {
      'movie': 'MOVIE',
      'tv': 'TV',
      'game': 'GAME',
    };

    return this.prisma.downloadMetadata.create({
      data: {
        name: data.name,
        originalUrl: data.originalUrl,
        type: typeMap[data.type] as any,
        aria2Gid: data.aria2Gid,
        destination: data.destination,
        mediaType: data.mediaType ? (mediaTypeMap[data.mediaType] as any) : null,
        mediaTitle: data.mediaTitle,
        mediaYear: data.mediaYear,
        mediaPoster: data.mediaPoster,
        mediaOverview: data.mediaOverview,
        aria2ChildGids: [],
        status: 'ACTIVE' as any,
      },
    });
  }

  async updateChildGids(id: string, childGids: string[]): Promise<void> {
    await this.prisma.downloadMetadata.update({
      where: { id },
      data: { aria2ChildGids: childGids },
    });
  }

  async getGroupedDownloads(): Promise<GroupedDownload[]> {
    const metadataList = await this.prisma.downloadMetadata.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const groupedDownloads: GroupedDownload[] = [];

    for (const metadata of metadataList) {
      try {
        // Get status of main torrent
        const mainStatus = await this.aria2Service.getStatus(metadata.aria2Gid);
        
        // Get status of all child files
        const childStatuses = await Promise.all(
          metadata.aria2ChildGids.map(async (gid) => {
            try {
              return await this.aria2Service.getStatus(gid);
            } catch {
              return null; // Child might be removed or not exist
            }
          })
        );

        const validChildStatuses = childStatuses.filter(Boolean);

        // Calculate aggregated stats
        const totalSize = validChildStatuses.reduce(
          (sum, child) => sum + parseInt(child.totalLength || '0'), 
          parseInt(mainStatus.totalLength || '0')
        );

        const completedSize = validChildStatuses.reduce(
          (sum, child) => sum + parseInt(child.completedLength || '0'), 
          parseInt(mainStatus.completedLength || '0')
        );

        const progress = totalSize > 0 ? Math.round((completedSize / totalSize) * 100) : 0;

        // Calculate download speed (sum of all active downloads)
        const downloadSpeed = validChildStatuses
          .filter(child => child.status === 'active')
          .reduce((sum, child) => sum + parseInt(child.downloadSpeed || '0'), 0);

        // Determine overall status
        let overallStatus = mainStatus.status;
        if (validChildStatuses.length > 0) {
          const hasActive = validChildStatuses.some(child => child.status === 'active');
          const hasError = validChildStatuses.some(child => child.status === 'error');
          const allComplete = validChildStatuses.every(child => child.status === 'complete');

          if (hasError) overallStatus = 'error';
          else if (hasActive) overallStatus = 'active';
          else if (allComplete && mainStatus.status === 'complete') overallStatus = 'complete';
        }

        // Create file list
        const files = validChildStatuses.map(child => ({
          name: child.files?.[0]?.path?.split('/').pop() || 'Unknown',
          size: parseInt(child.totalLength || '0'),
          completed: parseInt(child.completedLength || '0'),
          progress: parseInt(child.totalLength || '0') > 0 ? 
            Math.round((parseInt(child.completedLength || '0') / parseInt(child.totalLength || '0')) * 100) : 0,
        }));

        groupedDownloads.push({
          id: metadata.id,
          name: metadata.name,
          originalUrl: metadata.originalUrl,
          type: metadata.type,
          mediaType: metadata.mediaType,
          mediaTitle: metadata.mediaTitle,
          mediaYear: metadata.mediaYear,
          mediaPoster: metadata.mediaPoster,
          mediaOverview: metadata.mediaOverview,
          status: overallStatus,
          totalSize,
          completedSize,
          progress,
          downloadSpeed,
          files,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
        });

        // Update metadata status
        const statusMap: Record<string, string> = {
          'active': 'ACTIVE',
          'waiting': 'WAITING',
          'paused': 'PAUSED',
          'error': 'ERROR',
          'complete': 'COMPLETE',
          'removed': 'REMOVED',
        };

        if (metadata.status !== statusMap[overallStatus]) {
          await this.prisma.downloadMetadata.update({
            where: { id: metadata.id },
            data: { status: statusMap[overallStatus] as any },
          });
        }

      } catch (error) {
        // If we can't get Aria2 status, mark as error
        groupedDownloads.push({
          id: metadata.id,
          name: metadata.name,
          originalUrl: metadata.originalUrl,
          type: metadata.type,
          mediaType: metadata.mediaType,
          mediaTitle: metadata.mediaTitle,
          mediaYear: metadata.mediaYear,
          mediaPoster: metadata.mediaPoster,
          mediaOverview: metadata.mediaOverview,
          status: 'error',
          totalSize: 0,
          completedSize: 0,
          progress: 0,
          downloadSpeed: 0,
          files: [],
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
        });
      }
    }

    return groupedDownloads;
  }

  async deleteDownloadMetadata(id: string): Promise<void> {
    const metadata = await this.prisma.downloadMetadata.findUnique({
      where: { id }
    });

    if (!metadata) {
      throw new Error('Download metadata not found');
    }

    // Cancel all related Aria2 downloads
    try {
      await this.aria2Service.remove(metadata.aria2Gid);
    } catch {
      // Ignore if already removed
    }

    for (const childGid of metadata.aria2ChildGids) {
      try {
        await this.aria2Service.remove(childGid);
      } catch {
        // Ignore if already removed
      }
    }

    await this.prisma.downloadMetadata.delete({ where: { id } });
  }

  async pauseDownload(id: string): Promise<void> {
    const metadata = await this.prisma.downloadMetadata.findUnique({
      where: { id }
    });

    if (!metadata) {
      throw new Error('Download metadata not found');
    }

    // Pause main download
    try {
      await this.aria2Service.pause(metadata.aria2Gid);
    } catch {
      // Ignore if already paused or removed
    }

    // Pause all child downloads
    for (const childGid of metadata.aria2ChildGids) {
      try {
        await this.aria2Service.pause(childGid);
      } catch {
        // Ignore if already paused or removed
      }
    }
  }

  async resumeDownload(id: string): Promise<void> {
    const metadata = await this.prisma.downloadMetadata.findUnique({
      where: { id }
    });

    if (!metadata) {
      throw new Error('Download metadata not found');
    }

    // Resume main download
    try {
      await this.aria2Service.unpause(metadata.aria2Gid);
    } catch {
      // Ignore if already active or removed
    }

    // Resume all child downloads
    for (const childGid of metadata.aria2ChildGids) {
      try {
        await this.aria2Service.unpause(childGid);
      } catch {
        // Ignore if already active or removed
      }
    }
  }
}
