import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SystemService } from './system.service';

@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('updates/check')
  @ApiOperation({ summary: 'Check for available updates' })
  @ApiResponse({ 
    status: 200, 
    description: 'Update information retrieved',
    schema: {
      type: 'object',
      properties: {
        updateAvailable: { type: 'boolean' },
        currentVersion: { type: 'string' },
        latestVersion: { type: 'string' },
        releaseUrl: { type: 'string' },
        publishedAt: { type: 'string' },
        updateCommand: { type: 'string' },
        description: { type: 'string' }
      }
    }
  })
  async checkForUpdates() {
    return this.systemService.checkForUpdates();
  }

  @Get('info')
  @ApiOperation({ summary: 'Get system information' })
  @ApiResponse({ 
    status: 200, 
    description: 'System information retrieved',
    schema: {
      type: 'object',
      properties: {
        version: { type: 'string' },
        vpnEnabled: { type: 'boolean' },
        environment: { type: 'string' },
        uptime: { type: 'number' },
        memory: { type: 'object' }
      }
    }
  })
  async getSystemInfo() {
    return this.systemService.getSystemInfo();
  }

  @Get('storage')
  @ApiOperation({ summary: 'Get disk usage for the download and library paths' })
  @ApiResponse({
    status: 200,
    description: 'Storage information retrieved',
    schema: {
      type: 'object',
      properties: {
        volumes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              path: { type: 'string' },
              total: { type: 'number', nullable: true },
              used: { type: 'number', nullable: true },
              available: { type: 'number', nullable: true },
              usedPercent: { type: 'number', nullable: true },
              sharedWith: { type: 'string', nullable: true },
              error: { type: 'string' }
            }
          }
        }
      }
    }
  })
  async getStorageInfo() {
    return this.systemService.getStorageInfo();
  }
}
