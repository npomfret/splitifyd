import type {
    AcceptMultiplePoliciesResponse,
    AcceptPolicyRequest,
    ActivityFeedResponse,
    AdminUpsertTenantRequest,
    AdminUpsertTenantResponse,
    AddTenantDomainRequest,
    AuthUser,
    ChangeEmailRequest,
    CommentDTO,
    CommentText,
    CreateExpenseRequest,
    CreateGroupRequest,
    CreatePolicyRequest,
    CreatePolicyResponse,
    CreateSettlementRequest,
    CurrentPolicyResponse,
    DeletePolicyVersionResponse,
    DisplayName,
    Email,
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
    MessageResponse,
    PasswordChangeRequest,
    PolicyDTO,
    PolicyId,
    PolicyVersion,
    PooledTestUser,
    PreviewGroupResponse,
    PublishPolicyResponse,
    PublishTenantThemeRequest,
    PublishTenantThemeResponse,
    SettlementDTO,
    SettlementId,
    SettlementWithMembers,
    ShareLinkResponse,
    ShareLinkToken,
    TenantDomainsResponse,
    TenantSettingsResponse,
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
    VersionHash,
} from './shared-types';

export type AuthToken = string | void;

/**
 * Public API operations that don't require authentication.
 *
 * These endpoints are accessible without a valid auth token.
 */
export interface PublicAPI {
    /**
     * Get the current published version of a policy
     * Public endpoint - no authentication required
     */
    getCurrentPolicy(policyId: PolicyId): Promise<CurrentPolicyResponse>;
}

/**
 * Authenticated API operations for regular users.
 *
 * Contract shared by all API consumers (web app client, HTTP integration driver, in-memory app driver).
 * All methods require authentication. Implementations that manage authentication internally can ignore the optional token parameter.
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
    getUserPolicyStatus(token?: AuthToken): Promise<UserPolicyStatusResponse>;

    getUserProfile(token?: AuthToken): Promise<UserProfileResponse>;
    updateUserProfile(request: UpdateUserProfileRequest, token?: AuthToken): Promise<UserProfileResponse>;
    changePassword(request: PasswordChangeRequest, token?: AuthToken): Promise<MessageResponse>;
    changeEmail(request: ChangeEmailRequest, token?: AuthToken): Promise<UserProfileResponse>;
}

/**
 * Admin-only API operations.
 *
 * These methods require elevated permissions (system_admin, tenant_admin, or system_user roles).
 * Implementations must rely on backend enforcement of authorization - this interface does not enforce permissions.
 *
 * This is a separate standalone interface that can be implemented alongside the regular API interface.
 */
export interface AdminAPI<AuthToken> {
    // ===== POLICY MANAGEMENT (system_admin only) =====

    /**
     * Create a new policy with its first version
     * Requires: system_admin role
     */
    createPolicy(request: CreatePolicyRequest, token?: AuthToken): Promise<CreatePolicyResponse>;

    /**
     * List all policies with version metadata
     * Requires: system_admin role
     */
    listPolicies(token?: AuthToken): Promise<ListPoliciesResponse>;

    /**
     * Get specific policy version content
     * Requires: system_admin role
     */
    getPolicyVersion(policyId: PolicyId, versionHash: VersionHash, token?: AuthToken): Promise<PolicyVersion & { versionHash: VersionHash }>;

    /**
     * Create new draft version (optionally publish immediately)
     * Requires: system_admin role
     */
    updatePolicy(policyId: PolicyId, request: UpdatePolicyRequest, token?: AuthToken): Promise<UpdatePolicyResponse>;

    /**
     * Publish a draft version as the current version
     * Requires: system_admin role
     */
    publishPolicy(policyId: PolicyId, versionHash: VersionHash, token?: AuthToken): Promise<PublishPolicyResponse>;

    /**
     * Delete an archived policy version
     * Requires: system_admin role
     */
    deletePolicyVersion(policyId: PolicyId, versionHash: VersionHash, token?: AuthToken): Promise<DeletePolicyVersionResponse>;

    // ===== USER MANAGEMENT (system_admin only) =====

    /**
     * Update user account status (enable/disable)
     * Requires: system_admin role
     */
    updateUser(uid: UserId, updates: UpdateUserStatusRequest, token?: AuthToken): Promise<AuthUser>;

    /**
     * Update user role (system_admin, tenant_admin, or regular user)
     * Requires: system_admin role
     */
    updateUserRole(uid: UserId, updates: UpdateUserRoleRequest, token?: AuthToken): Promise<AuthUser>;

    // ===== USER/TENANT BROWSING (system_user or system_admin role) =====

    /**
     * List Firebase Auth users with role enrichment
     * Requires: system_user or system_admin role
     */
    listAuthUsers(options: ListAuthUsersOptions, token?: AuthToken): Promise<ListAuthUsersResponse>;

    /**
     * List Firestore user documents
     * Requires: system_user or system_admin role
     */
    listFirestoreUsers(options: ListFirestoreUsersOptions, token?: AuthToken): Promise<ListFirestoreUsersResponse>;

    /**
     * List all tenant configurations
     * Requires: system_user or system_admin role
     */
    listAllTenants(token?: AuthToken): Promise<ListAllTenantsResponse>;

    // ===== TENANT MANAGEMENT (system_admin only) =====

    /**
     * Create or update full tenant configuration
     * Requires: system_admin role
     */
    adminUpsertTenant(request: AdminUpsertTenantRequest, token?: AuthToken): Promise<AdminUpsertTenantResponse>;

    /**
     * Publish tenant theme to CDN/storage
     * Requires: system_admin role
     */
    publishTenantTheme(request: PublishTenantThemeRequest, token?: AuthToken): Promise<PublishTenantThemeResponse>;

    // ===== TENANT SETTINGS (tenant_admin or system_admin role) =====

    /**
     * Get tenant settings for current tenant
     * Requires: tenant_admin or system_admin role
     */
    getTenantSettings(token?: AuthToken): Promise<TenantSettingsResponse>;

    /**
     * Update tenant branding configuration
     * Requires: tenant_admin or system_admin role
     */
    updateTenantBranding(request: UpdateTenantBrandingRequest, token?: AuthToken): Promise<MessageResponse>;

    /**
     * List tenant domains
     * Requires: tenant_admin or system_admin role
     */
    getTenantDomains(token?: AuthToken): Promise<TenantDomainsResponse>;

    /**
     * Add a new tenant domain
     * Requires: tenant_admin or system_admin role
     */
    addTenantDomain(request: AddTenantDomainRequest, token?: AuthToken): Promise<MessageResponse>;
}

/**
 * Test-only API operations.
 *
 * These endpoints are ONLY available in emulator or test environments.
 * They provide utilities for integration and E2E testing such as user pool management.
 *
 * ⚠️ These endpoints will never be available in production and should only be used
 * in test code, never in application code.
 *
 * This is a separate standalone interface that can be implemented alongside other API interfaces.
 */
export interface TestAPI {
    /**
     * Borrow a test user from the pool
     * Creates a new pooled user if none are available
     *
     * Test environments only - endpoint returns 403 in production
     *
     * @returns PooledTestUser with uid, email, password, and authentication token
     */
    borrowTestUser(): Promise<PooledTestUser>;

    /**
     * Return a test user to the pool for reuse
     *
     * Test environments only - endpoint returns 403 in production
     *
     * @param email - Email address of the test user to return
     */
    returnTestUser(email: Email): Promise<void>;
}
