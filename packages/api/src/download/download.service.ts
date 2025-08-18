import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CreateDownloadDto } from './dto/create-download.dto';
import { Aria2Service } from './aria2.service';

@Injectable()
export class DownloadService {
  constructor(
    @InjectQueue('download') private downloadQueue: Queue,
    private aria2Service: Aria2Service,
  ) {}

  async createDownload(createDownloadDto: CreateDownloadDto) {
    const job = await this.downloadQueue.add('process-download', {
      ...createDownloadDto,
      createdAt: new Date(),
    });

    return {
      id: job.id,
      status: 'queued',
      ...createDownloadDto,
    };
  }

  async getDownloads() {
    const jobs = await this.downloadQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    
    return jobs.map(job => ({
      id: job.id,
      status: job.opts.jobId,
      data: job.data,
      progress: job.progress(),
      createdAt: job.timestamp,
      processedAt: job.processedOn,
      finishedAt: job.finishedOn,
    }));
  }

  async getDownload(id: string) {
    const job = await this.downloadQueue.getJob(id);
    
    if (!job) {
      throw new Error('Download job not found');
    }

    return {
      id: job.id,
      status: await job.getState(),
      data: job.data,
      progress: job.progress(),
      createdAt: job.timestamp,
      processedAt: job.processedOn,
      finishedAt: job.finishedOn,
    };
  }

  async getDownloadStatus(id: string) {
    const job = await this.downloadQueue.getJob(id);

    if (!job) {
      throw new Error('Download job not found');
    }

    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress(),
    };
  }

  async pauseDownload(id: string) {
    const job = await this.downloadQueue.getJob(id);

    if (!job) {
      throw new Error('Download job not found');
    }

    // If the job has an aria2 GID, pause it in aria2
    if (job.data.aria2Gid) {
      try {
        await this.aria2Service.pause(job.data.aria2Gid);
      } catch (error) {
        // Log error but don't fail the operation
        console.error('Failed to pause download in aria2:', error);
      }
    }

    return { success: true, message: 'Download paused' };
  }

  async resumeDownload(id: string) {
    const job = await this.downloadQueue.getJob(id);

    if (!job) {
      throw new Error('Download job not found');
    }

    // If the job has an aria2 GID, resume it in aria2
    if (job.data.aria2Gid) {
      try {
        await this.aria2Service.unpause(job.data.aria2Gid);
      } catch (error) {
        // Log error but don't fail the operation
        console.error('Failed to resume download in aria2:', error);
      }
    }

    return { success: true, message: 'Download resumed' };
  }

  async cancelDownload(id: string) {
    const job = await this.downloadQueue.getJob(id);

    if (!job) {
      throw new Error('Download job not found');
    }

    // Remove the job from the queue
    await job.remove();

    // If the job has an aria2 GID, remove it from aria2 as well
    if (job.data.aria2Gid) {
      try {
        await this.aria2Service.remove(job.data.aria2Gid);
      } catch (error) {
        // Log error but don't fail the operation
        console.error('Failed to cancel download in aria2:', error);
      }
    }

    return { success: true, message: 'Download cancelled' };
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.downloadQueue.getJobs(['waiting']),
      this.downloadQueue.getJobs(['active']),
      this.downloadQueue.getJobs(['completed']),
      this.downloadQueue.getJobs(['failed']),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length,
    };
  }

  async getAria2Stats() {
    try {
      return await this.aria2Service.getGlobalStat();
    } catch (error) {
      throw new Error('Failed to get Aria2 statistics');
    }
  }
}
