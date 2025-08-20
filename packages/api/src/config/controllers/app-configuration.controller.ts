import { Controller, Get, Put, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppConfigurationService } from '../services/app-configuration.service';
import { OrganizationRulesService } from '../../organization/services/organization-rules.service';
import { UpdateAppConfigurationDto, OnboardingStepDto } from '../dto/app-configuration.dto';
import { ContentType } from '../../../generated/prisma';

@ApiTags('configuration')
@Controller('configuration')
export class AppConfigurationController {
  constructor(
    private readonly appConfigService: AppConfigurationService,
    private readonly organizationRulesService: OrganizationRulesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get app configuration' })
  @ApiResponse({ status: 200, description: 'App configuration retrieved' })
  async getConfiguration() {
    return this.appConfigService.getConfiguration();
  }

  @Put()
  @ApiOperation({ summary: 'Update app configuration' })
  @ApiResponse({ status: 200, description: 'App configuration updated' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateConfiguration(@Body() dto: UpdateAppConfigurationDto) {
    return this.appConfigService.updateConfiguration(dto);
  }

  @Get('onboarding/status')
  @ApiOperation({ summary: 'Check if onboarding is completed' })
  @ApiResponse({ status: 200, description: 'Onboarding status' })
  async getOnboardingStatus() {
    const completed = await this.appConfigService.isOnboardingCompleted();
    return { completed };
  }

  @Post('onboarding/complete')
  @ApiOperation({ summary: 'Complete onboarding process' })
  @ApiResponse({ status: 200, description: 'Onboarding completed successfully' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async completeOnboarding(@Body() dto: OnboardingStepDto) {
    // Complete the onboarding
    const config = await this.appConfigService.completeOnboarding(dto);

    // If organization is enabled, create default rules
    if (dto.organizationEnabled) {
      await this.createDefaultOrganizationRules();
    }

    return {
      success: true,
      message: 'Onboarding completed successfully',
      configuration: config,
    };
  }

  @Get('jackett')
  @ApiOperation({ summary: 'Get Jackett configuration' })
  @ApiResponse({ status: 200, description: 'Jackett configuration' })
  async getJackettConfig() {
    return this.appConfigService.getJackettConfig();
  }

  /**
   * Create default organization rules for all content types
   */
  private async createDefaultOrganizationRules(): Promise<void> {
    const contentTypes = [ContentType.MOVIE, ContentType.TV_SHOW, ContentType.GAME];
    
    for (const contentType of contentTypes) {
      try {
        // Check if default rule already exists
        const existingRule = await this.organizationRulesService.getRuleForContentType(contentType);
        if (!existingRule) {
          // This will create a default rule if none exists
          await this.organizationRulesService.getRuleForContentType(contentType);
        }
      } catch (error) {
        // Rule will be created automatically when needed
      }
    }
  }
}
