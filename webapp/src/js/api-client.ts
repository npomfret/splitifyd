import { firebaseConfigManager } from './firebase-config-manager.js';
import { authManager } from './auth.js';
import { AUTH_TOKEN_KEY } from './constants.js';
import type { AppConfiguration } from './types/webapp-shared-types.js';

class ApiClient {
  private configPromise: Promise<AppConfiguration> | null = null;

  private async getConfig(): Promise<AppConfiguration> {
    if (!this.configPromise) {
      this.configPromise = firebaseConfigManager.getConfig();
    }
    return this.configPromise;
  }

  private getAuthToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const config = await this.getConfig();
    const apiBaseUrl = (window as Window & { API_BASE_URL?: string }).API_BASE_URL;
    const url = `${apiBaseUrl}/api${endpoint}`;
    
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Add auth headers if we have a token
    const token = this.getAuthToken();
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    // Merge headers
    const headers = {
      ...defaultHeaders,
      ...options.headers
    };

    // Apply timeout from config
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.api.timeout);

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
      throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  }

  // Convenience methods
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

}

export const apiClient = new ApiClient();