/**
 * Common API Client Interface
 *
 * This interface defines the canonical set of API operations available across all client implementations.
 * Method names and signatures are aligned with the server's route configuration.
 *
 * @see firebase/functions/src/routes/route-config.ts - Canonical source of truth for API endpoints
 *
 * Type Parameters:
 * - TGroupId: GroupId | string (test drivers) or GroupId (production client)
 * - TExpenseId: ExpenseId | string (test drivers) or ExpenseId (production client)
 * - TSettlementId: SettlementId | string (test drivers) or SettlementId (production client)
 * - TPolicyId: PolicyId | string (test drivers) or PolicyId (production client)
 *
 * This design allows:
 * - Test drivers to accept plain strings for convenience ("test-group-123")
 * - Production client to enforce strict branded types for safety (GroupId)
 */

import type {
    ActivityFeedResponse,
    CommentDTO,
    CreateExpenseRequest,
    CreateGroupRequest,
    CreateSettlementRequest,
    CurrentPolicyResponse,
    DisplayName,
    ExpenseDTO,
    ExpenseFullDetailsDTO,
    GetActivityFeedOptions,
    GetGroupFullDetailsOptions,
    GroupDTO,
    GroupFullDetailsDTO,
    GroupMembershipDTO,
    GroupPermissions,
    JoinGroupResponse,
    ListCommentsOptions,
    ListCommentsResponse,
    ListGroupsOptions,
    ListGroupsResponse,
    MemberRole,
    MessageResponse,
    PreviewGroupResponse,
    SettlementDTO,
    SettlementWithMembers,
    ShareLinkResponse,
    UpdateGroupRequest,
    UpdateSettlementRequest,
} from '../shared-types';
import type { ExpenseId, GroupId, PolicyId, SettlementId } from '../shared-types';

/**
 * Core API Client interface defining all available operations.
 *
 * Auth Patterns:
 * - ApiDriver: Adds `token: string` as last parameter
 * - AppDriver: Adds `userId: UserId` as first parameter
 * - apiClient: Manages token internally via setAuthToken()
 */
export interface IApiClient<
    TGroupId = GroupId,
    TExpenseId = ExpenseId,
    TSettlementId = SettlementId,
    TPolicyId = PolicyId,
> {
    // ========================================================================
    // Group Operations
    // ========================================================================

    /**
     * Create a new group
     * @see POST /groups - handler: createGroup
     */
    createGroup(data: CreateGroupRequest): Promise<GroupDTO>;

    /**
     * List all groups for the authenticated user
     * @see GET /groups - handler: listGroups
     */
    listGroups(options?: ListGroupsOptions): Promise<ListGroupsResponse>;

    /**
     * Get full details for a specific group
     * @see GET /groups/:id/full-details - handler: getGroupFullDetails
     */
    getGroupFullDetails(
        groupId: TGroupId,
        options?: GetGroupFullDetailsOptions,
    ): Promise<GroupFullDetailsDTO>;

    /**
     * Update group details
     * @see PUT /groups/:id - handler: updateGroup
     */
    updateGroup(groupId: TGroupId, data: UpdateGroupRequest): Promise<MessageResponse>;

    /**
     * Delete a group
     * @see DELETE /groups/:id - handler: deleteGroup
     */
    deleteGroup(groupId: TGroupId): Promise<MessageResponse>;

    /**
     * Generate a shareable invite link for a group
     * @see POST /groups/share - handler: generateShareableLink
     */
    generateShareableLink(groupId: TGroupId, expiresAt?: string): Promise<ShareLinkResponse>;

    /**
     * Preview group details via share link (before joining)
     * @see POST /groups/preview - handler: previewGroupByLink
     */
    previewGroupByLink(linkId: string): Promise<PreviewGroupResponse>;

    /**
     * Join a group via share link
     * @see POST /groups/join - handler: joinGroupByLink
     */
    joinGroupByLink(linkId: string, groupDisplayName: DisplayName): Promise<JoinGroupResponse>;

    /**
     * Leave a group
     * @see POST /groups/:id/leave - handler: leaveGroup
     */
    leaveGroup(groupId: TGroupId): Promise<MessageResponse>;

    /**
     * Archive a group for the current user
     * @see POST /groups/:id/archive - handler: archiveGroupForUser
     */
    archiveGroupForUser(groupId: TGroupId): Promise<MessageResponse>;

    /**
     * Unarchive a group for the current user
     * @see POST /groups/:id/unarchive - handler: unarchiveGroupForUser
     */
    unarchiveGroupForUser(groupId: TGroupId): Promise<MessageResponse>;

    /**
     * Update group security permissions
     * @see PATCH /groups/:id/security/permissions - handler: updateGroupPermissions
     */
    updateGroupPermissions(
        groupId: TGroupId,
        permissions: Partial<GroupPermissions>,
    ): Promise<MessageResponse>;

    /**
     * Update the current user's display name within a group
     * @see PUT /groups/:id/members/display-name - handler: updateGroupMemberDisplayName
     */
    updateGroupMemberDisplayName(
        groupId: TGroupId,
        displayName: DisplayName,
    ): Promise<MessageResponse>;

    /**
     * Get pending members awaiting approval
     * @see GET /groups/:id/members/pending - handler: getPendingMembers
     */
    getPendingMembers(groupId: TGroupId): Promise<GroupMembershipDTO[]>;

    /**
     * Update a member's role
     * @see PATCH /groups/:id/members/:memberId/role - handler: updateMemberRole
     */
    updateMemberRole(groupId: TGroupId, memberId: string, role: MemberRole): Promise<MessageResponse>;

    /**
     * Approve a pending member
     * @see POST /groups/:id/members/:memberId/approve - handler: approveMember
     */
    approveMember(groupId: TGroupId, memberId: string): Promise<MessageResponse>;

    /**
     * Reject a pending member
     * @see POST /groups/:id/members/:memberId/reject - handler: rejectMember
     */
    rejectMember(groupId: TGroupId, memberId: string): Promise<MessageResponse>;

    /**
     * Remove a member from a group
     * @see DELETE /groups/:id/members/:memberId - handler: removeGroupMember
     */
    removeGroupMember(groupId: TGroupId, memberId: string): Promise<MessageResponse>;

    // ========================================================================
    // Expense Operations
    // ========================================================================

    /**
     * Create a new expense
     * @see POST /expenses - handler: createExpense
     */
    createExpense(data: CreateExpenseRequest): Promise<ExpenseDTO>;

    /**
     * Update an existing expense
     * @see PUT /expenses - handler: updateExpense
     */
    updateExpense(expenseId: TExpenseId, data: Partial<CreateExpenseRequest>): Promise<ExpenseDTO>;

    /**
     * Delete an expense
     * @see DELETE /expenses - handler: deleteExpense
     */
    deleteExpense(expenseId: TExpenseId): Promise<MessageResponse>;

    /**
     * Get full details for an expense
     * @see GET /expenses/:id/full-details - handler: getExpenseFullDetails
     */
    getExpenseFullDetails(expenseId: TExpenseId): Promise<ExpenseFullDetailsDTO>;

    // ========================================================================
    // Settlement Operations
    // ========================================================================

    /**
     * Create a new settlement
     * @see POST /settlements - handler: createSettlement
     */
    createSettlement(data: CreateSettlementRequest): Promise<SettlementDTO>;

    /**
     * Update an existing settlement
     * @see PUT /settlements/:settlementId - handler: updateSettlement
     */
    updateSettlement(
        settlementId: TSettlementId,
        data: UpdateSettlementRequest,
    ): Promise<SettlementWithMembers>;

    /**
     * Delete a settlement
     * @see DELETE /settlements/:settlementId - handler: deleteSettlement
     */
    deleteSettlement(settlementId: TSettlementId): Promise<MessageResponse>;

    // ========================================================================
    // Comment Operations
    // ========================================================================

    /**
     * Create a comment on a group
     * @see POST /groups/:groupId/comments - handler: createComment
     */
    createGroupComment(groupId: TGroupId, text: string): Promise<CommentDTO>;

    /**
     * List comments for a group
     * @see GET /groups/:groupId/comments - handler: listGroupComments
     */
    listGroupComments(
        groupId: TGroupId,
        options?: ListCommentsOptions,
    ): Promise<ListCommentsResponse>;

    /**
     * Create a comment on an expense
     * @see POST /expenses/:expenseId/comments - handler: createCommentForExpense
     */
    createExpenseComment(expenseId: TExpenseId, text: string): Promise<CommentDTO>;

    /**
     * List comments for an expense
     * @see GET /expenses/:expenseId/comments - handler: listExpenseComments
     */
    listExpenseComments(
        expenseId: TExpenseId,
        options?: ListCommentsOptions,
    ): Promise<ListCommentsResponse>;

    // ========================================================================
    // Activity Feed
    // ========================================================================

    /**
     * Get activity feed for the authenticated user
     * @see GET /activity-feed - handler: getActivityFeed
     */
    getActivityFeed(options?: GetActivityFeedOptions): Promise<ActivityFeedResponse>;

    // ========================================================================
    // Policy Operations
    // ========================================================================

    /**
     * Get the current published version of a policy (public endpoint)
     * @see GET /policies/:id/current - handler: getCurrentPolicy
     */
    getCurrentPolicy(policyId: TPolicyId): Promise<CurrentPolicyResponse>;
}
