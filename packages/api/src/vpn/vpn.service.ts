import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VpnService {
  private readonly logger = new Logger(VpnService.name);
  private vpnConnection: any = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private maxRetries = 3;

  constructor(private configService: ConfigService) {}

  async connect(): Promise<boolean> {
    const vpnEnabled = this.configService.get<string>('VPN_ENABLED') === 'true';

    if (!vpnEnabled) {
      this.logger.log('VPN is disabled in configuration');
      return false;
    }

    const configPath = this.configService.get<string>('VPN_CONFIG_PATH');

    if (!configPath) {
      this.logger.error('VPN_CONFIG_PATH not configured');
      return false;
    }

    // Check if config file exists
    if (!fs.existsSync(configPath)) {
      this.logger.error(`VPN config file not found: ${configPath}`);
      return false;
    }

    try {
      this.logger.log(`Connecting to VPN using config: ${configPath}`);

      // Import node-openvpn dynamically to handle potential missing dependency
      const { spawn } = await import('child_process');

      return new Promise((resolve) => {
        const vpnProcess = spawn('openvpn', [
          '--config', configPath,
          '--daemon',
          '--log', '/tmp/openvpn.log',
          '--status', '/tmp/openvpn-status.log',
          '--management', '127.0.0.1', '7505'
        ]);

        vpnProcess.on('spawn', () => {
          this.logger.log('VPN process started');
          this.vpnConnection = vpnProcess;

          // Wait a bit for connection to establish
          setTimeout(() => {
            this.checkConnectionStatus().then((connected) => {
              this.isConnected = connected;
              if (connected) {
                this.logger.log('VPN connected successfully');
                this.connectionAttempts = 0;
              } else {
                this.logger.warn('VPN process started but connection not established');
              }
              resolve(connected);
            });
          }, 5000);
        });

        vpnProcess.on('error', (error) => {
          this.logger.error('Failed to start VPN process:', error);
          this.isConnected = false;
          resolve(false);
        });

        vpnProcess.on('exit', (code) => {
          this.logger.warn(`VPN process exited with code: ${code}`);
          this.isConnected = false;
          this.vpnConnection = null;
        });
      });
    } catch (error) {
      this.logger.error('Failed to connect to VPN:', error);
      this.connectionAttempts++;

      if (this.connectionAttempts < this.maxRetries) {
        this.logger.log(`Retrying VPN connection (${this.connectionAttempts}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.connect();
      }

      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    if (!this.isConnected || !this.vpnConnection) {
      return true;
    }

    try {
      this.logger.log('Disconnecting from VPN...');

      // Kill the VPN process
      this.vpnConnection.kill('SIGTERM');

      // Wait for process to terminate
      await new Promise((resolve) => {
        this.vpnConnection.on('exit', () => {
          resolve(true);
        });

        // Force kill after 5 seconds if not terminated
        setTimeout(() => {
          if (this.vpnConnection && !this.vpnConnection.killed) {
            this.vpnConnection.kill('SIGKILL');
          }
          resolve(true);
        }, 5000);
      });

      this.isConnected = false;
      this.vpnConnection = null;
      this.connectionAttempts = 0;

      this.logger.log('VPN disconnected successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to disconnect from VPN:', error);
      return false;
    }
  }

  private async checkConnectionStatus(): Promise<boolean> {
    try {
      // Check if we can reach the internet through VPN
      const { spawn } = await import('child_process');

      return new Promise((resolve) => {
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

    return {
      enabled: this.configService.get<string>('VPN_ENABLED') === 'true',
      connected: this.isConnected,
      configPath: this.configService.get<string>('VPN_CONFIG_PATH'),
      publicIP,
      connectionAttempts: this.connectionAttempts,
      processRunning: this.vpnConnection && !this.vpnConnection.killed,
    };
  }

  isVpnConnected(): boolean {
    return this.isConnected;
  }

  async ensureVpnConnection(): Promise<boolean> {
    if (this.configService.get<string>('VPN_ENABLED') !== 'true') {
      return true; // VPN not required
    }

    if (this.isConnected) {
      // Verify connection is still active
      const isActive = await this.checkConnectionStatus();
      if (isActive) {
        return true;
      } else {
        this.logger.warn('VPN connection lost, attempting to reconnect...');
        this.isConnected = false;
      }
    }

    return this.connect();
  }
}
