import {
    AcceptMultiplePoliciesResponse,
    AcceptPolicyRequest,
    ActivityFeedEventType,
    ActivityFeedEventTypes,
    ActivityFeedItem,
    ChangeEmailRequest,
    CommentDTO,
    CommentText,
    CreateExpenseRequest,
    CreatePolicyRequest,
    CreatePolicyResponse,
    CreateSettlementRequest,
    CurrentPolicyResponse,
    DeletePolicyVersionResponse,
    ExpenseDTO,
    ExpenseFullDetailsDTO,
    GetActivityFeedOptions,
    GetGroupFullDetailsOptions,
    GetPendingMembersResponse,
    GroupDTO,
    GroupFullDetailsDTO,
    GroupId,
    GroupMembershipDTO,
    GroupPermissions,
    JoinGroupResponse,
    ListCommentsOptions,
    ListCommentsResponse,
    ListGroupsOptions,
    ListGroupsResponse,
    ListPoliciesResponse,
    MemberRole,
    MemberStatus,
    MessageResponse,
    PasswordChangeRequest,
    PolicyDTO,
    PolicyId,
    PolicyVersion,
    PreviewGroupResponse,
    PublishPolicyResponse,
    SettlementDTO,
    SettlementWithMembers,
    ShareLinkResponse,
    ShareLinkToken,
    UpdateExpenseRequest,
    UpdateGroupRequest,
    UpdatePolicyRequest,
    UpdatePolicyResponse,
    UpdateSettlementRequest,
    UpdateUserProfileRequest,
    UserId,
    UserPolicyStatusResponse,
    UserProfileResponse,
    UserRegistration,
    VersionHash,
} from '@splitifyd/shared';
import { ExpenseId, SettlementId } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import { SystemUserRoles } from '@splitifyd/shared';
import { SplitifydFirestoreTestDatabase } from '@splitifyd/test-support';
import { CreateGroupRequestBuilder, createStubRequest, createStubResponse } from '@splitifyd/test-support';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { expect } from 'vitest';
import { createRouteDefinitions, RouteDefinition } from '../../routes/route-config';
import { ComponentBuilder } from '../../services/ComponentBuilder';
import { FirestoreReader } from '../../services/firestore';
import { RegisterUserResult } from '../../services/UserService2';
import { Errors, sendError } from '../../utils/errors';
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
export class AppDriver {
    private db = new SplitifydFirestoreTestDatabase();
    private authService = new StubAuthService();
    private routeDefinitions: RouteDefinition[];

    constructor() {
        // Create a ComponentBuilder with our test dependencies
        const componentBuilder = new ComponentBuilder(this.authService, this.db);

        // Create populated route definitions using the component builder
        this.routeDefinitions = createRouteDefinitions(componentBuilder);
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
                const userDocument = await firestoreReader.getUser(req.user.uid);
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

        return {
            authenticate,
            authenticateAdmin,
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
                const result = middleware(req, res, next);

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
        const next = () => {};
        await handlerFn(req, res, next);

        return res;
    }

    seedUser(userId: UserId, userData: Record<string, any> = {}) {
        const user = this.db.seedUser(userId, userData);

        this.authService.setUser(userId, {
            uid: userId,
            email: user.email,
            displayName: user.displayName,
        });
    }

    /**
     * Seeds an admin user for testing admin-only endpoints
     */
    seedAdminUser(userId: UserId, userData: Record<string, any> = {}) {
        const user = this.db.seedUser(userId, {
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
        const user = this.db.seedUser(userId, {
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
     * Seeds a tenant document in Firestore for testing tenant endpoints
     * This creates the actual Firestore document that tenant update operations require
     */
    seedTenantDocument(tenantId: string, tenantData: Record<string, any> = {}) {
        this.db.seedTenantDocument(tenantId, tenantData);
    }

    dispose() {}

    async listGroups(options: ListGroupsOptions = {}, userId: UserId,) {
        const req = createStubRequest(userId, {});
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

    async getGroupFullDetails(groupId: GroupId | string, options: GetGroupFullDetailsOptions = {}, userId: UserId,) {
        const req = createStubRequest(userId, {}, { id: groupId });
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

    async createGroup(groupRequest = new CreateGroupRequestBuilder().build(), userId: UserId) {
        const req = createStubRequest(userId, groupRequest);
        const res = await this.dispatchByHandler('createGroup', req);
        return res.getJson() as GroupDTO;
    }

    async generateShareableLink(groupId: GroupId | string, expiresAt: string | undefined = undefined, userId: UserId): Promise<ShareLinkResponse> {
        const body: Record<string, unknown> = { groupId };
        if (expiresAt) {
            body.expiresAt = expiresAt;
        }

        const req = createStubRequest(userId, body);
        const res = await this.dispatchByHandler('generateShareableLink', req);
        return res.getJson() as ShareLinkResponse;
    }

    async joinGroupByLink(shareToken: ShareLinkToken | string, groupDisplayName: DisplayName | string | undefined = undefined, userId: UserId): Promise<JoinGroupResponse> {
        const displayName = groupDisplayName || `User ${userId}`;
        const req = createStubRequest(userId, { shareToken, groupDisplayName: displayName });
        const res = await this.dispatchByHandler('joinGroupByLink', req);
        return res.getJson() as JoinGroupResponse;
    }

    async previewGroupByLink(shareToken: ShareLinkToken | string, userId: UserId): Promise<PreviewGroupResponse> {
        const req = createStubRequest(userId, { shareToken });
        const res = await this.dispatchByHandler('previewGroupByLink', req);
        return res.getJson() as PreviewGroupResponse;
    }

    async updateGroup(groupId: GroupId | string, updates: Partial<UpdateGroupRequest>, userId: UserId) {
        const req = createStubRequest(userId, updates, { id: groupId });
        const res = await this.dispatchByHandler('updateGroup', req);
        return res.getJson() as GroupDTO;
    }

    async deleteGroup(groupId: GroupId | string, userId: UserId) {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = await this.dispatchByHandler('deleteGroup', req);
        return res.getJson() as MessageResponse;
    }

    async getGroup(groupId: GroupId | string, userId: UserId): Promise<GroupDTO> {
        const details = await this.getGroupFullDetails(groupId, {}, userId);
        return details.group;
    }

    async getGroupBalances(groupId: GroupId | string, userId: UserId) {
        const details = await this.getGroupFullDetails(groupId, {}, userId);
        return details.balances;
    }

    async getGroupExpenses(groupId: GroupId | string, options: GetGroupFullDetailsOptions = {}, userId: UserId) {
        const details = await this.getGroupFullDetails(groupId, options, userId);
        return details.expenses;
    }

    async leaveGroup(groupId: GroupId | string, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = await this.dispatchByHandler('leaveGroup', req);
        return res.getJson() as MessageResponse;
    }

    async removeGroupMember(groupId: GroupId | string, memberId: UserId, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId, memberId });
        const res = await this.dispatchByHandler('removeGroupMember', req);
        return res.getJson() as MessageResponse;
    }

    async archiveGroupForUser(groupId: GroupId | string, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = await this.dispatchByHandler('archiveGroupForUser', req);
        return res.getJson() as MessageResponse;
    }

    async unarchiveGroupForUser(groupId: GroupId | string, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = await this.dispatchByHandler('unarchiveGroupForUser', req);
        return res.getJson() as MessageResponse;
    }

    async updateGroupMemberDisplayName(groupId: GroupId | string, displayName: DisplayName, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, { displayName }, { id: groupId });
        const res = await this.dispatchByHandler('updateGroupMemberDisplayName', req);
        return res.getJson() as MessageResponse;
    }

    async updateGroupPermissions(groupId: GroupId | string, updates: Partial<GroupPermissions>, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, updates, { id: groupId });
        const res = await this.dispatchByHandler('updateGroupPermissions', req);
        return res.getJson() as MessageResponse;
    }

    async getPendingMembers(groupId: GroupId | string, userId: UserId): Promise<GetPendingMembersResponse> {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = await this.dispatchByHandler('getPendingMembers', req);
        return res.getJson() as GetPendingMembersResponse;
    }

    async updateMemberRole(groupId: GroupId | string, memberId: UserId, role: MemberRole, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, { role }, { id: groupId, memberId });
        const res = await this.dispatchByHandler('updateMemberRole', req);
        return res.getJson() as MessageResponse;
    }

    async approveMember(groupId: GroupId | string, memberId: UserId, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId, memberId });
        const res = await this.dispatchByHandler('approveMember', req);
        return res.getJson() as MessageResponse;
    }

    async rejectMember(groupId: GroupId | string, memberId: UserId, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId, memberId });
        const res = await this.dispatchByHandler('rejectMember', req);
        return res.getJson() as MessageResponse;
    }

    async createExpense(expenseRequest: CreateExpenseRequest, userId: UserId): Promise<ExpenseDTO> {
        const req = createStubRequest(userId, expenseRequest);
        const res = await this.dispatchByHandler('createExpense', req);
        return res.getJson() as ExpenseDTO;
    }

    async updateExpense(expenseId: ExpenseId | string, updateBody: UpdateExpenseRequest, userId: UserId): Promise<ExpenseDTO> {
        const req = createStubRequest(userId, updateBody);
        req.query = { id: expenseId };
        const res = await this.dispatchByHandler('updateExpense', req);
        return res.getJson() as ExpenseDTO;
    }

    async deleteExpense(expenseId: ExpenseId | string, userId: UserId) {
        const req = createStubRequest(userId, {});
        req.query = { id: expenseId };
        const res = await this.dispatchByHandler('deleteExpense', req);
        return res.getJson() as MessageResponse;
    }

    async getExpense(expenseId: ExpenseId | string, userId: UserId): Promise<ExpenseDTO> {
        const fullDetails = await this.getExpenseFullDetails(expenseId, userId);
        return fullDetails.expense;
    }

    async getExpenseFullDetails(expenseId: ExpenseId | string, userId: UserId) {
        const req = createStubRequest(userId, {}, { id: expenseId });
        const res = await this.dispatchByHandler('getExpenseFullDetails', req);
        return res.getJson() as ExpenseFullDetailsDTO;
    }

    async createSettlement(settlementRequest: CreateSettlementRequest, userId: UserId): Promise<SettlementDTO> {
        const req = createStubRequest(userId, settlementRequest);
        const res = await this.dispatchByHandler('createSettlement', req);
        return res.getJson() as SettlementDTO;
    }

    async updateSettlement(settlementId: SettlementId | string, updateRequest: UpdateSettlementRequest, userId: UserId): Promise<SettlementWithMembers> {
        const req = createStubRequest(userId, updateRequest, { settlementId });
        const res = await this.dispatchByHandler('updateSettlement', req);
        return res.getJson() as SettlementWithMembers;
    }

    async deleteSettlement(settlementId: SettlementId | string, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { settlementId });
        const res = await this.dispatchByHandler('deleteSettlement', req);
        return res.getJson() as MessageResponse;
    }

    async getSettlement(groupId: GroupId | string, settlementId: SettlementId | string, userId: UserId): Promise<SettlementWithMembers> {
        let fullDetails;

        try {
            fullDetails = await this.getGroupFullDetails(groupId, {}, userId);
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

    async createGroupComment(groupId: GroupId | string, text: CommentText, userId: UserId): Promise<CommentDTO> {
        const req = createStubRequest(userId, { text }, { groupId });
        const res = await this.dispatchByHandler('createComment', req);
        return res.getJson() as CommentDTO;
    }

    async listGroupComments(groupId: GroupId | string, options: ListCommentsOptions = {}, userId: UserId): Promise<ListCommentsResponse> {
        const req = createStubRequest(userId, {}, { groupId });
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

    async createExpenseComment(expenseId: ExpenseId | string, text: CommentText, userId: UserId): Promise<CommentDTO> {
        const req = createStubRequest(userId, { text }, { expenseId });
        const res = await this.dispatchByHandler('createCommentForExpense', req);
        return res.getJson() as CommentDTO;
    }

    async listExpenseComments(expenseId: ExpenseId | string, options: ListCommentsOptions = {}, userId: UserId): Promise<ListCommentsResponse> {
        const req = createStubRequest(userId, {}, { expenseId });
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

    async getUserProfile(userId: UserId): Promise<UserProfileResponse> {
        const req = createStubRequest(userId, {});
        const res = await this.dispatchByHandler('getUserProfile', req);
        return res.getJson() as UserProfileResponse;
    }

    async updateUserProfile(updateRequest: UpdateUserProfileRequest, userId: UserId): Promise<UserProfileResponse> {
        const req = createStubRequest(userId, updateRequest);
        const res = await this.dispatchByHandler('updateUserProfile', req);
        return res.getJson() as UserProfileResponse;
    }

    async changePassword(passwordRequest: PasswordChangeRequest, userId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, passwordRequest);
        const res = await this.dispatchByHandler('changePassword', req);
        return res.getJson() as MessageResponse;
    }

    async changeEmail(changeEmailRequest: ChangeEmailRequest, userId: UserId): Promise<UserProfileResponse> {
        const req = createStubRequest(userId, changeEmailRequest);
        const res = await this.dispatchByHandler('changeEmail', req);
        return res.getJson() as UserProfileResponse;
    }

    async registerUser(registration: UserRegistration): Promise<RegisterUserResult> {
        const req = createStubRequest('', registration);
        const res = await this.dispatchByHandler('register', req);
        return res.getJson() as RegisterUserResult;
    }

    async createPolicy(policyData: CreatePolicyRequest, userId: UserId): Promise<CreatePolicyResponse> {
        const req = createStubRequest(userId, policyData);
        const res = await this.dispatchByHandler('createPolicy', req);
        return res.getJson() as CreatePolicyResponse;
    }

    async listPolicies(userId: UserId): Promise<ListPoliciesResponse> {
        const req = createStubRequest(userId, {});
        const res = await this.dispatchByHandler('listPolicies', req);
        return res.getJson() as ListPoliciesResponse;
    }

    async getPolicy(policyId: PolicyId, userId: UserId): Promise<PolicyDTO> {
        const req = createStubRequest(userId, {}, { id: policyId });
        const res = await this.dispatchByHandler('getPolicy', req);
        return res.getJson() as PolicyDTO;
    }

    async getPolicyVersion(policyId: PolicyId, versionHash: VersionHash, userId: UserId): Promise<PolicyVersion & { versionHash: VersionHash }> {
        const req = createStubRequest(userId, {}, { id: policyId, hash: versionHash });
        const res = await this.dispatchByHandler('getPolicyVersion', req);
        return res.getJson() as PolicyVersion & { versionHash: VersionHash; };
    }

    async updatePolicy(policyId: PolicyId, updateData: UpdatePolicyRequest, userId: UserId): Promise<UpdatePolicyResponse> {
        const req = createStubRequest(userId, updateData, { id: policyId });
        const res = await this.dispatchByHandler('updatePolicy', req);
        return res.getJson() as UpdatePolicyResponse;
    }

    async publishPolicy(userId: UserId, policyId: PolicyId, versionHash: VersionHash): Promise<PublishPolicyResponse> {
        const req = createStubRequest(userId, { versionHash }, { id: policyId });
        const res = await this.dispatchByHandler('publishPolicy', req);
        return res.getJson() as PublishPolicyResponse;
    }

    async deletePolicyVersion(policyId: PolicyId, versionHash: VersionHash, userId: UserId): Promise<DeletePolicyVersionResponse> {
        const req = createStubRequest(userId, {}, { id: policyId, hash: versionHash });
        const res = await this.dispatchByHandler('deletePolicyVersion', req);
        return res.getJson() as DeletePolicyVersionResponse;
    }

    async acceptMultiplePolicies(acceptances: AcceptPolicyRequest[], userId: UserId): Promise<AcceptMultiplePoliciesResponse> {
        const req = createStubRequest(userId, { acceptances });
        const res = await this.dispatchByHandler('acceptMultiplePolicies', req);
        return res.getJson() as AcceptMultiplePoliciesResponse;
    }

    async getUserPolicyStatus(userId: UserId): Promise<UserPolicyStatusResponse> {
        const req = createStubRequest(userId, {});
        const res = await this.dispatchByHandler('getUserPolicyStatus', req);
        return res.getJson() as UserPolicyStatusResponse;
    }

    async getCurrentPolicy(policyId: PolicyId): Promise<CurrentPolicyResponse> {
        const req = createStubRequest('', {}, { id: policyId });
        const res = await this.dispatchByHandler('getCurrentPolicy', req);
        return res.getJson() as CurrentPolicyResponse;
    }

    async getActivityFeed(options: GetActivityFeedOptions = {}, userId: UserId): Promise<{ items: ActivityFeedItem[]; hasMore: boolean; nextCursor?: string }> {
        const req = createStubRequest(userId, {});
        const query: Record<string, string> = {};

        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor !== undefined) {
            query.cursor = options.cursor;
        }

        req.query = query;
        const res = await this.dispatchByHandler('getActivityFeed', req);

        return res.getJson() as { items: ActivityFeedItem[]; hasMore: boolean; nextCursor?: string; };
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

    // Tenant Settings API methods
    async getTenantSettings(userId: UserId): Promise<any> {
        const req = createStubRequest(userId, {});
        const res = await this.dispatchByHandler('getTenantSettings', req);
        return res.getJson();
    }

    async updateTenantBranding(userId: UserId, brandingData: any): Promise<any> {
        const req = createStubRequest(userId, brandingData);
        const res = await this.dispatchByHandler('updateTenantBranding', req);
        return res.getJson();
    }

    async listTenantDomains(userId: UserId): Promise<any> {
        const req = createStubRequest(userId, {});
        const res = await this.dispatchByHandler('listTenantDomains', req);
        return res.getJson();
    }

    async addTenantDomain(userId: UserId, domainData: any): Promise<any> {
        const req = createStubRequest(userId, domainData);
        const res = await this.dispatchByHandler('addTenantDomain', req);
        return res.getJson();
    }
}
