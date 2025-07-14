import { firebaseConfigManager } from './firebase-config-manager.js';
import { authManager } from './auth.js';
import { AUTH_TOKEN_KEY } from './constants.js';
import type { AppConfiguration } from './types/config.types.js';

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

  private getAuthHeaders(): Record<string, string> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const config = await this.getConfig();
    const apiBaseUrl = (window as any).API_BASE_URL || '';
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

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
        throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Convenience methods
  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async put<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Retry logic for failed requests
  async requestWithRetry<T = any>(
    endpoint: string, 
    options: RequestInit = {},
    maxRetries?: number
  ): Promise<T> {
    const config = await this.getConfig();
    const retries = maxRetries ?? config.api.retryAttempts;
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on auth errors
        if (lastError.message.includes('Authentication required') || 
            lastError.message.includes('401') ||
            lastError.message.includes('403')) {
          throw lastError;
        }
        
        if (attempt < retries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }
    
    throw lastError || new Error('Request failed after retries');
  }
}

export const apiClient = new ApiClient();