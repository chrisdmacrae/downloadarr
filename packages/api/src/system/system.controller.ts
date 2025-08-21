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
}
