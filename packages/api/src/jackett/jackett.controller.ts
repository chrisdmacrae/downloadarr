import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JackettConfigService } from './jackett-config.service';

@ApiTags('jackett')
@Controller('jackett')
export class JackettController {
  constructor(private readonly jackettConfigService: JackettConfigService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get Jackett and FlareSolverr configuration status' })
  @ApiResponse({ status: 200, description: 'Configuration status' })
  async getStatus() {
    return this.jackettConfigService.getConfigurationStatus();
  }

  @Post('configure')
  @ApiOperation({ summary: 'Manually trigger Jackett FlareSolverr configuration' })
  @ApiResponse({ status: 200, description: 'Configuration triggered' })
  async configure() {
    return this.jackettConfigService.triggerConfiguration();
  }
}
