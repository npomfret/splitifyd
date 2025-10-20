import {
    AcceptMultiplePoliciesResponse,
    CommentDTO,
    CreateExpenseRequest,
    CreatePolicyResponse,
    CreateSettlementRequest,
    CurrentPolicyResponse,
    DeletePolicyVersionResponse,
    ExpenseDTO,
    ExpenseFullDetailsDTO,
    GroupDTO,
    GroupFullDetailsDTO, GroupId,
    JoinGroupResponse,
    ListCommentsResponse,
    ListGroupsResponse,
    MessageResponse,
    PreviewGroupResponse,
    PublishPolicyResponse,
    RegisteredUser,
    SettlementDTO,
    SettlementWithMembers,
    ShareLinkResponse,
    UpdateGroupRequest,
    UpdatePolicyResponse,
    UpdateSettlementRequest,
    UserPolicyStatusResponse,
} from '@splitifyd/shared';
import { CreateGroupRequestBuilder, createStubRequest, createStubResponse, StubFirestoreDatabase } from '@splitifyd/test-support';
import { CommentHandlers } from '../../comments/CommentHandlers';
import { ExpenseHandlers } from '../../expenses/ExpenseHandlers';
import { GroupHandlers } from '../../groups/GroupHandlers';
import { GroupMemberHandlers } from '../../groups/GroupMemberHandlers';
import { GroupShareHandlers } from '../../groups/GroupShareHandlers';
import { PolicyHandlers } from '../../policies/PolicyHandlers';
import { UserHandlers as PolicyUserHandlers } from '../../policies/UserHandlers';
import { getCurrentPolicy } from '../../policies/public-handlers';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';
import { FirestoreWriter } from '../../services/firestore';
import { SettlementHandlers } from '../../settlements/SettlementHandlers';
import { UserHandlers } from '../../user/UserHandlers';
import { StubAuthService } from './mocks/StubAuthService';
import {ExpenseId} from "@splitifyd/shared";
import {SettlementId} from "@splitifyd/shared";

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
    private db = new StubFirestoreDatabase();
    private authService = new StubAuthService();

    private applicationBuilder = new ApplicationBuilder(this.authService, this.db);
    private settlementHandlers = new SettlementHandlers(this.applicationBuilder.buildSettlementService());
    private groupHandlers = new GroupHandlers(this.applicationBuilder.buildGroupService(), new FirestoreWriter(this.db));
    private groupShareHandlers = new GroupShareHandlers(this.applicationBuilder.buildGroupShareService());
    private groupMemberHandlers = new GroupMemberHandlers(this.applicationBuilder.buildGroupMemberService());
    private expenseHandlers = new ExpenseHandlers(this.applicationBuilder.buildExpenseService());
    private commentHandlers = new CommentHandlers(this.applicationBuilder.buildCommentService());
    private userHandlers = new UserHandlers(this.applicationBuilder.buildUserService());
    private policyHandlers = new PolicyHandlers(this.applicationBuilder.buildPolicyService());
    private policyUserHandlers = new PolicyUserHandlers(this.applicationBuilder.buildUserPolicyService());

    seedUser(userId: string, userData: Record<string, any> = {}) {
        const user = this.db.seedUser(userId, userData);

        this.db.seed(`user-notifications/${userId}`, {
            userId,
            changeVersion: 0,
            lastModified: new Date().toISOString(),
            groups: {},
        });

        this.authService.setUser(userId, {
            uid: userId,
            email: user.email,
            displayName: user.displayName,
        });
    }

    async listGroups(userId1: string) {
        const req = createStubRequest(userId1, {});
        req.query = { limit: '20' };
        const res = createStubResponse();

        await this.groupHandlers.listGroups(req, res);

        return (res as any).getJson() as ListGroupsResponse;
    }

    async getGroupFullDetails(userId1: string, groupId: GroupId) {
        const req = createStubRequest(userId1, {}, { id: groupId });
        req.query = {};
        const res = createStubResponse();

        await this.groupHandlers.getGroupFullDetails(req, res);

        return (res as any).getJson() as GroupFullDetailsDTO;
    }

    async createGroup(userId1: string, groupRequest = new CreateGroupRequestBuilder().build()) {
        const req = createStubRequest(userId1, groupRequest);
        const res = createStubResponse();

        await this.groupHandlers.createGroup(req, res);

        return (res as any).getJson() as GroupDTO;
    }

    async generateShareableLink(userId1: string, groupId: GroupId): Promise<ShareLinkResponse> {
        const req = createStubRequest(userId1, { groupId });
        const res = createStubResponse();

        await this.groupShareHandlers.generateShareableLink(req, res);

        return (res as any).getJson() as ShareLinkResponse;
    }

    async joinGroupByLink(userId1: string, linkId: string): Promise<JoinGroupResponse> {
        const req = createStubRequest(userId1, { linkId });
        const res = createStubResponse();

        await this.groupShareHandlers.joinGroupByLink(req, res);

        return (res as any).getJson() as JoinGroupResponse;
    }

    async previewGroupByLink(userId: string, linkId: string): Promise<PreviewGroupResponse> {
        const req = createStubRequest(userId, { linkId });
        const res = createStubResponse();

        await this.groupShareHandlers.previewGroupByLink(req, res);

        return (res as any).getJson() as PreviewGroupResponse;
    }

    async updateGroup(userId: string, groupId: GroupId, updates: Partial<UpdateGroupRequest>) {
        const req = createStubRequest(userId, updates, { id: groupId });
        const res = createStubResponse();

        await this.groupHandlers.updateGroup(req, res);

        return (res as any).getJson() as GroupDTO;
    }

    async deleteGroup(userId: string, groupId: GroupId) {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = createStubResponse();

        await this.groupHandlers.deleteGroup(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async leaveGroup(userId: string, groupId: GroupId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId });
        const res = createStubResponse();

        await this.groupMemberHandlers.leaveGroup(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async removeGroupMember(userId: string, groupId: GroupId, memberId: string): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { id: groupId, memberId });
        const res = createStubResponse();

        await this.groupMemberHandlers.removeGroupMember(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async updateGroupMemberDisplayName(userId: string, groupId: GroupId, displayName: string): Promise<MessageResponse> {
        const req = createStubRequest(userId, { displayName }, { id: groupId });
        const res = createStubResponse();

        await this.groupHandlers.updateGroupMemberDisplayName(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async createExpense(userId1: string, expenseRequest: CreateExpenseRequest): Promise<ExpenseDTO> {
        const req = createStubRequest(userId1, expenseRequest);
        const res = createStubResponse();

        await this.expenseHandlers.createExpense(req, res);

        return (res as any).getJson() as ExpenseDTO;
    }

    async updateExpense(userId: string, expenseId: ExpenseId, updateBody: any): Promise<ExpenseDTO> {
        const req = createStubRequest(userId, updateBody);
        req.query = { id: expenseId };
        const res = createStubResponse();

        await this.expenseHandlers.updateExpense(req, res);

        return (res as any).getJson() as ExpenseDTO;
    }

    async deleteExpense(userId: string, expenseId: ExpenseId) {
        const req = createStubRequest(userId, {});
        req.query = { id: expenseId };
        const res = createStubResponse();

        await this.expenseHandlers.deleteExpense(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async getExpenseFullDetails(userId: string, expenseId: ExpenseId) {
        const req = createStubRequest(userId, {}, { id: expenseId });
        const res = createStubResponse();

        await this.expenseHandlers.getExpenseFullDetails(req, res);

        return (res as any).getJson() as ExpenseFullDetailsDTO;
    }

    async createSettlement(userId: string, settlementRequest: CreateSettlementRequest): Promise<SettlementDTO> {
        const req = createStubRequest(userId, settlementRequest);
        const res = createStubResponse();

        await this.settlementHandlers.createSettlement(req, res);

        return (res as any).getJson() as SettlementDTO;
    }

    async updateSettlement(userId: string, settlementId: SettlementId, updateRequest: UpdateSettlementRequest): Promise<SettlementWithMembers> {
        const req = createStubRequest(userId, updateRequest, { settlementId });
        const res = createStubResponse();

        await this.settlementHandlers.updateSettlement(req, res);

        return (res as any).getJson() as SettlementWithMembers;
    }

    async deleteSettlement(userId: string, settlementId: SettlementId): Promise<MessageResponse> {
        const req = createStubRequest(userId, {}, { settlementId });
        const res = createStubResponse();

        await this.settlementHandlers.deleteSettlement(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async createGroupComment(userId: string, groupId: GroupId, text: string): Promise<CommentDTO> {
        const req = createStubRequest(userId, { text }, { groupId });
        req.path = `/groups/${groupId}/comments`;
        const res = createStubResponse();

        await this.commentHandlers.createComment(req, res);

        return (res as any).getJson() as CommentDTO;
    }

    async listGroupComments(userId: string, groupId: GroupId): Promise<ListCommentsResponse> {
        const req = createStubRequest(userId, {}, { groupId });
        req.path = `/groups/${groupId}/comments`;
        req.query = {};
        const res = createStubResponse();

        await this.commentHandlers.listGroupComments(req, res);

        return (res as any).getJson() as ListCommentsResponse;
    }

    async createExpenseComment(userId: string, expenseId: ExpenseId, text: string): Promise<CommentDTO> {
        const req = createStubRequest(userId, { text }, { expenseId });
        req.path = `/expenses/${expenseId}/comments`;
        const res = createStubResponse();

        await this.commentHandlers.createComment(req, res);

        return (res as any).getJson() as CommentDTO;
    }

    async listExpenseComments(userId: string, expenseId: ExpenseId): Promise<ListCommentsResponse> {
        const req = createStubRequest(userId, {}, { expenseId });
        req.path = `/expenses/${expenseId}/comments`;
        req.query = {};
        const res = createStubResponse();

        await this.commentHandlers.listExpenseComments(req, res);

        return (res as any).getJson() as ListCommentsResponse;
    }

    async updateUserProfile(userId: string, updateRequest: any): Promise<RegisteredUser> {
        const req = createStubRequest(userId, updateRequest);
        const res = createStubResponse();

        await this.userHandlers.updateUserProfile(req, res);

        return (res as any).getJson() as RegisteredUser;
    }

    async changePassword(userId: string, passwordRequest: any): Promise<MessageResponse> {
        const req = createStubRequest(userId, passwordRequest);
        const res = createStubResponse();

        await this.userHandlers.changePassword(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async createPolicy(userId: string, policyData: { policyName: string; text: string; }): Promise<CreatePolicyResponse> {
        const req = createStubRequest(userId, policyData);
        const res = createStubResponse();

        await this.policyHandlers.createPolicy(req, res);

        return (res as any).getJson() as CreatePolicyResponse;
    }

    async listPolicies(userId: string): Promise<{ policies: any[]; count: number; }> {
        const req = createStubRequest(userId, {});
        const res = createStubResponse();

        await this.policyHandlers.listPolicies(req, res);

        return (res as any).getJson() as { policies: any[]; count: number; };
    }

    async getPolicy(userId: string, policyId: string): Promise<any> {
        const req = createStubRequest(userId, {}, { id: policyId });
        const res = createStubResponse();

        await this.policyHandlers.getPolicy(req, res);

        return (res as any).getJson();
    }

    async getPolicyVersion(userId: string, policyId: string, versionHash: string): Promise<any> {
        const req = createStubRequest(userId, {}, { id: policyId, hash: versionHash });
        const res = createStubResponse();

        await this.policyHandlers.getPolicyVersion(req, res);

        return (res as any).getJson();
    }

    async updatePolicy(userId: string, policyId: string, updateData: { text: string; publish?: boolean; }): Promise<UpdatePolicyResponse> {
        const req = createStubRequest(userId, updateData, { id: policyId });
        const res = createStubResponse();

        await this.policyHandlers.updatePolicy(req, res);

        return (res as any).getJson() as UpdatePolicyResponse;
    }

    async publishPolicy(userId: string, policyId: string, versionHash: string): Promise<PublishPolicyResponse> {
        const req = createStubRequest(userId, { versionHash }, { id: policyId });
        const res = createStubResponse();

        await this.policyHandlers.publishPolicy(req, res);

        return (res as any).getJson() as PublishPolicyResponse;
    }

    async deletePolicyVersion(userId: string, policyId: string, versionHash: string): Promise<DeletePolicyVersionResponse> {
        const req = createStubRequest(userId, {}, { id: policyId, hash: versionHash });
        const res = createStubResponse();

        await this.policyHandlers.deletePolicyVersion(req, res);

        return (res as any).getJson() as DeletePolicyVersionResponse;
    }

    async acceptMultiplePolicies(userId: string, acceptances: Array<{ policyId: string; versionHash: string; }>): Promise<AcceptMultiplePoliciesResponse> {
        const req = createStubRequest(userId, { acceptances });
        const res = createStubResponse();

        await this.policyUserHandlers.acceptMultiplePolicies(req, res);

        return (res as any).getJson() as AcceptMultiplePoliciesResponse;
    }

    async getUserPolicyStatus(userId: string): Promise<UserPolicyStatusResponse> {
        const req = createStubRequest(userId, {});
        const res = createStubResponse();

        await this.policyUserHandlers.getUserPolicyStatus(req, res);

        return (res as any).getJson() as UserPolicyStatusResponse;
    }

    async getCurrentPolicy(policyId: string): Promise<CurrentPolicyResponse> {
        const req = createStubRequest('', {}, { id: policyId });
        const res = createStubResponse();

        await getCurrentPolicy(req, res);

        return (res as any).getJson() as CurrentPolicyResponse;
    }
}
