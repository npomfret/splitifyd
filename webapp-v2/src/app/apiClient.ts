/**
 * API client with runtime validation
 *
 * All API responses are validated at runtime using zod schemas
 * This ensures the server response matches our expected types
 */

import { ApiSerializer, ISOString } from '@billsplit-wl/shared';
import type {
    AcceptMultiplePoliciesResponse,
    AcceptPolicyRequest,
    ActivityFeedResponse,
    AddTenantDomainRequest,
    AdminAPI,
    AdminUpsertTenantRequest,
    AdminUpsertTenantResponse,
    API,
    AttachmentId,
    ChangeEmailRequest,
    ClientAppConfiguration,
    CommentDTO,
    CreateExpenseRequest,
    CreateGroupRequest,
    CreatePolicyRequest,
    CreatePolicyResponse,
    CreateSettlementRequest,
    CurrentPolicyResponse,
    DeletePolicyVersionResponse,
    EmailVerificationRequest,
    EnvironmentDiagnosticsResponse,
    ExpenseDTO,
    ExpenseFullDetailsDTO,
    GenerateShareLinkRequest,
    GetActivityFeedOptions,
    GetGroupFullDetailsOptions,
    GroupDTO,
    GroupFullDetailsDTO,
    GroupMembershipDTO,
    GroupPermissions,
    HealthResponse,
    InitiateMergeRequest,
    InitiateMergeResponse,
    JoinGroupResponse,
    ListAllTenantsResponse,
    ListAuthUsersOptions,
    ListAuthUsersResponse,
    ListCommentsOptions,
    ListCommentsResponse,
    ListFirestoreUsersOptions,
    ListFirestoreUsersResponse,
    ListGroupsOptions,
    ListGroupsResponse,
    ListPoliciesResponse,
    ListTenantImagesResponse,
    LoginRequest,
    LoginResponse,
    MemberRole,
    MergeJobResponse,
    PasswordChangeRequest,
    PasswordResetRequest,
    PolicyAcceptanceStatusDTO,
    PolicyId,
    PolicyVersion,
    PreviewGroupResponse,
    PublicAPI,
    PublishPolicyResponse,
    PublishTenantThemeRequest,
    PublishTenantThemeResponse,
    RegisterResponse,
    RenameTenantImageRequest,
    ResolveRedirectRequest,
    ResolveRedirectResponse,
    SettlementDTO,
    SettlementWithMembers,
    ShareLinkResponse,
    ShareLinkToken,
    TenantDomainsResponse,
    TenantImageId,
    TenantSettingsResponse,
    UpdateExpenseRequest,
    UpdateGroupRequest,
    UpdatePolicyRequest,
    UpdatePolicyResponse,
    UpdateTenantBrandingRequest,
    UpdateUserProfileAdminRequest,
    UpdateUserProfileRequest,
    UpdateUserRoleRequest,
    UpdateUserStatusRequest,
    UploadAttachmentResponse,
    UploadTenantLibraryImageResponse,
    UserId,
    UserPolicyStatusResponse,
    UserProfileResponse,
    UserRegistration,
    VersionHash,
} from '@billsplit-wl/shared';
import { ApiErrorResponseSchema, responseSchemas } from '@billsplit-wl/shared';
import type { UpdateSettlementRequest } from '@billsplit-wl/shared';
import { CommentId, ExpenseId, GroupId, ReactionEmoji, ReactionToggleResponse } from '@billsplit-wl/shared';
import { SettlementId } from '@billsplit-wl/shared';
import { DisplayName } from '@billsplit-wl/shared';
import type { CommentText } from '@billsplit-wl/shared';
import { z } from 'zod';
import { logApiRequest, logApiResponse, logError, logWarning } from '../utils/browser-logger';

// Re-export types for consumers
export type { EnvironmentDiagnosticsResponse };

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

/**
 * Main API client class for frontend application.
 *
 * This class implements the operations defined in IApiClient with an internally managed token.
 * It follows the pattern: method(data) where the auth token is managed via setAuthToken().
 * Includes automatic token refresh, request/response interceptors, and retry logic.
 *
 * @see IApiClient for the complete list of supported operations
 */
class ApiClient implements PublicAPI, API<void>, AdminAPI<void> {
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

    /**
     * Fetch a blob (image, PDF, etc.) from an authenticated endpoint.
     * Used by AuthenticatedImage component to load images that require auth.
     */
    async fetchBlob(url: string): Promise<Blob> {
        const headers: Record<string, string> = {};
        if (this.authToken) {
            headers.Authorization = `Bearer ${this.authToken}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Failed to fetch blob: ${response.status}`);
        }

        return response.blob();
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
            // CRITICAL: Disable browser caching to prevent stale data after updates
            cache: 'no-store',
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

                // Try to parse as API error (structured format only)
                const errorResult = ApiErrorResponseSchema.safeParse(errorData);
                if (errorResult.success) {
                    const { code, ...errorDetails } = errorResult.data.error;
                    // Use code as message for i18n lookup, store full error object as details
                    throw new ApiError(code, code, errorDetails, {
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

            // Handle 204 No Content - return immediately without parsing body
            if (response.status === 204) {
                logApiResponse(options.method, endpoint, response.status, {
                    duration,
                    retryAttempt: attemptNumber > 1 ? attemptNumber : undefined,
                });
                return undefined as T;
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
                // All route parameters are now consistently named (e.g., :groupId, :expenseId, :policyId)
                let normalizedEndpoint = endpoint
                    .replace(/\/groups\/[a-zA-Z0-9_-]{15,}/g, '/groups/:groupId')
                    .replace(/\/expenses\/[a-zA-Z0-9_-]{15,}/g, '/expenses/:expenseId')
                    .replace(/\/settlements\/[a-zA-Z0-9_-]{15,}/g, '/settlements/:settlementId')
                    .replace(/\/policies\/[a-zA-Z0-9_-]+(?=\/)/g, '/policies/:policyId')
                    .replace(/\/admin\/users\/[a-zA-Z0-9_-]+/g, '/admin/users/:userId')
                    .replace(/\/members\/[a-zA-Z0-9_-]{15,}/g, '/members/:memberId');

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
    async listGroups(
        options?: ListGroupsOptions & { page?: number; },
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

    async getActivityFeed(options: GetActivityFeedOptions = {}): Promise<ActivityFeedResponse> {
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

    async getGroupActivityFeed(groupId: GroupId, options: GetActivityFeedOptions = {}): Promise<ActivityFeedResponse> {
        const query: Record<string, string> = {};

        if (options.limit !== undefined) {
            query.limit = options.limit.toString();
        }

        if (options.cursor) {
            query.cursor = options.cursor;
        }

        return this.request<ActivityFeedResponse>({
            endpoint: `/groups/${groupId}/activity-feed`,
            method: 'GET',
            query: Object.keys(query).length > 0 ? query : undefined,
            schema: responseSchemas['GET /activity-feed'] as z.ZodSchema<ActivityFeedResponse>,
        });
    }

    async getGroupFullDetails(
        id: string,
        options?: GetGroupFullDetailsOptions,
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
            endpoint: '/groups/:groupId/full-details',
            method: 'GET',
            params: { groupId: id },
            query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });
    }

    async leaveGroup(groupId: GroupId): Promise<void> {
        await this.request({
            endpoint: '/groups/:groupId/leave',
            method: 'POST',
            params: { groupId },
        });
    }

    async archiveGroupForUser(groupId: GroupId): Promise<void> {
        await this.request({
            endpoint: '/groups/:groupId/archive',
            method: 'POST',
            params: { groupId },
        });
    }

    async unarchiveGroupForUser(groupId: GroupId): Promise<void> {
        await this.request({
            endpoint: '/groups/:groupId/unarchive',
            method: 'POST',
            params: { groupId },
        });
    }

    async removeGroupMember(groupId: GroupId, memberId: UserId): Promise<void> {
        await this.request({
            endpoint: '/groups/:groupId/members/:memberId',
            method: 'DELETE',
            params: { groupId, memberId },
        });
    }

    async createGroup(data: CreateGroupRequest): Promise<GroupDTO> {
        return this.request({
            endpoint: '/groups',
            method: 'POST',
            body: data,
        });
    }

    async updateGroup(id: string, data: UpdateGroupRequest): Promise<void> {
        await this.request({
            endpoint: `/groups/${id}`,
            method: 'PUT',
            body: data,
        });
    }

    async deleteGroup(id: string): Promise<void> {
        await this.request({
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

    async updateExpense(expenseId: ExpenseId, data: UpdateExpenseRequest): Promise<ExpenseDTO> {
        return this.request({
            endpoint: '/expenses',
            method: 'PUT',
            query: { id: expenseId },
            body: data,
        });
    }

    async deleteExpense(expenseId: ExpenseId): Promise<void> {
        await this.request({
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

    async updateSettlement(settlementId: SettlementId, data: UpdateSettlementRequest): Promise<SettlementWithMembers> {
        return this.request({
            endpoint: '/settlements/:settlementId',
            method: 'PUT',
            params: { settlementId },
            body: data,
        });
    }

    async deleteSettlement(settlementId: SettlementId): Promise<void> {
        await this.request({
            endpoint: '/settlements/:settlementId',
            method: 'DELETE',
            params: { settlementId },
        });
    }

    // Reaction operations
    async toggleExpenseReaction(expenseId: ExpenseId, emoji: ReactionEmoji): Promise<ReactionToggleResponse> {
        return this.request({
            endpoint: '/expenses/:expenseId/reactions',
            method: 'POST',
            params: { expenseId },
            body: { emoji },
        });
    }

    async toggleGroupCommentReaction(groupId: GroupId, commentId: CommentId, emoji: ReactionEmoji): Promise<ReactionToggleResponse> {
        return this.request({
            endpoint: '/groups/:groupId/comments/:commentId/reactions',
            method: 'POST',
            params: { groupId, commentId },
            body: { emoji },
        });
    }

    async toggleExpenseCommentReaction(expenseId: ExpenseId, commentId: CommentId, emoji: ReactionEmoji): Promise<ReactionToggleResponse> {
        return this.request({
            endpoint: '/expenses/:expenseId/comments/:commentId/reactions',
            method: 'POST',
            params: { expenseId, commentId },
            body: { emoji },
        });
    }

    async toggleSettlementReaction(settlementId: SettlementId, emoji: ReactionEmoji): Promise<ReactionToggleResponse> {
        return this.request({
            endpoint: '/settlements/:settlementId/reactions',
            method: 'POST',
            params: { settlementId },
            body: { emoji },
        });
    }

    async generateShareableLink(groupId: GroupId, expiresAt?: ISOString): Promise<ShareLinkResponse> {
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

    async updateGroupPermissions(groupId: GroupId, permissions: Partial<GroupPermissions>): Promise<void> {
        await this.request({
            endpoint: `/groups/${groupId}/security/permissions`,
            method: 'PATCH',
            body: permissions,
        });
    }

    async updateMemberRole(groupId: GroupId, memberId: UserId, role: MemberRole): Promise<void> {
        await this.request({
            endpoint: `/groups/${groupId}/members/${memberId}/role`,
            method: 'PATCH',
            body: { role },
        });
    }

    async approveMember(groupId: GroupId, memberId: UserId): Promise<void> {
        await this.request({
            endpoint: `/groups/${groupId}/members/${memberId}/approve`,
            method: 'POST',
        });
    }

    async rejectMember(groupId: GroupId, memberId: UserId): Promise<void> {
        await this.request({
            endpoint: `/groups/${groupId}/members/${memberId}/reject`,
            method: 'POST',
        });
    }

    async getPendingMembers(groupId: GroupId): Promise<GroupMembershipDTO[]> {
        const response = await this.request<GroupMembershipDTO[]>({
            endpoint: `/groups/${groupId}/members/pending`,
            method: 'GET',
        });
        return Array.isArray(response) ? response : [];
    }

    async previewGroupByLink(shareToken: ShareLinkToken | string): Promise<PreviewGroupResponse> {
        return this.request({
            endpoint: '/groups/preview',
            method: 'POST',
            body: { shareToken },
        });
    }

    async joinGroupByLink(shareToken: ShareLinkToken | string, groupDisplayName: DisplayName): Promise<JoinGroupResponse> {
        return this.request<JoinGroupResponse>({
            endpoint: '/groups/join',
            method: 'POST',
            body: { shareToken, groupDisplayName },
            skipRetry: false,
        });
    }

    async register(userData: Omit<UserRegistration, 'signupHostname'>): Promise<RegisterResponse> {
        return this.request({
            endpoint: '/register',
            method: 'POST',
            body: {
                ...userData,
                signupHostname: window.location.hostname,
            },
        });
    }

    async login(credentials: LoginRequest): Promise<LoginResponse> {
        return this.request({
            endpoint: '/login',
            method: 'POST',
            body: credentials,
            skipAuth: true,
        });
    }

    async sendPasswordResetEmail(request: PasswordResetRequest): Promise<void> {
        await this.request({
            endpoint: '/password-reset',
            method: 'POST',
            body: request,
            skipAuth: true,
        });
    }

    async sendEmailVerification(request: EmailVerificationRequest): Promise<void> {
        await this.request({
            endpoint: '/email-verification',
            method: 'POST',
            body: request,
            skipAuth: true,
        });
    }

    async getConfig(): Promise<ClientAppConfiguration> {
        return this.request({
            endpoint: '/config',
            method: 'GET',
            skipAuth: true,
        });
    }

    async getBootstrapConfig(): Promise<ClientAppConfiguration> {
        return this.request({
            endpoint: '/bootstrap-config',
            method: 'GET',
            skipAuth: true,
        });
    }

    async getHealth(): Promise<HealthResponse> {
        return this.request({
            endpoint: '/health',
            method: 'GET',
            skipAuth: true,
        });
    }

    // ===== ADMIN API: USER/TENANT BROWSING =====

    async listAuthUsers(options: ListAuthUsersOptions): Promise<ListAuthUsersResponse> {
        const query: Record<string, string> = {};
        if (options?.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options?.pageToken) {
            query.pageToken = options.pageToken;
        }
        if (options?.email) {
            query.email = options.email;
        }
        if (options?.uid) {
            query.uid = options.uid;
        }

        return this.request<ListAuthUsersResponse>({
            endpoint: '/admin/browser/users/auth',
            method: 'GET',
            query: Object.keys(query).length > 0 ? query : undefined,
            // Schema automatically picked up from responseSchemas
        });
    }

    async listFirestoreUsers(options?: ListFirestoreUsersOptions): Promise<ListFirestoreUsersResponse> {
        const query: Record<string, string> = {};
        if (options?.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options?.cursor) {
            query.cursor = options.cursor;
        }
        if (options?.email) {
            query.email = options.email;
        }
        if (options?.uid) {
            query.uid = options.uid;
        }
        if (options?.displayName) {
            query.displayName = options.displayName;
        }

        return this.request<ListFirestoreUsersResponse>({
            endpoint: '/admin/browser/users/firestore',
            method: 'GET',
            query: Object.keys(query).length > 0 ? query : undefined,
        });
    }

    async listAllTenants(): Promise<ListAllTenantsResponse> {
        return this.request({
            endpoint: '/admin/browser/tenants',
            method: 'GET',
        });
    }

    // ===== ADMIN API: USER MANAGEMENT =====

    /**
     * Update user account status (enable/disable)
     * Admin-only endpoint
     */
    async updateUser(uid: UserId, updates: UpdateUserStatusRequest): Promise<void> {
        await this.request({
            endpoint: '/admin/users/:uid',
            method: 'PUT',
            params: { uid },
            body: updates,
        });
    }

    /**
     * Update user role (system_admin, tenant_admin, or regular user)
     * Admin-only endpoint
     */
    async updateUserRole(uid: UserId, updates: UpdateUserRoleRequest): Promise<void> {
        await this.request({
            endpoint: '/admin/users/:uid/role',
            method: 'PUT',
            params: { uid },
            body: updates,
        });
    }

    /**
     * Update user profile (displayName, email)
     * Admin-only endpoint
     */
    async updateUserProfileAdmin(uid: UserId, updates: UpdateUserProfileAdminRequest): Promise<void> {
        await this.request({
            endpoint: '/admin/users/:uid/profile',
            method: 'PUT',
            params: { uid },
            body: updates,
        });
    }

    /**
     * Get Firebase Auth user record (raw)
     * Admin-only endpoint
     */
    async getUserAuth(uid: UserId): Promise<any> {
        return this.request<any>({
            endpoint: '/admin/users/:uid/auth',
            method: 'GET',
            params: { uid },
        });
    }

    /**
     * Get Firestore user document (raw)
     * Admin-only endpoint
     */
    async getUserFirestore(uid: UserId): Promise<any> {
        return this.request<any>({
            endpoint: '/admin/users/:uid/firestore',
            method: 'GET',
            params: { uid },
        });
    }

    // Public policy endpoint (no auth required) - used by policy acceptance modal
    private getCurrentPolicyInternal(policyId: PolicyId, signal?: AbortSignal): Promise<CurrentPolicyResponse> {
        return this.request({
            endpoint: '/policies/:policyId/current',
            method: 'GET',
            params: { policyId },
            skipAuth: true,
            signal,
        });
    }

    async getCurrentPolicy(policyId: PolicyId): Promise<CurrentPolicyResponse> {
        return this.getCurrentPolicyInternal(policyId);
    }

    // User policy acceptance methods
    async acceptMultiplePolicies(acceptances: AcceptPolicyRequest[]): Promise<AcceptMultiplePoliciesResponse> {
        return this.request({
            endpoint: '/user/policies/accept-multiple',
            method: 'POST',
            body: { acceptances },
        });
    }

    private getUserPolicyStatusInternal(signal?: AbortSignal): Promise<UserPolicyStatusResponse> {
        return this.request({
            endpoint: '/user/policies/status',
            method: 'GET',
            signal,
        });
    }

    async getUserPolicyStatus(): Promise<UserPolicyStatusResponse> {
        return this.getUserPolicyStatusInternal();
    }

    async getUserPolicyStatusWithAbort(signal?: AbortSignal): Promise<UserPolicyStatusResponse> {
        return this.getUserPolicyStatusInternal(signal);
    }

    async getPrivacyPolicy(): Promise<string> {
        return this.fetchPolicyText('/policies/privacy-policy/text');
    }

    async getTermsOfService(): Promise<string> {
        return this.fetchPolicyText('/policies/terms-of-service/text');
    }

    async getCookiePolicy(): Promise<string> {
        return this.fetchPolicyText('/policies/cookie-policy/text');
    }

    /**
     * Fetches policy text as plain text from the specified endpoint.
     * Server controls caching via Cache-Control headers in cache-control middleware.
     */
    private async fetchPolicyText(endpoint: string): Promise<string> {
        const url = `/api${endpoint}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/plain',
            },
            credentials: 'omit',
        });

        if (!response.ok) {
            throw new ApiError(`Request failed with status ${response.status}`, 'POLICY_FETCH_ERROR', undefined, {
                url,
                method: 'GET',
                status: response.status,
                statusText: response.statusText,
            });
        }

        return response.text();
    }

    async getAppConfig(signal?: AbortSignal): Promise<ClientAppConfiguration> {
        return this.request({
            endpoint: '/config',
            method: 'GET',
            skipAuth: true,
            signal,
        });
    }

    async updateGroupMemberDisplayName(groupId: GroupId, displayName: DisplayName): Promise<void> {
        await this.request({
            endpoint: '/groups/:groupId/members/display-name',
            method: 'PUT',
            params: { groupId },
            body: { displayName },
        });
    }

    // User profile management methods
    private getUserProfileInternal(signal?: AbortSignal): Promise<UserProfileResponse> {
        return this.request({
            endpoint: '/user/profile',
            method: 'GET',
            signal,
        });
    }

    async getUserProfile(): Promise<UserProfileResponse> {
        return this.getUserProfileInternal();
    }

    async updateUserProfile(data: UpdateUserProfileRequest): Promise<void> {
        await this.request({
            endpoint: '/user/profile',
            method: 'PUT',
            body: data,
        });
    }

    async changePassword(data: PasswordChangeRequest): Promise<void> {
        await this.request({
            endpoint: '/user/change-password',
            method: 'POST',
            body: data,
        });
    }

    async changeEmail(data: ChangeEmailRequest): Promise<void> {
        await this.request({
            endpoint: '/user/change-email',
            method: 'POST',
            body: data,
        });
    }

    // Comment methods
    async createGroupComment(groupId: GroupId, text: CommentText, attachmentIds?: AttachmentId[]): Promise<CommentDTO> {
        return this.request<CommentDTO>({
            endpoint: '/groups/:groupId/comments',
            method: 'POST',
            params: { groupId },
            body: { text, attachmentIds },
        });
    }

    async createExpenseComment(expenseId: ExpenseId, text: CommentText, attachmentIds?: AttachmentId[]): Promise<CommentDTO> {
        return this.request<CommentDTO>({
            endpoint: '/expenses/:expenseId/comments',
            method: 'POST',
            params: { expenseId },
            body: { text, attachmentIds },
        });
    }

    // Attachment methods
    async uploadAttachment(groupId: GroupId, type: 'receipt' | 'comment', file: File, contentType: string): Promise<UploadAttachmentResponse> {
        const url = buildUrl(`/api/groups/:groupId/attachments`, { groupId }, { type });
        const headers: Record<string, string> = {
            'Content-Type': contentType,
        };

        if (this.authToken) {
            headers.Authorization = `Bearer ${this.authToken}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: file,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { code: 'UNKNOWN_ERROR' } }));
            throw new ApiError(
                errorData.error?.message || 'Upload failed',
                errorData.error?.code || 'UPLOAD_ERROR',
                errorData.error,
                { url, method: 'POST', status: response.status, statusText: response.statusText },
            );
        }

        return response.json() as Promise<UploadAttachmentResponse>;
    }

    getAttachmentUrl(groupId: GroupId, attachmentId: AttachmentId): string {
        return buildUrl('/api/groups/:groupId/attachments/:attachmentId', { groupId, attachmentId });
    }

    async deleteAttachment(groupId: GroupId, attachmentId: AttachmentId): Promise<void> {
        return this.request<void>({
            endpoint: '/groups/:groupId/attachments/:attachmentId',
            method: 'DELETE',
            params: { groupId, attachmentId },
        });
    }

    async listGroupComments(groupId: GroupId, options?: ListCommentsOptions): Promise<ListCommentsResponse> {
        const query: Record<string, string> = {};
        if (options?.cursor) query.cursor = options.cursor;
        if (options?.limit) query.limit = options.limit.toString();

        return this.request<ListCommentsResponse>({
            endpoint: '/groups/:groupId/comments',
            method: 'GET',
            params: { groupId },
            query: Object.keys(query).length > 0 ? query : undefined,
        });
    }

    async listExpenseComments(expenseId: ExpenseId, options?: ListCommentsOptions): Promise<ListCommentsResponse> {
        const query: Record<string, string> = {};
        if (options?.cursor) query.cursor = options.cursor;
        if (options?.limit) query.limit = options.limit.toString();

        return this.request<ListCommentsResponse>({
            endpoint: '/expenses/:expenseId/comments',
            method: 'GET',
            params: { expenseId },
            query: Object.keys(query).length > 0 ? query : undefined,
        });
    }

    async deleteGroupComment(groupId: GroupId, commentId: CommentId): Promise<void> {
        await this.request({
            endpoint: '/groups/:groupId/comments/:commentId',
            method: 'DELETE',
            params: { groupId, commentId },
        });
    }

    async deleteExpenseComment(expenseId: ExpenseId, commentId: CommentId): Promise<void> {
        await this.request({
            endpoint: '/expenses/:expenseId/comments/:commentId',
            method: 'DELETE',
            params: { expenseId, commentId },
        });
    }

    // ===== ADMIN API: POLICY MANAGEMENT =====

    async createPolicy(request: CreatePolicyRequest): Promise<CreatePolicyResponse> {
        return this.request({
            endpoint: '/admin/policies',
            method: 'POST',
            body: request,
        });
    }

    async listPolicies(): Promise<ListPoliciesResponse> {
        return this.request({
            endpoint: '/admin/policies',
            method: 'GET',
        });
    }

    async getPolicyVersion(policyId: PolicyId, versionHash: VersionHash): Promise<PolicyVersion & { versionHash: VersionHash; }> {
        return this.request({
            endpoint: '/admin/policies/:id/versions/:hash',
            method: 'GET',
            params: { id: policyId, hash: versionHash },
        });
    }

    async updatePolicy(policyId: PolicyId, request: UpdatePolicyRequest): Promise<UpdatePolicyResponse> {
        return this.request({
            endpoint: '/admin/policies/:id',
            method: 'PUT',
            params: { id: policyId },
            body: request,
        });
    }

    async publishPolicy(policyId: PolicyId, versionHash: VersionHash): Promise<PublishPolicyResponse> {
        return this.request({
            endpoint: '/admin/policies/:id/publish',
            method: 'POST',
            params: { id: policyId },
            body: { versionHash },
        });
    }

    async deletePolicyVersion(policyId: PolicyId, versionHash: VersionHash): Promise<DeletePolicyVersionResponse> {
        return this.request({
            endpoint: '/admin/policies/:id/versions/:hash',
            method: 'DELETE',
            params: { id: policyId, hash: versionHash },
        });
    }

    // ===== ADMIN API: TENANT MANAGEMENT =====

    async adminUpsertTenant(request: AdminUpsertTenantRequest): Promise<AdminUpsertTenantResponse> {
        return this.request({
            endpoint: '/admin/tenants',
            method: 'POST',
            body: request,
        });
    }

    async publishTenantTheme(request: PublishTenantThemeRequest): Promise<PublishTenantThemeResponse> {
        return this.request({
            endpoint: '/admin/tenants/publish',
            method: 'POST',
            body: request,
        });
    }

    async uploadTenantImage(
        tenantId: string,
        assetType: 'logo' | 'favicon',
        file: File,
    ): Promise<{ url: string; }> {
        const url = `/api/admin/tenants/${encodeURIComponent(tenantId)}/assets/${assetType}`;

        const headers: Record<string, string> = {
            'Content-Type': file.type,
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: file,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ code: 'UNKNOWN_ERROR', message: 'Upload failed' }));
            throw new Error(error.message || 'Upload failed');
        }

        return response.json();
    }

    // ===== ADMIN API: TENANT SETTINGS =====

    async getTenantSettings(): Promise<TenantSettingsResponse> {
        return this.request({
            endpoint: '/settings/tenant',
            method: 'GET',
        });
    }

    async updateTenantBranding(request: UpdateTenantBrandingRequest): Promise<void> {
        await this.request({
            endpoint: '/settings/tenant/branding',
            method: 'PUT',
            body: request,
        });
    }

    async getTenantDomains(): Promise<TenantDomainsResponse> {
        return this.request({
            endpoint: '/settings/tenant/domains',
            method: 'GET',
        });
    }

    async addTenantDomain(request: AddTenantDomainRequest): Promise<void> {
        await this.request({
            endpoint: '/settings/tenant/domains',
            method: 'POST',
            body: request,
        });
    }

    // ===== ADMIN API: TENANT IMAGE LIBRARY =====

    async listTenantImages(tenantId: string): Promise<ListTenantImagesResponse> {
        return this.request({
            endpoint: '/admin/tenants/:tenantId/images',
            method: 'GET',
            params: { tenantId },
        });
    }

    async uploadTenantLibraryImage(
        tenantId: string,
        name: string,
        file: File,
        contentType: string,
    ): Promise<UploadTenantLibraryImageResponse> {
        const url = `/api/admin/tenants/${encodeURIComponent(tenantId)}/images?name=${encodeURIComponent(name)}`;

        const headers: Record<string, string> = {
            'Content-Type': contentType,
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: file,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ code: 'UNKNOWN_ERROR', message: 'Upload failed' }));
            throw new ApiError(error.message || 'Upload failed', error.code || 'UPLOAD_ERROR', error, {
                url,
                method: 'POST',
                status: response.status,
                statusText: response.statusText,
            });
        }

        return response.json();
    }

    async renameTenantImage(tenantId: string, imageId: TenantImageId, request: RenameTenantImageRequest): Promise<void> {
        await this.request({
            endpoint: '/admin/tenants/:tenantId/images/:imageId',
            method: 'PATCH',
            params: { tenantId, imageId },
            body: request,
        });
    }

    async deleteTenantImage(tenantId: string, imageId: TenantImageId): Promise<void> {
        await this.request({
            endpoint: '/admin/tenants/:tenantId/images/:imageId',
            method: 'DELETE',
            params: { tenantId, imageId },
        });
    }

    // ===== ACCOUNT MERGE API =====

    async initiateMerge(request: InitiateMergeRequest): Promise<InitiateMergeResponse> {
        return this.request({
            endpoint: '/merge',
            method: 'POST',
            body: request,
        });
    }

    async getMergeStatus(jobId: string): Promise<MergeJobResponse> {
        return this.request({
            endpoint: '/merge/:jobId',
            method: 'GET',
            params: { jobId },
        });
    }

    // ===== URL UTILITIES =====

    async resolveRedirect(request: ResolveRedirectRequest): Promise<ResolveRedirectResponse> {
        return this.request({
            endpoint: '/utils/resolve-redirect',
            method: 'POST',
            body: request,
        });
    }

    // ===== ADMIN API: DIAGNOSTICS =====

    async getEnvironmentDiagnostics(): Promise<EnvironmentDiagnosticsResponse> {
        return this.request({
            endpoint: '/env',
            method: 'GET',
        });
    }
}

// Export types for external use
export type { PolicyAcceptanceStatusDTO };

// Export a singleton instance
export const apiClient = new ApiClient();
