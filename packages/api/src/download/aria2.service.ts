import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Aria2 from 'aria2';

export interface DownloadOptions {
  dir?: string;
  out?: string;
  'max-connection-per-server'?: number;
  'split'?: number;
  'min-split-size'?: string;
  'continue'?: boolean;
  'max-concurrent-downloads'?: number;
  'max-download-limit'?: string;
  'seed-time'?: number;
  'bt-max-peers'?: number;
  'bt-request-peer-speed-limit'?: string;
  'dht-listen-port'?: string;
  'listen-port'?: string;
  'enable-dht'?: boolean;
  'bt-enable-lpd'?: boolean;
  'enable-peer-exchange'?: boolean;
  'user-agent'?: string;
  'referer'?: string;
  'header'?: string[];
}

export interface DownloadStatus {
  gid: string;
  status: 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed';
  totalLength: string;
  completedLength: string;
  uploadLength: string;
  bitfield?: string;
  downloadSpeed: string;
  uploadSpeed: string;
  infoHash?: string;
  numSeeders?: string;
  seeder?: string;
  pieceLength?: string;
  numPieces?: string;
  connections: string;
  errorCode?: string;
  errorMessage?: string;
  followedBy?: string[];
  following?: string;
  belongsTo?: string;
  dir: string;
  files: Array<{
    index: string;
    path: string;
    length: string;
    completedLength: string;
    selected: string;
    uris: Array<{
      uri: string;
      status: string;
    }>;
  }>;
  bittorrent?: {
    announceList: string[][];
    comment: string;
    creationDate: number;
    mode: string;
    info: {
      name: string;
    };
  };
  verifiedLength: string;
  verifyIntegrityPending: string;
}

@Injectable()
export class Aria2Service implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Aria2Service.name);
  private aria2: any;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const host = this.configService.get('ARIA2_HOST', 'localhost');
      const port = this.configService.get('ARIA2_PORT', 6800);
      const secret = this.configService.get('ARIA2_SECRET') || this.configService.get('ARIA2_RPC_SECRET', '');

      this.logger.log(`Attempting to connect to Aria2 RPC at ${host}:${port}`);

      if (!secret) {
        this.logger.warn('No ARIA2_SECRET or ARIA2_RPC_SECRET configured - using empty secret');
      }

      this.aria2 = new Aria2({
        host,
        port,
        secure: false,
        secret,
        path: '/jsonrpc',
      });

      // Test connection
      await this.aria2.call('getVersion');
      this.isConnected = true;
      this.logger.log(`Successfully connected to Aria2 RPC at ${host}:${port}`);
    } catch (error) {
      this.logger.error('Failed to connect to Aria2 RPC:', error);
      this.isConnected = false;

      // Don't throw error on startup - allow service to start and retry later
      if (error.message?.includes('Unauthorized')) {
        this.logger.error('Aria2 RPC authentication failed. Check ARIA2_SECRET/ARIA2_RPC_SECRET environment variable.');
      } else if (error.code === 'ECONNREFUSED') {
        this.logger.error('Aria2 RPC connection refused. Is Aria2 running and accessible?');
      }
    }
  }

  private async disconnect() {
    if (this.aria2) {
      try {
        await this.aria2.close();
        this.isConnected = false;
        this.logger.log('Disconnected from Aria2 RPC');
      } catch (error) {
        this.logger.error('Error disconnecting from Aria2:', error);
      }
    }
  }

  async addUri(uris: string[], options: DownloadOptions = {}): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      const defaultOptions: DownloadOptions = {
        'max-connection-per-server': 4,
        'split': 4,
        'min-split-size': '1M',
        'continue': true,
        'max-concurrent-downloads': 3,
        'user-agent': 'Downloadarr/1.0',
        ...options,
      };

      const gid = await this.aria2.call('addUri', uris, defaultOptions);
      this.logger.log(`Added download with GID: ${gid}`);
      return gid;
    } catch (error) {
      this.logger.error('Failed to add URI download:', error);
      throw error;
    }
  }

  async addTorrent(torrent: Buffer, uris: string[] = [], options: DownloadOptions = {}): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      const defaultOptions: DownloadOptions = {
        'seed-time': 0,
        'bt-max-peers': 50,
        'bt-request-peer-speed-limit': '50K',
        'dht-listen-port': '6881-6999',
        'listen-port': '6881-6999',
        'enable-dht': true,
        'bt-enable-lpd': true,
        'enable-peer-exchange': true,
        ...options,
      };

      const torrentBase64 = torrent.toString('base64');
      const gid = await this.aria2.call('addTorrent', torrentBase64, uris, defaultOptions);
      this.logger.log(`Added torrent download with GID: ${gid}`);
      return gid;
    } catch (error) {
      this.logger.error('Failed to add torrent download:', error);
      throw error;
    }
  }

  async addMagnet(magnetUri: string, options: DownloadOptions = {}): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      const defaultOptions: DownloadOptions = {
        'seed-time': 0,
        'bt-max-peers': 50,
        'bt-request-peer-speed-limit': '50K',
        'dht-listen-port': '6881-6999',
        'listen-port': '6881-6999',
        'enable-dht': true,
        'bt-enable-lpd': true,
        'enable-peer-exchange': true,
        ...options,
      };

      const gid = await this.aria2.call('addUri', [magnetUri], defaultOptions);
      this.logger.log(`Added magnet download with GID: ${gid}`);
      return gid;
    } catch (error) {
      this.logger.error('Failed to add magnet download:', error);
      throw error;
    }
  }

  async getStatus(gid: string): Promise<DownloadStatus> {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      const status = await this.aria2.call('tellStatus', gid);
      return status as DownloadStatus;
    } catch (error) {
      this.logger.error(`Failed to get status for GID ${gid}:`, error);
      throw error;
    }
  }

  async pause(gid: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      const result = await this.aria2.call('pause', gid);
      this.logger.log(`Paused download with GID: ${gid}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to pause download ${gid}:`, error);
      throw error;
    }
  }

  async unpause(gid: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      const result = await this.aria2.call('unpause', gid);
      this.logger.log(`Unpaused download with GID: ${gid}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to unpause download ${gid}:`, error);
      throw error;
    }
  }

  async remove(gid: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      const result = await this.aria2.call('remove', gid);
      this.logger.log(`Removed download with GID: ${gid}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to remove download ${gid}:`, error);
      throw error;
    }
  }

  async getGlobalStat() {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      return await this.aria2.call('getGlobalStat');
    } catch (error) {
      this.logger.error('Failed to get global stats:', error);
      throw error;
    }
  }

  async getActiveDownloads(): Promise<DownloadStatus[]> {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      return await this.aria2.call('tellActive');
    } catch (error) {
      this.logger.error('Failed to get active downloads:', error);
      throw error;
    }
  }

  async getWaitingDownloads(offset = 0, num = 100): Promise<DownloadStatus[]> {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      return await this.aria2.call('tellWaiting', offset, num);
    } catch (error) {
      this.logger.error('Failed to get waiting downloads:', error);
      throw error;
    }
  }

  async getStoppedDownloads(offset = 0, num = 100): Promise<DownloadStatus[]> {
    if (!this.isConnected) {
      throw new Error('Aria2 RPC not connected');
    }

    try {
      return await this.aria2.call('tellStopped', offset, num);
    } catch (error) {
      this.logger.error('Failed to get stopped downloads:', error);
      throw error;
    }
  }

  isAria2Connected(): boolean {
    return this.isConnected;
  }
}
