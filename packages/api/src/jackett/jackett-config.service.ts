import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';



@Injectable()
export class JackettConfigService implements OnModuleInit {
  private readonly logger = new Logger(JackettConfigService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    // Wait a bit for services to start up
    setTimeout(() => {
      this.configureJackett();
    }, 30000); // Wait 30 seconds for Jackett to be ready
  }

  private async configureJackett(): Promise<void> {
    try {
      const jackettUrl = this.configService.get<string>('JACKETT_URL', 'http://jackett:9117');
      const flaresolverrUrl = this.configService.get<string>('FLARESOLVERR_URL', 'http://flaresolverr:8191');

      this.logger.log('Starting Jackett FlareSolverr configuration...');

      // First, check if FlareSolverr is available
      const isFlareSolverrReady = await this.checkFlareSolverrHealth(flaresolverrUrl);
      if (!isFlareSolverrReady) {
        this.logger.warn('FlareSolverr is not ready, skipping configuration');
        return;
      }

      // Check if Jackett is available
      const isJackettReady = await this.checkJackettHealth(jackettUrl);
      if (!isJackettReady) {
        this.logger.warn('Jackett is not ready, skipping configuration');
        return;
      }

      // Configure Jackett via API
      await this.configureJackettViaApi(jackettUrl, flaresolverrUrl);

      this.logger.log('✅ Jackett FlareSolverr configuration completed successfully');
    } catch (error) {
      this.logger.error('Failed to configure Jackett FlareSolverr:', error);
    }
  }

  private async checkFlareSolverrHealth(flaresolverrUrl: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${flaresolverrUrl}/`, { timeout: 5000 })
      );
      return response.data && response.data.msg === 'FlareSolverr is ready!';
    } catch (error) {
      this.logger.debug('FlareSolverr health check failed:', error.message);
      return false;
    }
  }

  private async checkJackettHealth(jackettUrl: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${jackettUrl}/`, { timeout: 5000 })
      );
      return response.status === 200;
    } catch (error) {
      this.logger.debug('Jackett health check failed:', error.message);
      return false;
    }
  }

  private async configureJackettViaApi(jackettUrl: string, flaresolverrUrl: string): Promise<void> {
    try {
      // Get current Jackett configuration
      const configResponse = await firstValueFrom(
        this.httpService.get(`${jackettUrl}/api/v2.0/server/config`, { timeout: 10000 })
      );

      const currentConfig = configResponse.data;

      // Check if already configured
      if (currentConfig.flaresolverr_url === flaresolverrUrl + '/') {
        this.logger.log('Jackett is already configured with FlareSolverr');
        return;
      }

      // Update configuration with FlareSolverr settings
      const updatedConfig = {
        ...currentConfig,
        flaresolverr_url: flaresolverrUrl + '/',
        flaresolverr_maxtimeout: 60000,
      };

      // Send updated configuration back to Jackett
      await firstValueFrom(
        this.httpService.post(`${jackettUrl}/api/v2.0/server/config`, updatedConfig, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );

      this.logger.log(`✅ Configured Jackett to use FlareSolverr at ${flaresolverrUrl}`);
    } catch (error) {
      this.logger.error('❌ Failed to configure Jackett via API:', error.message);
      throw error;
    }
  }



  /**
   * Manual trigger for configuration (can be called via API endpoint)
   */
  async triggerConfiguration(): Promise<{ success: boolean; message: string }> {
    try {
      await this.configureJackett();
      return {
        success: true,
        message: 'Jackett FlareSolverr configuration completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Configuration failed: ${error.message}`,
      };
    }
  }

  /**
   * Check current FlareSolverr configuration status
   */
  async getConfigurationStatus(): Promise<{
    flaresolverrReady: boolean;
    jackettReady: boolean;
    configured: boolean;
  }> {
    const jackettUrl = this.configService.get<string>('JACKETT_URL', 'http://jackett:9117');
    const flaresolverrUrl = this.configService.get<string>('FLARESOLVERR_URL', 'http://flaresolverr:8191');

    const flaresolverrReady = await this.checkFlareSolverrHealth(flaresolverrUrl);
    const jackettReady = await this.checkJackettHealth(jackettUrl);

    let configured = false;
    if (jackettReady) {
      try {
        const configResponse = await firstValueFrom(
          this.httpService.get(`${jackettUrl}/api/v2.0/server/config`, { timeout: 5000 })
        );
        configured = !!configResponse.data?.flaresolverr_url;
      } catch (error) {
        this.logger.debug('Could not check Jackett configuration:', error.message);
      }
    }

    return {
      flaresolverrReady,
      jackettReady,
      configured,
    };
  }
}
