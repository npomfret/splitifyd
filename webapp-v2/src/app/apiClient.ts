/**
 * Type-safe API client with runtime validation
 * 
 * MANDATORY: All API responses are validated at runtime using zod schemas
 * This ensures the server response matches our expected types
 */

import type { ApiContract } from '@shared/apiContract';
import { responseSchemas, ApiErrorResponseSchema } from '@shared/apiSchemas';
import { z } from 'zod';

// API configuration - use window.API_BASE_URL injected during build
const apiBaseUrl = (window as any).API_BASE_URL;
if (!apiBaseUrl) {
  throw new Error('API_BASE_URL is not set - check build configuration');
}
const API_BASE_URL = apiBaseUrl + '/api';

// Custom error class for API validation errors
export class ApiValidationError extends Error {
  constructor(
    message: string,
    public errors: z.ZodError['issues']
  ) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Helper to build URL with params
function buildUrl(endpoint: string, params?: Record<string, string>, query?: Record<string, string>) {
  let url = endpoint;
  
  // Replace path parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });
  }
  
  // Add query parameters
  if (query) {
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value);
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  
  return url;
}

// Type-safe request options
interface RequestOptions<TEndpoint extends keyof ApiContract> {
  method: ApiContract[TEndpoint]['method'];
  params?: ApiContract[TEndpoint] extends { params: infer P } ? P : never;
  query?: ApiContract[TEndpoint] extends { query: infer Q } ? Q : never;
  body?: ApiContract[TEndpoint] extends { request: infer R } ? R : never;
  headers?: Record<string, string>;
}

// Main API client class
export class ApiClient {
  private authToken: string | null = null;

  constructor() {
    // Try to get auth token from localStorage
    const token = localStorage.getItem('AUTH_TOKEN_KEY');
    if (token) {
      this.authToken = token;
    }
  }

  // Set auth token
  setAuthToken(token: string | null) {
    this.authToken = token;
    if (token) {
      localStorage.setItem('AUTH_TOKEN_KEY', token);
    } else {
      localStorage.removeItem('AUTH_TOKEN_KEY');
    }
  }

  // Main request method with type safety and runtime validation
  async request<TEndpoint extends keyof ApiContract>(
    endpoint: TEndpoint,
    options: RequestOptions<TEndpoint>
  ): Promise<ApiContract[TEndpoint]['response']> {
    const url = buildUrl(
      `${API_BASE_URL}${endpoint as string}`,
      options.params as Record<string, string>,
      options.query as Record<string, string>
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth token if available
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const fetchOptions: RequestInit = {
      method: options.method,
      headers,
      // Don't send cookies/credentials to avoid CORS complications
      credentials: 'omit'
    };

    // Add body if present
    if (options.body !== undefined && options.method !== 'GET') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      
      // Handle non-2xx responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Try to parse as API error
        const errorResult = ApiErrorResponseSchema.safeParse(errorData);
        if (errorResult.success) {
          throw new ApiError(
            errorResult.data.error.message,
            errorResult.data.error.code,
            errorResult.data.error.details
          );
        }
        
        // Fallback error
        throw new ApiError(
          `Request failed with status ${response.status}`,
          'UNKNOWN_ERROR',
          errorData
        );
      }

      // Parse response
      const data = await response.json();

      // Get validator for this endpoint
      const validator = responseSchemas[endpoint as keyof typeof responseSchemas];
      if (!validator) {
        console.warn(`No validator found for endpoint ${endpoint as string}`);
        return data;
      }

      // Validate response
      const result = validator.safeParse(data);
      if (!result.success) {
        throw new ApiValidationError(
          `Response from ${endpoint as string} does not match expected type`,
          result.error.issues
        );
      }

      return result.data as ApiContract[TEndpoint]['response'];
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof ApiError || error instanceof ApiValidationError) {
        throw error;
      }
      
      // Wrap other errors
      if (error instanceof Error) {
        throw new ApiError(
          error.message,
          'NETWORK_ERROR',
          error
        );
      }
      
      throw new ApiError(
        'Unknown error occurred',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  // Convenience methods for common endpoints
  async getConfig() {
    return this.request('/config', { method: 'GET' });
  }

  async getGroups() {
    return this.request('/groups', { method: 'GET' });
  }

  async getGroup(id: string) {
    return this.request('/groups/:id', {
      method: 'GET',
      params: { id }
    });
  }

  async createGroup(data: ApiContract['/groups']['request']) {
    return this.request('/groups', {
      method: 'POST',
      body: data
    });
  }

  async getGroupBalances(groupId: string) {
    return this.request('/groups/balances', {
      method: 'GET',
      query: { groupId }
    });
  }

  async getExpenses(groupId: string, limit?: number, cursor?: string) {
    return this.request('/expenses/group', {
      method: 'GET',
      query: {
        groupId,
        limit: limit?.toString(),
        cursor
      }
    });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();