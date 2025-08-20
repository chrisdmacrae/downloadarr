import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { AxiosResponse, AxiosRequestConfig } from 'axios';
import { ExternalApiResponse, ExternalApiConfig, ApiRateLimit } from '../interfaces/external-api.interface';

@Injectable()
export abstract class BaseExternalApiService {
  protected logger = new Logger(this.constructor.name);
  protected config: ExternalApiConfig;
  protected rateLimitInfo: ApiRateLimit | null = null;
  protected requestQueue: Array<() => Promise<any>> = [];
  protected isProcessingQueue = false;

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {}

  protected abstract getServiceConfig(): ExternalApiConfig | Promise<ExternalApiConfig>;

  protected async makeRequest<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: AxiosRequestConfig,
  ): Promise<ExternalApiResponse<T>> {
    try {
      this.config = await this.getServiceConfig();
      
      // Check rate limiting
      if (this.config.rateLimit && this.rateLimitInfo) {
        await this.checkRateLimit();
      }

      const url = `${this.config.baseUrl}${endpoint}`;
      const requestConfig: AxiosRequestConfig = {
        timeout: this.config.timeout || 10000,
        params: {
          ...params,
          ...(this.config.apiKey && { apikey: this.config.apiKey }),
        },
        ...options,
      };

      this.logger.debug(`Making request to: ${url}`, { params: requestConfig.params });

      const response = await firstValueFrom(
        this.httpService.get<T>(url, requestConfig).pipe(
          timeout(this.config.timeout || 10000),
          retry(this.config.retryAttempts || 2),
          catchError((error) => {
            this.logger.error(`API request failed: ${error.message}`, error.stack);
            throw new HttpException(
              `External API error: ${error.message}`,
              error.response?.status || HttpStatus.SERVICE_UNAVAILABLE,
            );
          }),
        ),
      );

      // Update rate limit info from headers
      this.updateRateLimitInfo(response);

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };
    } catch (error) {
      this.logger.error(`Request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        statusCode: error.status || HttpStatus.SERVICE_UNAVAILABLE,
      };
    }
  }

  protected async checkRateLimit(): Promise<void> {
    if (!this.rateLimitInfo || !this.config.rateLimit) return;

    const now = Date.now();
    if (this.rateLimitInfo.remaining <= 0 && now < this.rateLimitInfo.reset) {
      const waitTime = this.rateLimitInfo.reset - now;
      this.logger.warn(`Rate limit exceeded, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  protected updateRateLimitInfo(response: AxiosResponse): void {
    const headers = response.headers;
    
    // Common rate limit header patterns
    const limit = headers['x-ratelimit-limit'] || headers['x-rate-limit-limit'];
    const remaining = headers['x-ratelimit-remaining'] || headers['x-rate-limit-remaining'];
    const reset = headers['x-ratelimit-reset'] || headers['x-rate-limit-reset'];

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: parseInt(reset) * 1000, // Convert to milliseconds
      };
    }
  }

  protected validateApiKey(keyName: string): string {
    const apiKey = this.configService.get<string>(keyName);
    if (!apiKey) {
      throw new HttpException(
        `${keyName} is required but not configured`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return apiKey;
  }

  protected sanitizeSearchQuery(query: string): string {
    return query.trim().replace(/[^\w\s-]/g, '').substring(0, 100);
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
