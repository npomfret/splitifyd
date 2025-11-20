import type {
    AcceptMultiplePoliciesResponse,
    AcceptPolicyRequest,
    ActivityFeedResponse,
    ChangeEmailRequest,
    CommentDTO,
    CommentText,
    CreateExpenseRequest,
    CreateGroupRequest,
    CreateSettlementRequest,
    CurrentPolicyResponse,
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
    ISOString,
    JoinGroupResponse,
    ListCommentsOptions,
    ListCommentsResponse,
    ListGroupsOptions,
    ListGroupsResponse,
    MemberRole,
    MessageResponse,
    PasswordChangeRequest,
    PolicyId,
    PreviewGroupResponse,
    SettlementDTO,
    SettlementId,
    SettlementWithMembers,
    ShareLinkResponse,
    ShareLinkToken,
    UpdateExpenseRequest,
    UpdateGroupRequest,
    UpdateSettlementRequest,
    UpdateUserProfileRequest,
    UserId,
    UserPolicyStatusResponse,
    UserProfileResponse,
} from './shared-types';

export type AuthToken = string | void;

/**
 * Contract shared by all API consumers (web app client, HTTP integration driver, in-memory app driver).
 * Implementations that manage authentication internally can ignore the optional token parameter.
 */
export interface API<AuthToken> {
    listGroups(options?: ListGroupsOptions, token?: AuthToken): Promise<ListGroupsResponse>;
    getGroupFullDetails(groupId: GroupId, options?: GetGroupFullDetailsOptions, token?: AuthToken): Promise<GroupFullDetailsDTO>;
    createGroup(request: CreateGroupRequest, token?: AuthToken): Promise<GroupDTO>;
    updateGroup(groupId: GroupId, updates: UpdateGroupRequest, token?: AuthToken): Promise<MessageResponse>;
    deleteGroup(groupId: GroupId, token?: AuthToken): Promise<MessageResponse>;
    leaveGroup(groupId: GroupId, token?: AuthToken): Promise<MessageResponse>;
    archiveGroupForUser(groupId: GroupId, token?: AuthToken): Promise<MessageResponse>;
    unarchiveGroupForUser(groupId: GroupId, token?: AuthToken): Promise<MessageResponse>;
    updateGroupPermissions(groupId: GroupId, permissions: Partial<GroupPermissions>, token?: AuthToken): Promise<MessageResponse>;
    updateGroupMemberDisplayName(groupId: GroupId, displayName: DisplayName, token?: AuthToken): Promise<MessageResponse>;

    getActivityFeed(options?: GetActivityFeedOptions, token?: AuthToken): Promise<ActivityFeedResponse>;

    updateMemberRole(groupId: GroupId, memberId: UserId, role: MemberRole, token?: AuthToken): Promise<MessageResponse>;
    approveMember(groupId: GroupId, memberId: UserId, token?: AuthToken): Promise<MessageResponse>;
    rejectMember(groupId: GroupId, memberId: UserId, token?: AuthToken): Promise<MessageResponse>;
    removeGroupMember(groupId: GroupId, memberId: UserId, token?: AuthToken): Promise<MessageResponse>;
    getPendingMembers(groupId: GroupId, token?: AuthToken): Promise<GroupMembershipDTO[]>;

    generateShareableLink(groupId: GroupId, expiresAt?: ISOString, token?: AuthToken): Promise<ShareLinkResponse>;
    previewGroupByLink(shareToken: ShareLinkToken, token?: AuthToken): Promise<PreviewGroupResponse>;
    joinGroupByLink(shareToken: ShareLinkToken, displayNameOrToken?: DisplayName | AuthToken, token?: AuthToken): Promise<JoinGroupResponse>;

    createExpense(request: CreateExpenseRequest, token?: AuthToken): Promise<ExpenseDTO>;
    updateExpense(expenseId: ExpenseId, request: UpdateExpenseRequest, token?: AuthToken): Promise<ExpenseDTO>;
    deleteExpense(expenseId: ExpenseId, token?: AuthToken): Promise<MessageResponse>;
    getExpenseFullDetails(expenseId: ExpenseId, token?: AuthToken): Promise<ExpenseFullDetailsDTO>;
    createExpenseComment(expenseId: ExpenseId, text: CommentText, token?: AuthToken): Promise<CommentDTO>;
    listExpenseComments(expenseId: ExpenseId, options?: ListCommentsOptions, token?: AuthToken): Promise<ListCommentsResponse>;

    createSettlement(request: CreateSettlementRequest, token?: AuthToken): Promise<SettlementDTO>;
    updateSettlement(settlementId: SettlementId, request: UpdateSettlementRequest, token?: AuthToken): Promise<SettlementWithMembers>;
    deleteSettlement(settlementId: SettlementId, token?: AuthToken): Promise<MessageResponse>;

    createGroupComment(groupId: GroupId, text: CommentText, token?: AuthToken): Promise<CommentDTO>;
    listGroupComments(groupId: GroupId, options?: ListCommentsOptions, token?: AuthToken): Promise<ListCommentsResponse>;

    acceptMultiplePolicies(requests: AcceptPolicyRequest[], token?: AuthToken): Promise<AcceptMultiplePoliciesResponse>;
    getUserPolicyStatus(signal?: unknown, token?: AuthToken): Promise<UserPolicyStatusResponse>;
    getCurrentPolicy(policyId: PolicyId, signal?: unknown, token?: AuthToken): Promise<CurrentPolicyResponse>;

    getUserProfile(signal?: unknown, token?: AuthToken): Promise<UserProfileResponse>;
    updateUserProfile(request: UpdateUserProfileRequest, token?: AuthToken): Promise<UserProfileResponse>;
    changePassword(request: PasswordChangeRequest, token?: AuthToken): Promise<MessageResponse>;
    changeEmail(request: ChangeEmailRequest, token?: AuthToken): Promise<UserProfileResponse>;
}
