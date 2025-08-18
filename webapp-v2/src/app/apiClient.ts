/**
 * API client with runtime validation
 *
 * All API responses are validated at runtime using zod schemas
 * This ensures the server response matches our expected types
 */

import { responseSchemas, ApiErrorResponseSchema } from '../api/apiSchemas';
import { z } from 'zod';
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
    SettlementListItem,
    User,
} from '@shared/shared-types';

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

// Policy acceptance types for user endpoints
interface AcceptPolicyRequest {
    policyId: string;
    versionHash: string;
}

interface PolicyAcceptanceStatus {
    policyId: string;
    currentVersionHash: string;
    userAcceptedHash?: string;
    needsAcceptance: boolean;
    policyName: string;
}

interface UserPolicyStatusResponse {
    needsAcceptance: boolean;
    policies: PolicyAcceptanceStatus[];
    totalPending: number;
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
        public errors: z.ZodError['issues'],
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
        },
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
            // Ensure value is a string and not undefined/null
            if (value !== undefined && value !== null) {
                url = url.replace(`:${key}`, String(value));
            }
        });
    }

    // Add query parameters
    if (query) {
        const searchParams = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                searchParams.append(key, String(value));
            }
        });
        const queryString = searchParams.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
    }

    return url;
}

// Enhanced request configuration interface
interface RequestConfig<T = any> {
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
    headers?: Record<string, string>;
    schema?: z.ZodSchema<T>; // Optional runtime validation override
    skipAuth?: boolean; // Skip auth token for public endpoints
    skipRetry?: boolean; // Skip retry for specific requests
    __retried?: boolean; // Internal flag to prevent infinite retry loops
}

// Legacy interface for backward compatibility
interface RequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
    headers?: Record<string, string>;
}

// Interceptor types for middleware pipeline
type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ResponseInterceptor = <T>(response: T, config: RequestConfig) => T | Promise<T>;

// Retry configuration
const RETRY_CONFIG = {
    maxAttempts: 3,
    retryableHttpMethods: ['GET', 'PUT'] as const,
    baseDelayMs: 100,
    backoffMultiplier: 2,
};

// Helper functions for retry logic
function isRetryableMethod(method: string, config: RequestConfig): boolean {
    // If skipRetry is explicitly set to false, this specific request opts into retries
    if (config.skipRetry === false) {
        return true;
    }
    return RETRY_CONFIG.retryableHttpMethods.includes(method as any);
}

function shouldRetryError(error: unknown): error is ApiError {
    return error instanceof ApiError && error.code === 'NETWORK_ERROR';
}

function calculateRetryDelay(attemptNumber: number): number {
    return RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attemptNumber - 1);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main API client class
export class ApiClient {
    private authToken: string | null = null;
    private requestInterceptors: RequestInterceptor[] = [];
    private responseInterceptors: ResponseInterceptor[] = [];
    private refreshingToken = false;
    private failedQueue: Array<{
        resolve: (value: any) => void;
        reject: (error: any) => void;
        config: RequestConfig;
    }> = [];
    private authRefreshCallback: (() => Promise<void>) | null = null;
    private authLogoutCallback: (() => Promise<void>) | null = null;

    constructor() {
        // Auth token will be set by auth store after user authentication
        // We no longer read from localStorage here to avoid the chicken-and-egg problem

        // Set up 401 response interceptor
        this.setup401Interceptor();
    }

    // Add request interceptor
    addRequestInterceptor(interceptor: RequestInterceptor): () => void {
        this.requestInterceptors.push(interceptor);
        // Return function to remove the interceptor
        return () => {
            const index = this.requestInterceptors.indexOf(interceptor);
            if (index > -1) {
                this.requestInterceptors.splice(index, 1);
            }
        };
    }

    // Add response interceptor
    addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
        this.responseInterceptors.push(interceptor);
        // Return function to remove the interceptor
        return () => {
            const index = this.responseInterceptors.indexOf(interceptor);
            if (index > -1) {
                this.responseInterceptors.splice(index, 1);
            }
        };
    }

    // Set auth token
    setAuthToken(token: string | null) {
        this.authToken = token;
        // Auth token persistence is now handled by auth store using user-scoped storage
        // This avoids the chicken-and-egg problem and ensures proper user isolation
    }

    // Set auth callbacks to avoid circular dependencies
    setAuthCallbacks(refreshCallback: () => Promise<void>, logoutCallback: () => Promise<void>) {
        this.authRefreshCallback = refreshCallback;
        this.authLogoutCallback = logoutCallback;
    }

    // Set up 401 response interceptor
    private setup401Interceptor(): void {
        this.addResponseInterceptor(async (response, config) => {
            // Check if this is a 401/UNAUTHORIZED error
            if (response instanceof ApiError && (response.code === 'UNAUTHORIZED' || response.code === 'INVALID_TOKEN' || response.requestContext?.status === 401)) {
                // Skip retry if already attempted or auth is disabled for this request
                if (config.skipAuth || config.__retried) {
                    throw response;
                }

                // If already refreshing, queue this request
                if (this.refreshingToken) {
                    return new Promise((resolve, reject) => {
                        this.failedQueue.push({ resolve, reject, config });
                    });
                }

                this.refreshingToken = true;

                try {
                    // Use callback pattern to avoid circular dependency
                    if (this.authRefreshCallback) {
                        await this.authRefreshCallback();
                    } else {
                        throw new Error('Auth refresh callback not set');
                    }

                    // Process queued requests
                    this.processQueue(null);

                    // Retry original request
                    return this.request({
                        ...config,
                        __retried: true,
                    });
                } catch (refreshError) {
                    // Process queue with error
                    this.processQueue(refreshError);

                    // If refresh failed, logout the user
                    try {
                        if (this.authLogoutCallback) {
                            await this.authLogoutCallback();
                        }
                    } catch (logoutError) {
                        logError('Failed to logout after token refresh failure', logoutError);
                    }

                    throw response;
                } finally {
                    this.refreshingToken = false;
                }
            }

            return response;
        });
    }

    // Process queued requests after token refresh
    private processQueue(error: any): void {
        this.failedQueue.forEach(({ resolve, reject, config }) => {
            if (error) {
                reject(error);
            } else {
                // Retry the request
                this.request(config).then(resolve).catch(reject);
            }
        });

        this.failedQueue = [];
    }

    // Enhanced request method with RequestConfig support
    async request<T = any>(config: RequestConfig<T>): Promise<T>;
    // Legacy overload for backward compatibility
    async request<T = any>(endpoint: string, options: RequestOptions): Promise<T>;
    async request<T = any>(configOrEndpoint: RequestConfig<T> | string, options?: RequestOptions): Promise<T> {
        // Normalize input to RequestConfig
        let config: RequestConfig<T>;
        if (typeof configOrEndpoint === 'string') {
            // Legacy format - convert to new format
            config = {
                endpoint: configOrEndpoint,
                ...options!,
            };
        } else {
            // New RequestConfig format
            config = configOrEndpoint;
        }

        // Apply request interceptors
        let processedConfig = config;
        for (const interceptor of this.requestInterceptors) {
            processedConfig = await interceptor(processedConfig);
        }

        return this.requestWithRetry(processedConfig, 1);
    }

    // Internal method that handles the actual request with retry logic
    private async requestWithRetry<T = any>(config: RequestConfig<T>, attemptNumber: number): Promise<T> {
        const { endpoint, ...options } = config;
        const url = buildUrl(`${API_BASE_URL}${endpoint}`, options.params, options.query);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        // Add auth token if available and not skipped
        if (this.authToken && !config.skipAuth) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const fetchOptions: RequestInit = {
            method: options.method,
            headers,
            // Don't send cookies/credentials to avoid CORS complications
            credentials: 'omit',
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
                    throw new ApiError(errorResult.data.error.message, errorResult.data.error.code, errorResult.data.error.details, {
                        url,
                        method: options.method,
                        status: response.status,
                        statusText: response.statusText,
                    });
                }

                // Fallback error
                throw new ApiError(`Request failed with status ${response.status}`, 'UNKNOWN_ERROR', errorData, {
                    url,
                    method: options.method,
                    status: response.status,
                    statusText: response.statusText,
                });
            }

            // Parse response
            const data = await response.json();

            // Log successful response
            logApiResponse(options.method, endpoint, response.status, {
                duration,
                dataSize: JSON.stringify(data).length,
                retryAttempt: attemptNumber > 1 ? attemptNumber : undefined,
            });

            // Use custom schema if provided, otherwise use global schemas
            let validator: z.ZodSchema<any> | undefined = config.schema;
            if (!validator) {
                // Get validator for this endpoint, trying method-specific first
                const methodEndpoint = `${options.method} ${endpoint}` as keyof typeof responseSchemas;
                validator = responseSchemas[methodEndpoint];

                // Fallback to endpoint without method
                if (!validator) {
                    validator = responseSchemas[endpoint as keyof typeof responseSchemas];
                }
            }

            let validatedData: T;
            if (!validator) {
                logWarning('No validator found for endpoint', { endpoint });
                validatedData = data as T;
            } else {
                // Validate response
                const result = validator.safeParse(data);
                if (!result.success) {
                    // Create a more detailed error message
                    const errorDetails = result.error.issues
                        .map((issue) => {
                            const path = issue.path.join('.');
                            const expected = 'expected' in issue ? issue.expected : issue.code;
                            const received = 'received' in issue ? JSON.stringify(issue.received) : 'unknown';
                            return `  - ${path}: ${issue.message} (expected ${expected}, got ${received})`;
                        })
                        .join('\n');

                    logError('API response validation failed', undefined, {
                        endpoint,
                        issues: result.error.issues,
                        receivedData: data,
                    });

                    throw new ApiValidationError(`API response validation failed for ${endpoint}:\n${errorDetails}`, result.error.issues);
                }
                validatedData = result.data as T;
            }

            // Apply response interceptors
            let processedResponse = validatedData;
            for (const interceptor of this.responseInterceptors) {
                processedResponse = await interceptor(processedResponse, config);
            }

            return processedResponse;
        } catch (error) {
            // Re-throw our custom errors that aren't retryable
            if (error instanceof ApiValidationError) {
                throw error;
            }

            // Handle API errors - check if we should retry
            if (error instanceof ApiError) {
                if (!config.skipRetry && shouldRetryError(error) && isRetryableMethod(options.method, config) && attemptNumber < RETRY_CONFIG.maxAttempts) {
                    const delayMs = calculateRetryDelay(attemptNumber);
                    logWarning('API request failed, retrying', {
                        endpoint,
                        method: options.method,
                        attempt: attemptNumber,
                        maxAttempts: RETRY_CONFIG.maxAttempts,
                        retryDelayMs: delayMs,
                        error: error.message,
                    });

                    await sleep(delayMs);
                    return this.requestWithRetry(config, attemptNumber + 1);
                }
                throw error;
            }

            // Wrap other errors as network errors
            let networkError: ApiError;
            if (error instanceof Error) {
                networkError = new ApiError(error.message, 'NETWORK_ERROR', error, {
                    url,
                    method: options.method,
                });
            } else {
                networkError = new ApiError('Unknown error occurred', 'UNKNOWN_ERROR', error, {
                    url,
                    method: options.method,
                });
            }

            // Check if we should retry this network error
            if (!config.skipRetry && shouldRetryError(networkError) && isRetryableMethod(options.method, config) && attemptNumber < RETRY_CONFIG.maxAttempts) {
                const delayMs = calculateRetryDelay(attemptNumber);
                logWarning('API request failed, retrying', {
                    endpoint,
                    method: options.method,
                    attempt: attemptNumber,
                    maxAttempts: RETRY_CONFIG.maxAttempts,
                    retryDelayMs: delayMs,
                    error: networkError.message,
                });

                await sleep(delayMs);
                return this.requestWithRetry(config, attemptNumber + 1);
            }

            throw networkError;
        }
    }

    // Convenience methods for common endpoints (using enhanced RequestConfig internally)
    async getConfig(): Promise<AppConfiguration> {
        return this.request({
            endpoint: '/config',
            method: 'GET',
        });
    }

    async getGroups(options?: { 
        includeMetadata?: boolean;
        page?: number;
        limit?: number;
        order?: 'asc' | 'desc';
        cursor?: string;
    }): Promise<ListGroupsResponse> {
        const query: Record<string, string> = {};
        if (options?.includeMetadata) query.includeMetadata = 'true';
        if (options?.page) query.page = options.page.toString();
        if (options?.limit) query.limit = options.limit.toString();
        if (options?.order) query.order = options.order;
        if (options?.cursor) query.cursor = options.cursor;
        
        return this.request({
            endpoint: '/groups',
            method: 'GET',
            query: Object.keys(query).length > 0 ? query : undefined,
        });
    }

    async getGroup(id: string): Promise<Group> {
        return this.request({
            endpoint: '/groups/:id',
            method: 'GET',
            params: { id },
        });
    }

    async getGroupFullDetails(id: string): Promise<{
        group: Group;
        members: { members: User[] };
        expenses: { expenses: ExpenseData[]; hasMore: boolean; nextCursor?: string };
        balances: GroupBalances;
        settlements: { settlements: SettlementListItem[]; hasMore: boolean; nextCursor?: string };
    }> {
        return this.request({
            endpoint: '/groups/:id/full-details',
            method: 'GET',
            params: { id },
        });
    }


    async getGroupMembers(id: string): Promise<GroupMembersResponse> {
        return this.request({
            endpoint: '/groups/:id/members',
            method: 'GET',
            params: { id },
        });
    }

    async leaveGroup(groupId: string): Promise<{ success: boolean; message: string }> {
        return this.request({
            endpoint: `/groups/${groupId}/leave`,
            method: 'POST',
        });
    }

    async removeGroupMember(groupId: string, memberId: string): Promise<{ success: boolean; message: string }> {
        return this.request({
            endpoint: `/groups/${groupId}/members/${memberId}`,
            method: 'DELETE',
        });
    }

    async createGroup(data: CreateGroupRequest): Promise<Group> {
        return this.request({
            endpoint: '/groups',
            method: 'POST',
            body: data,
        });
    }

    async updateGroup(id: string, data: { name?: string; description?: string }): Promise<{ message: string }> {
        return this.request({
            endpoint: `/groups/${id}`,
            method: 'PUT',
            body: data,
        });
    }

    async deleteGroup(id: string): Promise<{ message: string }> {
        return this.request({
            endpoint: `/groups/${id}`,
            method: 'DELETE',
        });
    }

    async getGroupBalances(groupId: string): Promise<GroupBalances> {
        return this.request({
            endpoint: '/groups/balances',
            method: 'GET',
            query: { groupId },
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
        return this.request({
            endpoint: '/expenses/group',
            method: 'GET',
            query,
        });
    }

    async createExpense(data: CreateExpenseRequest): Promise<ExpenseData> {
        return this.request({
            endpoint: '/expenses',
            method: 'POST',
            body: data,
        });
    }

    async updateExpense(expenseId: string, data: CreateExpenseRequest): Promise<ExpenseData> {
        return this.request({
            endpoint: '/expenses',
            method: 'PUT',
            query: { id: expenseId },
            body: data,
        });
    }

    async deleteExpense(expenseId: string): Promise<{ message: string }> {
        return this.request({
            endpoint: '/expenses',
            method: 'DELETE',
            query: { id: expenseId },
        });
    }

    async getExpenseFullDetails(expenseId: string): Promise<{
        expense: ExpenseData;
        group: Group;
        members: { members: User[] };
    }> {
        return this.request({
            endpoint: `/expenses/${expenseId}/full-details`,
            method: 'GET',
        });
    }

    async createSettlement(data: CreateSettlementRequest): Promise<Settlement> {
        const response = await this.request<{ success: boolean; data: Settlement }>({
            endpoint: '/settlements',
            method: 'POST',
            body: data,
        });
        return response.data;
    }

    async getSettlement(settlementId: string): Promise<SettlementListItem> {
        return this.request({
            endpoint: '/settlements/:settlementId',
            method: 'GET',
            params: { settlementId },
        });
    }

    async listSettlements(
        groupId: string,
        limit?: number,
        cursor?: string,
        userId?: string,
        startDate?: string,
        endDate?: string,
    ): Promise<{
        settlements: SettlementListItem[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        const query: Record<string, string> = { groupId };
        if (limit !== undefined) query.limit = limit.toString();
        if (cursor !== undefined) query.cursor = cursor;
        if (userId !== undefined) query.userId = userId;
        if (startDate !== undefined) query.startDate = startDate;
        if (endDate !== undefined) query.endDate = endDate;

        const response = await this.request<{ success: boolean; data: { settlements: SettlementListItem[]; count: number; hasMore: boolean; nextCursor?: string } }>({
            endpoint: '/settlements',
            method: 'GET',
            query,
        });
        return response.data;
    }

    async updateSettlement(settlementId: string, data: Partial<CreateSettlementRequest>): Promise<Settlement> {
        return this.request({
            endpoint: '/settlements/:settlementId',
            method: 'PUT',
            params: { settlementId },
            body: data,
        });
    }

    async deleteSettlement(settlementId: string): Promise<{ message: string }> {
        return this.request({
            endpoint: '/settlements/:settlementId',
            method: 'DELETE',
            params: { settlementId },
        });
    }

    async generateShareLink(groupId: string): Promise<{ linkId: string; shareablePath: string }> {
        return this.request({
            endpoint: '/groups/share',
            method: 'POST',
            body: { groupId },
        });
    }

    async previewGroupByLink(linkId: string): Promise<{
        groupId: string;
        groupName: string;
        groupDescription: string;
        memberCount: number; // Still returned by preview endpoint for display
        isAlreadyMember: boolean;
    }> {
        return this.request({
            endpoint: '/groups/preview',
            method: 'POST',
            body: { linkId },
        });
    }

    async joinGroupByLink(linkId: string): Promise<Group> {
        const response = await this.request({
            endpoint: '/groups/join',
            method: 'POST',
            body: { linkId },
            // Override: This POST is safe to retry because joining a group is idempotent
            skipRetry: false,
        });

        // Transform the response to match Group interface
        return {
            id: response.groupId,
            name: response.groupName,
            description: '',
            memberIds: [], // Will be populated after join
            createdBy: '', // Will be populated from server
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            balance: {
                balancesByCurrency: {},
            },
            lastActivity: 'just now',
            lastActivityRaw: new Date().toISOString(),
        } as Group;
    }

    async register(
        email: string,
        password: string,
        displayName: string,
        termsAccepted: boolean,
        cookiePolicyAccepted: boolean,
    ): Promise<{ success: boolean; message: string; user: { uid: string; email: string; displayName: string } }> {
        return this.request({
            endpoint: '/register',
            method: 'POST',
            body: { email, password, displayName, termsAccepted, cookiePolicyAccepted },
        });
    }

    async healthCheck(): Promise<HealthCheckResponse> {
        return this.request({
            endpoint: '/health',
            method: 'GET',
        });
    }

    // User policy acceptance methods
    async acceptPolicy(policyId: string, versionHash: string): Promise<{ success: boolean; message: string; acceptedPolicy: { policyId: string; versionHash: string; acceptedAt: string } }> {
        return this.request({
            endpoint: '/user/policies/accept',
            method: 'POST',
            body: { policyId, versionHash },
        });
    }

    async acceptMultiplePolicies(
        acceptances: AcceptPolicyRequest[],
    ): Promise<{ success: boolean; message: string; acceptedPolicies: Array<{ policyId: string; versionHash: string; acceptedAt: string }> }> {
        return this.request({
            endpoint: '/user/policies/accept-multiple',
            method: 'POST',
            body: { acceptances },
        });
    }

    async getUserPolicyStatus(): Promise<UserPolicyStatusResponse> {
        return this.request({
            endpoint: '/user/policies/status',
            method: 'GET',
        });
    }

    async getCurrentPolicies(): Promise<{ policies: Record<string, { policyName: string; currentVersionHash: string }>; count: number }> {
        return this.request({
            endpoint: '/policies/current',
            method: 'GET',
            skipAuth: true, // Public endpoint
        });
    }

    async getCurrentPolicy(policyId: string): Promise<{ id: string; policyName: string; currentVersionHash: string; text: string; createdAt: string }> {
        return this.request({
            endpoint: '/policies/:id/current',
            method: 'GET',
            params: { id: policyId },
            skipAuth: true, // Public endpoint
        });
    }

    // User profile management methods
    async getUserProfile(): Promise<{ uid: string; email: string; displayName: string }> {
        return this.request({
            endpoint: '/user/profile',
            method: 'GET',
        });
    }

    async updateUserProfile(data: { displayName?: string }): Promise<{ uid: string; email: string; displayName: string }> {
        return this.request({
            endpoint: '/user/profile',
            method: 'PUT',
            body: data,
        });
    }

    async changePassword(data: { currentPassword: string; newPassword: string }): Promise<{ message: string }> {
        return this.request({
            endpoint: '/user/change-password',
            method: 'POST',
            body: data,
        });
    }

    async sendPasswordResetEmail(email: string): Promise<{ message: string }> {
        return this.request({
            endpoint: '/user/reset-password',
            method: 'POST',
            body: { email },
            skipAuth: true, // Public endpoint
        });
    }

    async deleteUserAccount(): Promise<{ message: string }> {
        return this.request({
            endpoint: '/user/account',
            method: 'DELETE',
        });
    }
}

// Export types for external use
export type { RequestConfig, RequestInterceptor, ResponseInterceptor, AcceptPolicyRequest, PolicyAcceptanceStatus, UserPolicyStatusResponse };

// Export a singleton instance
export const apiClient = new ApiClient();

// Helper function to create strongly typed requests
export function createTypedRequest<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', schema?: z.ZodSchema<T>) {
    return (additionalConfig: Omit<RequestConfig<T>, 'endpoint' | 'method' | 'schema'> = {}) => {
        return apiClient.request<T>({
            endpoint,
            method,
            schema,
            ...additionalConfig,
        });
    };
}
