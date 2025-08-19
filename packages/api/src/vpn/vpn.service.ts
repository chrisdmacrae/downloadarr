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
      // First try to get IP from VPN container if VPN is enabled
      const vpnEnabled = this.configService.get<string>('VPN_ENABLED', 'true') === 'true';

      if (vpnEnabled) {
        const vpnIP = await this.getVpnContainerIP();
        if (vpnIP) {
          return vpnIP;
        }
        // If VPN is enabled but we can't get IP from container, fall back to direct call
        this.logger.warn('VPN enabled but could not get IP from VPN container, falling back to direct call');
      }

      // Fallback: Direct call (for non-VPN setups or when VPN container method fails)
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

  /**
   * Get the public IP from the shared volume written by the VPN-routed Aria2 container
   */
  private async getVpnContainerIP(): Promise<string | null> {
    try {
      const fs = await import('fs/promises');
      const path = '/tmp/vpn-ip/external_ip';

      // Check if the IP file exists and read it
      const ipData = await fs.readFile(path, 'utf8');
      const ip = ipData.trim();

      // Basic IP validation
      if (ip && ip !== 'unknown' && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
        // Optionally check if the IP is recent (within last 5 minutes)
        try {
          const lastUpdatePath = '/tmp/vpn-ip/last_update';
          const lastUpdateData = await fs.readFile(lastUpdatePath, 'utf8');
          const lastUpdateTime = new Date(lastUpdateData.split(': ')[0]);
          const now = new Date();
          const ageMinutes = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60);

          if (ageMinutes > 5) {
            this.logger.warn(`VPN IP data is ${ageMinutes.toFixed(1)} minutes old, may be stale`);
          }
        } catch (updateError) {
          // Ignore errors reading update time
        }

        return ip;
      } else {
        this.logger.debug(`Invalid or missing VPN IP in shared volume: "${ip}"`);
        return null;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.debug('VPN IP file not found in shared volume, VPN container may not be ready');
      } else {
        this.logger.debug('Error reading VPN IP from shared volume:', error.message);
      }
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
