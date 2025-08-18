import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { message: string; timestamp: string; version: string } {
    return {
      message: 'Downloadarr API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  getStatus() {
    return {
      api: 'healthy',
      database: 'connected',
      redis: 'connected',
      vpn: process.env.VPN_ENABLED === 'true' ? 'enabled' : 'disabled',
      services: {
        downloads: 'ready',
        queue: 'ready',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}
