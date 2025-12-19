import type {
    AcceptMultiplePoliciesResponse,
    AcceptPolicyRequest,
    ActivityFeedResponse,
    AddTenantDomainRequest,
    AdminUpsertTenantRequest,
    AdminUpsertTenantResponse,
    AttachmentId,
    ChangeEmailRequest,
    ClientAppConfiguration,
    CommentDTO,
    CommentId,
    CommentText,
    CreateAdminUserRequest,
    CreateExpenseRequest,
    CreateGroupRequest,
    CreatePolicyRequest,
    CreatePolicyResponse,
    CreateSettlementRequest,
    CurrentPolicyResponse,
    DeletePolicyVersionResponse,
    DisplayName,
    Email,
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
    PolicyId,
    PolicyVersion,
    PooledTestUser,
    PreviewGroupResponse,
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
    TenantDomainsResponse,
    TenantImageId,
    TenantSettingsResponse,
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
    UploadTenantImageResponse,
    UploadTenantLibraryImageResponse,
    UserId,
    UserPolicyStatusResponse,
    UserProfileResponse,
    UserRegistration,
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
     * Get client application configuration
     * Public endpoint - no authentication required
     */
    getConfig(): Promise<ClientAppConfiguration>;

    /**
     * Get bootstrap configuration for scripts that need to authenticate before tenants exist
     * Returns minimal config without tenant-specific overrides
     * Public endpoint - no authentication required
     */
    getBootstrapConfig(): Promise<ClientAppConfiguration>;

    /**
     * Get health status of the API
     * Public endpoint - no authentication required
     */
    getHealth(): Promise<HealthResponse>;

    /**
     * Register a new user account
     * Public endpoint - no authentication required
     */
    register(userData: UserRegistration): Promise<RegisterResponse>;

    /**
     * Get the current published version of a policy
     * Public endpoint - no authentication required
     * Used by the policy acceptance modal to display policy content
     */
    getCurrentPolicy(policyId: PolicyId): Promise<CurrentPolicyResponse>;

    /**
     * Get the Privacy Policy content as plain text
     * Returns text/plain response for tenant embedding
     */
    getPrivacyPolicy(): Promise<string>;

    /**
     * Get the Terms of Service content as plain text
     * Returns text/plain response for tenant embedding
     */
    getTermsOfService(): Promise<string>;

    /**
     * Get the Cookie Policy content as plain text
     * Returns text/plain response for tenant embedding
     */
    getCookiePolicy(): Promise<string>;

    /**
     * Authenticate a user with email and password.
     * Returns a custom token that the client uses to sign in with Firebase Auth.
     * Public endpoint - no authentication required
     */
    login(credentials: LoginRequest): Promise<LoginResponse>;

    /**
     * Send a password reset email to the specified email address.
     * Returns 204 No Content even for non-existent emails (to prevent enumeration).
     * Public endpoint - no authentication required
     */
    sendPasswordResetEmail(request: PasswordResetRequest): Promise<void>;

    /**
     * Send an email verification email to the specified email address.
     * Returns 204 No Content even for non-existent emails (to prevent enumeration).
     * Public endpoint - no authentication required
     */
    sendEmailVerification(request: EmailVerificationRequest): Promise<void>;
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
    updateGroup(groupId: GroupId, updates: UpdateGroupRequest, token?: AuthToken): Promise<void>;
    deleteGroup(groupId: GroupId, token?: AuthToken): Promise<void>;
    leaveGroup(groupId: GroupId, token?: AuthToken): Promise<void>;
    archiveGroupForUser(groupId: GroupId, token?: AuthToken): Promise<void>;
    unarchiveGroupForUser(groupId: GroupId, token?: AuthToken): Promise<void>;
    updateGroupPermissions(groupId: GroupId, permissions: Partial<GroupPermissions>, token?: AuthToken): Promise<void>;
    updateGroupMemberDisplayName(groupId: GroupId, displayName: DisplayName, token?: AuthToken): Promise<void>;

    getActivityFeed(options?: GetActivityFeedOptions, token?: AuthToken): Promise<ActivityFeedResponse>;
    getGroupActivityFeed(groupId: GroupId, options?: GetActivityFeedOptions, token?: AuthToken): Promise<ActivityFeedResponse>;

    updateMemberRole(groupId: GroupId, memberId: UserId, role: MemberRole, token?: AuthToken): Promise<void>;
    approveMember(groupId: GroupId, memberId: UserId, token?: AuthToken): Promise<void>;
    rejectMember(groupId: GroupId, memberId: UserId, token?: AuthToken): Promise<void>;
    removeGroupMember(groupId: GroupId, memberId: UserId, token?: AuthToken): Promise<void>;
    getPendingMembers(groupId: GroupId, token?: AuthToken): Promise<GroupMembershipDTO[]>;

    generateShareableLink(groupId: GroupId, expiresAt?: ISOString, token?: AuthToken): Promise<ShareLinkResponse>;
    previewGroupByLink(shareToken: ShareLinkToken, token?: AuthToken): Promise<PreviewGroupResponse>;
    joinGroupByLink(shareToken: ShareLinkToken, groupDisplayName: DisplayName, token?: AuthToken): Promise<JoinGroupResponse>;

    createExpense(request: CreateExpenseRequest, token?: AuthToken): Promise<ExpenseDTO>;
    updateExpense(expenseId: ExpenseId, request: UpdateExpenseRequest, token?: AuthToken): Promise<ExpenseDTO>;
    deleteExpense(expenseId: ExpenseId, token?: AuthToken): Promise<void>;
    getExpenseFullDetails(expenseId: ExpenseId, token?: AuthToken): Promise<ExpenseFullDetailsDTO>;
    createExpenseComment(expenseId: ExpenseId, text: CommentText, attachmentIds?: AttachmentId[], token?: AuthToken): Promise<CommentDTO>;
    listExpenseComments(expenseId: ExpenseId, options?: ListCommentsOptions, token?: AuthToken): Promise<ListCommentsResponse>;
    deleteExpenseComment(expenseId: ExpenseId, commentId: CommentId, token?: AuthToken): Promise<void>;

    createSettlement(request: CreateSettlementRequest, token?: AuthToken): Promise<SettlementDTO>;
    updateSettlement(settlementId: SettlementId, request: UpdateSettlementRequest, token?: AuthToken): Promise<SettlementWithMembers>;
    deleteSettlement(settlementId: SettlementId, token?: AuthToken): Promise<void>;

    // Reaction operations
    toggleExpenseReaction(expenseId: ExpenseId, emoji: ReactionEmoji, token?: AuthToken): Promise<ReactionToggleResponse>;
    toggleGroupCommentReaction(groupId: GroupId, commentId: CommentId, emoji: ReactionEmoji, token?: AuthToken): Promise<ReactionToggleResponse>;
    toggleExpenseCommentReaction(expenseId: ExpenseId, commentId: CommentId, emoji: ReactionEmoji, token?: AuthToken): Promise<ReactionToggleResponse>;
    toggleSettlementReaction(settlementId: SettlementId, emoji: ReactionEmoji, token?: AuthToken): Promise<ReactionToggleResponse>;

    createGroupComment(groupId: GroupId, text: CommentText, attachmentIds?: AttachmentId[], token?: AuthToken): Promise<CommentDTO>;
    listGroupComments(groupId: GroupId, options?: ListCommentsOptions, token?: AuthToken): Promise<ListCommentsResponse>;
    deleteGroupComment(groupId: GroupId, commentId: CommentId, token?: AuthToken): Promise<void>;

    uploadAttachment(groupId: GroupId, type: 'receipt' | 'comment', file: File | Buffer, contentType: string, token?: AuthToken): Promise<UploadAttachmentResponse>;
    deleteAttachment(groupId: GroupId, attachmentId: AttachmentId, token?: AuthToken): Promise<void>;

    acceptMultiplePolicies(requests: AcceptPolicyRequest[], token?: AuthToken): Promise<AcceptMultiplePoliciesResponse>;
    getUserPolicyStatus(token?: AuthToken): Promise<UserPolicyStatusResponse>;

    getUserProfile(token?: AuthToken): Promise<UserProfileResponse>;
    updateUserProfile(request: UpdateUserProfileRequest, token?: AuthToken): Promise<void>;
    changePassword(request: PasswordChangeRequest, token?: AuthToken): Promise<void>;
    changeEmail(request: ChangeEmailRequest, token?: AuthToken): Promise<void>;

    initiateMerge(request: InitiateMergeRequest, token?: AuthToken): Promise<InitiateMergeResponse>;
    getMergeStatus(jobId: string, token?: AuthToken): Promise<MergeJobResponse>;

    /**
     * Resolve a shortened URL by following redirects server-side.
     * Used for expanding maps.app.goo.gl and similar short URLs to extract place names.
     */
    resolveRedirect(request: ResolveRedirectRequest, token?: AuthToken): Promise<ResolveRedirectResponse>;
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
    getPolicyVersion(policyId: PolicyId, versionHash: VersionHash, token?: AuthToken): Promise<PolicyVersion & { versionHash: VersionHash; }>;

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
    updateUser(uid: UserId, updates: UpdateUserStatusRequest, token?: AuthToken): Promise<void>;

    /**
     * Update user role (system_admin, tenant_admin, or regular user)
     * Requires: system_admin role
     */
    updateUserRole(uid: UserId, updates: UpdateUserRoleRequest, token?: AuthToken): Promise<void>;

    /**
     * Update user profile (displayName, email)
     * Requires: system_admin role
     */
    updateUserProfileAdmin(uid: UserId, updates: UpdateUserProfileAdminRequest, token?: AuthToken): Promise<void>;

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

    /**
     * Upload tenant asset image (logo or favicon)
     * Requires: system_admin role
     */
    uploadTenantImage(tenantId: string, assetType: 'logo' | 'favicon', file: File | Buffer, contentType: string, token?: AuthToken): Promise<UploadTenantImageResponse>;

    // ===== TENANT IMAGE LIBRARY (tenant_admin or system_admin role) =====

    /**
     * List all images in tenant's image library
     * Requires: tenant_admin or system_admin role
     */
    listTenantImages(tenantId: string, token?: AuthToken): Promise<ListTenantImagesResponse>;

    /**
     * Upload a new image to tenant's image library
     * Requires: tenant_admin or system_admin role
     */
    uploadTenantLibraryImage(tenantId: string, name: string, file: File | Buffer, contentType: string, token?: AuthToken): Promise<UploadTenantLibraryImageResponse>;

    /**
     * Rename an image in tenant's image library
     * Requires: tenant_admin or system_admin role
     */
    renameTenantImage(tenantId: string, imageId: TenantImageId, request: RenameTenantImageRequest, token?: AuthToken): Promise<void>;

    /**
     * Delete an image from tenant's image library
     * Requires: tenant_admin or system_admin role
     */
    deleteTenantImage(tenantId: string, imageId: TenantImageId, token?: AuthToken): Promise<void>;

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
    updateTenantBranding(request: UpdateTenantBrandingRequest, token?: AuthToken): Promise<void>;

    /**
     * List tenant domains
     * Requires: tenant_admin or system_admin role
     */
    getTenantDomains(token?: AuthToken): Promise<TenantDomainsResponse>;

    /**
     * Add a new tenant domain
     * Requires: tenant_admin or system_admin role
     */
    addTenantDomain(request: AddTenantDomainRequest, token?: AuthToken): Promise<void>;

    // ===== DIAGNOSTICS (system_admin only) =====

    /**
     * Get server environment diagnostics
     * Requires: system_admin role
     */
    getEnvironmentDiagnostics(token?: AuthToken): Promise<EnvironmentDiagnosticsResponse>;
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

    /**
     * Promote user to system_admin role (test/emulator only)
     * Only available in emulator or test environments
     *
     * @param uid - User ID to promote to admin
     */
    promoteUserToAdmin(uid: UserId): Promise<void>;

    /**
     * Clear all policy acceptances for the authenticated user
     * Useful for testing policy acceptance flows
     *
     * Test environments only - endpoint returns 403 in production
     *
     * @param token - Authentication token of the user whose policy acceptances should be cleared
     */
    clearUserPolicyAcceptances(token: AuthToken): Promise<void>;

    /**
     * Create an admin user directly, bypassing policy checks.
     * Used during emulator bootstrap to create the initial admin before policies are seeded.
     *
     * Test environments only - endpoint returns 403 in production
     *
     * @param request - User details (email, password, displayName)
     * @returns PooledTestUser with uid, email, password, and authentication token
     */
    createAdminUser(request: CreateAdminUserRequest): Promise<PooledTestUser>;
}
