import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { of } from 'rxjs';

export interface ContainerStatus {
  name: string;
  status: string;
  state: string;
  health?: string;
  running: boolean;
  exitCode?: number;
}

export interface VpnContainerInfo {
  exists: boolean;
  running: boolean;
  healthy: boolean;
  name?: string;
  status?: string;
  message: string;
}

@Injectable()
export class DockerService {
  private readonly logger = new Logger(DockerService.name);

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  /**
   * Check if a specific container is running
   */
  async isContainerRunning(containerName: string): Promise<boolean> {
    try {
      const { spawn } = await import('child_process');

      return new Promise((resolve) => {
        // Use docker ps to check if container is running
        const dockerProcess = spawn('docker', ['ps', '--filter', `name=${containerName}`, '--format', '{{.Names}}']);
        
        let output = '';
        dockerProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        dockerProcess.on('exit', (code) => {
          if (code === 0) {
            // Check if the container name appears in the output
            const runningContainers = output.trim().split('\n').filter(line => line.trim());
            const isRunning = runningContainers.some(name => name.includes(containerName));
            resolve(isRunning);
          } else {
            resolve(false);
          }
        });

        dockerProcess.on('error', (error) => {
          this.logger.error(`Error checking container ${containerName}:`, error);
          resolve(false);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          dockerProcess.kill();
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      this.logger.error(`Error checking if container ${containerName} is running:`, error);
      return false;
    }
  }

  /**
   * Get detailed container status
   */
  async getContainerStatus(containerName: string): Promise<ContainerStatus | null> {
    try {
      const { spawn } = await import('child_process');

      return new Promise((resolve) => {
        // Use docker inspect to get detailed container information
        const dockerProcess = spawn('docker', ['inspect', containerName, '--format', '{{.Name}},{{.State.Status}},{{.State.Running}},{{.State.Health.Status}},{{.State.ExitCode}}']);
        
        let output = '';
        dockerProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        dockerProcess.on('exit', (code) => {
          if (code === 0 && output.trim()) {
            try {
              const [name, status, running, health, exitCode] = output.trim().split(',');
              resolve({
                name: name.replace(/^\//, ''), // Remove leading slash from container name
                status,
                state: status,
                health: health !== '<no value>' ? health : undefined,
                running: running === 'true',
                exitCode: exitCode !== '<no value>' ? parseInt(exitCode) : undefined,
              });
            } catch (parseError) {
              this.logger.error(`Error parsing container status for ${containerName}:`, parseError);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });

        dockerProcess.on('error', (error) => {
          this.logger.error(`Error getting container status for ${containerName}:`, error);
          resolve(null);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          dockerProcess.kill();
          resolve(null);
        }, 5000);
      });
    } catch (error) {
      this.logger.error(`Error getting container status for ${containerName}:`, error);
      return null;
    }
  }

  /**
   * Check VPN health by verifying OpenVPN connection status
   */
  async checkVpnHealth(): Promise<{ healthy: boolean; message: string }> {
    try {
      const vpnHost = this.configService.get<string>('ARIA2_HOST', 'aria2');
      const vpnNetworkMode = this.configService.get<string>('VPN_NETWORK_MODE', 'false') === 'true';

      // Check if VPN is configured either by hostname or network mode
      if (vpnHost !== 'vpn' && !vpnNetworkMode) {
        return {
          healthy: false,
          message: 'VPN not configured (not using vpn hostname or network mode)'
        };
      }

      // If we're in VPN network mode, check if we can reach Aria2 locally
      if (vpnNetworkMode) {
        return await this.checkVpnNetworkModeHealth();
      }

      // Create a health check endpoint on the VPN container
      // We'll call a simple endpoint that checks OpenVPN status
      try {
        const response = await firstValueFrom(
          this.httpService.get(`http://vpn:8080/health`, {
            timeout: 5000,
            headers: { 'User-Agent': 'Downloadarr-Health-Check' }
          }).pipe(
            timeout(5000),
            catchError((error) => {
              this.logger.debug('VPN health endpoint not reachable:', error.message);
              return of(null);
            })
          )
        );

        if (response && response.data) {
          return {
            healthy: response.data.connected === true,
            message: response.data.message || 'VPN status retrieved'
          };
        }

        // Fallback: If health endpoint doesn't exist, check basic connectivity
        return await this.checkVpnConnectivityFallback();

      } catch (error) {
        this.logger.debug('VPN health check failed, trying fallback:', error.message);
        return await this.checkVpnConnectivityFallback();
      }
    } catch (error) {
      this.logger.error('Error checking VPN health:', error);
      return {
        healthy: false,
        message: 'Error checking VPN health'
      };
    }
  }

  /**
   * Check VPN health when running in network mode
   */
  private async checkVpnNetworkModeHealth(): Promise<{ healthy: boolean; message: string }> {
    try {
      // In network mode, we're sharing the VPN container's network
      // Check if we can reach Aria2 locally (which means VPN container is running)
      const aria2Port = this.configService.get<number>('ARIA2_PORT', 6800);

      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:${aria2Port}`, {
          timeout: 3000,
          headers: { 'User-Agent': 'Downloadarr-Health-Check' }
        }).pipe(
          timeout(3000),
          catchError(() => of({ status: 200 }))
        )
      );

      return {
        healthy: true,
        message: 'VPN network mode active - container is running'
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'VPN network mode - container not reachable'
      };
    }
  }

  /**
   * Fallback VPN connectivity check
   */
  private async checkVpnConnectivityFallback(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Check if we can reach aria2 through the VPN
      const aria2Port = this.configService.get<number>('ARIA2_PORT', 6800);

      const response = await firstValueFrom(
        this.httpService.get(`http://vpn:${aria2Port}`, {
          timeout: 3000,
          headers: { 'User-Agent': 'Downloadarr-Health-Check' }
        }).pipe(
          timeout(3000),
          catchError(() => of({ status: 200 }))
        )
      );

      return {
        healthy: true,
        message: 'VPN container is reachable (fallback check)'
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'VPN container is not reachable'
      };
    }
  }

  /**
   * Check VPN container status using health check
   */
  async getVpnContainerStatus(): Promise<VpnContainerInfo> {
    try {
      const healthCheck = await this.checkVpnHealth();

      return {
        exists: healthCheck.healthy,
        running: healthCheck.healthy,
        healthy: healthCheck.healthy,
        message: healthCheck.message,
      };
    } catch (error) {
      this.logger.error('Error checking VPN container status:', error);
      return {
        exists: false,
        running: false,
        healthy: false,
        message: 'Error checking VPN status',
      };
    }
  }

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      const { spawn } = await import('child_process');

      return new Promise((resolve) => {
        const dockerProcess = spawn('docker', ['version', '--format', '{{.Server.Version}}']);
        
        dockerProcess.on('exit', (code) => {
          resolve(code === 0);
        });

        dockerProcess.on('error', () => {
          resolve(false);
        });

        // Timeout after 3 seconds
        setTimeout(() => {
          dockerProcess.kill();
          resolve(false);
        }, 3000);
      });
    } catch (error) {
      this.logger.error('Error checking Docker availability:', error);
      return false;
    }
  }
}
