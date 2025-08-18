import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerService } from '../docker/docker.service';

@Injectable()
export class VpnService {
  private readonly logger = new Logger(VpnService.name);

  constructor(
    private configService: ConfigService,
    private dockerService: DockerService,
  ) {}

  async checkVpnConnection(): Promise<boolean> {
    try {
      // In Docker Compose setup, we check if we can reach the VPN container
      // This is a simple connectivity check
      const { spawn } = await import('child_process');

      return new Promise((resolve) => {
        // Try to ping a public DNS server to check internet connectivity
        const pingProcess = spawn('ping', ['-c', '1', '-W', '3', '8.8.8.8']);

        pingProcess.on('exit', (code) => {
          resolve(code === 0);
        });

        pingProcess.on('error', () => {
          resolve(false);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          pingProcess.kill();
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      this.logger.error('Error checking VPN connection status:', error);
      return false;
    }
  }

  async getPublicIP(): Promise<string | null> {
    try {
      const https = await import('https');

      return new Promise((resolve) => {
        const req = https.get('https://api.ipify.org', (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => resolve(data.trim()));
        });

        req.on('error', () => resolve(null));
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(null);
        });
      });
    } catch (error) {
      this.logger.error('Error getting public IP:', error);
      return null;
    }
  }

  async getStatus() {
    const publicIP = await this.getPublicIP();
    const vpnEnabled = this.configService.get<string>('VPN_ENABLED', 'true') === 'true';

    // VPN connection logic: only "connected" if VPN is enabled AND we can get Docker status
    let connected = false;
    let message = '';
    let containerRunning = false;
    let containerHealthy = false;

    if (vpnEnabled) {
      try {
        // Check VPN container status using Docker service
        const vpnContainerInfo = await this.dockerService.getVpnContainerStatus();
        containerRunning = vpnContainerInfo.running;
        containerHealthy = vpnContainerInfo.healthy;

        if (vpnContainerInfo.running && vpnContainerInfo.healthy) {
          // Container is running, now check network connectivity
          const networkConnected = await this.checkVpnConnection();
          connected = networkConnected;
          message = networkConnected
            ? 'VPN container running and network connected'
            : 'VPN container running but network issues detected';
        } else {
          connected = false;
          message = vpnContainerInfo.message;
        }
      } catch (error) {
        // Cannot get Docker status - VPN cannot be connected
        connected = false;
        containerRunning = false;
        containerHealthy = false;
        message = 'Cannot communicate with Docker - VPN status unknown';
      }
    } else {
      // VPN is disabled - never report as "connected"
      connected = false;
      message = 'VPN is disabled';
    }

    return {
      enabled: vpnEnabled,
      connected,
      publicIP,
      containerRunning,
      containerHealthy,
      message,
    };
  }

  async isVpnHealthy(): Promise<boolean> {
    const vpnEnabled = this.configService.get<string>('VPN_ENABLED', 'true') === 'true';

    if (!vpnEnabled) {
      return true; // VPN not required, so it's "healthy"
    }

    // Check both container status and network connectivity
    const vpnContainerInfo = await this.dockerService.getVpnContainerStatus();

    if (!vpnContainerInfo.running || !vpnContainerInfo.healthy) {
      return false; // Container not running or unhealthy
    }

    // Container is healthy, check network connectivity
    return this.checkVpnConnection();
  }
}
