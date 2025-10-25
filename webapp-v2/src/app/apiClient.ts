/**
 * API client with runtime validation
 *
 * All API responses are validated at runtime using zod schemas
 * This ensures the server response matches our expected types
 */

import { ApiSerializer } from '@splitifyd/shared';
import type {
    ActivityFeedResponse,
    AcceptMultiplePoliciesResponse,
    AcceptPolicyRequest,
    AppConfiguration,
    CommentDTO,
    CreateExpenseRequest,
    CreateGroupRequest,
    CreateSettlementRequest,
    CurrentPolicyResponse,
    ExpenseDTO,
    ExpenseFullDetailsDTO,
    GenerateShareLinkRequest,
    GroupDTO,
    GroupFullDetailsDTO,
    GroupMembershipDTO,
    GroupPermissions,
    JoinGroupResponse,
    ListCommentsResponse,
    ListGroupsResponse,
    MemberRole,
    MemberStatus,
    MessageResponse,
    PolicyAcceptanceStatusDTO,
    PreviewGroupResponse,
    RegisterResponse,
    SettlementDTO,
    ShareLinkResponse,
    UpdateDisplayNameRequest,
    UpdateGroupRequest,
    UserPolicyStatusResponse,
    UserProfileResponse,
} from '@splitifyd/shared';
import { ApiErrorResponseSchema, responseSchemas } from '@splitifyd/shared';
import type { UpdateSettlementRequest } from '@splitifyd/shared';
import { ExpenseId, GroupId } from '@splitifyd/shared';
import { SettlementId } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import type { Email } from '@splitifyd/shared';
import { PolicyId } from '@splitifyd/shared';
import { z } from 'zod';
import { logApiRequest, logApiResponse, logError, logWarning } from '../utils/browser-logger';

// All types are now imported from shared-types

class ApiValidationError extends Error {
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
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    schema?: z.ZodSchema<T>; // Optional runtime validation override
    skipAuth?: boolean; // Skip auth token for public endpoints
    skipRetry?: boolean; // Skip retry for specific requests
    __retried?: boolean; // Internal flag to prevent infinite retry loops
}

// Legacy interface for backward compatibility
interface RequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
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

function isAbortError(error: unknown, signal?: AbortSignal | null): boolean {
    if (signal?.aborted) {
        return true;
    }

    if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
        return error.name === 'AbortError';
    }

    if (error instanceof Error) {
        if (error.name === 'AbortError') {
            return true;
        }

        if (error.message && /aborted/i.test(error.message)) {
            return true;
        }
    }

    return false;
}

// Main API client class
class ApiClient {
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
    private async request<T = any>(config: RequestConfig<T>): Promise<T>;
    // Legacy overload for backward compatibility
    private async request<T = any>(configOrEndpoint: RequestConfig<T> | string, options?: RequestOptions): Promise<T> {
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
        const { endpoint, signal, ...options } = config;
        const url = buildUrl(`/api${endpoint}`, options.params, options.query);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/x-serialized-json',
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

        if (signal) {
            fetchOptions.signal = signal;
        }

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
            const rawBody = await response.text();

            // Handle non-2xx responses
            if (!response.ok) {
                let errorData: unknown = {};
                if (rawBody) {
                    try {
                        errorData = ApiSerializer.deserialize(rawBody);
                    } catch (error) {
                        logWarning('Failed to deserialize error payload', {
                            url,
                            method: options.method,
                            status: response.status,
                            rawBody,
                            error,
                        });
                    }
                }

                // Log error response
                logApiResponse(options.method, endpoint, response.status, {
                    duration,
                    error: errorData,
                    retryAttempt: attemptNumber > 1 ? attemptNumber : undefined,
                });

                // Try to parse as API error
                const errorResult = ApiErrorResponseSchema.safeParse(errorData);
                if (errorResult.success) {
                    const parsedError = errorResult.data;

                    // Handle structured error format
                    if (typeof parsedError.error === 'object' && 'message' in parsedError.error) {
                        throw new ApiError(parsedError.error.message, parsedError.error.code, parsedError.error.details, {
                            url,
                            method: options.method,
                            status: response.status,
                            statusText: response.statusText,
                        });
                    } // Handle simple error format
                    else if (typeof parsedError.error === 'string') {
                        const simpleError = parsedError as { error: string; field?: string; };
                        const code = simpleError.field ? `VALIDATION_${simpleError.field.toUpperCase()}` : 'VALIDATION_ERROR';
                        throw new ApiError(
                            simpleError.error,
                            code,
                            { field: simpleError.field },
                            {
                                url,
                                method: options.method,
                                status: response.status,
                                statusText: response.statusText,
                            },
                        );
                    }
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
            let data: T | undefined;
            if (rawBody) {
                try {
                    data = ApiSerializer.deserialize<T>(rawBody);
                } catch (error) {
                    logError('Failed to deserialize API response', {
                        url,
                        method: options.method,
                        status: response.status,
                        rawBody,
                        error,
                    });
                    throw new ApiError('Unable to deserialize response payload', 'DESERIALIZATION_ERROR', { rawBody }, {
                        url,
                        method: options.method,
                        status: response.status,
                        statusText: response.statusText,
                    });
                }
            }

            // Log successful response
            logApiResponse(options.method, endpoint, response.status, {
                duration,
                dataSize: rawBody.length,
                retryAttempt: attemptNumber > 1 ? attemptNumber : undefined,
            });

            // Use custom schema if provided, otherwise use global schemas
            let validator: z.ZodSchema<any> | undefined = config.schema;
            if (!validator) {
                // Normalize endpoint by replacing IDs with placeholders to match schema keys
                // Note: Schema has inconsistent placeholder naming (:id vs :expenseId vs :groupId)
                // We need to try multiple patterns and fallback appropriately
                let normalizedEndpoint = endpoint;

                // Try specific patterns first (match schema inconsistencies)
                if (endpoint.includes('/expenses/') && endpoint.includes('/comments')) {
                    // /expenses/abc123/comments -> /expenses/:expenseId/comments
                    normalizedEndpoint = endpoint.replace(/\/expenses\/[^/]+(?=\/)/g, '/expenses/:expenseId');
                } else if (endpoint.includes('/expenses/') && endpoint.includes('/full-details')) {
                    // /expenses/abc123/full-details -> /expenses/:id/full-details
                    normalizedEndpoint = endpoint.replace(/\/expenses\/[^/]+(?=\/)/g, '/expenses/:id');
                } else if (endpoint.includes('/groups/') && endpoint.includes('/comments')) {
                    // /groups/xyz789/comments -> /groups/:groupId/comments
                    normalizedEndpoint = endpoint.replace(/\/groups\/[^/]+(?=\/)/g, '/groups/:groupId');
                } else if (endpoint.includes('/settlements/')) {
                    // /settlements/def456 -> /settlements/:settlementId or just /settlements/def456/... -> /settlements/:settlementId/...
                    normalizedEndpoint = endpoint.replace(/\/settlements\/[a-zA-Z0-9_-]{15,}/g, '/settlements/:settlementId');
                } else if (endpoint.includes('/policies/') && endpoint.includes('/current')) {
                    // /policies/policy123/current -> /policies/:id/current
                    normalizedEndpoint = endpoint.replace(/\/policies\/[^/]+(?=\/)/g, '/policies/:id');
                } else if (endpoint.match(/\/groups\/[a-zA-Z0-9_-]{15,}($|\/)/)) {
                    // /groups/abc123def456... -> /groups/:id (only if segment looks like an ID)
                    normalizedEndpoint = endpoint.replace(/\/groups\/[a-zA-Z0-9_-]{15,}/g, '/groups/:id');
                }
                // No generic fallback - only normalize when we have specific patterns

                // Get validator for this endpoint, trying method-specific first
                const methodEndpoint = `${options.method} ${normalizedEndpoint}` as keyof typeof responseSchemas;
                validator = responseSchemas[methodEndpoint];

                // Fallback to endpoint without method
                if (!validator) {
                    validator = responseSchemas[normalizedEndpoint as keyof typeof responseSchemas];
                }
            }

            let validatedData: T;
            if (!validator) {
                // Only log validator warnings for unexpected endpoints to reduce test noise
                const knownEndpoints = ['/groups/preview'];
                if (!knownEndpoints.includes(endpoint)) {
                    logWarning('No validator found for endpoint', { endpoint });
                }
                validatedData = data as T;
            } else {
                // Validate response
                const result = validator.safeParse(data);
                if (!result.success) {
                    // Create a more detailed error message
                    const errorDetails = result
                        .error
                        .issues
                        .map((issue) => {
                            const path = issue.path.join('.');
                            const expected = 'expected' in issue ? issue.expected : issue.code;
                            const received = 'received' in issue ? JSON.stringify(issue.received) : 'unknown';

                            // Provide more helpful error messages for common issues
                            if (path.includes('joinedAt')) {
                                const actualValue = path.split('.').reduce((obj, key) => obj?.[key], data as any);
                                const actualType = typeof actualValue;
                                return `  - ${path}: Expected ISO date string, got ${actualType} (value: ${JSON.stringify(actualValue)})`;
                            }

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
            if (isAbortError(error, signal)) {
                throw error;
            }

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
    async getGroups(
        options?: { includeMetadata?: boolean; page?: number; limit?: number; order?: 'asc' | 'desc'; cursor?: string; statusFilter?: MemberStatus | MemberStatus[]; },
    ): Promise<ListGroupsResponse> {
        const query: Record<string, string> = {};
        if (options?.includeMetadata) query.includeMetadata = 'true';
        if (options?.page) query.page = options.page.toString();
        if (options?.limit) query.limit = options.limit.toString();
        if (options?.order) query.order = options.order;
        if (options?.cursor) query.cursor = options.cursor;
        if (options?.statusFilter) {
            if (Array.isArray(options.statusFilter)) {
                query.statusFilter = options.statusFilter.join(',');
            } else {
                query.statusFilter = options.statusFilter;
            }
        }

        return this.request<ListGroupsResponse>({
            endpoint: '/groups',
            method: 'GET',
            query: Object.keys(query).length > 0 ? query : undefined,
        });
    }

    async getActivityFeed(options: { cursor?: string; limit?: number; } = {}): Promise<ActivityFeedResponse> {
        const query: Record<string, string> = {};

        if (options.limit !== undefined) {
            query.limit = options.limit.toString();
        }

        if (options.cursor) {
            query.cursor = options.cursor;
        }

        return this.request<ActivityFeedResponse>({
            endpoint: '/activity-feed',
            method: 'GET',
            query: Object.keys(query).length > 0 ? query : undefined,
            schema: responseSchemas['GET /activity-feed'] as z.ZodSchema<ActivityFeedResponse>,
        });
    }

    async getGroupFullDetails(
        id: string,
        options?: {
            expenseLimit?: number;
            expenseCursor?: string;
            includeDeletedExpenses?: boolean;
            settlementLimit?: number;
            settlementCursor?: string;
            includeDeletedSettlements?: boolean;
            commentLimit?: number;
            commentCursor?: string;
        },
    ): Promise<GroupFullDetailsDTO> {
        const queryParams: Record<string, string> = {};

        if (options?.expenseLimit) {
            queryParams.expenseLimit = options.expenseLimit.toString();
        }
        if (options?.expenseCursor) {
            queryParams.expenseCursor = options.expenseCursor;
        }
        if (options?.includeDeletedExpenses !== undefined) {
            queryParams.includeDeletedExpenses = options.includeDeletedExpenses.toString();
        }
        if (options?.settlementLimit) {
            queryParams.settlementLimit = options.settlementLimit.toString();
        }
        if (options?.settlementCursor) {
            queryParams.settlementCursor = options.settlementCursor;
        }
        if (options?.includeDeletedSettlements !== undefined) {
            queryParams.includeDeletedSettlements = options.includeDeletedSettlements.toString();
        }
        if (options?.commentLimit) {
            queryParams.commentLimit = options.commentLimit.toString();
        }
        if (options?.commentCursor) {
            queryParams.commentCursor = options.commentCursor;
        }

        return this.request({
            endpoint: '/groups/:id/full-details',
            method: 'GET',
            params: { id },
            query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });
    }

    async leaveGroup(groupId: GroupId): Promise<MessageResponse> {
        return this.request({
            endpoint: '/groups/:id/leave',
            method: 'POST',
            params: { id: groupId },
        });
    }

    async archiveGroup(groupId: GroupId): Promise<MessageResponse> {
        return this.request({
            endpoint: '/groups/:id/archive',
            method: 'POST',
            params: { id: groupId },
        });
    }

    async unarchiveGroup(groupId: GroupId): Promise<MessageResponse> {
        return this.request({
            endpoint: '/groups/:id/unarchive',
            method: 'POST',
            params: { id: groupId },
        });
    }

    async removeGroupMember(groupId: GroupId, memberId: string): Promise<MessageResponse> {
        return this.request({
            endpoint: '/groups/:id/members/:memberId',
            method: 'DELETE',
            params: { id: groupId, memberId },
        });
    }

    async createGroup(data: CreateGroupRequest): Promise<GroupDTO> {
        return this.request({
            endpoint: '/groups',
            method: 'POST',
            body: data,
        });
    }

    async updateGroup(id: string, data: UpdateGroupRequest): Promise<MessageResponse> {
        return this.request({
            endpoint: `/groups/${id}`,
            method: 'PUT',
            body: data,
        });
    }

    async deleteGroup(id: string): Promise<MessageResponse> {
        return this.request({
            endpoint: `/groups/${id}`,
            method: 'DELETE',
        });
    }

    async createExpense(data: CreateExpenseRequest): Promise<ExpenseDTO> {
        return this.request({
            endpoint: '/expenses',
            method: 'POST',
            body: data,
        });
    }

    async updateExpense(expenseId: ExpenseId, data: CreateExpenseRequest): Promise<ExpenseDTO> {
        return this.request({
            endpoint: '/expenses',
            method: 'PUT',
            query: { id: expenseId },
            body: data,
        });
    }

    async deleteExpense(expenseId: ExpenseId): Promise<MessageResponse> {
        return this.request({
            endpoint: '/expenses',
            method: 'DELETE',
            query: { id: expenseId },
        });
    }

    async getExpenseFullDetails(expenseId: ExpenseId): Promise<ExpenseFullDetailsDTO> {
        return this.request({
            endpoint: `/expenses/${expenseId}/full-details`,
            method: 'GET',
        });
    }

    async createSettlement(data: CreateSettlementRequest): Promise<SettlementDTO> {
        return this.request<SettlementDTO>({
            endpoint: '/settlements',
            method: 'POST',
            body: data,
        });
    }

    async updateSettlement(settlementId: SettlementId, data: UpdateSettlementRequest): Promise<SettlementDTO> {
        return this.request({
            endpoint: '/settlements/:settlementId',
            method: 'PUT',
            params: { settlementId },
            body: data,
        });
    }

    async deleteSettlement(settlementId: SettlementId): Promise<MessageResponse> {
        return this.request({
            endpoint: '/settlements/:settlementId',
            method: 'DELETE',
            params: { settlementId },
        });
    }

    async generateShareLink(groupId: GroupId, expiresAt?: string): Promise<ShareLinkResponse> {
        const body: GenerateShareLinkRequest = { groupId };
        if (expiresAt) {
            body.expiresAt = expiresAt;
        }

        return this.request({
            endpoint: '/groups/share',
            method: 'POST',
            body,
        });
    }

    async updateGroupPermissions(groupId: GroupId, permissions: Partial<GroupPermissions>): Promise<MessageResponse> {
        return this.request({
            endpoint: `/groups/${groupId}/security/permissions`,
            method: 'PATCH',
            body: permissions,
        });
    }

    async updateMemberRole(groupId: GroupId, memberId: string, role: MemberRole): Promise<MessageResponse> {
        return this.request({
            endpoint: `/groups/${groupId}/members/${memberId}/role`,
            method: 'PATCH',
            body: { role },
        });
    }

    async approvePendingMember(groupId: GroupId, memberId: string): Promise<MessageResponse> {
        return this.request({
            endpoint: `/groups/${groupId}/members/${memberId}/approve`,
            method: 'POST',
        });
    }

    async rejectPendingMember(groupId: GroupId, memberId: string): Promise<MessageResponse> {
        return this.request({
            endpoint: `/groups/${groupId}/members/${memberId}/reject`,
            method: 'POST',
        });
    }

    async getPendingMembers(groupId: GroupId): Promise<GroupMembershipDTO[]> {
        const response = await this.request<{ members: GroupMembershipDTO[]; }>({
            endpoint: `/groups/${groupId}/members/pending`,
            method: 'GET',
        });
        return Array.isArray(response?.members) ? response.members : [];
    }

    async previewGroupByLink(linkId: string): Promise<PreviewGroupResponse> {
        return this.request({
            endpoint: '/groups/preview',
            method: 'POST',
            body: { linkId },
        });
    }

    async joinGroupByLink(linkId: string): Promise<JoinGroupResponse> {
        return this.request<JoinGroupResponse>({
            endpoint: '/groups/join',
            method: 'POST',
            body: { linkId },
            // Override: This POST is safe to retry because joining a group is idempotent
            skipRetry: false,
        });
    }

    async register(email: Email, password: string, displayName: DisplayName, termsAccepted: boolean, cookiePolicyAccepted: boolean): Promise<RegisterResponse> {
        return this.request({
            endpoint: '/register',
            method: 'POST',
            body: { email, password, displayName, termsAccepted, cookiePolicyAccepted },
        });
    }

    // User policy acceptance methods
    async acceptMultiplePolicies(acceptances: AcceptPolicyRequest[]): Promise<AcceptMultiplePoliciesResponse> {
        return this.request({
            endpoint: '/user/policies/accept-multiple',
            method: 'POST',
            body: { acceptances },
        });
    }

    async getUserPolicyStatus(signal?: AbortSignal): Promise<UserPolicyStatusResponse> {
        return this.request({
            endpoint: '/user/policies/status',
            method: 'GET',
            signal,
        });
    }

    async getCurrentPolicy(policyId: PolicyId, signal?: AbortSignal): Promise<CurrentPolicyResponse> {
        return this.request({
            endpoint: '/policies/:id/current',
            method: 'GET',
            params: { id: policyId },
            skipAuth: true, // Public endpoint
            signal,
        });
    }

    async getAppConfig(signal?: AbortSignal): Promise<AppConfiguration> {
        return this.request({
            endpoint: '/config',
            method: 'GET',
            skipAuth: true,
            signal,
        });
    }

    async updateGroupMemberDisplayName(groupId: GroupId, displayName: UpdateDisplayNameRequest['displayName']): Promise<MessageResponse> {
        return this.request({
            endpoint: '/groups/:id/members/display-name',
            method: 'PUT',
            params: { id: groupId },
            body: { displayName },
        });
    }

    // User profile management methods
    async getUserProfile(signal?: AbortSignal): Promise<UserProfileResponse> {
        return this.request({
            endpoint: '/user/profile',
            method: 'GET',
            signal,
        });
    }

    async updateUserProfile(data: { displayName?: string; }): Promise<UserProfileResponse> {
        return this.request({
            endpoint: '/user/profile',
            method: 'PUT',
            body: data,
        });
    }

    async changePassword(data: { currentPassword: string; newPassword: string; }): Promise<MessageResponse> {
        return this.request({
            endpoint: '/user/change-password',
            method: 'POST',
            body: data,
        });
    }

    // Comment methods
    async createGroupComment(groupId: GroupId, text: string): Promise<CommentDTO> {
        return this.request<CommentDTO>({
            endpoint: '/groups/:groupId/comments',
            method: 'POST',
            params: { groupId },
            body: { text },
        });
    }

    async createExpenseComment(expenseId: ExpenseId, text: string): Promise<CommentDTO> {
        return this.request<CommentDTO>({
            endpoint: '/expenses/:expenseId/comments',
            method: 'POST',
            params: { expenseId },
            body: { text },
        });
    }

    async getGroupComments(groupId: GroupId, cursor?: string): Promise<ListCommentsResponse> {
        const query: Record<string, string> = {};
        if (cursor) query.cursor = cursor;

        return this.request<ListCommentsResponse>({
            endpoint: '/groups/:groupId/comments',
            method: 'GET',
            params: { groupId },
            query: Object.keys(query).length > 0 ? query : undefined,
        });
    }

    async getExpenseComments(expenseId: ExpenseId, cursor?: string): Promise<ListCommentsResponse> {
        const query: Record<string, string> = {};
        if (cursor) query.cursor = cursor;

        return this.request<ListCommentsResponse>({
            endpoint: '/expenses/:expenseId/comments',
            method: 'GET',
            params: { expenseId },
            query: Object.keys(query).length > 0 ? query : undefined,
        });
    }
}

// Export types for external use
export type { PolicyAcceptanceStatusDTO };

// Export a singleton instance
export const apiClient = new ApiClient();
