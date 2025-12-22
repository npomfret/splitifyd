import {
    AcceptMultiplePoliciesResponse,
    AcceptPolicyRequest,
    ActivityFeedEventType,
    ActivityFeedEventTypes,
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
    CommentId,
    CommentText,
    CreateExpenseRequest,
    CreatePolicyRequest,
    CreatePolicyResponse,
    CreateSettlementRequest,
    CurrentPolicyResponse,
    DeletePolicyVersionResponse,
    DisplayName,
    EmailVerificationRequest,
    EnvironmentDiagnosticsResponse,
    ExpenseDTO,
    ExpenseFullDetailsDTO,
    ExpenseId,
    GetActivityFeedOptions,
    GetGroupFullDetailsOptions,
    GroupDTO,
    GroupFullDetailsDTO,
    GroupId,
    GroupMembershipDTO,
    GroupPermissions,
    HealthResponse,
    InitiateMergeRequest,
    InitiateMergeResponse,
    ISOString,
    JoinGroupResponse,
    ListAllTenantsResponse,
    ListAuthUsersOptions,
    ListAuthUsersResponse,
    ListCommentsOptions,
    ListCommentsResponse,
    ListExpensesResponse,
    ListFirestoreUsersOptions,
    ListFirestoreUsersResponse,
    ListGroupsOptions,
    ListGroupsResponse,
    ListPoliciesResponse,
    ListSettlementsOptions,
    ListSettlementsResponse,
    ListTenantImagesResponse,
    LoginRequest,
    LoginResponse,
    MemberRole,
    MergeJobResponse,
    PasswordChangeRequest,
    PasswordResetRequest,
    PolicyDTO,
    PolicyId,
    PolicyVersion,
    PreviewGroupResponse,
    PublicAPI,
    PublishPolicyResponse,
    PublishTenantThemeRequest,
    PublishTenantThemeResponse,
    ReactionEmoji,
    ReactionToggleResponse,
    RegisterResponse,
    RenameTenantImageRequest,
    ResolveRedirectRequest,
    ResolveRedirectResponse,
    SettlementDTO,
    SettlementId,
    SettlementWithMembers,
    ShareLinkResponse,
    ShareLinkToken,
    SystemUserRoles,
    TenantDomainsResponse,
    TenantImageId,
    TenantSettingsResponse,
    toUserId,
    UpdateExpenseRequest,
    UpdateGroupRequest,
    UpdatePolicyRequest,
    UpdatePolicyResponse,
    UpdateSettlementRequest,
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
import { CreateGroupRequestBuilder, createStubRequest, createStubResponse, StubRequestOptions, StubStorage, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { StubCloudTasksClient, StubFirestoreDatabase } from 'ts-firebase-simulator';
import { expect } from 'vitest';
import { ApiError, ErrorDetail, Errors } from '../../errors';
import { createRouteDefinitions, RouteDefinition } from '../../routes/route-config';
import type { UserDocument } from '../../schemas';
import { ComponentBuilder } from '../../services/ComponentBuilder';
import { FakeEmailService } from '../../services/email';
import { FirestoreReader } from '../../services/firestore';
import { RegisterUserResult } from '../../services/UserService2';
import { createUnitTestServiceConfig, StubGroupAttachmentStorage } from '../test-config';
import { StubAuthService } from './mocks/StubAuthService';
import { TenantPayloadBuilder } from './TenantPayloadBuilder';

/**
 * Options for listing expenses in a group
 */
interface ListExpensesOptions {
    limit?: number;
    cursor?: string;
    includeDeleted?: boolean;
}

/**
 * Extended request interface for authenticated requests in AppDriver
 */
interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        displayName?: string;
        role?: string;
    };
}

export type AuthToken = string;

export class AppDriver implements PublicAPI, API<AuthToken>, AdminAPI<AuthToken> {
    private db = new StubFirestoreDatabase();
    private storage = new StubStorage({ defaultBucketName: 'app-driver-test-bucket' });
    private authService = new StubAuthService();
    private cloudTasksClient = new StubCloudTasksClient();
    private routeDefinitions: RouteDefinition[];
    private readonly _componentBuilder: ComponentBuilder;

    constructor() {
        // Create a ComponentBuilder with our test dependencies
        const groupAttachmentStorage = new StubGroupAttachmentStorage(this.storage);
        this._componentBuilder = new ComponentBuilder(
            this.authService,
            new FakeEmailService(),
            this.db,
            this.storage,
            this.cloudTasksClient,
            createUnitTestServiceConfig(),
            groupAttachmentStorage,
        );

        // Create populated route definitions using the component builder
        this.routeDefinitions = createRouteDefinitions(this._componentBuilder);
    }

    private localhostTenantSeeded = false;

    /**
     * Seeds a localhost tenant with branding config for tests that need tenant resolution.
     * Call this explicitly in tests that require a tenant (e.g., password reset tests).
     * This is idempotent - safe to call multiple times; will skip if already seeded.
     */
    seedLocalhostTenant(): void {
        // Track seeding with a flag to make this idempotent
        if (this.localhostTenantSeeded) {
            return;
        }

        const now = Timestamp.now();

        const localhostTenant = new TenantPayloadBuilder('localhost-tenant')
            .withDomains(['localhost'])
            .withAppName('Localhost')
            .withSupportEmail('support@localhost.test')
            .withDefaultTenantFlag(true)
            .build();

        this.db.seed('tenants/localhost-tenant', {
            ...localhostTenant,
            createdAt: now,
            updatedAt: now,
        });

        this.localhostTenantSeeded = true;
    }

    get componentBuilder() {
        return this._componentBuilder;
    }

    get storageStub(): StubStorage {
        return this.storage;
    }

    get firestoreStub(): StubFirestoreDatabase {
        return this.db;
    }

    /**
     * Test-specific middleware that works with stub requests.
     * Unlike production middleware, this doesn't verify tokens - it trusts the user already attached by createStubRequest.
     */
    private createTestMiddleware() {
        const firestoreReader = new FirestoreReader(this.db);
        const authService = this.authService;

        // Email verification allowlist - paths that don't require verified email for write operations
        const EMAIL_VERIFICATION_ALLOWLIST = [
            '/email-verification', // Resend verification email
            '/auth/login', // Login
            '/auth/register', // Registration
            '/auth/password-reset', // Password reset
            '/user/profile', // Allow profile updates (language, display name)
            '/user/email', // Email change (needs verification)
            '/user/email-preferences', // Email preferences
            '/user/change-password', // Password change (user must know current password)
            '/groups/join', // Join group via share link (share link provides authorization)
            '/groups/preview', // Preview group before joining (part of join flow)
        ];

        function isEmailVerificationAllowlisted(path: string): boolean {
            return EMAIL_VERIFICATION_ALLOWLIST.some(allowed => path.startsWith(allowed));
        }

        function isWriteOperation(method: string): boolean {
            return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
        }

        /**
         * Test authentication middleware - validates user is attached to request
         */
        const authenticate: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            if (!req.user || !req.user.uid) {
                throw Errors.authRequired();
            }

            // Fetch role from Firestore (mimics production middleware)
            try {
                const userDocument = await firestoreReader.getUser(toUserId(req.user.uid));
                if (userDocument) {
                    req.user.role = userDocument.role;
                }
            } catch (error) {
                // User might not exist in Firestore yet (e.g., during registration), continue anyway
            }

            // Check email verification for write operations (mimics production middleware)
            if (isWriteOperation(req.method) && !isEmailVerificationAllowlisted(req.path)) {
                try {
                    const userRecord = await authService.getUser(toUserId(req.user.uid));
                    if (userRecord && !userRecord.emailVerified) {
                        throw Errors.forbidden(ErrorDetail.EMAIL_NOT_VERIFIED);
                    }
                } catch (error: any) {
                    // If it's already a forbidden error, rethrow
                    if (error.code === 'FORBIDDEN') {
                        throw error;
                    }
                    // User might not exist in Auth yet, continue anyway
                }
            }

            // Await next to properly propagate errors from combined middlewares
            await Promise.resolve(next());
        };

        /**
         * Test admin middleware - checks for admin role
         */
        const requireAdmin: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            if (!req.user) {
                throw Errors.authRequired();
            }

            if (req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
                throw Errors.forbidden();
            }

            next();
        };

        /**
         * Test system user middleware - checks for system user or admin role
         */
        const requireSystemRole: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            if (!req.user) {
                throw Errors.authRequired();
            }

            if (req.user.role !== SystemUserRoles.SYSTEM_USER && req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
                throw Errors.forbidden();
            }

            next();
        };

        const authenticateAdmin: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            try {
                await authenticate(req, res, async (error?: any) => {
                    if (error) {
                        throw error;
                    }
                    await requireAdmin(req, res, next);
                });
            } catch (err) {
                throw err;
            }
        };

        const authenticateSystemUser: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            try {
                await authenticate(req, res, async (error?: any) => {
                    if (error) {
                        throw error;
                    }
                    await requireSystemRole(req, res, next);
                });
            } catch (err) {
                throw err;
            }
        };

        /**
         * Test tenant admin middleware - checks for tenant admin or system admin role
         */
        const requireTenantAdmin: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            if (!req.user) {
                throw Errors.authRequired();
            }

            if (req.user.role !== SystemUserRoles.TENANT_ADMIN && req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
                throw Errors.forbidden();
            }

            next();
        };

        const authenticateTenantAdmin: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            try {
                await authenticate(req, res, async (error?: any) => {
                    if (error) {
                        throw error;
                    }
                    await requireTenantAdmin(req, res, next);
                });
            } catch (err) {
                throw err;
            }
        };

        /**
         * Test Cloud Task middleware - skips OIDC verification in tests (like emulator mode)
         */
        const authenticateCloudTask: RequestHandler = async (_req: Request, _res: Response, next: NextFunction) => {
            // In tests, we skip OIDC token verification (same as emulator mode)
            next();
        };

        return {
            authenticate,
            authenticateAdmin,
            authenticateCloudTask,
            authenticateSystemUser,
            authenticateTenantAdmin,
        };
    }

    /**
     * Looks up route configuration by handler name
     */
    private findRouteByHandler(handlerName: string): RouteDefinition | undefined {
        return this.routeDefinitions.find(route => route.handlerName === handlerName);
    }

    /**
     * Dispatches a request through the routing system by handler name, executing middleware
     * and the handler function. Creates and returns the response object.
     * This provides route-aware testing with middleware execution.
     *
     * The handler function is looked up from the route definition.
     */
    private async dispatchByHandler(handlerName: string, req: any): Promise<any> {
        const route = this.findRouteByHandler(handlerName);

        if (!route) {
            throw new Error(`No route found for handler: ${handlerName}`);
        }

        // Get the handler function from the route definition
        const handlerFn = route.handler;
        if (!handlerFn) {
            throw new Error(`Handler function not found on route: ${handlerName}`);
        }

        // Set method and path from route configuration
        req.method = route.method;
        req.path = route.path;

        // Create response
        const res = createStubResponse();

        // Get test middleware registry
        const middlewareRegistry = this.createTestMiddleware();

        // Build middleware chain
        const middlewareChain: RequestHandler[] = [];
        if (route.middleware) {
            for (const middlewareName of route.middleware) {
                const middleware = (middlewareRegistry as any)[middlewareName];
                if (!middleware) {
                    throw new Error(`Middleware not found: ${middlewareName}`);
                }
                middlewareChain.push(middleware);
            }
        }

        try {
            // Execute middleware chain
            for (const middleware of middlewareChain) {
                let nextCalled = false;
                let error: any = null;

                await new Promise<void>((resolve, reject) => {
                    const next = (err?: any) => {
                        nextCalled = true;
                        if (err) {
                            error = err;
                            reject(err);
                        } else {
                            resolve();
                        }
                    };

                    // Execute middleware
                    const result = middleware(req, res, next) as void | Promise<void>;

                    // Handle async middleware
                    if (result && result instanceof Promise) {
                        result
                            .then(() => {
                                if (!nextCalled) {
                                    resolve();
                                }
                            })
                            .catch(reject);
                    } else if (!nextCalled) {
                        // Synchronous middleware that didn't call next - assume success
                        resolve();
                    }
                });

                // If middleware sent a response (e.g., error), stop execution
                if (res.getStatus && res.getStatus()) {
                    return res;
                }

                if (error) {
                    throw error;
                }
            }

            // Middleware passed, now call the handler
            // Provide a next function that throws errors (mimics Express error handling)
            const next = (err?: any) => {
                if (err) throw err;
            };
            await handlerFn(req, res, next);

            return res;
        } catch (err) {
            // Convert thrown ApiError to HTTP response (mirrors Express error handler)
            if (err instanceof ApiError) {
                res.status(err.statusCode).json({
                    error: {
                        ...err.toJSON(),
                    },
                });
                return res;
            }
            throw err;
        }
    }

    /**
     * Marks a user's email as verified in Firebase Auth
     */
    async markEmailVerified(userId: UserId | string) {
        const existingUser = await this.authService.getUser(toUserId(userId));
        if (existingUser) {
            this.authService.setUser(userId as string, {
                ...existingUser,
                emailVerified: true,
            });
        }
    }

    /**
     * Seeds an admin user for testing admin-only endpoints
     */
    seedAdminUser(userId: UserId | string, userData: Record<string, any> = {}) {
        const user = this._seedUser(userId, {
            ...userData,
            role: SystemUserRoles.SYSTEM_ADMIN,
        });

        this.authService.setUser(userId, {
            uid: userId,
            email: user.email,
            displayName: user.displayName,
            emailVerified: true,
        });
    }

    /**
     * Seeds a tenant admin user for testing tenant admin endpoints
     */
    seedTenantAdminUser(userId: UserId, userData: Record<string, any> = {}) {
        const user = this._seedUser(userId, {
            ...userData,
            role: SystemUserRoles.TENANT_ADMIN,
        });

        this.authService.setUser(userId, {
            uid: userId,
            email: user.email,
            displayName: user.displayName,
            emailVerified: true,
        });
    }
    /**
     * Seed a user document with sensible defaults.
     *
     * Note: displayName is stored in Firebase Auth, not Firestore. If provided,
     * it will be included in the return value but NOT stored in the database.
     *
     * @param userId - The user ID
     * @param partialUser - Partial user data to override defaults
     * @returns The complete user object including displayName (for use with Auth mocks)
     */
    private _seedUser(userId: string, partialUser: Record<string, any> = {}): Record<string, any> {
        const now = Timestamp.now();

        // Create the full user object with displayName for the return value
        const displayName = partialUser.displayName || `User ${userId}`;
        const defaultUser = {
            id: userId,
            email: partialUser.email || `${userId}@test.com`,
            displayName,
            role: partialUser.role || 'system_user',
            createdAt: now,
            updatedAt: now,
            ...partialUser,
        };

        // Remove displayName before storing in Firestore (it belongs in Auth, not Firestore)
        const { displayName: _omitted, id: _omittedId, ...firestoreUser } = defaultUser;

        this.db.seed(`users/${userId}`, firestoreUser);

        // Return the full object including displayName for Auth service mocks
        return defaultUser;
    }
    /**
     * Creates an admin user via API (register + promote to admin)
     * This replaces seedAdminUser to avoid direct database seeding
     */
    async createAdminUser(): Promise<{ userId: UserId; token: AuthToken; }> {
        const registration = new UserRegistrationBuilder().build();

        const result = await this.registerUser(registration);
        const uid = result.user.uid;

        await this.promoteUserToAdmin(uid);

        return {
            userId: uid,
            token: uid as string,
        };
    }

    /**
     * Creates a standard set of test users for common test scenarios.
     * Replaces repetitive beforeEach user registration boilerplate.
     *
     * @param options Configuration for test users
     * @returns Object containing created user IDs
     *
     * @example
     * // Most common: 3 users + admin
     * const { users, admin } = await appDriver.createTestUsers({ count: 3, includeAdmin: true });
     * [user1, user2, user3] = users;
     * adminUser = admin!;
     *
     * @example
     * // Simple: 2 users, no admin
     * const { users } = await appDriver.createTestUsers({ count: 2 });
     * [user1, user2] = users;
     */
    async createTestUsers(options: {
        count: number;
        includeAdmin?: boolean;
    }): Promise<{ users: UserId[]; emails: string[]; password: string; admin?: UserId; adminEmail?: string; }> {
        // Auto-seed localhost tenant for registration (idempotent - safe to call multiple times)
        this.seedLocalhostTenant();

        const users: UserId[] = [];
        const emails: string[] = [];
        const password = 'password12345';
        // Use unique suffix to avoid conflicts when called multiple times in same test
        const uniqueSuffix = Math.random().toString(36).substr(2, 6);

        // Create regular users
        for (let i = 0; i < options.count; i++) {
            const userNum = i + 1;
            const displayNames = ['one', 'two', 'three', 'four'];
            const displayName = userNum <= 4 ? displayNames[userNum - 1] : `${userNum}`;
            const email = `user${userNum}-${uniqueSuffix}@example.com`;

            const registration = new UserRegistrationBuilder()
                .withEmail(email)
                .withDisplayName(`User ${displayName}`)
                .withPassword(password)
                .build();

            const result = await this.registerUser(registration);
            const userId = toUserId(result.user.uid);
            users.push(userId);
            emails.push(email);
            // Mark as email verified so tests can perform write operations
            await this.markEmailVerified(userId);
        }

        // Create admin if requested
        let admin: UserId | undefined;
        let adminEmail: string | undefined;
        if (options.includeAdmin) {
            adminEmail = `admin-${uniqueSuffix}@example.com`;
            const adminReg = new UserRegistrationBuilder()
                .withEmail(adminEmail)
                .withDisplayName('Admin User')
                .withPassword(password)
                .build();
            const adminResult = await this.registerUser(adminReg);
            admin = toUserId(adminResult.user.uid);
            this.seedAdminUser(admin);
            // Mark admin as email verified
            await this.markEmailVerified(admin);
        }

        return { users, emails, password, admin, adminEmail };
    }

    dispose() {
    }

    async listGroups(options: ListGroupsOptions = {}, authToken: AuthToken) {
        const req = createStubRequest(authToken, {});
        const query: Record<string, string> = {};

        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor) {
            query.cursor = options.cursor;
        }
        if (options.order) {
            query.order = options.order;
        }
        if (options.includeMetadata !== undefined) {
            query.includeMetadata = String(options.includeMetadata);
        }
        if (options.statusFilter) {
            query.statusFilter = Array.isArray(options.statusFilter) ? options.statusFilter.join(',') : options.statusFilter;
        }

        req.query = query;
        const res = await this.dispatchByHandler('listGroups', req);
        this.throwIfError(res);
        return res.getJson() as ListGroupsResponse;
    }

    async getGroupFullDetails(groupId: GroupId | string, options: GetGroupFullDetailsOptions = {}, authToken: AuthToken) {
        const req = createStubRequest(authToken, {}, { groupId });
        const query: Record<string, string> = {};

        if (options.expenseLimit !== undefined) {
            query.expenseLimit = String(options.expenseLimit);
        }
        if (options.expenseCursor) {
            query.expenseCursor = options.expenseCursor;
        }
        if (options.includeDeletedExpenses !== undefined) {
            query.includeDeletedExpenses = String(options.includeDeletedExpenses);
        }
        if (options.settlementLimit !== undefined) {
            query.settlementLimit = String(options.settlementLimit);
        }
        if (options.settlementCursor) {
            query.settlementCursor = options.settlementCursor;
        }
        if (options.includeDeletedSettlements !== undefined) {
            query.includeDeletedSettlements = String(options.includeDeletedSettlements);
        }

        req.query = query;
        const res = await this.dispatchByHandler('getGroupFullDetails', req);
        this.throwIfError(res);
        return res.getJson() as GroupFullDetailsDTO;
    }

    async createGroup(groupRequest = new CreateGroupRequestBuilder().build(), authToken: AuthToken) {
        const req = createStubRequest(authToken, groupRequest);
        const res = await this.dispatchByHandler('createGroup', req);
        this.throwIfError(res);
        return res.getJson() as GroupDTO;
    }

    async generateShareableLink(groupId: GroupId | string, expiresAt: ISOString | string | undefined = undefined, authToken: AuthToken): Promise<ShareLinkResponse> {
        const body: Record<string, unknown> = { groupId };
        if (expiresAt) {
            body.expiresAt = expiresAt;
        }

        const req = createStubRequest(authToken, body);
        const res = await this.dispatchByHandler('generateShareableLink', req);
        this.throwIfError(res);
        return res.getJson() as ShareLinkResponse;
    }

    async joinGroupByLink(shareToken: ShareLinkToken | string, groupDisplayName: DisplayName | string | undefined = undefined, authToken: AuthToken): Promise<JoinGroupResponse> {
        const displayName = groupDisplayName || `User ${authToken}`;
        const req = createStubRequest(authToken, { shareToken, groupDisplayName: displayName });
        const res = await this.dispatchByHandler('joinGroupByLink', req);
        this.throwIfError(res);
        return res.getJson() as JoinGroupResponse;
    }

    async previewGroupByLink(shareToken: ShareLinkToken, authToken?: AuthToken): Promise<PreviewGroupResponse> {
        if (!authToken) {
            throw new Error('Auth token is required for previewGroupByLink');
        }

        const req = createStubRequest(authToken, { shareToken });
        const res = await this.dispatchByHandler('previewGroupByLink', req);
        this.throwIfError(res);
        return res.getJson() as PreviewGroupResponse;
    }

    async updateGroup(groupId: GroupId | string, updates: UpdateGroupRequest, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, updates, { groupId });
        const res = await this.dispatchByHandler('updateGroup', req);
        this.throwIfError(res);
    }

    async deleteGroup(groupId: GroupId | string, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, {}, { groupId });
        const res = await this.dispatchByHandler('deleteGroup', req);
        this.throwIfError(res);
    }

    async getGroup(groupId: GroupId | string, authToken: AuthToken): Promise<GroupDTO> {
        const details = await this.getGroupFullDetails(groupId, {}, authToken);
        return details.group;
    }

    async getGroupBalances(groupId: GroupId | string, authToken: AuthToken) {
        const details = await this.getGroupFullDetails(groupId, {}, authToken);
        return details.balances;
    }

    async getGroupExpenses(groupId: GroupId | string, options: GetGroupFullDetailsOptions = {}, authToken: AuthToken) {
        const details = await this.getGroupFullDetails(groupId, options, authToken);
        return details.expenses;
    }

    async leaveGroup(groupId: GroupId | string, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, {}, { groupId });
        const res = await this.dispatchByHandler('leaveGroup', req);
        this.throwIfError(res);
    }

    async removeGroupMember(groupId: GroupId | string, memberId: UserId | string, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, {}, { groupId, memberId });
        const res = await this.dispatchByHandler('removeGroupMember', req);
        this.throwIfError(res);
    }

    async archiveGroupForUser(groupId: GroupId | string, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, {}, { groupId });
        const res = await this.dispatchByHandler('archiveGroupForUser', req);
        this.throwIfError(res);
    }

    async unarchiveGroupForUser(groupId: GroupId | string, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, {}, { groupId });
        const res = await this.dispatchByHandler('unarchiveGroupForUser', req);
        this.throwIfError(res);
    }

    async updateGroupMemberDisplayName(groupId: GroupId | string, displayName: DisplayName | string, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, { displayName }, { groupId });
        const res = await this.dispatchByHandler('updateGroupMemberDisplayName', req);
        this.throwIfError(res);
    }

    async updateGroupPermissions(groupId: GroupId | string, updates: Partial<GroupPermissions>, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, updates, { groupId });
        const res = await this.dispatchByHandler('updateGroupPermissions', req);
        this.throwIfError(res);
    }

    async getPendingMembers(groupId: GroupId | string, authToken: AuthToken): Promise<GroupMembershipDTO[]> {
        const req = createStubRequest(authToken, {}, { groupId });
        const res = await this.dispatchByHandler('getPendingMembers', req);
        this.throwIfError(res);
        return res.getJson() as GroupMembershipDTO[];
    }

    async updateMemberRole(groupId: GroupId | string, memberId: UserId, role: MemberRole, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, { role }, { groupId, memberId });
        const res = await this.dispatchByHandler('updateMemberRole', req);
        this.throwIfError(res);
    }

    async approveMember(groupId: GroupId | string, memberId: UserId, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, {}, { groupId, memberId });
        const res = await this.dispatchByHandler('approveMember', req);
        this.throwIfError(res);
    }

    async rejectMember(groupId: GroupId | string, memberId: UserId, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, {}, { groupId, memberId });
        const res = await this.dispatchByHandler('rejectMember', req);
        this.throwIfError(res);
    }

    async createExpense(expenseRequest: CreateExpenseRequest, authToken: AuthToken): Promise<ExpenseDTO> {
        const req = createStubRequest(authToken, expenseRequest);
        const res = await this.dispatchByHandler('createExpense', req);
        this.throwIfError(res);
        return res.getJson() as ExpenseDTO;
    }

    async updateExpense(expenseId: ExpenseId | string, data: UpdateExpenseRequest, authToken: AuthToken): Promise<ExpenseDTO> {
        const req = createStubRequest(authToken, data);
        req.query = { id: expenseId };
        const res = await this.dispatchByHandler('updateExpense', req);
        this.throwIfError(res);
        return res.getJson() as ExpenseDTO;
    }

    async deleteExpense(expenseId: ExpenseId | string, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, {});
        req.query = { id: expenseId };
        const res = await this.dispatchByHandler('deleteExpense', req);
        this.throwIfError(res);
    }

    async getExpense(expenseId: ExpenseId | string, authToken: AuthToken): Promise<ExpenseDTO> {
        const fullDetails = await this.getExpenseFullDetails(expenseId, authToken);
        return fullDetails.expense;
    }

    async getExpenseFullDetails(expenseId: ExpenseId | string, authToken: AuthToken) {
        const req = createStubRequest(authToken, {}, { expenseId });
        const res = await this.dispatchByHandler('getExpenseFullDetails', req);
        this.throwIfError(res);
        return res.getJson() as ExpenseFullDetailsDTO;
    }

    /**
     * Direct database access to get an expense by ID, including deleted/superseded expenses.
     * This bypasses the API layer and reads directly from the stub database.
     * Useful for testing edit history (supersededBy) functionality.
     */
    async getExpenseById(expenseId: ExpenseId | string): Promise<ExpenseDTO> {
        const firestoreReader = new FirestoreReader(this.db);
        const expense = await firestoreReader.getExpense(
            typeof expenseId === 'string' ? expenseId as ExpenseId : expenseId,
            { includeSoftDeleted: true },
        );
        if (!expense) {
            throw new Error(`Expense not found: ${expenseId}`);
        }
        return expense;
    }

    /**
     * Direct database access to get a settlement by ID, including deleted/superseded settlements.
     * This bypasses the API layer and reads directly from the stub database.
     * Useful for testing edit history (supersededBy) functionality.
     */
    async getSettlementById(settlementId: SettlementId | string): Promise<SettlementDTO> {
        const firestoreReader = new FirestoreReader(this.db);
        const settlement = await firestoreReader.getSettlement(
            typeof settlementId === 'string' ? settlementId as SettlementId : settlementId,
            { includeSoftDeleted: true },
        );
        if (!settlement) {
            throw new Error(`Settlement not found: ${settlementId}`);
        }
        return settlement;
    }

    /**
     * Direct database access to get a user document by ID.
     * This bypasses the API layer and reads directly from the stub database.
     * Useful for verifying internal fields like signupTenantId that aren't exposed via API.
     */
    async getUserDocumentById(userId: UserId | string): Promise<UserDocument> {
        const firestoreReader = new FirestoreReader(this.db);
        const user = await firestoreReader.getUser(
            typeof userId === 'string' ? toUserId(userId) : userId,
        );
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }
        return user;
    }

    async listGroupExpenses(groupId: GroupId | string, options: ListExpensesOptions = {}, authToken: AuthToken): Promise<ListExpensesResponse> {
        const req = createStubRequest(authToken, {}, { groupId });
        const query: Record<string, string> = {};
        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor !== undefined) {
            query.cursor = options.cursor;
        }
        if (options.includeDeleted !== undefined) {
            query.includeDeleted = String(options.includeDeleted);
        }
        req.query = query;
        const res = await this.dispatchByHandler('listGroupExpenses', req);
        this.throwIfError(res);
        return res.getJson() as ListExpensesResponse;
    }
    async createSettlement(data: CreateSettlementRequest, authToken: AuthToken): Promise<SettlementDTO> {
        const req = createStubRequest(authToken, data);
        const res = await this.dispatchByHandler('createSettlement', req);
        this.throwIfError(res);
        return res.getJson() as SettlementDTO;
    }

    async updateSettlement(settlementId: SettlementId | string, data: UpdateSettlementRequest, authToken: AuthToken): Promise<SettlementWithMembers> {
        const req = createStubRequest(authToken, data, { settlementId });
        const res = await this.dispatchByHandler('updateSettlement', req);
        this.throwIfError(res);
        return res.getJson() as SettlementWithMembers;
    }

    async deleteSettlement(settlementId: SettlementId | string, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, {}, { settlementId });
        const res = await this.dispatchByHandler('deleteSettlement', req);
        this.throwIfError(res);
    }

    // Reaction operations - these are stubs that will be implemented when handlers are added
    async toggleExpenseReaction(expenseId: ExpenseId | string, emoji: ReactionEmoji, authToken: AuthToken): Promise<ReactionToggleResponse> {
        const req = createStubRequest(authToken, { emoji }, { expenseId });
        const res = await this.dispatchByHandler('toggleExpenseReaction', req);
        this.throwIfError(res);
        return res.getJson() as ReactionToggleResponse;
    }

    async toggleGroupCommentReaction(groupId: GroupId | string, commentId: CommentId | string, emoji: ReactionEmoji, authToken: AuthToken): Promise<ReactionToggleResponse> {
        const req = createStubRequest(authToken, { emoji }, { groupId, commentId });
        const res = await this.dispatchByHandler('toggleGroupCommentReaction', req);
        this.throwIfError(res);
        return res.getJson() as ReactionToggleResponse;
    }

    async toggleExpenseCommentReaction(expenseId: ExpenseId | string, commentId: CommentId | string, emoji: ReactionEmoji, authToken: AuthToken): Promise<ReactionToggleResponse> {
        const req = createStubRequest(authToken, { emoji }, { expenseId, commentId });
        const res = await this.dispatchByHandler('toggleExpenseCommentReaction', req);
        this.throwIfError(res);
        return res.getJson() as ReactionToggleResponse;
    }

    async toggleSettlementReaction(settlementId: SettlementId | string, emoji: ReactionEmoji, authToken: AuthToken): Promise<ReactionToggleResponse> {
        const req = createStubRequest(authToken, { emoji }, { settlementId });
        const res = await this.dispatchByHandler('toggleSettlementReaction', req);
        this.throwIfError(res);
        return res.getJson() as ReactionToggleResponse;
    }

    async listGroupSettlements(groupId: GroupId | string, options: ListSettlementsOptions = {}, authToken: AuthToken): Promise<ListSettlementsResponse> {
        const req = createStubRequest(authToken, {}, { groupId });
        const query: Record<string, string> = {};
        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor !== undefined) {
            query.cursor = options.cursor;
        }
        if (options.includeDeleted !== undefined) {
            query.includeDeleted = String(options.includeDeleted);
        }
        req.query = query;
        const res = await this.dispatchByHandler('listGroupSettlements', req);
        this.throwIfError(res);
        return res.getJson() as ListSettlementsResponse;
    }

    async getSettlement(groupId: GroupId | string, settlementId: SettlementId | string, authToken: AuthToken): Promise<SettlementWithMembers> {
        let fullDetails;

        try {
            fullDetails = await this.getGroupFullDetails(groupId, {}, authToken);
        } catch (error: any) {
            // If getGroupFullDetails fails, it means the user can't access the group
            // This should be treated as NOT_GROUP_MEMBER regardless of the specific error code
            if (
                error.status === 403 || error.status === 404
                || (error.message && (error.message.includes('Group not found') || error.message.includes('403')))
            ) {
                const groupError = new Error(`Group access denied`);
                (groupError as any).status = 403;
                (groupError as any).message = 'status 403: NOT_GROUP_MEMBER';
                throw groupError;
            }

            // Re-throw other errors as-is
            throw error;
        }

        // At this point, we have group access, so check if settlement exists
        const settlement = fullDetails.settlements.settlements.find((s: any) => s.id === settlementId);

        if (!settlement) {
            // Create an error object with status and message properties to match expected test behavior
            const error = new Error(`Settlement not found`);
            (error as any).status = 404;
            (error as any).message = 'status 404: SETTLEMENT_NOT_FOUND';
            throw error;
        }

        return settlement;
    }

    async createGroupComment(groupId: GroupId | string, text: CommentText | string, attachmentIds?: AttachmentId[], authToken?: AuthToken): Promise<CommentDTO> {
        const req = createStubRequest(authToken || '', { text, attachmentIds }, { groupId });
        const res = await this.dispatchByHandler('createComment', req);
        this.throwIfError(res);
        return res.getJson() as CommentDTO;
    }

    async listGroupComments(groupId: GroupId | string, options: ListCommentsOptions = {}, authToken: AuthToken): Promise<ListCommentsResponse> {
        const req = createStubRequest(authToken, {}, { groupId });
        const query: Record<string, string> = {};
        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor !== undefined) {
            query.cursor = options.cursor;
        }
        req.query = query;
        const res = await this.dispatchByHandler('listGroupComments', req);
        this.throwIfError(res);
        return res.getJson() as ListCommentsResponse;
    }

    async createExpenseComment(expenseId: ExpenseId | string, text: CommentText | string, attachmentIds?: AttachmentId[], authToken?: AuthToken): Promise<CommentDTO> {
        const req = createStubRequest(authToken || '', { text, attachmentIds }, { expenseId });
        const res = await this.dispatchByHandler('createCommentForExpense', req);
        this.throwIfError(res);
        return res.getJson() as CommentDTO;
    }

    async listExpenseComments(expenseId: ExpenseId | string, options: ListCommentsOptions = {}, authToken: AuthToken): Promise<ListCommentsResponse> {
        const req = createStubRequest(authToken, {}, { expenseId });
        const query: Record<string, string> = {};
        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor !== undefined) {
            query.cursor = options.cursor;
        }
        req.query = query;
        const res = await this.dispatchByHandler('listExpenseComments', req);
        this.throwIfError(res);
        return res.getJson() as ListCommentsResponse;
    }

    async deleteGroupComment(groupId: GroupId | string, commentId: CommentId | string, authToken?: AuthToken): Promise<void> {
        const req = createStubRequest(authToken || '', {}, { groupId, commentId });
        const res = await this.dispatchByHandler('deleteGroupComment', req);
        this.throwIfError(res);
    }

    async deleteExpenseComment(expenseId: ExpenseId | string, commentId: CommentId | string, authToken?: AuthToken): Promise<void> {
        const req = createStubRequest(authToken || '', {}, { expenseId, commentId });
        const res = await this.dispatchByHandler('deleteExpenseComment', req);
        this.throwIfError(res);
    }

    // Attachment methods - implemented in Phase 2
    async uploadAttachment(
        groupId: GroupId | string,
        type: 'receipt' | 'comment',
        file: File | Buffer,
        contentType: string,
        authToken?: AuthToken,
        fileName = 'attachment.bin',
    ): Promise<UploadAttachmentResponse> {
        const req = createStubRequest(authToken || '', file as any, { groupId }, {
            headers: {
                'content-type': contentType,
                'x-file-name': fileName,
            },
        });
        req.query = { type };
        req.body = file as Buffer;
        const res = await this.dispatchByHandler('uploadAttachment', req);
        this.throwIfError(res);
        return res.getJson() as UploadAttachmentResponse;
    }

    async getAttachment(groupId: GroupId | string, attachmentId: AttachmentId | string, authToken: AuthToken) {
        const req = createStubRequest(authToken, {}, { groupId, attachmentId });
        const res = await this.dispatchByHandler('getAttachment', req);
        this.throwIfError(res);
        return {
            body: res.getBody() as Buffer,
            contentType: res.getContentType(),
        };
    }

    async deleteAttachment(groupId: GroupId | string, attachmentId: AttachmentId | string, authToken?: AuthToken): Promise<void> {
        const req = createStubRequest(authToken || '', {}, { groupId, attachmentId });
        const res = await this.dispatchByHandler('deleteAttachment', req);
        this.throwIfError(res);
    }

    async getUserProfile(authToken: AuthToken): Promise<UserProfileResponse> {
        const req = createStubRequest(authToken, {});
        const res = await this.dispatchByHandler('getUserProfile', req);
        this.throwIfError(res);
        return res.getJson() as UserProfileResponse;
    }

    async updateUserProfile(updateRequest: UpdateUserProfileRequest, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, updateRequest);
        const res = await this.dispatchByHandler('updateUserProfile', req);
        this.throwIfError(res);
    }

    async changePassword(passwordRequest: PasswordChangeRequest, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, passwordRequest);
        const res = await this.dispatchByHandler('changePassword', req);
        this.throwIfError(res);
    }

    async changeEmail(changeEmailRequest: ChangeEmailRequest, authToken: AuthToken): Promise<void> {
        const req = createStubRequest(authToken, changeEmailRequest);
        const res = await this.dispatchByHandler('changeEmail', req);
        this.throwIfError(res);
    }

    // ===== MERGE API =====

    async initiateMerge(body: InitiateMergeRequest, authToken: AuthToken): Promise<InitiateMergeResponse> {
        const req = createStubRequest(authToken, body);
        const res = await this.dispatchByHandler('initiateMerge', req);
        return res.getJson() as InitiateMergeResponse;
    }

    async getMergeStatus(jobId: string, authToken: AuthToken): Promise<MergeJobResponse> {
        const req = createStubRequest(authToken, {}, { jobId });
        const res = await this.dispatchByHandler('getMergeStatus', req);
        return res.getJson() as MergeJobResponse;
    }

    // ===== URL UTILITIES =====

    async resolveRedirect(request: ResolveRedirectRequest, authToken: AuthToken): Promise<ResolveRedirectResponse> {
        const req = createStubRequest(authToken, request);
        const res = await this.dispatchByHandler('resolveRedirect', req);
        this.throwIfError(res);
        return res.getJson() as ResolveRedirectResponse;
    }

    async processMergeTask(jobId: string, authToken?: AuthToken): Promise<any> {
        const req = createStubRequest(authToken || '', { jobId });
        const res = await this.dispatchByHandler('processMergeTask', req);
        return res.getJson();
    }

    // ===== ADMIN API: USER MANAGEMENT =====

    async updateUser(uid: UserId, updates: UpdateUserStatusRequest, token?: AuthToken): Promise<void> {
        const req = createStubRequest(token || '', updates, { userId: uid });
        const res = await this.dispatchByHandler('updateUserAdmin', req);
        this.throwIfError(res);
    }

    async updateUserRole(uid: UserId, updates: UpdateUserRoleRequest, token?: AuthToken): Promise<void> {
        const req = createStubRequest(token || '', updates, { userId: uid });
        const res = await this.dispatchByHandler('updateUserRoleAdmin', req);
        this.throwIfError(res);
    }

    async updateUserProfileAdmin(uid: UserId, updates: UpdateUserProfileAdminRequest, token?: AuthToken): Promise<void> {
        const req = createStubRequest(token || '', updates, { userId: uid });
        const res = await this.dispatchByHandler('updateUserProfileAdmin', req);
        this.throwIfError(res);
    }

    async getUserAuth(uid: UserId, token?: AuthToken): Promise<any> {
        const req = createStubRequest(token || '', {}, { userId: uid });
        const res = await this.dispatchByHandler('getUserAuth', req);
        this.throwIfError(res);
        return res.getJson();
    }

    async getUserFirestore(uid: UserId, token?: AuthToken): Promise<any> {
        const req = createStubRequest(token || '', {}, { userId: uid });
        const res = await this.dispatchByHandler('getUserFirestore', req);
        this.throwIfError(res);
        return res.getJson();
    }

    async promoteUserToAdmin(uid: UserId): Promise<void> {
        const req = createStubRequest('', { uid });
        await this.dispatchByHandler('promoteTestUserToAdmin', req);
    }

    async register(userData: UserRegistration): Promise<RegisterResponse> {
        // Auto-seed localhost tenant for registration if no tenant exists yet.
        // This is idempotent - skipped if tenant already exists (e.g., test has custom tenant setup).
        this.seedLocalhostTenant();
        const req = createStubRequest('', userData);
        const res = await this.dispatchByHandler('register', req);
        this.throwIfError(res);
        const response = res.getJson() as RegisterResponse;
        // Auto-verify email so tests can perform write operations without extra setup
        await this.markEmailVerified(response.user.uid);
        return response;
    }

    async registerWithOptions(userData: UserRegistration, options: Partial<StubRequestOptions>): Promise<RegisterResponse> {
        const req = createStubRequest('', userData, {}, options);
        const res = await this.dispatchByHandler('register', req);
        this.throwIfError(res);
        const response = res.getJson() as RegisterResponse;
        // Auto-verify email so tests can perform write operations without extra setup
        await this.markEmailVerified(response.user.uid);
        return response;
    }

    async login(credentials: LoginRequest): Promise<LoginResponse> {
        const req = createStubRequest('', credentials);
        const res = await this.dispatchByHandler('login', req);
        this.throwIfError(res);
        return res.getJson() as LoginResponse;
    }

    async sendPasswordResetEmail(request: PasswordResetRequest): Promise<void> {
        const req = createStubRequest('', request, {}, {});
        const res = await this.dispatchByHandler('sendPasswordResetEmail', req);
        this.throwIfError(res);
    }

    async sendPasswordResetEmailWithOptions(request: PasswordResetRequest, options: Partial<StubRequestOptions>): Promise<void> {
        const req = createStubRequest('', request, {}, options);
        const res = await this.dispatchByHandler('sendPasswordResetEmail', req);
        this.throwIfError(res);
    }

    async sendEmailVerification(request: EmailVerificationRequest): Promise<void> {
        const req = createStubRequest('', request, {}, {});
        const res = await this.dispatchByHandler('sendEmailVerification', req);
        this.throwIfError(res);
    }

    /** @deprecated Use register() instead */
    async registerUser(registration: UserRegistration): Promise<RegisterUserResult> {
        return this.register(registration);
    }

    /**
     * Register a user WITHOUT auto-verifying their email.
     * Use this only for tests that specifically test unverified user behavior.
     */
    async registerUnverified(userData: UserRegistration): Promise<RegisterResponse> {
        this.seedLocalhostTenant();
        const req = createStubRequest('', userData);
        const res = await this.dispatchByHandler('register', req);
        this.throwIfError(res);
        return res.getJson() as RegisterResponse;
    }

    // ===== ADMIN API: POLICY MANAGEMENT =====

    async createPolicy(request: CreatePolicyRequest, token: AuthToken): Promise<CreatePolicyResponse> {
        const req = createStubRequest(token, request);
        const res = await this.dispatchByHandler('createPolicy', req);
        this.throwIfError(res);
        return res.getJson() as CreatePolicyResponse;
    }

    async listPolicies(token: AuthToken): Promise<ListPoliciesResponse> {
        const req = createStubRequest(token, {});
        const res = await this.dispatchByHandler('listPolicies', req);
        return res.getJson() as ListPoliciesResponse;
    }

    /**
     * Helper method to get a single policy by ID with all its versions.
     * Not part of the AdminAPI interface - used internally by tests.
     */
    async getPolicy(policyId: PolicyId, token: AuthToken): Promise<PolicyDTO> {
        const response = await this.listPolicies(token);
        const policy = response.policies.find(p => p.id === policyId);
        if (!policy) {
            throw new Error(`Policy not found: ${policyId}`);
        }
        return policy;
    }

    async getPolicyVersion(policyId: PolicyId, versionHash: VersionHash, token: AuthToken): Promise<PolicyVersion & { versionHash: VersionHash; }> {
        const req = createStubRequest(token, {}, { policyId, hash: versionHash });
        const res = await this.dispatchByHandler('getPolicyVersion', req);
        this.throwIfError(res);
        return res.getJson() as PolicyVersion & { versionHash: VersionHash; };
    }

    async updatePolicy(policyId: PolicyId, request: UpdatePolicyRequest, token: AuthToken): Promise<UpdatePolicyResponse> {
        const req = createStubRequest(token, request, { policyId });
        const res = await this.dispatchByHandler('updatePolicy', req);
        this.throwIfError(res);
        return res.getJson() as UpdatePolicyResponse;
    }

    async publishPolicy(policyId: PolicyId, versionHash: VersionHash, token: AuthToken): Promise<PublishPolicyResponse> {
        const req = createStubRequest(token, { versionHash }, { policyId });
        const res = await this.dispatchByHandler('publishPolicy', req);
        this.throwIfError(res);
        return res.getJson() as PublishPolicyResponse;
    }

    async deletePolicyVersion(policyId: PolicyId, versionHash: VersionHash, token: AuthToken): Promise<DeletePolicyVersionResponse> {
        const req = createStubRequest(token, {}, { policyId, hash: versionHash });
        const res = await this.dispatchByHandler('deletePolicyVersion', req);
        this.throwIfError(res);
        return res.getJson() as DeletePolicyVersionResponse;
    }

    async getCurrentPolicy(policyId: PolicyId): Promise<CurrentPolicyResponse> {
        const req = createStubRequest('', {}, { policyId });
        const res = await this.dispatchByHandler('getCurrentPolicy', req);
        this.throwIfError(res);
        return res.getJson() as CurrentPolicyResponse;
    }

    async acceptMultiplePolicies(acceptances: AcceptPolicyRequest[], authToken: AuthToken): Promise<AcceptMultiplePoliciesResponse> {
        const req = createStubRequest(authToken, { acceptances });
        const res = await this.dispatchByHandler('acceptMultiplePolicies', req);
        this.throwIfError(res);
        return res.getJson() as AcceptMultiplePoliciesResponse;
    }

    async getUserPolicyStatus(authToken: AuthToken): Promise<UserPolicyStatusResponse> {
        const req = createStubRequest(authToken, {});
        const res = await this.dispatchByHandler('getUserPolicyStatus', req);
        this.throwIfError(res);
        return res.getJson() as UserPolicyStatusResponse;
    }

    async getConfig(): Promise<ClientAppConfiguration> {
        const req = createStubRequest('', {});
        const res = await this.dispatchByHandler('getConfig', req);
        return res.getJson() as ClientAppConfiguration;
    }

    async getBootstrapConfig(): Promise<ClientAppConfiguration> {
        const req = createStubRequest('', {});
        const res = await this.dispatchByHandler('getBootstrapConfig', req);
        return res.getJson() as ClientAppConfiguration;
    }

    async getHealth(): Promise<HealthResponse> {
        const req = createStubRequest('', {});
        const res = await this.dispatchByHandler('getHealth', req);
        return res.getJson() as HealthResponse;
    }

    async getPrivacyPolicy(options: { host?: string; } = {}): Promise<string> {
        const req = createStubRequest('', {}, {}, {
            headers: options.host ? { host: options.host } : {},
            hostname: options.host ?? 'localhost',
        });
        const res = await this.dispatchByHandler('getPrivacyPolicyText', req);
        this.throwIfError(res);
        return res.getBody() as string;
    }

    async getTermsOfService(options: { host?: string; } = {}): Promise<string> {
        const req = createStubRequest('', {}, {}, {
            headers: options.host ? { host: options.host } : {},
            hostname: options.host ?? 'localhost',
        });
        const res = await this.dispatchByHandler('getTermsOfServiceText', req);
        this.throwIfError(res);
        return res.getBody() as string;
    }

    async getCookiePolicy(options: { host?: string; } = {}): Promise<string> {
        const req = createStubRequest('', {}, {}, {
            headers: options.host ? { host: options.host } : {},
            hostname: options.host ?? 'localhost',
        });
        const res = await this.dispatchByHandler('getCookiePolicyText', req);
        this.throwIfError(res);
        return res.getBody() as string;
    }

    async getActivityFeed(options: GetActivityFeedOptions = {}, authToken: AuthToken): Promise<ActivityFeedResponse> {
        const req = createStubRequest(authToken, {});
        const query: Record<string, string> = {};

        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor !== undefined) {
            query.cursor = options.cursor;
        }

        req.query = query;
        const res = await this.dispatchByHandler('getActivityFeed', req);
        this.throwIfError(res);
        return res.getJson() as ActivityFeedResponse;
    }

    async getGroupActivityFeed(groupId: GroupId, options: GetActivityFeedOptions = {}, authToken: AuthToken): Promise<ActivityFeedResponse> {
        const req = createStubRequest(authToken, {}, { groupId });
        const query: Record<string, string> = {};

        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor !== undefined) {
            query.cursor = options.cursor;
        }

        req.query = query;
        const res = await this.dispatchByHandler('getGroupActivityFeed', req);
        this.throwIfError(res);
        return res.getJson() as ActivityFeedResponse;
    }

    // =============================================================================
    // Test Helper Methods
    // These methods directly access the database for test assertions and setup.
    // They do NOT go through the HTTP handler layer.
    // =============================================================================

    /**
     * Test helper - directly reads activity feed items from database for assertions
     */
    // TODO: Replace direct DB read with getActivityFeed API usage in tests if real-time ordering is not required.
    async getActivityFeedItems(userId: UserId) {
        const snapshot = await this.db.collection('activity-feed').doc(userId).collection('items').get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    /**
     * Test helper - verifies that expected activity feed events were created
     */
    // TODO: Migrate expectation checks to assert against handler responses instead of raw DB state.
    async expectNotificationUpdate(
        userId: UserId,
        groupId: GroupId | string,
        expectedChanges: {
            transactionChangeCount?: number;
            balanceChangeCount?: number;
            groupDetailsChangeCount?: number;
            commentChangeCount?: number;
        },
    ) {
        const items = await this.getActivityFeedItems(userId);

        const expectations: Array<[keyof typeof expectedChanges, ActivityFeedEventType[]]> = [
            [
                'transactionChangeCount',
                [
                    ActivityFeedEventTypes.EXPENSE_CREATED,
                    ActivityFeedEventTypes.EXPENSE_UPDATED,
                    ActivityFeedEventTypes.EXPENSE_DELETED,
                ],
            ],
            [
                'balanceChangeCount',
                [
                    ActivityFeedEventTypes.SETTLEMENT_CREATED,
                    ActivityFeedEventTypes.SETTLEMENT_UPDATED,
                ],
            ],
            [
                'groupDetailsChangeCount',
                [
                    ActivityFeedEventTypes.GROUP_CREATED,
                    ActivityFeedEventTypes.GROUP_UPDATED,
                    ActivityFeedEventTypes.MEMBER_JOINED,
                    ActivityFeedEventTypes.MEMBER_LEFT,
                ],
            ],
            ['commentChangeCount', [ActivityFeedEventTypes.COMMENT_ADDED]],
        ];

        for (const [field, eventTypes] of expectations) {
            const expected = expectedChanges[field];
            if (expected === undefined || expected <= 0) {
                continue;
            }

            const match = items.some((item) => item.groupId === groupId && eventTypes.includes(item.eventType));
            if (!match) {
                console.error('Activity feed items', items.map((item) => ({ eventType: item.eventType, groupId: item.groupId })));
            }
            expect(match, `Expected activity feed event ${eventTypes.join(', ')} for group ${groupId}`).toBe(true);
        }
    }

    /**
     * Test helper - convenience function for adding multiple members to a group
     */
    async addMembersToGroup(groupId: GroupId | string, ownerUserId: UserId | string, memberUserIds: string[] | UserId[]) {
        const shareLink = await this.generateShareableLink(groupId, undefined, ownerUserId);
        for (const userId of memberUserIds) {
            await this.joinGroupByLink(shareLink.shareToken, undefined, userId);
        }
    }

    /**
     * Test helper - subscribe to group comments via the underlying stub database.
     * Returns an unsubscribe function mirroring Firestore's onSnapshot behaviour.
     */
    watchGroupComments(
        groupId: GroupId | string,
        onChange: (comments: Array<{ id: string; [key: string]: unknown; }>) => void,
        options: { order?: 'asc' | 'desc'; limit?: number; } = {},
    ): () => void {
        let query = this
            .db
            .collection(`groups/${groupId}/comments`)
            .orderBy('createdAt', options.order ?? 'desc');

        if (typeof options.limit === 'number') {
            query = query.limit(options.limit);
        }

        return query.onSnapshot((snapshot) => {
            const comments = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            onChange(comments);
        });
    }

    /**
     * Test helper - fetches a comment snapshot mirroring a Firestore query.
     */
    // TODO: Prefer listGroupComments handler where suitable once tests can assert via API responses.
    async getGroupCommentSnapshot(
        groupId: GroupId | string,
        options: { order?: 'asc' | 'desc'; limit?: number; } = {},
    ): Promise<Array<{ id: string; [key: string]: unknown; }>> {
        let query = this
            .db
            .collection(`groups/${groupId}/comments`)
            .orderBy('createdAt', options.order ?? 'desc');

        if (typeof options.limit === 'number') {
            query = query.limit(options.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
    }

    // ===== ADMIN API: USER/TENANT BROWSING =====

    async listAuthUsers(options: ListAuthUsersOptions = {}, token?: AuthToken): Promise<ListAuthUsersResponse> {
        const req = createStubRequest(token || '', {});
        const query: Record<string, string | number> = {};
        if (options.limit !== undefined) {
            query.limit = options.limit;
        }
        if (options.pageToken) {
            query.pageToken = options.pageToken;
        }
        if (options.email) {
            query.email = options.email;
        }
        if (options.uid) {
            query.uid = options.uid;
        }

        req.query = query;
        const res = await this.dispatchByHandler('listAuthUsers', req);
        return res.getJson() as ListAuthUsersResponse;
    }

    async listFirestoreUsers(options: ListFirestoreUsersOptions = {}, token?: AuthToken): Promise<ListFirestoreUsersResponse> {
        const req = createStubRequest(token || '', {});
        const query: Record<string, string | number> = {};
        if (options.limit !== undefined) {
            query.limit = options.limit;
        }
        if (options.cursor) {
            query.cursor = options.cursor;
        }
        if (options.email) {
            query.email = options.email;
        }
        if (options.uid) {
            query.uid = options.uid;
        }
        if (options.displayName) {
            query.displayName = options.displayName;
        }

        req.query = query;
        const res = await this.dispatchByHandler('listFirestoreUsers', req);
        return res.getJson() as ListFirestoreUsersResponse;
    }

    async listAllTenants(token?: AuthToken): Promise<ListAllTenantsResponse> {
        const req = createStubRequest(token || '', {});
        const res = await this.dispatchByHandler('listAllTenants', req);
        this.throwIfError(res);
        return res.getJson() as ListAllTenantsResponse;
    }

    // ===== ADMIN API: TENANT MANAGEMENT =====

    async adminUpsertTenant(request: AdminUpsertTenantRequest, token: AuthToken): Promise<AdminUpsertTenantResponse> {
        const req = createStubRequest(token, request);
        const res = await this.dispatchByHandler('adminUpsertTenant', req);
        this.throwIfError(res);
        return res.getJson() as AdminUpsertTenantResponse;
    }

    async publishTenantTheme(request: PublishTenantThemeRequest, token: AuthToken): Promise<PublishTenantThemeResponse> {
        const req = createStubRequest(token, request);
        const res = await this.dispatchByHandler('publishTenantTheme', req);
        this.throwIfError(res);
        return res.getJson() as PublishTenantThemeResponse;
    }

    async uploadTenantImage(tenantId: string, assetType: 'logo' | 'favicon', file: Buffer, contentType: string, token: AuthToken): Promise<{ url: string; }> {
        // Create a special stub request with binary body instead of JSON
        const req = createStubRequest(token, {}, { tenantId, assetType });
        // Set the raw body buffer and content type
        (req as any).body = file;
        if (!req.headers) {
            req.headers = {};
        }
        req.headers['content-type'] = contentType;

        const res = await this.dispatchByHandler('uploadTenantImage', req);
        this.throwIfError(res);
        return res.getJson() as { url: string; };
    }

    // ===== ADMIN API: TENANT SETTINGS =====

    async getTenantSettings(token: AuthToken): Promise<TenantSettingsResponse> {
        const req = createStubRequest(token, {});
        const res = await this.dispatchByHandler('getTenantSettings', req);
        this.throwIfError(res);
        return res.getJson() as TenantSettingsResponse;
    }

    async updateTenantBranding(request: UpdateTenantBrandingRequest, token: AuthToken): Promise<void> {
        const req = createStubRequest(token, request);
        const res = await this.dispatchByHandler('updateTenantBranding', req);
        this.throwIfError(res);
    }

    async getTenantDomains(token: AuthToken): Promise<TenantDomainsResponse> {
        const req = createStubRequest(token, {});
        const res = await this.dispatchByHandler('listTenantDomains', req);
        return res.getJson() as TenantDomainsResponse;
    }

    async addTenantDomain(request: AddTenantDomainRequest, token: AuthToken): Promise<void> {
        const req = createStubRequest(token, request);
        const res = await this.dispatchByHandler('addTenantDomain', req);
        this.throwIfError(res);
    }

    async getEnvironmentDiagnostics(token: AuthToken): Promise<EnvironmentDiagnosticsResponse> {
        const req = createStubRequest(token, {});
        const res = await this.dispatchByHandler('getEnv', req);
        return res.getJson() as EnvironmentDiagnosticsResponse;
    }

    // ===== ADMIN API: TENANT IMAGE LIBRARY =====

    async listTenantImages(tenantId: string, token: AuthToken): Promise<ListTenantImagesResponse> {
        const req = createStubRequest(token, {}, { tenantId });
        const res = await this.dispatchByHandler('listTenantImages', req);
        this.throwIfError(res);
        return res.getJson() as ListTenantImagesResponse;
    }

    async uploadTenantLibraryImage(tenantId: string, name: string, file: Buffer, contentType: string, token: AuthToken): Promise<UploadTenantLibraryImageResponse> {
        const req = createStubRequest(token, {}, { tenantId });
        // Set query param for name
        req.query = { name };
        // Set the raw body buffer and content type
        (req as any).body = file;
        if (!req.headers) {
            req.headers = {};
        }
        req.headers['content-type'] = contentType;

        const res = await this.dispatchByHandler('uploadTenantLibraryImage', req);
        this.throwIfError(res);
        return res.getJson() as UploadTenantLibraryImageResponse;
    }

    async renameTenantImage(tenantId: string, imageId: TenantImageId, request: RenameTenantImageRequest, token: AuthToken): Promise<void> {
        const req = createStubRequest(token, request, { tenantId, imageId });
        const res = await this.dispatchByHandler('renameTenantImage', req);
        this.throwIfError(res);
    }

    async deleteTenantImage(tenantId: string, imageId: TenantImageId, token: AuthToken): Promise<void> {
        const req = createStubRequest(token, {}, { tenantId, imageId });
        const res = await this.dispatchByHandler('deleteTenantImage', req);
        this.throwIfError(res);
    }

    /**
     * Checks if the response contains an error and throws an ApiError if so.
     * Used for void methods that need to properly propagate errors.
     */
    private throwIfError(res: any): void {
        const status = res.getStatus();
        const json = res.getJson();

        if (status && status >= 400 && json?.error) {
            // ApiError constructor: (statusCode, code, data?)
            throw new ApiError(status, json.error.code || 'UNKNOWN_ERROR', json.error);
        }
    }
}
