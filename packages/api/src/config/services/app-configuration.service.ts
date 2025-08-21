import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppConfiguration } from '../../../generated/prisma';
import { UpdateAppConfigurationDto, OnboardingStepDto } from '../dto/app-configuration.dto';

@Injectable()
export class AppConfigurationService {
  private readonly logger = new Logger(AppConfigurationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get app configuration, creating default if none exists
   */
  async getConfiguration(): Promise<AppConfiguration> {
    let config = await this.prisma.appConfiguration.findFirst();
    
    if (!config) {
      config = await this.createDefaultConfiguration();
    }
    
    return config;
  }

  /**
   * Update app configuration
   */
  async updateConfiguration(dto: UpdateAppConfigurationDto): Promise<AppConfiguration> {
    const existingConfig = await this.getConfiguration();
    
    const updateData: any = { ...dto };
    
    // If marking onboarding as completed, set the completion timestamp
    if (dto.onboardingCompleted === true && !existingConfig.onboardingCompleted) {
      updateData.onboardingCompletedAt = new Date();
    }
    
    return this.prisma.appConfiguration.update({
      where: { id: existingConfig.id },
      data: updateData,
    });
  }

  /**
   * Complete onboarding with provided configuration
   */
  async completeOnboarding(dto: OnboardingStepDto): Promise<AppConfiguration> {
    this.logger.log('Completing onboarding with data:', {
      jackettApiKey: dto.jackettApiKey ? '[REDACTED]' : null,
      organizationEnabled: dto.organizationEnabled,
      omdbApiKey: dto.omdbApiKey ? '[REDACTED]' : null,
      tmdbApiKey: dto.tmdbApiKey ? '[REDACTED]' : null,
      igdbClientId: dto.igdbClientId ? '[REDACTED]' : null,
      igdbClientSecret: dto.igdbClientSecret ? '[REDACTED]' : null,
    });

    const existingConfig = await this.getConfiguration();
    this.logger.log(`Updating configuration with ID: ${existingConfig.id}`);

    try {
      const updatedConfig = await this.prisma.appConfiguration.update({
        where: { id: existingConfig.id },
        data: {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          jackettApiKey: dto.jackettApiKey,
          organizationEnabled: dto.organizationEnabled,
          omdbApiKey: dto.omdbApiKey,
          tmdbApiKey: dto.tmdbApiKey,
          igdbClientId: dto.igdbClientId,
          igdbClientSecret: dto.igdbClientSecret,
        },
      });

      this.logger.log('Onboarding completed successfully');
      return updatedConfig;
    } catch (error) {
      this.logger.error('Failed to complete onboarding:', error);
      throw error;
    }
  }

  /**
   * Check if onboarding is completed
   */
  async isOnboardingCompleted(): Promise<boolean> {
    const config = await this.getConfiguration();
    return config.onboardingCompleted;
  }

  /**
   * Get Jackett configuration
   */
  async getJackettConfig(): Promise<{ apiKey: string | null; url: string }> {
    const config = await this.getConfiguration();
    return {
      apiKey: config.jackettApiKey,
      url: config.jackettUrl,
    };
  }

  /**
   * Get external API keys configuration
   */
  async getApiKeysConfig(): Promise<{
    omdbApiKey: string | null;
    tmdbApiKey: string | null;
    igdbClientId: string | null;
    igdbClientSecret: string | null;
  }> {
    const config = await this.getConfiguration();
    return {
      omdbApiKey: config.omdbApiKey,
      tmdbApiKey: config.tmdbApiKey,
      igdbClientId: config.igdbClientId,
      igdbClientSecret: config.igdbClientSecret,
    };
  }

  /**
   * Update external API keys
   */
  async updateApiKeys(apiKeys: {
    omdbApiKey?: string;
    tmdbApiKey?: string;
    igdbClientId?: string;
    igdbClientSecret?: string;
  }): Promise<AppConfiguration> {
    const existingConfig = await this.getConfiguration();

    return this.prisma.appConfiguration.update({
      where: { id: existingConfig.id },
      data: {
        omdbApiKey: apiKeys.omdbApiKey ?? existingConfig.omdbApiKey,
        tmdbApiKey: apiKeys.tmdbApiKey ?? existingConfig.tmdbApiKey,
        igdbClientId: apiKeys.igdbClientId ?? existingConfig.igdbClientId,
        igdbClientSecret: apiKeys.igdbClientSecret ?? existingConfig.igdbClientSecret,
      },
    });
  }

  /**
   * Create default configuration
   */
  private async createDefaultConfiguration(): Promise<AppConfiguration> {
    this.logger.log('Creating default app configuration');
    
    return this.prisma.appConfiguration.create({
      data: {
        onboardingCompleted: false,
        jackettUrl: 'http://jackett:9117',
        organizationEnabled: true,
      },
    });
  }
}
