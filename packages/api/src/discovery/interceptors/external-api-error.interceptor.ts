import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ExternalApiErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ExternalApiErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        this.logger.error(`External API error: ${error.message}`, error.stack);

        // Handle different types of errors
        if (error instanceof HttpException) {
          return throwError(() => error);
        }

        // Handle network/timeout errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          return throwError(() => new HttpException(
            'External service is currently unavailable',
            HttpStatus.SERVICE_UNAVAILABLE,
          ));
        }

        if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
          return throwError(() => new HttpException(
            'External service request timed out',
            HttpStatus.REQUEST_TIMEOUT,
          ));
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          return throwError(() => new HttpException(
            'Rate limit exceeded. Please try again later',
            HttpStatus.TOO_MANY_REQUESTS,
          ));
        }

        // Handle authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          return throwError(() => new HttpException(
            'External API authentication failed. Please check API keys',
            HttpStatus.SERVICE_UNAVAILABLE,
          ));
        }

        // Handle not found errors
        if (error.response?.status === 404) {
          return throwError(() => new HttpException(
            'Requested resource not found',
            HttpStatus.NOT_FOUND,
          ));
        }

        // Default error handling
        return throwError(() => new HttpException(
          'An unexpected error occurred while processing your request',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ));
      }),
    );
  }
}
