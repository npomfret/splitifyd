/**
 * API Contract Definitions
 * 
 * This file defines the complete contract between the client and server.
 * Every endpoint must have its request and response types defined here.
 * 
 * MANDATORY: All types must be strict - no 'any' types allowed
 * MANDATORY: Client must validate all responses against these types at runtime
 */

import type {
  Group,
  GroupBalances,
  ExpenseData,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  CreateGroupRequest,
  ShareableLinkResponse,
  JoinGroupResponse,
  AppConfiguration
} from '../types/webapp-shared-types';

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
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

/**
 * Status response
 */
export interface StatusResponse {
  version: string;
  environment: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  timestamp: string;
}

/**
 * Environment info response (dev only)
 */
export interface EnvResponse {
  env: Record<string, string | undefined>;
  build: {
    timestamp: string;
    version: string;
    commit?: string;
    branch?: string;
  };
  files: string[];
}

/**
 * User registration request
 */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

/**
 * User registration response
 */
export interface RegisterResponse {
  success: boolean;
  userId: string;
  message: string;
}

/**
 * Create user document request
 */
export interface CreateUserDocumentRequest {
  // Uses auth token, no body required
}

/**
 * Create user document response
 */
export interface CreateUserDocumentResponse {
  success: boolean;
  userId: string;
}

/**
 * List groups response
 */
export interface ListGroupsResponse {
  groups: Group[];
  count: number;
  hasMore: boolean;
  nextCursor?: string;
  pagination: {
    limit: number;
    order: string;
  };
}

/**
 * Expense list response
 */
export interface ExpenseListResponse {
  expenses: ExpenseData[];
  count: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Expense history response
 */
export interface ExpenseHistoryResponse {
  history: Array<{
    timestamp: string;
    action: string;
    changes: Record<string, any>;
    userId: string;
  }>;
}

/**
 * Complete API contract mapping endpoints to their types
 */
export interface ApiContract {
  // Public endpoints
  '/config': {
    method: 'GET';
    request: never;
    response: AppConfiguration;
  };
  '/health': {
    method: 'GET';
    request: never;
    response: HealthCheckResponse;
  };
  '/status': {
    method: 'GET';
    request: never;
    response: StatusResponse;
  };
  '/env': {
    method: 'GET';
    request: never;
    response: EnvResponse;
  };
  '/csp-violation-report': {
    method: 'POST';
    request: unknown; // Browser-generated CSP report
    response: never; // 204 No Content
  };

  // Authentication
  '/register': {
    method: 'POST';
    request: RegisterRequest;
    response: RegisterResponse;
  };
  '/createUserDocument': {
    method: 'POST';
    request: CreateUserDocumentRequest;
    response: CreateUserDocumentResponse;
  };

  // Groups
  '/groups': {
    method: 'GET';
    request: never;
    response: ListGroupsResponse;
  } | {
    method: 'POST';
    request: CreateGroupRequest;
    response: Group;
  };
  '/groups/:id': {
    method: 'GET';
    params: { id: string };
    request: never;
    response: Group;
  } | {
    method: 'PUT';
    params: { id: string };
    request: Partial<Group>;
    response: Group;
  } | {
    method: 'DELETE';
    params: { id: string };
    request: never;
    response: { success: boolean };
  };
  '/groups/share': {
    method: 'POST';
    request: { groupId: string };
    response: ShareableLinkResponse;
  };
  '/groups/join': {
    method: 'POST';
    request: { linkId: string };
    response: JoinGroupResponse;
  };
  '/groups/balances': {
    method: 'GET';
    query: { groupId: string };
    request: never;
    response: GroupBalances;
  };

  // Expenses
  '/expenses': {
    method: 'POST';
    request: CreateExpenseRequest;
    response: ExpenseData;
  } | {
    method: 'GET';
    query: { id: string };
    request: never;
    response: ExpenseData;
  } | {
    method: 'PUT';
    query: { id: string };
    request: UpdateExpenseRequest;
    response: ExpenseData;
  } | {
    method: 'DELETE';
    query: { id: string };
    request: never;
    response: { success: boolean };
  };
  '/expenses/group': {
    method: 'GET';
    query: { 
      groupId: string;
      limit?: string;
      cursor?: string;
    };
    request: never;
    response: ExpenseListResponse;
  };
  '/expenses/user': {
    method: 'GET';
    query: {
      limit?: string;
      cursor?: string;
    };
    request: never;
    response: ExpenseListResponse;
  };
  '/expenses/history': {
    method: 'GET';
    query: { id: string };
    request: never;
    response: ExpenseHistoryResponse;
  };
}

/**
 * Helper type to extract endpoint configuration
 */
export type EndpointConfig<T extends keyof ApiContract> = ApiContract[T];

/**
 * Helper type to extract request type for an endpoint
 */
export type EndpointRequest<T extends keyof ApiContract> = 
  ApiContract[T] extends { request: infer R } ? R : never;

/**
 * Helper type to extract response type for an endpoint
 */
export type EndpointResponse<T extends keyof ApiContract> = 
  ApiContract[T] extends { response: infer R } ? R : never;

/**
 * Helper type to extract params for an endpoint
 */
export type EndpointParams<T extends keyof ApiContract> = 
  ApiContract[T] extends { params: infer P } ? P : never;

/**
 * Helper type to extract query params for an endpoint
 */
export type EndpointQuery<T extends keyof ApiContract> = 
  ApiContract[T] extends { query: infer Q } ? Q : never;