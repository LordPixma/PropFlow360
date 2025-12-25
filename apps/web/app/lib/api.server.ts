import type { AppLoadContext } from '@remix-run/cloudflare';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}

// Default API URL for production
const DEFAULT_API_URL = 'https://propflow360-api-dev.samuel-1e5.workers.dev';

export class ApiClient {
  private baseUrl: string;
  private accessToken?: string;

  constructor(context: AppLoadContext, accessToken?: string) {
    // Use env var if available, otherwise fall back to default
    this.baseUrl = context.env?.API_BASE_URL || DEFAULT_API_URL;
    this.accessToken = accessToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    const data = await response.json();
    return data as ApiResponse<T>;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = params ? `${path}?${new URLSearchParams(params)}` : path;
    return this.request<T>('GET', url);
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }
}

export function createApiClient(context: AppLoadContext, accessToken?: string): ApiClient {
  return new ApiClient(context, accessToken);
}

// Alias for backwards compatibility
export const apiClient = createApiClient;
