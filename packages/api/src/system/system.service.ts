import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  publishedAt: string;
  updateCommand: string;
  description?: string;
}

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly GITHUB_API_URL = 'https://api.github.com/repos/chrisdmacrae/downloadarr/releases/latest';
  private readonly CURRENT_VERSION: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    // Use environment variable or default version
    // This should be set in docker-compose.yml when deploying a specific version
    this.CURRENT_VERSION = this.configService.get<string>('APP_VERSION', 'latest');
  }

  /**
   * Check for updates from GitHub releases
   */
  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      this.logger.log('Checking for updates from GitHub...');
      
      const response = await firstValueFrom(
        this.httpService.get(this.GITHUB_API_URL, {
          headers: {
            'User-Agent': 'Downloadarr-Update-Checker',
            'Accept': 'application/vnd.github.v3+json',
          },
          timeout: 10000,
        })
      );

      const release = response.data;
      const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
      const currentVersion = this.CURRENT_VERSION;

      // If current version is "latest", always show update available
      const updateAvailable = currentVersion === 'latest' || this.isNewerVersion(latestVersion, currentVersion);
      const vpnEnabled = this.configService.get<string>('VPN_ENABLED', 'false') === 'true';

      const updateCommand = this.getUpdateCommand(vpnEnabled);

      return {
        updateAvailable,
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        publishedAt: release.published_at,
        updateCommand,
        description: release.body || 'No release notes available',
      };
    } catch (error) {
      this.logger.error('Failed to check for updates:', error.message);
      
      // Return fallback info when GitHub API fails
      const vpnEnabled = this.configService.get<string>('VPN_ENABLED', 'false') === 'true';
      
      return {
        updateAvailable: false,
        currentVersion: this.CURRENT_VERSION,
        latestVersion: 'Unknown',
        releaseUrl: 'https://github.com/chrisdmacrae/downloadarr/releases',
        publishedAt: new Date().toISOString(),
        updateCommand: this.getUpdateCommand(vpnEnabled),
        description: 'Unable to check for updates. Please check manually.',
      };
    }
  }

  /**
   * Get the appropriate Docker Compose update command based on VPN configuration
   */
  private getUpdateCommand(vpnEnabled: boolean): string {
    const baseCommand = vpnEnabled
      ? 'docker compose -f docker-compose.yml -f docker-compose.vpn.yml'
      : 'docker compose';

    return `${baseCommand} pull && ${baseCommand} up -d`;
  }

  /**
   * Compare version strings to determine if an update is available
   * Simple semantic version comparison (major.minor.patch)
   */
  private isNewerVersion(latest: string, current: string): boolean {
    try {
      // If current is "latest", we can't really compare, so assume update available
      if (current === 'latest') {
        return true;
      }

      const latestParts = latest.split('.').map(Number);
      const currentParts = current.split('.').map(Number);

      // Ensure both arrays have the same length
      const maxLength = Math.max(latestParts.length, currentParts.length);
      while (latestParts.length < maxLength) latestParts.push(0);
      while (currentParts.length < maxLength) currentParts.push(0);

      for (let i = 0; i < maxLength; i++) {
        if (latestParts[i] > currentParts[i]) {
          return true;
        } else if (latestParts[i] < currentParts[i]) {
          return false;
        }
      }

      return false; // Versions are equal
    } catch (error) {
      this.logger.warn('Error comparing versions, assuming no update available:', error.message);
      return false;
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    const vpnEnabled = this.configService.get<string>('VPN_ENABLED', 'false') === 'true';
    
    return {
      version: this.CURRENT_VERSION,
      vpnEnabled,
      environment: this.configService.get<string>('NODE_ENV', 'production'),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}
