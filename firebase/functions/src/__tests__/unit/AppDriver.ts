import {CreateGroupRequestBuilder, createStubRequest, createStubResponse, StubFirestoreDatabase} from "@splitifyd/test-support";
import {ApplicationBuilder} from "../../services/ApplicationBuilder";
import {FirestoreReader, FirestoreWriter} from "../../services/firestore";
import {StubAuthService} from "./mocks/StubAuthService";
import {SettlementHandlers} from "../../settlements/SettlementHandlers";
import {GroupHandlers} from "../../groups/GroupHandlers";
import {ExpenseHandlers} from "../../expenses/ExpenseHandlers";
import {
    CreateCommentResponse,
    CreateExpenseRequest,
    CreateGroupRequest,
    CreateSettlementRequest, CreateSettlementResponse, DeleteSettlementResponse,
    ExpenseFullDetailsDTO,
    GroupDTO,
    GroupFullDetailsDTO,
    JoinGroupResponse,
    ListCommentsResponse,
    ListGroupsResponse, MessageResponse,
    PreviewGroupResponse,
    UpdateGroupRequest,
    UpdateSettlementRequest, UpdateSettlementResponse
} from "@splitifyd/shared/src";
import {GroupShareHandlers} from "../../groups/GroupShareHandlers";
import {GroupMemberHandlers} from "../../groups/GroupMemberHandlers";
import {CommentHandlers} from "../../comments/CommentHandlers";

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

    private applicationBuilder = new ApplicationBuilder(new FirestoreReader(this.db), new FirestoreWriter(this.db), this.authService);
    private settlementHandlers = new SettlementHandlers(this.applicationBuilder.buildSettlementService());
    private groupHandlers = new GroupHandlers(this.applicationBuilder.buildGroupService(), new FirestoreWriter(this.db));
    private groupShareHandlers = new GroupShareHandlers(this.applicationBuilder.buildGroupShareService());
    private groupMemberHandlers = new GroupMemberHandlers(this.applicationBuilder.buildGroupMemberService());
    private expenseHandlers = new ExpenseHandlers(this.applicationBuilder.buildExpenseService());
    private commentHandlers = new CommentHandlers(this.applicationBuilder.buildCommentService());

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
        req.query = {limit: '20'};
        const res = createStubResponse();

        await this.groupHandlers.listGroups(req, res);

        return (res as any).getJson() as ListGroupsResponse;
    }

    async getGroupFullDetails(userId1: string, groupId: string) {
        const req = createStubRequest(userId1, {}, {id: groupId});
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

    async generateShareableLink(userId1: string, groupId: string): Promise<{ shareablePath: string; linkId: string; }> {
        const req = createStubRequest(userId1, {groupId});
        const res = createStubResponse();

        await this.groupShareHandlers.generateShareableLink(req, res);

        return (res as any).getJson();
    }

    async joinGroupByLink(userId1: string, linkId: string): Promise<JoinGroupResponse> {
        const req = createStubRequest(userId1, {linkId});
        const res = createStubResponse();

        await this.groupShareHandlers.joinGroupByLink(req, res);

        return (res as any).getJson() as JoinGroupResponse;
    }

    async previewGroupByLink(userId: string, linkId: string): Promise<PreviewGroupResponse> {
        const req = createStubRequest(userId, {linkId});
        const res = createStubResponse();

        await this.groupShareHandlers.previewGroupByLink(req, res);

        return (res as any).getJson() as PreviewGroupResponse;
    }

    async updateGroup(userId: string, groupId: string, updates: Partial<UpdateGroupRequest>) {
        const req = createStubRequest(userId, updates, {id: groupId});
        const res = createStubResponse();

        await this.groupHandlers.updateGroup(req, res);

        return (res as any).getJson() as GroupDTO;
    }

    async deleteGroup(userId: string, groupId: string) {
        const req = createStubRequest(userId, {}, {id: groupId});
        const res = createStubResponse();

        await this.groupHandlers.deleteGroup(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async leaveGroup(userId: string, groupId: string): Promise<{ success: true; message: string; }> {
        const req = createStubRequest(userId, {}, {id: groupId});
        const res = createStubResponse();

        await this.groupMemberHandlers.leaveGroup(req, res);

        return (res as any).getJson();
    }

    async removeGroupMember(userId: string, groupId: string, memberId: string): Promise<{ success: true; message: string; }> {
        const req = createStubRequest(userId, {}, {id: groupId, memberId});
        const res = createStubResponse();

        await this.groupMemberHandlers.removeGroupMember(req, res);

        return (res as any).getJson();
    }

    async updateGroupMemberDisplayName(userId: string, groupId: string, displayName: string): Promise<{ success: boolean; message:  string}> {
        const req = createStubRequest(userId, {displayName}, {id: groupId});
        const res = createStubResponse();

        await this.groupHandlers.updateGroupMemberDisplayName(req, res);

        return (res as any).getJson();
    }

    async createExpense(userId1: string, expenseRequest: CreateExpenseRequest) {
        const req = createStubRequest(userId1, expenseRequest);
        const res = createStubResponse();

        await this.expenseHandlers.createExpense(req, res);

        return (res as any).getJson() as any;// todo: fix the return type
    }

    async updateExpense(userId: string, expenseId: string, updateBody: any) {
        const req = createStubRequest(userId, updateBody);
        req.query = {id: expenseId};
        const res = createStubResponse();

        await this.expenseHandlers.updateExpense(req, res);

        return (res as any).getJson() as any;// todo: fix the return type
    }

    async deleteExpense(userId: string, expenseId: string) {
        const req = createStubRequest(userId, {});
        req.query = {id: expenseId};
        const res = createStubResponse();

        await this.expenseHandlers.deleteExpense(req, res);

        return (res as any).getJson() as MessageResponse;
    }

    async getExpenseFullDetails(userId: string, expenseId: string) {
        const req = createStubRequest(userId, {}, {id: expenseId});
        const res = createStubResponse();

        await this.expenseHandlers.getExpenseFullDetails(req, res);

        return (res as any).getJson() as ExpenseFullDetailsDTO;
    }

    async createSettlement(userId: string, settlementRequest: CreateSettlementRequest) {
        const req = createStubRequest(userId, settlementRequest);
        const res = createStubResponse();

        await this.settlementHandlers.createSettlement(req, res);

        return (res as any).getJson() as CreateSettlementResponse;
    }

    async updateSettlement(userId: string, settlementId: string, updateRequest: UpdateSettlementRequest) {
        const req = createStubRequest(userId, updateRequest, {settlementId});
        const res = createStubResponse();

        await this.settlementHandlers.updateSettlement(req, res);

        return (res as any).getJson() as UpdateSettlementResponse;
    }

    async deleteSettlement(userId: string, settlementId: string) {
        const req = createStubRequest(userId, {}, {settlementId});
        const res = createStubResponse();

        await this.settlementHandlers.deleteSettlement(req, res);

        return (res as any).getJson() as DeleteSettlementResponse;
    }

    async createGroupComment(userId: string, groupId: string, text: string): Promise<CreateCommentResponse> {
        const req = createStubRequest(userId, {text}, {groupId});
        req.path = `/groups/${groupId}/comments`;
        const res = createStubResponse();

        await this.commentHandlers.createComment(req, res);

        return (res as any).getJson() as CreateCommentResponse;
    }

    async listGroupComments(userId: string, groupId: string): Promise<{ success: boolean; data: ListCommentsResponse; }> {
        const req = createStubRequest(userId, {}, {groupId});
        req.path = `/groups/${groupId}/comments`;
        req.query = {};
        const res = createStubResponse();

        await this.commentHandlers.listGroupComments(req, res);

        return (res as any).getJson() as { success: boolean; data: ListCommentsResponse; };
    }

    async createExpenseComment(userId: string, expenseId: string, text: string): Promise<CreateCommentResponse> {
        const req = createStubRequest(userId, {text}, {expenseId});
        req.path = `/expenses/${expenseId}/comments`;
        const res = createStubResponse();

        await this.commentHandlers.createComment(req, res);

        return (res as any).getJson() as CreateCommentResponse;
    }

    async listExpenseComments(userId: string, expenseId: string): Promise<{ success: boolean; data: ListCommentsResponse; }> {
        const req = createStubRequest(userId, {}, {expenseId});
        req.path = `/expenses/${expenseId}/comments`;
        req.query = {};
        const res = createStubResponse();

        await this.commentHandlers.listExpenseComments(req, res);

        return (res as any).getJson() as { success: boolean; data: ListCommentsResponse; };
    }

}
