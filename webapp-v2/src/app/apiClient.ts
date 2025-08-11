/**
 * API client with runtime validation
 *
 * All API responses are validated at runtime using zod schemas
 * This ensures the server response matches our expected types
 */

import { responseSchemas, ApiErrorResponseSchema } from '../api/apiSchemas';
import { z } from 'zod';
import { AUTH_TOKEN_KEY } from '../constants';
import { logWarning, logError, logApiRequest, logApiResponse } from '../utils/browser-logger';
import type {
  CreateGroupRequest,
  Group,
  ListGroupsResponse,
  GroupMembersResponse,
  GroupBalances,
  ExpenseData,
  AppConfiguration,
  CreateExpenseRequest,
  CreateSettlementRequest,
  Settlement,
  SettlementListItem
} from '@shared/types/webapp-shared-types';

// Define HealthCheckResponse locally since it's not in shared types
interface HealthCheckResponse {
  checks: {
    firestore: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    };
    auth: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    };
  };
}

// API configuration - use window.API_BASE_URL injected during build
const getApiBaseUrl = () => {
  // During SSG, return empty string (no API calls happen during SSG)
  if (typeof window === 'undefined') {
    return '/api';
  }
  
  const apiBaseUrl = (window as any).API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error('API_BASE_URL is not set - check build configuration');
  }
  return apiBaseUrl + '/api';
};

const API_BASE_URL = getApiBaseUrl();

export class ApiValidationError extends Error {
  constructor(
    message: string,
    public errors: z.ZodError['issues']
  ) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
    public requestContext?: {
      url: string;
      method: string;
      status?: number;
      statusText?: string;
    }
  ) {
    super(message);
    this.name = 'ApiError';
  }
  
  // Override toString to include request context in error message
  toString(): string {
    let msg = `ApiError: ${this.message} (code: ${this.code})`;
    if (this.requestContext) {
      msg += `\n  Request: ${this.requestContext.method} ${this.requestContext.url}`;
      if (this.requestContext.status) {
        msg += `\n  Status: ${this.requestContext.status}${this.requestContext.statusText ? ` ${this.requestContext.statusText}` : ''}`;
      }
    }
    return msg;
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

// Simple request options
interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
}

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  retryableHttpMethods: ['GET', 'PUT'] as const,
  baseDelayMs: 100,
  backoffMultiplier: 2
};

// Helper functions for retry logic
function isRetryableMethod(method: string): boolean {
  return RETRY_CONFIG.retryableHttpMethods.includes(method as any);
}

function shouldRetryError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === 'NETWORK_ERROR';
}

function calculateRetryDelay(attemptNumber: number): number {
  return RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attemptNumber - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main API client class
export class ApiClient {
  private authToken: string | null = null;

  constructor() {
    // Try to get auth token from localStorage (skip during SSG)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        this.authToken = token;
      }
    }
  }

  // Set auth token
  setAuthToken(token: string | null) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    }
  }

  // Main request method with runtime validation and retry logic
  async request<T = any>(
    endpoint: string,
    options: RequestOptions
  ): Promise<T> {
    return this.requestWithRetry(endpoint, options, 1);
  }

  // Internal method that handles the actual request with retry logic
  private async requestWithRetry<T = any>(
    endpoint: string,
    options: RequestOptions,
    attemptNumber: number
  ): Promise<T> {
    const url = buildUrl(
      `${API_BASE_URL}${endpoint}`,
      options.params,
      options.query
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

    // Log the API request
    logApiRequest(options.method, endpoint, {
      params: options.params,
      query: options.query,
      body: options.body,
      headers: headers,
      attempt: attemptNumber,
      url: url,
    });

    const startTime = performance.now();

    try {
      const response = await fetch(url, fetchOptions);
      const duration = performance.now() - startTime;
      
      // Handle non-2xx responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Log error response
        logApiResponse(options.method, endpoint, response.status, {
          duration,
          error: errorData,
          retryAttempt: attemptNumber > 1 ? attemptNumber : undefined,
        });
        
        // Try to parse as API error
        const errorResult = ApiErrorResponseSchema.safeParse(errorData);
        if (errorResult.success) {
          throw new ApiError(
            errorResult.data.error.message,
            errorResult.data.error.code,
            errorResult.data.error.details,
            {
              url,
              method: options.method,
              status: response.status,
              statusText: response.statusText
            }
          );
        }
        
        // Fallback error
        throw new ApiError(
          `Request failed with status ${response.status}`,
          'UNKNOWN_ERROR',
          errorData,
          {
            url,
            method: options.method,
            status: response.status,
            statusText: response.statusText
          }
        );
      }

      // Parse response
      const data = await response.json();
      
      // Log successful response
      logApiResponse(options.method, endpoint, response.status, {
        duration,
        dataSize: JSON.stringify(data).length,
        retryAttempt: attemptNumber > 1 ? attemptNumber : undefined,
      });

      // Get validator for this endpoint, trying method-specific first
      const methodEndpoint = `${options.method} ${endpoint}` as keyof typeof responseSchemas;
      let validator = responseSchemas[methodEndpoint];
      
      // Fallback to endpoint without method
      if (!validator) {
        validator = responseSchemas[endpoint as keyof typeof responseSchemas];
      }
      
      if (!validator) {
        logWarning('No validator found for endpoint', { endpoint });
        return data as T;
      }

      // Validate response
      const result = validator.safeParse(data);
      if (!result.success) {
        // Create a more detailed error message
        const errorDetails = result.error.issues.map(issue => {
          const path = issue.path.join('.');
          const expected = 'expected' in issue ? issue.expected : issue.code;
          const received = 'received' in issue ? JSON.stringify(issue.received) : 'unknown';
          return `  - ${path}: ${issue.message} (expected ${expected}, got ${received})`;
        }).join('\n');
        
        logError('API response validation failed', undefined, {
          endpoint,
          issues: result.error.issues,
          receivedData: data
        });
        
        throw new ApiValidationError(
          `API response validation failed for ${endpoint}:\n${errorDetails}`,
          result.error.issues
        );
      }

      return result.data as T;
    } catch (error) {
      // Re-throw our custom errors that aren't retryable
      if (error instanceof ApiValidationError) {
        throw error;
      }
      
      // Handle API errors - check if we should retry
      if (error instanceof ApiError) {
        if (shouldRetryError(error) && 
            isRetryableMethod(options.method) && 
            attemptNumber < RETRY_CONFIG.maxAttempts) {
          
          const delayMs = calculateRetryDelay(attemptNumber);
          logWarning('API request failed, retrying', {
            endpoint,
            method: options.method,
            attempt: attemptNumber,
            maxAttempts: RETRY_CONFIG.maxAttempts,
            retryDelayMs: delayMs,
            error: error.message
          });
          
          await sleep(delayMs);
          return this.requestWithRetry(endpoint, options, attemptNumber + 1);
        }
        throw error;
      }
      
      // Wrap other errors as network errors
      let networkError: ApiError;
      if (error instanceof Error) {
        networkError = new ApiError(
          error.message,
          'NETWORK_ERROR',
          error,
          {
            url,
            method: options.method
          }
        );
      } else {
        networkError = new ApiError(
          'Unknown error occurred',
          'UNKNOWN_ERROR',
          error,
          {
            url,
            method: options.method
          }
        );
      }
      
      // Check if we should retry this network error
      if (shouldRetryError(networkError) && 
          isRetryableMethod(options.method) && 
          attemptNumber < RETRY_CONFIG.maxAttempts) {
        
        const delayMs = calculateRetryDelay(attemptNumber);
        logWarning('API request failed, retrying', {
          endpoint,
          method: options.method,
          attempt: attemptNumber,
          maxAttempts: RETRY_CONFIG.maxAttempts,
          retryDelayMs: delayMs,
          error: networkError.message
        });
        
        await sleep(delayMs);
        return this.requestWithRetry(endpoint, options, attemptNumber + 1);
      }
      
      throw networkError;
    }
  }

  // Convenience methods for common endpoints
  async getConfig(): Promise<AppConfiguration> {
    return this.request('/config', { method: 'GET' });
  }

  async getGroups(): Promise<ListGroupsResponse> {
    return this.request('/groups', { method: 'GET' });
  }

  async getGroup(id: string): Promise<Group> {
    return this.request('/groups/:id', {
      method: 'GET',
      params: { id }
    });
  }

  async getGroupMembers(id: string): Promise<GroupMembersResponse> {
    return this.request('/groups/:id/members', {
      method: 'GET',
      params: { id }
    });
  }

  async createGroup(data: CreateGroupRequest): Promise<Group> {
    return this.request('/groups', {
      method: 'POST',
      body: data
    });
  }

  async getGroupBalances(groupId: string): Promise<GroupBalances> {
    return this.request('/groups/balances', {
      method: 'GET',
      query: { groupId }
    });
  }

  async getExpenses(groupId: string, limit?: number, cursor?: string, includeDeleted?: boolean): Promise<{ expenses: ExpenseData[]; hasMore: boolean; nextCursor?: string }> {
    const query: Record<string, string> = { groupId };
    if (limit !== undefined) {
      query.limit = limit.toString();
    }
    if (cursor !== undefined) {
      query.cursor = cursor;
    }
    if (includeDeleted !== undefined) {
      query.includeDeleted = includeDeleted.toString();
    }
    return this.request('/expenses/group', {
      method: 'GET',
      query
    });
  }

  async createExpense(data: CreateExpenseRequest): Promise<ExpenseData> {
    return this.request('/expenses', {
      method: 'POST',
      body: data
    });
  }

  async updateExpense(expenseId: string, data: CreateExpenseRequest): Promise<ExpenseData> {
    return this.request('/expenses', {
      method: 'PUT',
      query: { id: expenseId },
      body: data
    });
  }

  async deleteExpense(expenseId: string): Promise<{ message: string }> {
    return this.request('/expenses', {
      method: 'DELETE',
      query: { id: expenseId }
    });
  }

  async createSettlement(data: CreateSettlementRequest): Promise<Settlement> {
    const response = await this.request<{ success: boolean; data: Settlement }>('/settlements', {
      method: 'POST',
      body: data
    });
    return response.data;
  }

  async getSettlement(settlementId: string): Promise<SettlementListItem> {
    return this.request('/settlements/:settlementId', {
      method: 'GET',
      params: { settlementId }
    });
  }

  async listSettlements(
    groupId: string, 
    limit?: number, 
    cursor?: string,
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ 
    settlements: SettlementListItem[]; 
    count: number;
    hasMore: boolean; 
    nextCursor?: string 
  }> {
    const query: Record<string, string> = { groupId };
    if (limit !== undefined) query.limit = limit.toString();
    if (cursor !== undefined) query.cursor = cursor;
    if (userId !== undefined) query.userId = userId;
    if (startDate !== undefined) query.startDate = startDate;
    if (endDate !== undefined) query.endDate = endDate;
    
    const response = await this.request<{ success: boolean; data: { settlements: SettlementListItem[]; count: number; hasMore: boolean; nextCursor?: string } }>('/settlements', {
      method: 'GET',
      query
    });
    return response.data;
  }

  async updateSettlement(settlementId: string, data: Partial<CreateSettlementRequest>): Promise<Settlement> {
    return this.request('/settlements/:settlementId', {
      method: 'PUT',
      params: { settlementId },
      body: data
    });
  }

  async deleteSettlement(settlementId: string): Promise<{ message: string }> {
    return this.request('/settlements/:settlementId', {
      method: 'DELETE',
      params: { settlementId }
    });
  }


  async generateShareLink(groupId: string): Promise<{ linkId: string; shareablePath: string }> {
    return this.request('/groups/share', {
      method: 'POST',
      body: { groupId }
    });
  }

  async previewGroupByLink(linkId: string): Promise<{
    groupId: string;
    groupName: string;
    groupDescription: string;
    memberCount: number;  // Still returned by preview endpoint for display
    isAlreadyMember: boolean;
  }> {
    return this.request('/groups/preview', {
      method: 'POST',
      body: { linkId }
    });
  }

  async joinGroupByLink(linkId: string): Promise<Group> {
    const response = await this.request('/groups/join', {
      method: 'POST',
      body: { linkId }
    });
    
    // Transform the response to match Group interface
    return {
      id: response.groupId,
      name: response.groupName,
      description: '',
      memberIds: [],  // Will be populated after join
      createdBy: '',  // Will be populated from server
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      balance: {
        userBalance: null,
        totalOwed: 0,
        totalOwing: 0
      },
      lastActivity: 'just now',
      lastActivityRaw: new Date().toISOString()
    } as Group;
  }

  async register(email: string, password: string, displayName: string, termsAccepted: boolean, cookiePolicyAccepted: boolean): Promise<{ success: boolean; message: string; user: { uid: string; email: string; displayName: string } }> {
    return this.request('/register', {
      method: 'POST',
      body: { email, password, displayName, termsAccepted, cookiePolicyAccepted }
    });
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request('/health', {
      method: 'GET'
    });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();