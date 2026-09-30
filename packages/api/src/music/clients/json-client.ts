import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * GETs JSON with one request in flight at a time and a minimum gap between
 * requests, so a sync stays under each provider's rate limit. A 404 or 204
 * returns null: "no such user" and "no stats yet" are answers, not failures.
 */
export class ThrottledJsonClient {
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(
    private readonly http: HttpService,
    private readonly logger: Logger,
    private readonly minIntervalMs: number,
    private readonly timeoutMs = 15000,
  ) {}

  get<T>(
    url: string,
    params?: Record<string, string | number | boolean | undefined>,
    headers?: Record<string, string>,
  ): Promise<T | null> {
    const run = this.queue.then(() => this.request<T>(url, params, headers));
    // The chain must survive a failed request.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async request<T>(
    url: string,
    params?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<T | null> {
    const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();

    try {
      const response = await firstValueFrom(
        this.http.get<T>(url, {
          params,
          timeout: this.timeoutMs,
          headers: { 'User-Agent': 'Downloadarr (https://github.com/chrisdmacrae/downloadarr)', ...headers },
        }),
      );
      if (response.status === 204 || response.data === '' || response.data == null) return null;
      return response.data;
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (status === 404 || status === 204) return null;
      this.logger.warn(`GET ${url} failed: ${status ?? ''} ${(error as Error).message}`);
      throw new ProviderError((error as Error).message, status);
    }
  }
}
