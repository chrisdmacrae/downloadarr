import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfigurationService } from '../config/services/app-configuration.service';

/** Prowlarr applies an indexer proxy only to indexers carrying its tag. */
const FLARESOLVERR_TAG = 'flaresolverr';
const FLARESOLVERR_PROXY_NAME = 'FlareSolverr';

@Injectable()
export class ProwlarrConfigService implements OnModuleInit {
  private readonly logger = new Logger(ProwlarrConfigService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly appConfigService: AppConfigurationService,
  ) {}

  async onModuleInit() {
    // Wait a bit for services to start up
    setTimeout(() => {
      this.configureProwlarr();
    }, 30000); // Wait 30 seconds for Prowlarr to be ready
  }

  private async configureProwlarr(): Promise<void> {
    try {
      const { url: prowlarrUrl, apiKey, flaresolverrUrl } = await this.getConnectionSettings();

      this.logger.log('Starting Prowlarr FlareSolverr configuration...');

      if (!apiKey) {
        this.logger.warn('No Prowlarr API key configured, skipping configuration');
        return;
      }

      if (!flaresolverrUrl) {
        this.logger.warn('No FlareSolverr URL configured, skipping configuration');
        return;
      }

      // First, check if FlareSolverr is available
      const isFlareSolverrReady = await this.checkFlareSolverrHealth(flaresolverrUrl);
      if (!isFlareSolverrReady) {
        this.logger.warn('FlareSolverr is not ready, skipping configuration');
        return;
      }

      // Check if Prowlarr is available
      const isProwlarrReady = await this.checkProwlarrHealth(prowlarrUrl, apiKey);
      if (!isProwlarrReady) {
        this.logger.warn('Prowlarr is not ready, skipping configuration');
        return;
      }

      await this.configureFlareSolverrProxy(prowlarrUrl, apiKey, flaresolverrUrl);

      this.logger.log('✅ Prowlarr FlareSolverr configuration completed successfully');
    } catch (error) {
      this.logger.error('Failed to configure Prowlarr FlareSolverr:', error);
    }
  }

  /**
   * Database config wins, env vars are the fallback for installs that never
   * ran the onboarding wizard.
   */
  private async getConnectionSettings(): Promise<{
    url: string;
    apiKey: string | null;
    flaresolverrUrl: string | null;
  }> {
    const envUrl = this.configService.get<string>('PROWLARR_URL', 'http://prowlarr:9696');
    const envFlaresolverr = this.configService.get<string>('FLARESOLVERR_URL', 'http://flaresolverr:8191');

    try {
      const config = await this.appConfigService.getProwlarrConfig();
      return {
        url: config.url || envUrl,
        apiKey: config.apiKey || this.configService.get<string>('PROWLARR_API_KEY') || null,
        flaresolverrUrl: config.flaresolverrUrl || envFlaresolverr || null,
      };
    } catch (error) {
      this.logger.debug('Could not read Prowlarr config from database, using environment variables');
      return {
        url: envUrl,
        apiKey: this.configService.get<string>('PROWLARR_API_KEY') || null,
        flaresolverrUrl: envFlaresolverr || null,
      };
    }
  }

  private authHeaders(apiKey: string): Record<string, string> {
    return { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' };
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

  private async checkProwlarrHealth(prowlarrUrl: string, apiKey: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${prowlarrUrl}/api/v1/system/status`, {
          timeout: 5000,
          headers: this.authHeaders(apiKey),
        })
      );
      return response.status === 200;
    } catch (error) {
      this.logger.debug('Prowlarr health check failed:', error.message);
      return false;
    }
  }

  /**
   * Create (or update) the FlareSolverr indexer proxy.
   *
   * FlareSolverr is not a global setting in Prowlarr: an indexer is routed
   * through the proxy only when it carries one of the proxy's tags. So this
   * also ensures a `flaresolverr` tag exists and is attached to the proxy —
   * users then tag whichever Cloudflare-protected indexers need it.
   */
  private async configureFlareSolverrProxy(
    prowlarrUrl: string,
    apiKey: string,
    flaresolverrUrl: string,
  ): Promise<void> {
    const headers = this.authHeaders(apiKey);
    // Prowlarr's FlareSolverr settings expect a trailing slash on the host.
    const host = flaresolverrUrl.endsWith('/') ? flaresolverrUrl : `${flaresolverrUrl}/`;

    try {
      const tagId = await this.ensureFlareSolverrTag(prowlarrUrl, headers);

      const existingResponse = await firstValueFrom(
        this.httpService.get<any[]>(`${prowlarrUrl}/api/v1/indexerproxy`, { timeout: 10000, headers })
      );

      const existing = (existingResponse.data || []).find(
        (proxy) => proxy.implementation === 'FlareSolverr',
      );

      const payload = {
        ...(existing || {}),
        name: existing?.name || FLARESOLVERR_PROXY_NAME,
        implementation: 'FlareSolverr',
        implementationName: 'FlareSolverr',
        configContract: 'FlareSolverrSettings',
        fields: [
          { name: 'host', value: host },
          { name: 'requestTimeout', value: 60 },
        ],
        tags: Array.from(new Set([...(existing?.tags || []), tagId])),
      };

      if (existing) {
        const currentHost = (existing.fields || []).find((field: any) => field.name === 'host')?.value;
        const alreadyTagged = (existing.tags || []).includes(tagId);

        if (currentHost === host && alreadyTagged) {
          this.logger.log('Prowlarr is already configured with FlareSolverr');
          return;
        }

        await firstValueFrom(
          this.httpService.put(`${prowlarrUrl}/api/v1/indexerproxy/${existing.id}`, payload, {
            timeout: 10000,
            headers,
          })
        );
      } else {
        await firstValueFrom(
          this.httpService.post(`${prowlarrUrl}/api/v1/indexerproxy`, payload, {
            timeout: 10000,
            headers,
          })
        );
      }

      this.logger.log(
        `✅ Configured Prowlarr to use FlareSolverr at ${host}. ` +
          `Tag indexers with "${FLARESOLVERR_TAG}" to route them through it.`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to configure Prowlarr FlareSolverr proxy:', error.message);
      throw error;
    }
  }

  private async ensureFlareSolverrTag(prowlarrUrl: string, headers: Record<string, string>): Promise<number> {
    const tagsResponse = await firstValueFrom(
      this.httpService.get<Array<{ id: number; label: string }>>(`${prowlarrUrl}/api/v1/tag`, {
        timeout: 10000,
        headers,
      })
    );

    const existing = (tagsResponse.data || []).find((tag) => tag.label === FLARESOLVERR_TAG);
    if (existing) {
      return existing.id;
    }

    const created = await firstValueFrom(
      this.httpService.post<{ id: number }>(
        `${prowlarrUrl}/api/v1/tag`,
        { label: FLARESOLVERR_TAG },
        { timeout: 10000, headers },
      )
    );

    this.logger.log(`Created Prowlarr tag "${FLARESOLVERR_TAG}"`);
    return created.data.id;
  }

  /**
   * Manual trigger for configuration (can be called via API endpoint)
   */
  async triggerConfiguration(): Promise<{ success: boolean; message: string }> {
    try {
      await this.configureProwlarr();
      return {
        success: true,
        message: 'Prowlarr FlareSolverr configuration completed successfully',
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
    prowlarrReady: boolean;
    configured: boolean;
    indexerCount: number;
  }> {
    const { url: prowlarrUrl, apiKey, flaresolverrUrl } = await this.getConnectionSettings();

    const flaresolverrReady = flaresolverrUrl ? await this.checkFlareSolverrHealth(flaresolverrUrl) : false;
    const prowlarrReady = apiKey ? await this.checkProwlarrHealth(prowlarrUrl, apiKey) : false;

    let configured = false;
    let indexerCount = 0;

    if (prowlarrReady && apiKey) {
      const headers = this.authHeaders(apiKey);

      try {
        const proxies = await firstValueFrom(
          this.httpService.get<any[]>(`${prowlarrUrl}/api/v1/indexerproxy`, { timeout: 5000, headers })
        );
        configured = (proxies.data || []).some((proxy) => proxy.implementation === 'FlareSolverr');
      } catch (error) {
        this.logger.debug('Could not check Prowlarr proxy configuration:', error.message);
      }

      try {
        const indexers = await firstValueFrom(
          this.httpService.get<any[]>(`${prowlarrUrl}/api/v1/indexer`, { timeout: 5000, headers })
        );
        indexerCount = (indexers.data || []).filter((indexer) => indexer.enable !== false).length;
      } catch (error) {
        this.logger.debug('Could not count Prowlarr indexers:', error.message);
      }
    }

    return {
      flaresolverrReady,
      prowlarrReady,
      configured,
      indexerCount,
    };
  }

  /**
   * Verify a set of credentials without saving them, for the settings UI's
   * "Test connection" button.
   */
  async testConnection(
    url?: string,
    apiKey?: string,
  ): Promise<{ success: boolean; message: string; version?: string; indexerCount?: number }> {
    const settings = await this.getConnectionSettings();
    const targetUrl = url || settings.url;
    const targetKey = apiKey || settings.apiKey;

    if (!targetKey) {
      return { success: false, message: 'No Prowlarr API key configured' };
    }

    try {
      const status = await firstValueFrom(
        this.httpService.get<{ version: string }>(`${targetUrl}/api/v1/system/status`, {
          timeout: 10000,
          headers: this.authHeaders(targetKey),
        })
      );

      const indexers = await firstValueFrom(
        this.httpService.get<any[]>(`${targetUrl}/api/v1/indexer`, {
          timeout: 10000,
          headers: this.authHeaders(targetKey),
        })
      );

      const indexerCount = (indexers.data || []).filter((indexer) => indexer.enable !== false).length;

      return {
        success: true,
        message: `Connected to Prowlarr ${status.data.version} with ${indexerCount} enabled indexer(s)`,
        version: status.data.version,
        indexerCount,
      };
    } catch (error) {
      const statusCode = error.response?.status;
      if (statusCode === 401) {
        return { success: false, message: 'Prowlarr rejected the API key' };
      }

      // Node hands back an AggregateError with an empty message when a
      // dual-stack host refuses on every address, so fall back to the code.
      const reason = error.message || error.code || 'connection refused';
      return { success: false, message: `Could not reach Prowlarr at ${targetUrl}: ${reason}` };
    }
  }
}
