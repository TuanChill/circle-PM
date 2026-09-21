import { HttpService } from '@app/core';
import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PROJECT_ACCESS_TOKEN } from './project-access-token.constant';
import { toProjectServiceHttpError } from './project-service-http-error';
import { getAppConfig } from '../../config/app.config';

const REQUEST_TIMEOUT_MS = 15_000;

@Injectable()
export class ProjectServiceHttpClient {
  constructor(
    private readonly httpService: HttpService,
    @Inject(PROJECT_ACCESS_TOKEN) private readonly token: string,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  get<T = unknown>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request('GET', path, () =>
      this.httpService.get<T>(this.url(path), this.config({ params: query })),
    );
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request('POST', path, () =>
      this.httpService.post<T>(this.url(path), body, this.config()),
    );
  }

  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request('PATCH', path, () =>
      this.httpService.patch<T>(this.url(path), body, this.config()),
    );
  }

  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request('PUT', path, () =>
      this.httpService.put<T>(this.url(path), body, this.config()),
    );
  }

  delete<T = unknown>(path: string): Promise<T> {
    return this.request('DELETE', path, () =>
      this.httpService.delete<T>(this.url(path), this.config()),
    );
  }

  private async request<T>(
    method: string,
    path: string,
    send: () => Promise<{ data: T }>,
  ): Promise<T> {
    try {
      const response = await send();
      this.logger.info({
        message: 'project-service call',
        context: 'ProjectServiceHttpClient',
        method,
        path,
      });
      return response.data;
    } catch (error) {
      const normalized = toProjectServiceHttpError(error);
      this.logger.error({
        message: 'project-service call failed',
        context: 'ProjectServiceHttpClient',
        method,
        path,
        errorCode: normalized.code,
        status: normalized.status,
      });
      throw normalized;
    }
  }

  private url(path: string): string {
    return `${getAppConfig().projectServiceBaseUrl}${path}`;
  }

  private config(extra: Record<string, unknown> = {}) {
    return {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${this.token}` },
      ...extra,
    };
  }
}
