import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface TokenInfo {
  accessToken: string;
  expiresAt: Date;
  isValid: boolean;
}

@Injectable()
export class IgdbAuthService implements OnModuleInit {
  private readonly logger = new Logger(IgdbAuthService.name);
  private tokenInfo: TokenInfo | null = null;
  private readonly TOKEN_REFRESH_BUFFER_MINUTES = 60; // Refresh 1 hour before expiry

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing IGDB authentication service...');
    
    try {
      // Try to get a fresh token on startup
      await this.refreshToken();
      this.logger.log('✅ IGDB authentication service initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize IGDB authentication service:', error.message);
      // Don't throw here - let the service continue and retry later
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    if (!this.tokenInfo || !this.isTokenValid()) {
      this.logger.log('Token is invalid or expired, refreshing...');
      await this.refreshToken();
    }

    if (!this.tokenInfo) {
      throw new Error('Failed to obtain valid IGDB access token');
    }

    return this.tokenInfo.accessToken;
  }

  /**
   * Check if the current token is valid and not expired
   */
  private isTokenValid(): boolean {
    if (!this.tokenInfo) {
      return false;
    }

    const now = new Date();
    const bufferTime = new Date(this.tokenInfo.expiresAt.getTime() - (this.TOKEN_REFRESH_BUFFER_MINUTES * 60 * 1000));
    
    return this.tokenInfo.isValid && now < bufferTime;
  }

  /**
   * Refresh the access token using client credentials
   */
  private async refreshToken(): Promise<void> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    this.logger.log('🔄 Requesting new access token from Twitch...');

    try {
      const response = await firstValueFrom(
        this.httpService.post<TwitchTokenResponse>(
          'https://id.twitch.tv/oauth2/token',
          new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
          }
        )
      );

      const { access_token, expires_in } = response.data;
      const expiresAt = new Date(Date.now() + (expires_in * 1000));

      this.tokenInfo = {
        accessToken: access_token,
        expiresAt,
        isValid: true,
      };

      this.logger.log(`✅ New access token obtained, expires at: ${expiresAt.toISOString()}`);

      // Validate the token works with IGDB
      await this.validateToken(access_token);
      
    } catch (error) {
      this.logger.error('❌ Failed to refresh IGDB access token:', error.message);
      
      if (this.tokenInfo) {
        this.tokenInfo.isValid = false;
      }
      
      throw new Error(`Failed to refresh IGDB access token: ${error.message}`);
    }
  }

  /**
   * Validate that the token works with IGDB API
   */
  private async validateToken(accessToken: string): Promise<void> {
    const clientId = this.getClientId();

    try {
      this.logger.log('🔍 Validating token with IGDB API...');

      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.igdb.com/v4/games',
          'fields id, name; limit 1;',
          {
            headers: {
              'Client-ID': clientId,
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'text/plain',
            },
            timeout: 10000,
          }
        )
      );

      if (response.status === 200) {
        this.logger.log('✅ Token validated successfully with IGDB API');
      } else {
        throw new Error(`IGDB validation failed with status ${response.status}`);
      }
    } catch (error) {
      this.logger.error('❌ Token validation failed:', error.message);
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Scheduled task to refresh token before it expires
   * Runs every 30 minutes to check if token needs refreshing
   */
  @Cron('0 */30 * * * *')
  async scheduledTokenRefresh(): Promise<void> {
    try {
      if (!this.isTokenValid()) {
        this.logger.log('🔄 Scheduled token refresh triggered');
        await this.refreshToken();
      }
    } catch (error) {
      this.logger.error('❌ Scheduled token refresh failed:', error.message);
      // Don't throw - let the service continue and retry on next schedule
    }
  }

  /**
   * Get client ID from environment
   */
  private getClientId(): string {
    const clientId = this.configService.get<string>('IGDB_CLIENT_ID');
    if (!clientId) {
      throw new Error('IGDB_CLIENT_ID is required but not configured');
    }
    return clientId;
  }

  /**
   * Get client secret from environment
   */
  private getClientSecret(): string {
    const clientSecret = this.configService.get<string>('IGDB_CLIENT_SECRET');
    if (!clientSecret) {
      throw new Error('IGDB_CLIENT_SECRET is required but not configured');
    }
    return clientSecret;
  }

  /**
   * Get token info for debugging/monitoring
   */
  getTokenInfo(): { isValid: boolean; expiresAt: Date | null; hasToken: boolean } {
    return {
      isValid: this.tokenInfo?.isValid ?? false,
      expiresAt: this.tokenInfo?.expiresAt ?? null,
      hasToken: !!this.tokenInfo,
    };
  }

  /**
   * Force refresh token (for manual refresh or testing)
   */
  async forceRefresh(): Promise<void> {
    this.logger.log('🔄 Force refreshing IGDB token...');
    await this.refreshToken();
  }
}
