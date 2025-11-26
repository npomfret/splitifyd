import { StubCloudTasksClient } from '@billsplit-wl/firebase-simulator';
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
    AdminUserProfile,
    API,
    ChangeEmailRequest,
    CommentDTO,
    CommentText,
    CreateExpenseRequest,
    CreatePolicyRequest,
    CreatePolicyResponse,
    CreateSettlementRequest,
    CurrentPolicyResponse,
    DeletePolicyVersionResponse,
    DisplayName,
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
    InitiateMergeRequest,
    InitiateMergeResponse,
    ISOString,
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
    MemberRole,
    MergeJobResponse,
    MessageResponse,
    PasswordChangeRequest,
    PolicyDTO,
    PolicyId,
    PolicyVersion,
    PreviewGroupResponse,
    PublicAPI,
    PublishPolicyResponse,
    PublishTenantThemeRequest,
    PublishTenantThemeResponse,
    SettlementDTO,
    SettlementId,
    SettlementWithMembers,
    ShareLinkResponse,
    ShareLinkToken,
    SystemUserRoles,
    TenantDomainsResponse,
    TenantSettingsResponse,
    TestAPI,
    toUserId,
    UpdateExpenseRequest,
    UpdateGroupRequest,
    UpdatePolicyRequest,
    UpdatePolicyResponse,
    UpdateSettlementRequest,
    UpdateTenantBrandingRequest,
    UpdateUserProfileRequest,
    UpdateUserRoleRequest,
    UpdateUserStatusRequest,
    UserId,
    UserPolicyStatusResponse,
    UserProfileResponse,
    UserRegistration,
    VersionHash,
} from '@billsplit-wl/shared';
import { CreateGroupRequestBuilder, createStubRequest, createStubResponse, StubFirestoreDatabase, StubStorage, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRecord } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { expect } from 'vitest';
import { createRouteDefinitions, RouteDefinition } from '../../routes/route-config';
import { ComponentBuilder } from '../../services/ComponentBuilder';
import { FirestoreReader } from '../../services/firestore';
import { RegisterUserResult } from '../../services/UserService2';
import { Errors, sendError } from '../../utils/errors';
import { createUnitTestServiceConfig } from '../test-config';
import { StubAuthService } from './mocks/StubAuthService';

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

/**
 * Thin façade around the public HTTP handlers.
 * - Uses the same handler classes the Express app wires up.
 * - Seeds data into an in-memory Firestore stub (no emulator required).
 * - Feeds handlers authenticated requests via the stub auth service.
 * - Now includes route-aware dispatch with middleware execution for better test coverage.
 *
 * Tests call into this driver to hit the actual validation/permission logic
 * without needing to spin up the Firebase runtime.
 *
 * DO NOT use for load / concurrency testing - it will not accurately simulate firestore behaviour under load
 *
 * This class implements the operations defined in IApiClient with a UserId-based authentication model.
 * It follows the pattern: method(userId, data) where userId is used for direct database access in tests.
 *
 * @see IApiClient for the complete list of supported operations
 */
type SeedUserData = Omit<Partial<UserRecord>, 'metadata'> & {
    role?: typeof SystemUserRoles[keyof typeof SystemUserRoles];
    metadata?: {
        creationTime: string;
        lastSignInTime?: string;
    };
};

export class AppDriver implements PublicAPI, API<AuthToken>, AdminAPI<AuthToken> {
    private db = new StubFirestoreDatabase();
    private storage = new StubStorage({ defaultBucketName: 'app-driver-test-bucket' });
    private authService = new StubAuthService();
    private cloudTasksClient = new StubCloudTasksClient();
    private routeDefinitions: RouteDefinition[];
    private readonly _componentBuilder: ComponentBuilder;

    constructor() {
        // Create a ComponentBuilder with our test dependencies
        this._componentBuilder = new ComponentBuilder(
            this.authService,
            this.db,
            this.storage,
            this.cloudTasksClient,
            createUnitTestServiceConfig(),
        );

        // Create populated route definitions using the component builder
        this.routeDefinitions = createRouteDefinitions(this._componentBuilder);
    }

    get componentBuilder() {
        return this._componentBuilder;
    }

    get storageStub(): StubStorage {
        return this.storage;
    }

    /**
     * Test-specific middleware that works with stub requests.
     * Unlike production middleware, this doesn't verify tokens - it trusts the user already attached by createStubRequest.
     */
    private createTestMiddleware() {
        const firestoreReader = new FirestoreReader(this.db);

        /**
         * Test authentication middleware - validates user is attached to request
         */
        const authenticate: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            if (!req.user || !req.user.uid) {
                sendError(res as any, Errors.UNAUTHORIZED(), undefined);
                return;
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

            next();
        };

        /**
         * Test admin middleware - checks for admin role
         */
        const requireAdmin: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            if (!req.user) {
                sendError(res as any, Errors.UNAUTHORIZED(), undefined);
                return;
            }

            if (req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
                sendError(res as any, Errors.FORBIDDEN(), undefined);
                return;
            }

            next();
        };

        /**
         * Test system user middleware - checks for system user or admin role
         */
        const requireSystemRole: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            if (!req.user) {
                sendError(res as any, Errors.UNAUTHORIZED(), undefined);
                return;
            }

            if (req.user.role !== SystemUserRoles.SYSTEM_USER && req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
                sendError(res as any, Errors.FORBIDDEN(), undefined);
                return;
            }

            next();
        };

        const authenticateAdmin: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            await authenticate(req, res, async (error?: any) => {
                if (error) {
                    next(error);
                    return;
                }
                await requireAdmin(req, res, next);
            });
        };

        const authenticateSystemUser: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            await authenticate(req, res, async (error?: any) => {
                if (error) {
                    next(error);
                    return;
                }
                await requireSystemRole(req, res, next);
            });
        };

        /**
         * Test tenant admin middleware - checks for tenant admin or system admin role
         */
        const requireTenantAdmin: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            if (!req.user) {
                sendError(res as any, Errors.UNAUTHORIZED(), undefined);
                return;
            }

            if (req.user.role !== SystemUserRoles.TENANT_ADMIN && req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
                sendError(res as any, Errors.FORBIDDEN(), undefined);
                return;
            }

            next();
        };

        const authenticateTenantAdmin: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            await authenticate(req, res, async (error?: any) => {
                if (error) {
                    next(error);
                    return;
                }
                await requireTenantAdmin(req, res, next);
            });
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
        // Provide a no-op next function for Express handlers
        const next = () => {
        };
        await handlerFn(req, res, next);

        return res;
    }

    seedUser(userId: UserId | string, userData: SeedUserData = {}) {
        const user = this._seedUser(userId, userData);

        this.authService.setUser(userId, {
            uid: userId,
            email: user.email,
            displayName: user.displayName,
        });
    }

    /**
     * Marks a user's email as verified in Firebase Auth
     */
    markEmailVerified(userId: UserId | string) {
        const existingUser = (this.authService as any).getUser(userId);
        if (existingUser) {
            this.authService.setUser(userId, {
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
    }): Promise<{ users: UserId[]; admin?: UserId; }> {
        const users: UserId[] = [];

        // Create regular users
        for (let i = 0; i < options.count; i++) {
            const userNum = i + 1;
            const displayNames = ['one', 'two', 'three', 'four'];
            const displayName = userNum <= 4 ? displayNames[userNum - 1] : `${userNum}`;

            const registration = new UserRegistrationBuilder()
                .withEmail(`user${userNum}@example.com`)
                .withDisplayName(`User ${displayName}`)
                .withPassword('password12345')
                .build();

            const result = await this.registerUser(registration);
            users.push(toUserId(result.user.uid));
        }

        // Create admin if requested
        let admin: UserId | undefined;
        if (options.includeAdmin) {
            const adminReg = new UserRegistrationBuilder()
                .withEmail('admin@example.com')
                .withDisplayName('Admin User')
                .withPassword('password12345')
                .build();
            const adminResult = await this.registerUser(adminReg);
            admin = toUserId(adminResult.user.uid);
            this.seedAdminUser(admin);
        }

        return { users, admin };
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

        return res.getJson() as GroupFullDetailsDTO;
    }

    async createGroup(groupRequest = new CreateGroupRequestBuilder().build(), authToken: AuthToken) {
        const req = createStubRequest(authToken, groupRequest);
        const res = await this.dispatchByHandler('createGroup', req);
        return res.getJson() as GroupDTO;
    }

    async generateShareableLink(groupId: GroupId | string, expiresAt: ISOString | string | undefined = undefined, authToken: AuthToken): Promise<ShareLinkResponse> {
        const body: Record<string, unknown> = { groupId };
        if (expiresAt) {
            body.expiresAt = expiresAt;
        }

        const req = createStubRequest(authToken, body);
        const res = await this.dispatchByHandler('generateShareableLink', req);
        return res.getJson() as ShareLinkResponse;
    }

    async joinGroupByLink(shareToken: ShareLinkToken | string, groupDisplayName: DisplayName | string | undefined = undefined, authToken: AuthToken): Promise<JoinGroupResponse> {
        const displayName = groupDisplayName || `User ${authToken}`;
        const req = createStubRequest(authToken, { shareToken, groupDisplayName: displayName });
        const res = await this.dispatchByHandler('joinGroupByLink', req);
        return res.getJson() as JoinGroupResponse;
    }

    async previewGroupByLink(shareToken: ShareLinkToken, authToken?: AuthToken): Promise<PreviewGroupResponse> {
        if (!authToken) {
            throw new Error('Auth token is required for previewGroupByLink');
        }

        const req = createStubRequest(authToken, { shareToken });
        const res = await this.dispatchByHandler('previewGroupByLink', req);
        return res.getJson() as PreviewGroupResponse;
    }

    async updateGroup(groupId: GroupId | string, updates: UpdateGroupRequest, authToken: AuthToken) {
        const req = createStubRequest(authToken, updates, { groupId });
        const res = await this.dispatchByHandler('updateGroup', req);
        return res.getJson() as MessageResponse;
    }

    async deleteGroup(groupId: GroupId | string, authToken: AuthToken) {
        const req = createStubRequest(authToken, {}, { groupId });
        const res = await this.dispatchByHandler('deleteGroup', req);
        return res.getJson() as MessageResponse;
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

    async leaveGroup(groupId: GroupId | string, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, {}, { groupId });
        const res = await this.dispatchByHandler('leaveGroup', req);
        return res.getJson() as MessageResponse;
    }

    async removeGroupMember(groupId: GroupId | string, memberId: UserId | string, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, {}, { groupId, memberId });
        const res = await this.dispatchByHandler('removeGroupMember', req);
        return res.getJson() as MessageResponse;
    }

    async archiveGroupForUser(groupId: GroupId | string, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, {}, { groupId });
        const res = await this.dispatchByHandler('archiveGroupForUser', req);
        return res.getJson() as MessageResponse;
    }

    async unarchiveGroupForUser(groupId: GroupId | string, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, {}, { groupId });
        const res = await this.dispatchByHandler('unarchiveGroupForUser', req);
        return res.getJson() as MessageResponse;
    }

    async updateGroupMemberDisplayName(groupId: GroupId | string, displayName: DisplayName | string, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, { displayName }, { groupId });
        const res = await this.dispatchByHandler('updateGroupMemberDisplayName', req);
        return res.getJson() as MessageResponse;
    }

    async updateGroupPermissions(groupId: GroupId | string, updates: Partial<GroupPermissions>, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, updates, { groupId });
        const res = await this.dispatchByHandler('updateGroupPermissions', req);
        return res.getJson() as MessageResponse;
    }

    async getPendingMembers(groupId: GroupId | string, authToken: AuthToken): Promise<GroupMembershipDTO[]> {
        const req = createStubRequest(authToken, {}, { groupId });
        const res = await this.dispatchByHandler('getPendingMembers', req);
        return res.getJson() as GroupMembershipDTO[];
    }

    async updateMemberRole(groupId: GroupId | string, memberId: UserId, role: MemberRole, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, { role }, { groupId, memberId });
        const res = await this.dispatchByHandler('updateMemberRole', req);
        return res.getJson() as MessageResponse;
    }

    async approveMember(groupId: GroupId | string, memberId: UserId, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, {}, { groupId, memberId });
        const res = await this.dispatchByHandler('approveMember', req);
        return res.getJson() as MessageResponse;
    }

    async rejectMember(groupId: GroupId | string, memberId: UserId, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, {}, { groupId, memberId });
        const res = await this.dispatchByHandler('rejectMember', req);
        return res.getJson() as MessageResponse;
    }

    async createExpense(expenseRequest: CreateExpenseRequest, authToken: AuthToken): Promise<ExpenseDTO> {
        const req = createStubRequest(authToken, expenseRequest);
        const res = await this.dispatchByHandler('createExpense', req);
        return res.getJson() as ExpenseDTO;
    }

    async updateExpense(expenseId: ExpenseId | string, data: UpdateExpenseRequest, authToken: AuthToken): Promise<ExpenseDTO> {
        const req = createStubRequest(authToken, data);
        req.query = { id: expenseId };
        const res = await this.dispatchByHandler('updateExpense', req);
        return res.getJson() as ExpenseDTO;
    }

    async deleteExpense(expenseId: ExpenseId | string, authToken: AuthToken) {
        const req = createStubRequest(authToken, {});
        req.query = { id: expenseId };
        const res = await this.dispatchByHandler('deleteExpense', req);
        return res.getJson() as MessageResponse;
    }

    async getExpense(expenseId: ExpenseId | string, authToken: AuthToken): Promise<ExpenseDTO> {
        const fullDetails = await this.getExpenseFullDetails(expenseId, authToken);
        return fullDetails.expense;
    }

    async getExpenseFullDetails(expenseId: ExpenseId | string, authToken: AuthToken) {
        const req = createStubRequest(authToken, {}, { expenseId });
        const res = await this.dispatchByHandler('getExpenseFullDetails', req);
        return res.getJson() as ExpenseFullDetailsDTO;
    }

    async createSettlement(data: CreateSettlementRequest, authToken: AuthToken): Promise<SettlementDTO> {
        const req = createStubRequest(authToken, data);
        const res = await this.dispatchByHandler('createSettlement', req);
        return res.getJson() as SettlementDTO;
    }

    async updateSettlement(settlementId: SettlementId | string, data: UpdateSettlementRequest, authToken: AuthToken): Promise<SettlementWithMembers> {
        const req = createStubRequest(authToken, data, { settlementId });
        const res = await this.dispatchByHandler('updateSettlement', req);
        return res.getJson() as SettlementWithMembers;
    }

    async deleteSettlement(settlementId: SettlementId | string, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, {}, { settlementId });
        const res = await this.dispatchByHandler('deleteSettlement', req);
        return res.getJson() as MessageResponse;
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

    async createGroupComment(groupId: GroupId | string, text: CommentText | string, authToken: AuthToken): Promise<CommentDTO> {
        const req = createStubRequest(authToken, { text }, { groupId });
        const res = await this.dispatchByHandler('createComment', req);
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
        return res.getJson() as ListCommentsResponse;
    }

    async createExpenseComment(expenseId: ExpenseId | string, text: CommentText | string, authToken: AuthToken): Promise<CommentDTO> {
        const req = createStubRequest(authToken, { text }, { expenseId });
        const res = await this.dispatchByHandler('createCommentForExpense', req);
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
        return res.getJson() as ListCommentsResponse;
    }

    async getUserProfile(authToken: AuthToken): Promise<UserProfileResponse> {
        const req = createStubRequest(authToken, {});
        const res = await this.dispatchByHandler('getUserProfile', req);
        return res.getJson() as UserProfileResponse;
    }

    async updateUserProfile(updateRequest: UpdateUserProfileRequest, authToken: AuthToken): Promise<UserProfileResponse> {
        const req = createStubRequest(authToken, updateRequest);
        const res = await this.dispatchByHandler('updateUserProfile', req);
        return res.getJson() as UserProfileResponse;
    }

    async changePassword(passwordRequest: PasswordChangeRequest, authToken: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(authToken, passwordRequest);
        const res = await this.dispatchByHandler('changePassword', req);
        return res.getJson() as MessageResponse;
    }

    async changeEmail(changeEmailRequest: ChangeEmailRequest, authToken: AuthToken): Promise<UserProfileResponse> {
        const req = createStubRequest(authToken, changeEmailRequest);
        const res = await this.dispatchByHandler('changeEmail', req);
        return res.getJson() as UserProfileResponse;
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

    async processMergeTask(jobId: string, authToken?: AuthToken): Promise<any> {
        const req = createStubRequest(authToken || '', { jobId });
        const res = await this.dispatchByHandler('processMergeTask', req);
        return res.getJson();
    }

    // ===== ADMIN API: USER MANAGEMENT =====

    async updateUser(uid: UserId, updates: UpdateUserStatusRequest, token?: AuthToken): Promise<AdminUserProfile> {
        const req = createStubRequest(token || '', updates, { userId: uid });
        const res = await this.dispatchByHandler('updateUserAdmin', req);
        return res.getJson() as AdminUserProfile;
    }

    async updateUserRole(uid: UserId, updates: UpdateUserRoleRequest, token?: AuthToken): Promise<AdminUserProfile> {
        const req = createStubRequest(token || '', updates, { userId: uid });
        const res = await this.dispatchByHandler('updateUserRoleAdmin', req);
        return res.getJson() as AdminUserProfile;
    }

    async getUserAuth(uid: UserId, token?: AuthToken): Promise<any> {
        const req = createStubRequest(token || '', {}, { userId: uid });
        const res = await this.dispatchByHandler('getUserAuth', req);
        return res.getJson();
    }

    async getUserFirestore(uid: UserId, token?: AuthToken): Promise<any> {
        const req = createStubRequest(token || '', {}, { userId: uid });
        const res = await this.dispatchByHandler('getUserFirestore', req);
        return res.getJson();
    }

    async promoteUserToAdmin(uid: UserId): Promise<MessageResponse> {
        const req = createStubRequest('', { uid });
        const res = await this.dispatchByHandler('promoteTestUserToAdmin', req);
        return res.getJson() as MessageResponse;
    }

    async registerUser(registration: UserRegistration): Promise<RegisterUserResult> {
        const req = createStubRequest('', registration);
        const res = await this.dispatchByHandler('register', req);
        return res.getJson() as RegisterUserResult;
    }

    // ===== ADMIN API: POLICY MANAGEMENT =====

    async createPolicy(request: CreatePolicyRequest, token: AuthToken): Promise<CreatePolicyResponse> {
        const req = createStubRequest(token, request);
        const res = await this.dispatchByHandler('createPolicy', req);
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
        return res.getJson() as PolicyVersion & { versionHash: VersionHash; };
    }

    async updatePolicy(policyId: PolicyId, request: UpdatePolicyRequest, token: AuthToken): Promise<UpdatePolicyResponse> {
        const req = createStubRequest(token, request, { policyId });
        const res = await this.dispatchByHandler('updatePolicy', req);
        return res.getJson() as UpdatePolicyResponse;
    }

    async publishPolicy(policyId: PolicyId, versionHash: VersionHash, token: AuthToken): Promise<PublishPolicyResponse> {
        const req = createStubRequest(token, { versionHash }, { policyId });
        const res = await this.dispatchByHandler('publishPolicy', req);
        return res.getJson() as PublishPolicyResponse;
    }

    async deletePolicyVersion(policyId: PolicyId, versionHash: VersionHash, token: AuthToken): Promise<DeletePolicyVersionResponse> {
        const req = createStubRequest(token, {}, { policyId, hash: versionHash });
        const res = await this.dispatchByHandler('deletePolicyVersion', req);
        return res.getJson() as DeletePolicyVersionResponse;
    }

    async acceptMultiplePolicies(acceptances: AcceptPolicyRequest[], authToken: AuthToken): Promise<AcceptMultiplePoliciesResponse> {
        const req = createStubRequest(authToken, { acceptances });
        const res = await this.dispatchByHandler('acceptMultiplePolicies', req);
        return res.getJson() as AcceptMultiplePoliciesResponse;
    }

    async getUserPolicyStatus(authToken: AuthToken): Promise<UserPolicyStatusResponse> {
        const req = createStubRequest(authToken, {});
        const res = await this.dispatchByHandler('getUserPolicyStatus', req);
        return res.getJson() as UserPolicyStatusResponse;
    }

    async getCurrentPolicy(policyId: PolicyId): Promise<CurrentPolicyResponse> {
        const req = createStubRequest('', {}, { policyId });
        const res = await this.dispatchByHandler('getCurrentPolicy', req);
        return res.getJson() as CurrentPolicyResponse;
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
        return res.getJson() as ListAllTenantsResponse;
    }

    // ===== ADMIN API: TENANT MANAGEMENT =====

    async adminUpsertTenant(request: AdminUpsertTenantRequest, token: AuthToken): Promise<AdminUpsertTenantResponse> {
        const req = createStubRequest(token, request);
        const res = await this.dispatchByHandler('adminUpsertTenant', req);
        return res.getJson() as AdminUpsertTenantResponse;
    }

    async publishTenantTheme(request: PublishTenantThemeRequest, token: AuthToken): Promise<PublishTenantThemeResponse> {
        const req = createStubRequest(token, request);
        const res = await this.dispatchByHandler('publishTenantTheme', req);
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
        return res.getJson() as { url: string };
    }

    // ===== ADMIN API: TENANT SETTINGS =====

    async getTenantSettings(token: AuthToken): Promise<TenantSettingsResponse> {
        const req = createStubRequest(token, {});
        const res = await this.dispatchByHandler('getTenantSettings', req);
        return res.getJson() as TenantSettingsResponse;
    }

    async updateTenantBranding(request: UpdateTenantBrandingRequest, token: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(token, request);
        const res = await this.dispatchByHandler('updateTenantBranding', req);
        return res.getJson() as MessageResponse;
    }

    async getTenantDomains(token: AuthToken): Promise<TenantDomainsResponse> {
        const req = createStubRequest(token, {});
        const res = await this.dispatchByHandler('listTenantDomains', req);
        return res.getJson() as TenantDomainsResponse;
    }

    async addTenantDomain(request: AddTenantDomainRequest, token: AuthToken): Promise<MessageResponse> {
        const req = createStubRequest(token, request);
        const res = await this.dispatchByHandler('addTenantDomain', req);
        return res.getJson() as MessageResponse;
    }
}
