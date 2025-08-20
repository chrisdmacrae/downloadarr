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
    const existingConfig = await this.getConfiguration();
    
    return this.prisma.appConfiguration.update({
      where: { id: existingConfig.id },
      data: {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        jackettApiKey: dto.jackettApiKey,
        organizationEnabled: dto.organizationEnabled,
      },
    });
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
