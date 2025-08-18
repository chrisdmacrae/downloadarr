import { Controller, Get, Post, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VpnService } from './vpn.service';

@ApiTags('vpn')
@Controller('vpn')
export class VpnController {
  constructor(private readonly vpnService: VpnService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get VPN connection status' })
  @ApiResponse({ status: 200, description: 'VPN status information' })
  async getStatus() {
    return this.vpnService.getStatus();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check VPN health status' })
  @ApiResponse({ status: 200, description: 'VPN health check result' })
  async checkHealth() {
    const healthy = await this.vpnService.isVpnHealthy();
    return {
      healthy,
      message: healthy ? 'VPN is healthy' : 'VPN connection issues detected',
    };
  }
}
