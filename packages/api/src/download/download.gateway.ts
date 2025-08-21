import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { DownloadService } from './download.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map(origin => origin.trim())
      : ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/downloads',
})
export class DownloadGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DownloadGateway.name);

  constructor(private downloadService: DownloadService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe-to-download')
  async handleSubscribeToDownload(
    @MessageBody() data: { downloadId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { downloadId } = data;
    
    try {
      // Join the client to a room for this specific download
      await client.join(`download-${downloadId}`);
      
      // Send current status
      const status = await this.downloadService.getDownloadStatus(downloadId);
      client.emit('download-status', {
        downloadId,
        ...status,
      });
      
      this.logger.log(`Client ${client.id} subscribed to download ${downloadId}`);
    } catch (error) {
      client.emit('error', {
        message: 'Failed to subscribe to download',
        error: error.message,
      });
    }
  }

  @SubscribeMessage('unsubscribe-from-download')
  async handleUnsubscribeFromDownload(
    @MessageBody() data: { downloadId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { downloadId } = data;
    await client.leave(`download-${downloadId}`);
    this.logger.log(`Client ${client.id} unsubscribed from download ${downloadId}`);
  }

  @SubscribeMessage('get-queue-stats')
  async handleGetQueueStats(@ConnectedSocket() client: Socket) {
    try {
      const stats = await this.downloadService.getQueueStats();
      client.emit('queue-stats', stats);
    } catch (error) {
      client.emit('error', {
        message: 'Failed to get queue stats',
        error: error.message,
      });
    }
  }

  @SubscribeMessage('get-aria2-stats')
  async handleGetAria2Stats(@ConnectedSocket() client: Socket) {
    try {
      const stats = await this.downloadService.getAria2Stats();
      client.emit('aria2-stats', stats);
    } catch (error) {
      client.emit('error', {
        message: 'Failed to get Aria2 stats',
        error: error.message,
      });
    }
  }

  // Method to broadcast download progress updates
  broadcastDownloadProgress(downloadId: string, progress: number, status: string, additionalData?: any) {
    this.server.to(`download-${downloadId}`).emit('download-progress', {
      downloadId,
      progress,
      status,
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  // Method to broadcast download status changes
  broadcastDownloadStatusChange(downloadId: string, status: string, data?: any) {
    this.server.to(`download-${downloadId}`).emit('download-status-change', {
      downloadId,
      status,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  // Method to broadcast download completion
  broadcastDownloadComplete(downloadId: string, result: any) {
    this.server.to(`download-${downloadId}`).emit('download-complete', {
      downloadId,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to broadcast download error
  broadcastDownloadError(downloadId: string, error: string) {
    this.server.to(`download-${downloadId}`).emit('download-error', {
      downloadId,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to broadcast queue statistics updates
  broadcastQueueStats(stats: any) {
    this.server.emit('queue-stats-update', {
      ...stats,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to broadcast Aria2 statistics updates
  broadcastAria2Stats(stats: any) {
    this.server.emit('aria2-stats-update', {
      ...stats,
      timestamp: new Date().toISOString(),
    });
  }
}
