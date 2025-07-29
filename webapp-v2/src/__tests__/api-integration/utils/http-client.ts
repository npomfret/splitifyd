import { EMULATOR_CONFIG } from './emulator-config';

export interface ApiRequestOptions extends RequestInit {
  timeout?: number;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || EMULATOR_CONFIG.API_BASE_URL;
  }

  async request<T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { timeout = 10000, ...fetchOptions } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text() as unknown as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  async get<T = any>(path: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T = any>(path: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(path: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(path: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}