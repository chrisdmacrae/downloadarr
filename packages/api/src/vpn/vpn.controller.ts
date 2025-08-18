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

  @Post('connect')
  @ApiOperation({ summary: 'Connect to VPN' })
  @ApiResponse({ status: 200, description: 'VPN connection initiated' })
  async connect() {
    const success = await this.vpnService.connect();
    return {
      success,
      message: success ? 'VPN connected successfully' : 'Failed to connect to VPN',
    };
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect from VPN' })
  @ApiResponse({ status: 200, description: 'VPN disconnection initiated' })
  async disconnect() {
    const success = await this.vpnService.disconnect();
    return {
      success,
      message: success ? 'VPN disconnected successfully' : 'Failed to disconnect from VPN',
    };
  }
}
