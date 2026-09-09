import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProwlarrConfigService } from './prowlarr-config.service';
import { TestProwlarrConnectionDto } from './dto/test-prowlarr-connection.dto';

@ApiTags('prowlarr')
@Controller('prowlarr')
export class ProwlarrController {
  constructor(private readonly prowlarrConfigService: ProwlarrConfigService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get Prowlarr and FlareSolverr configuration status' })
  @ApiResponse({ status: 200, description: 'Configuration status' })
  async getStatus() {
    return this.prowlarrConfigService.getConfigurationStatus();
  }

  @Post('configure')
  @ApiOperation({ summary: 'Manually trigger Prowlarr FlareSolverr configuration' })
  @ApiResponse({ status: 200, description: 'Configuration triggered' })
  async configure() {
    return this.prowlarrConfigService.triggerConfiguration();
  }

  @Post('test')
  @ApiOperation({ summary: 'Test a Prowlarr URL and API key without saving them' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async test(@Body() dto: TestProwlarrConnectionDto) {
    return this.prowlarrConfigService.testConnection(dto.url, dto.apiKey);
  }
}
