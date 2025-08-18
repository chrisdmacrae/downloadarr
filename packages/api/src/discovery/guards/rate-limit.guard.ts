import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

interface RateLimitConfig {
  requests: number;
  window: number; // in milliseconds
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly store: RateLimitStore = {};

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rateLimitConfig = this.reflector.get<RateLimitConfig>('rateLimit', context.getHandler());

    if (!rateLimitConfig) {
      return true; // No rate limiting configured
    }

    const key = this.generateKey(request);
    const now = Date.now();

    // Clean up expired entries
    this.cleanupExpiredEntries(now);

    // Get or create rate limit entry
    let entry = this.store[key];
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + rateLimitConfig.window,
      };
      this.store[key] = entry;
    }

    // Check if limit exceeded
    if (entry.count >= rateLimitConfig.requests) {
      const remainingTime = Math.ceil((entry.resetTime - now) / 1000);
      
      this.logger.warn(`Rate limit exceeded for ${key}. Reset in ${remainingTime}s`);
      
      throw new HttpException(
        {
          message: 'Rate limit exceeded',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          retryAfter: remainingTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    entry.count++;

    // Add rate limit headers to response
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', rateLimitConfig.requests);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitConfig.requests - entry.count));
    response.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    return true;
  }

  private generateKey(request: Request): string {
    // Use IP address and user agent for rate limiting key
    const ip = request.ip || request.connection.remoteAddress || 'unknown';
    const userAgent = request.get('User-Agent') || 'unknown';
    const endpoint = `${request.method}:${request.route?.path || request.path}`;
    
    return `${ip}:${userAgent}:${endpoint}`;
  }

  private cleanupExpiredEntries(now: number): void {
    const expiredKeys = Object.keys(this.store).filter(
      key => this.store[key].resetTime <= now
    );

    expiredKeys.forEach(key => {
      delete this.store[key];
    });

    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit entries`);
    }
  }
}

// Decorator for setting rate limit configuration
export const RateLimit = (config: RateLimitConfig) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata('rateLimit', config, descriptor.value);
    }
    return descriptor;
  };
};
