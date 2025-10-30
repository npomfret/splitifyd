import {
    AcceptMultiplePoliciesResponse,
    ActivityFeedEventType,
    ActivityFeedEventTypes,
    ActivityFeedItem,
    CommentDTO,
    CreateExpenseRequest,
    CreatePolicyResponse,
    CreateSettlementRequest,
    CurrentPolicyResponse,
    DeletePolicyVersionResponse,
    ExpenseDTO,
    ExpenseFullDetailsDTO,
    GroupDTO,
    GroupFullDetailsDTO,
    GroupId,
    GroupMembershipDTO,
    GroupPermissions,
    JoinGroupResponse,
    ListCommentsResponse,
    ListGroupsResponse,
    MemberRole,
    MemberStatus,
    MessageResponse,
    PolicyId,
    PreviewGroupResponse,
    PublishPolicyResponse,
    SettlementDTO,
    SettlementWithMembers,
    ShareLinkResponse,
    UpdateGroupRequest,
    UpdatePolicyResponse,
    UpdateSettlementRequest,
    UserId,
    UserPolicyStatusResponse,
    UserProfileResponse,
    UserRegistration,
    VersionHash,
} from '@splitifyd/shared';
import { ExpenseId, SettlementId } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import { SplitifydFirestoreTestDatabase } from '@splitifyd/test-support';
import { CreateGroupRequestBuilder, createStubRequest, createStubResponse } from '@splitifyd/test-support';
import { expect } from 'vitest';
import { ActivityFeedHandlers } from '../../activity/ActivityHandlers';
import { CommentHandlers } from '../../comments/CommentHandlers';
import { ExpenseHandlers } from '../../expenses/ExpenseHandlers';
import { GroupHandlers } from '../../groups/GroupHandlers';
import { GroupMemberHandlers } from '../../groups/GroupMemberHandlers';
import { GroupSecurityHandlers } from '../../groups/GroupSecurityHandlers';
import { GroupShareHandlers } from '../../groups/GroupShareHandlers';
import { PolicyHandlers } from '../../policies/PolicyHandlers';
import { getCurrentPolicy } from '../../policies/public-handlers';
import { UserHandlers as PolicyUserHandlers } from '../../policies/UserHandlers';
import { ComponentBuilder } from '../../services/ComponentBuilder';
import { FirestoreWriter } from '../../services/firestore';
import { SettlementHandlers } from '../../settlements/SettlementHandlers';
import { UserHandlers } from '../../user/UserHandlers';
import { StubAuthService } from './mocks/StubAuthService';

/**
 * Thin façade around the public HTTP handlers.
 * - Uses the same handler classes the Express app wires up.
 * - Seeds data into an in-memory Firestore stub (no emulator required).
 * - Feeds handlers authenticated requests via the stub auth service.
 *
 * Tests call into this driver to hit the actual validation/permission logic
 * without needing to spin up the Firebase runtime.
 *
 * DO NOT use for load / concurrency testing - it will not accurately simulate firestore bahviour under load
 */
export class AppDriver {
    private db = new SplitifydFirestoreTestDatabase();
    private authService = new StubAuthService();

    private applicationBuilder = new ComponentBuilder(this.authService, this.db);
    private settlementHandlers = new SettlementHandlers(this.applicationBuilder.buildSettlementService());
    private groupHandlers = new GroupHandlers(this.applicationBuilder.buildGroupService(), new FirestoreWriter(this.db));
    private groupShareHandlers = new GroupShareHandlers(this.applicationBuilder.buildGroupShareService());
    private groupMemberHandlers = new GroupMemberHandlers(this.applicationBuilder.buildGroupMemberService());
    private expenseHandlers = new ExpenseHandlers(this.applicationBuilder.buildExpenseService());
    private commentHandlers = new CommentHandlers(this.applicationBuilder.buildCommentService());
    private userHandlers = new UserHandlers(this.applicationBuilder.buildUserService());
    private policyHandlers = new PolicyHandlers(this.applicationBuilder.buildPolicyService());
    private policyUserHandlers = new PolicyUserHandlers(this.applicationBuilder.buildUserPolicyService());
    private activityFeedHandlers = new ActivityFeedHandlers(this.applicationBuilder.buildActivityFeedService());
    private groupSecurityHandlers = new GroupSecurityHandlers(
        this.applicationBuilder.buildGroupService(),
        this.applicationBuilder.buildGroupMemberService(),
    );

    seedUser(userId: UserId, userData: Record<string, any> = {}) {
        const user = this.db.seedUser(userId, userData);

        this.authService.setUser(userId, {
            uid: userId,
            email: user.email,
            displayName: user.displayName,
        });
    }

    /**
     * Exposes the underlying test infrastructure so specialized harnesses
     * (e.g. Firestore trigger simulators) can hook into the same stubbed
     * database and application container.
     */
    getTestHarness() {
        return {
            db: this.db,
            applicationBuilder: this.applicationBuilder,
        };
    }

    dispose() {}

    async listGroups(
        userId1: UserId,
        options: {
            limit?: number;
            cursor?: string;
            order?: 'asc' | 'desc';
            includeMetadata?: boolean;
            statusFilter?: MemberStatus | MemberStatus[];
        } = {},
    ) {
        const req = createStubRequest(userId1, {});
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
        const res = createStubResponse();

        await this.groupHandlers.listGroups(req, res);

        return (res as any).getJson() as ListGroupsResponse;
    }

    async getGroupFullDetails(
        userId1: UserId,
        groupId: GroupId | string,
        options: {
            expenseLimit?: number;
            expenseCursor?: string;
            includeDeletedExpenses?: boolean;
            settlementLimit?: number;
            settlementCursor?: string;
            includeDeletedSettlements?: boolean;
        } = {},
    ) {
        const req = createStubRequest(userId1, {}, { id: groupId });
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
        const res = createStubResponse();

        await this.groupHandlers.getGroupFullDetails(req, res);

        return (res as any).getJson() as GroupFullDetailsDTO;
    }

    async createGroup(userId1: UserId, groupRequest = new CreateGroupRequestBuilder().build()) {
        const req = createStubRequest(userId1, groupRequest);
        const res = createStubResponse();

        await this.groupHandlers.createGroup(req, res);

        return (res as any).getJson() as GroupDTO;
    }

    async generateShareableLink(userId1: UserId, groupId: GroupId | string, expiresAt?: string): Promise<ShareLinkResponse> {
        const body: Record<string, unknown> = { groupId };
        if (expiresAt) {
            body.expiresAt = expiresAt;
        }

        const req = createStubRequest(userId1, body);
        const res = createStubResponse();

        await this.groupShareHandlers.generateShareableLink(req, res);

        return (res as any).getJson() as ShareLinkResponse;
    }

    async joinGroupByLink(userId1: UserId, linkId: string, groupDisplayName?: string): Promise<JoinGroupResponse> {
        const displayName = groupDisplayName || `User ${userId1}`;
        const req = createStubRequest(userId1, { linkId, groupDisplayName: displayName });
        const res = createStubResponse();

        await this.groupShareHandlers.joinGroupByLink(req, res);

        return (res as any).getJson() as JoinGroupResponse;
    }

    async previewGroupByLink(userId: UserId, linkId: string): Promise<PreviewGroupResponse> {
        const req = createStubRequest(userId, { linkId });
        const res = createStubResponse();

        await this.groupShareHandlers.previewGroupByLink(req, res);

        return (res as any).getJson() as PreviewGroupResponse;
    }

    async updateGroup(userId: UserId, groupId: GroupId | string, updates: Partial<UpdateGroupRequest>) {
        const req = createStubRequest(userId, updates, { id: groupId });
        const res = createStubResponse();

        await this.groupHandlers.updateGroup(req, res);

        return (res as any).getJson() as GroupDTO;
    }

    async deleteGroup(userId: UserId, groupId: GroupId | string) {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = createStubResponse();

        await this.groupHandlers.deleteGroup(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async getGroup(userId: UserId, groupId: GroupId | string): Promise<GroupDTO> {
        const details = await this.getGroupFullDetails(userId, groupId);
        return details.group;
    }

    async getGroupBalances(userId: UserId, groupId: GroupId | string) {
        const details = await this.getGroupFullDetails(userId, groupId);
        return details.balances;
    }

    async getGroupExpenses(userId: UserId, groupId: GroupId | string, options?: { expenseLimit?: number; expenseCursor?: string; }) {
        const details = await this.getGroupFullDetails(userId, groupId, options);
        return details.expenses;
    }

    async leaveGroup(userId: UserId, groupId: GroupId | string): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = createStubResponse();

        await this.groupMemberHandlers.leaveGroup(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async removeGroupMember(userId: UserId, groupId: GroupId | string, memberId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId, memberId });
        const res = createStubResponse();

        await this.groupMemberHandlers.removeGroupMember(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async archiveGroupForUser(userId: UserId, groupId: GroupId | string): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = createStubResponse();

        await this.groupMemberHandlers.archiveGroupForUser(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async unarchiveGroupForUser(userId: UserId, groupId: GroupId | string): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = createStubResponse();

        await this.groupMemberHandlers.unarchiveGroupForUser(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async updateGroupMemberDisplayName(userId: UserId, groupId: GroupId | string, displayName: DisplayName): Promise<MessageResponse> {
        const req = createStubRequest(userId, { displayName }, { id: groupId });
        const res = createStubResponse();

        await this.groupHandlers.updateGroupMemberDisplayName(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async updateGroupPermissions(userId: UserId, groupId: GroupId | string, updates: Partial<GroupPermissions>): Promise<MessageResponse> {
        const req = createStubRequest(userId, updates, { id: groupId });
        const res = createStubResponse();

        await this.groupSecurityHandlers.updateGroupPermissions(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async getPendingMembers(userId: UserId, groupId: GroupId | string): Promise<{ members: GroupMembershipDTO[]; }> {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = createStubResponse();

        await this.groupSecurityHandlers.getPendingMembers(req, res);

        return (res as any).getJson() as { members: GroupMembershipDTO[]; };
    }

    async updateMemberRole(userId: UserId, groupId: GroupId | string, memberId: UserId, role: MemberRole): Promise<MessageResponse> {
        const req = createStubRequest(userId, { role }, { id: groupId, memberId });
        const res = createStubResponse();

        await this.groupSecurityHandlers.updateMemberRole(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async approveMember(userId: UserId, groupId: GroupId | string, memberId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId, memberId });
        const res = createStubResponse();

        await this.groupSecurityHandlers.approveMember(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async rejectMember(userId: UserId, groupId: GroupId | string, memberId: UserId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId, memberId });
        const res = createStubResponse();

        await this.groupSecurityHandlers.rejectMember(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async createExpense(userId1: UserId, expenseRequest: CreateExpenseRequest): Promise<ExpenseDTO> {
        const req = createStubRequest(userId1, expenseRequest);
        const res = createStubResponse();

        await this.expenseHandlers.createExpense(req, res);

        return (res as any).getJson() as ExpenseDTO;
    }

    async updateExpense(userId: UserId, expenseId: ExpenseId | string, updateBody: any): Promise<ExpenseDTO> {
        const req = createStubRequest(userId, updateBody);
        req.query = { id: expenseId };
        const res = createStubResponse();

        await this.expenseHandlers.updateExpense(req, res);

        return (res as any).getJson() as ExpenseDTO;
    }

    async deleteExpense(userId: UserId, expenseId: ExpenseId | string) {
        const req = createStubRequest(userId, {});
        req.query = { id: expenseId };
        const res = createStubResponse();

        await this.expenseHandlers.deleteExpense(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async getExpense(userId: UserId, expenseId: ExpenseId | string): Promise<ExpenseDTO> {
        const fullDetails = await this.getExpenseFullDetails(userId, expenseId);
        return fullDetails.expense;
    }

    async getExpenseFullDetails(userId: UserId, expenseId: ExpenseId | string) {
        const req = createStubRequest(userId, {}, { id: expenseId });
        const res = createStubResponse();

        await this.expenseHandlers.getExpenseFullDetails(req, res);

        return (res as any).getJson() as ExpenseFullDetailsDTO;
    }

    async createSettlement(userId: UserId, settlementRequest: CreateSettlementRequest): Promise<SettlementDTO> {
        const req = createStubRequest(userId, settlementRequest);
        const res = createStubResponse();

        await this.settlementHandlers.createSettlement(req, res);

        return (res as any).getJson() as SettlementDTO;
    }

    async updateSettlement(userId: UserId, settlementId: SettlementId | string, updateRequest: UpdateSettlementRequest): Promise<SettlementWithMembers> {
        const req = createStubRequest(userId, updateRequest, { settlementId });
        const res = createStubResponse();

        await this.settlementHandlers.updateSettlement(req, res);

        return (res as any).getJson() as SettlementWithMembers;
    }

    async deleteSettlement(userId: UserId, settlementId: SettlementId | string): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { settlementId });
        const res = createStubResponse();

        await this.settlementHandlers.deleteSettlement(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async getSettlement(userId: UserId, groupId: GroupId | string, settlementId: SettlementId | string): Promise<SettlementWithMembers> {
        let fullDetails;

        try {
            fullDetails = await this.getGroupFullDetails(userId, groupId);
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

    async createGroupComment(userId: UserId, groupId: GroupId | string, text: string): Promise<CommentDTO> {
        const req = createStubRequest(userId, { text }, { groupId });
        req.path = `/groups/${groupId}/comments`;
        const res = createStubResponse();

        await this.commentHandlers.createComment(req, res);

        return (res as any).getJson() as CommentDTO;
    }

    async listGroupComments(
        userId: UserId,
        groupId: GroupId | string,
        options: { cursor?: string; limit?: number; } = {},
    ): Promise<ListCommentsResponse> {
        const req = createStubRequest(userId, {}, { groupId });
        req.path = `/groups/${groupId}/comments`;
        const query: Record<string, string> = {};
        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor !== undefined) {
            query.cursor = options.cursor;
        }
        req.query = query;
        const res = createStubResponse();

        await this.commentHandlers.listGroupComments(req, res);

        return (res as any).getJson() as ListCommentsResponse;
    }

    async createExpenseComment(userId: UserId, expenseId: ExpenseId | string, text: string): Promise<CommentDTO> {
        const req = createStubRequest(userId, { text }, { expenseId });
        req.path = `/expenses/${expenseId}/comments`;
        const res = createStubResponse();

        await this.commentHandlers.createComment(req, res);

        return (res as any).getJson() as CommentDTO;
    }

    async listExpenseComments(
        userId: UserId,
        expenseId: ExpenseId | string,
        options: { cursor?: string; limit?: number; } = {},
    ): Promise<ListCommentsResponse> {
        const req = createStubRequest(userId, {}, { expenseId });
        req.path = `/expenses/${expenseId}/comments`;
        const query: Record<string, string> = {};
        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor !== undefined) {
            query.cursor = options.cursor;
        }
        req.query = query;
        const res = createStubResponse();

        await this.commentHandlers.listExpenseComments(req, res);

        return (res as any).getJson() as ListCommentsResponse;
    }

    async getUserProfile(userId: UserId): Promise<UserProfileResponse> {
        const req = createStubRequest(userId, {});
        const res = createStubResponse();

        await this.userHandlers.getUserProfile(req, res);

        return (res as any).getJson() as UserProfileResponse;
    }

    async updateUserProfile(userId: UserId, updateRequest: any): Promise<UserProfileResponse> {
        const req = createStubRequest(userId, updateRequest);
        const res = createStubResponse();

        await this.userHandlers.updateUserProfile(req, res);

        return (res as any).getJson() as UserProfileResponse;
    }

    async changePassword(userId: UserId, passwordRequest: any): Promise<MessageResponse> {
        const req = createStubRequest(userId, passwordRequest);
        const res = createStubResponse();

        await this.userHandlers.changePassword(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async changeEmail(userId: UserId, changeEmailRequest: any): Promise<UserProfileResponse> {
        const req = createStubRequest(userId, changeEmailRequest);
        const res = createStubResponse();

        await this.userHandlers.changeEmail(req, res);

        return (res as any).getJson() as UserProfileResponse;
    }

    async registerUser(registration: UserRegistration): Promise<{ success: boolean; message: string; user: { uid: string; displayName: DisplayName | undefined; }; }> {
        return this.applicationBuilder.buildUserService().registerUser(registration);
    }

    async createPolicy(userId: UserId, policyData: { policyName: string; text: string; }): Promise<CreatePolicyResponse> {
        const req = createStubRequest(userId, policyData);
        const res = createStubResponse();

        await this.policyHandlers.createPolicy(req, res);

        return (res as any).getJson() as CreatePolicyResponse;
    }

    async listPolicies(userId: UserId): Promise<{ policies: any[]; count: number; }> {
        const req = createStubRequest(userId, {});
        const res = createStubResponse();

        await this.policyHandlers.listPolicies(req, res);

        return (res as any).getJson() as { policies: any[]; count: number; };
    }

    async getPolicy(userId: UserId, policyId: PolicyId): Promise<any> {
        const req = createStubRequest(userId, {}, { id: policyId });
        const res = createStubResponse();

        await this.policyHandlers.getPolicy(req, res);

        return (res as any).getJson();
    }

    async getPolicyVersion(userId: UserId, policyId: PolicyId, versionHash: VersionHash): Promise<any> {
        const req = createStubRequest(userId, {}, { id: policyId, hash: versionHash });
        const res = createStubResponse();

        await this.policyHandlers.getPolicyVersion(req, res);

        return (res as any).getJson();
    }

    async updatePolicy(userId: UserId, policyId: PolicyId, updateData: { text: string; publish?: boolean; }): Promise<UpdatePolicyResponse> {
        const req = createStubRequest(userId, updateData, { id: policyId });
        const res = createStubResponse();

        await this.policyHandlers.updatePolicy(req, res);

        return (res as any).getJson() as UpdatePolicyResponse;
    }

    async publishPolicy(userId: UserId, policyId: PolicyId, versionHash: VersionHash): Promise<PublishPolicyResponse> {
        const req = createStubRequest(userId, { versionHash }, { id: policyId });
        const res = createStubResponse();

        await this.policyHandlers.publishPolicy(req, res);

        return (res as any).getJson() as PublishPolicyResponse;
    }

    async deletePolicyVersion(userId: UserId, policyId: PolicyId, versionHash: VersionHash): Promise<DeletePolicyVersionResponse> {
        const req = createStubRequest(userId, {}, { id: policyId, hash: versionHash });
        const res = createStubResponse();

        await this.policyHandlers.deletePolicyVersion(req, res);

        return (res as any).getJson() as DeletePolicyVersionResponse;
    }

    async acceptMultiplePolicies(userId: UserId, acceptances: Array<{ policyId: PolicyId; versionHash: VersionHash; }>): Promise<AcceptMultiplePoliciesResponse> {
        const req = createStubRequest(userId, { acceptances });
        const res = createStubResponse();

        await this.policyUserHandlers.acceptMultiplePolicies(req, res);

        return (res as any).getJson() as AcceptMultiplePoliciesResponse;
    }

    async getUserPolicyStatus(userId: UserId): Promise<UserPolicyStatusResponse> {
        const req = createStubRequest(userId, {});
        const res = createStubResponse();

        await this.policyUserHandlers.getUserPolicyStatus(req, res);

        return (res as any).getJson() as UserPolicyStatusResponse;
    }

    async getCurrentPolicy(policyId: PolicyId): Promise<CurrentPolicyResponse> {
        const req = createStubRequest('', {}, { id: policyId });
        const res = createStubResponse();

        await getCurrentPolicy(req, res);

        return (res as any).getJson() as CurrentPolicyResponse;
    }

    async getActivityFeed(
        userId: UserId,
        options: { limit?: number; cursor?: string; } = {},
    ): Promise<{ items: ActivityFeedItem[]; hasMore: boolean; nextCursor?: string; }> {
        const req = createStubRequest(userId, {});
        const query: Record<string, string> = {};

        if (options.limit !== undefined) {
            query.limit = String(options.limit);
        }
        if (options.cursor !== undefined) {
            query.cursor = options.cursor;
        }

        req.query = query;
        const res = createStubResponse();

        await this.activityFeedHandlers.getActivityFeed(req, res);

        return (res as any).getJson() as { items: ActivityFeedItem[]; hasMore: boolean; nextCursor?: string; };
    }

    async getActivityFeedItems(userId: UserId) {
        const snapshot = await this.db.collection('activity-feed').doc(userId).collection('items').get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

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

    // convenience function - not a public interface method
    async addMembersToGroup(groupId: GroupId | string, ownerUserId: string, memberUserIds: string[]) {
        const shareLink = await this.generateShareableLink(ownerUserId, groupId);
        for (const userId of memberUserIds) {
            await this.joinGroupByLink(userId, shareLink.linkId);
        }
    }
}
