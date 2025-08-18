import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CreateDownloadDto } from './dto/create-download.dto';

@Injectable()
export class DownloadService {
  constructor(
    @InjectQueue('download') private downloadQueue: Queue,
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
}
