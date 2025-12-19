import type { AttachmentId, CommentId, CommentText, Email, GroupName, ISOString, ReactionEmoji, ReactionToggleResponse, ShareLinkToken, UserId } from '@billsplit-wl/shared';
import {
    AcceptMultiplePoliciesResponse,
    AcceptPolicyRequest,
    type ActivityFeedResponse,
    type AddTenantDomainRequest,
    type AdminAPI,
    type AdminUpsertTenantRequest,
    type AdminUpsertTenantResponse,
    type API,
    ApiSerializer,
    AuthenticatedFirebaseUser,
    ChangeEmailRequest,
    type ClientAppConfiguration,
    CommentDTO,
    type CreateAdminUserRequest,
    type CreateExpenseRequest,
    type CreateGroupRequest,
    type CreatePolicyRequest,
    type CreatePolicyResponse,
    type CreateSettlementRequest,
    type CurrentPolicyResponse,
    type DeletePolicyVersionResponse,
    DisplayName,
    type EmailVerificationRequest,
    type EnvironmentDiagnosticsResponse,
    ExpenseDTO,
    ExpenseFullDetailsDTO,
    ExpenseId,
    type GetActivityFeedOptions,
    type GetGroupFullDetailsOptions,
    GroupBalances,
    GroupDTO,
    GroupFullDetailsDTO,
    GroupId,
    type GroupMembershipDTO,
    type GroupPermissions,
    type HealthResponse,
    InitiateMergeRequest,
    InitiateMergeResponse,
    JoinGroupResponse,
    type ListAllTenantsResponse,
    type ListAuthUsersOptions,
    type ListAuthUsersResponse,
    type ListCommentsOptions,
    ListCommentsResponse,
    type ListFirestoreUsersOptions,
    type ListFirestoreUsersResponse,
    type ListGroupsOptions,
    ListGroupsResponse,
    type ListPoliciesResponse,
    type ListTenantImagesResponse,
    LoginRequest,
    LoginResponse,
    type MemberRole,
    MergeJobResponse,
    PasswordChangeRequest,
    PasswordResetRequest,
    type PolicyDTO,
    PolicyId,
    type PolicyVersion,
    PooledTestUser,
    type PreviewGroupResponse,
    type PublicAPI,
    type PublishPolicyResponse,
    type PublishTenantThemeRequest,
    type PublishTenantThemeResponse,
    RegisterResponse,
    type RenameTenantImageRequest,
    type ResolveRedirectRequest,
    type ResolveRedirectResponse,
    type SettlementDTO,
    SettlementId,
    type SettlementWithMembers,
    ShareLinkResponse,
    type TenantDomainsResponse,
    type TenantImageId,
    type TenantSettingsResponse,
    type TestAPI,
    toDisplayName,
    toGroupName,
    type UpdateExpenseRequest,
    type UpdateGroupRequest,
    type UpdatePolicyRequest,
    type UpdatePolicyResponse,
    type UpdateSettlementRequest,
    type UpdateTenantBrandingRequest,
    type UpdateUserProfileAdminRequest,
    type UpdateUserProfileRequest,
    type UpdateUserRoleRequest,
    type UpdateUserStatusRequest,
    type UploadAttachmentResponse,
    type UploadTenantLibraryImageResponse,
    UserPolicyStatusResponse,
    UserProfileResponse,
    UserRegistration,
    UserToken,
    type VersionHash,
} from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { UserRegistrationBuilder } from './builders';
import { ApiDriverConfig, getApiDriverConfig } from './firebase-emulator-config';
import { Matcher, PollOptions, pollUntil } from './Polling';

let cachedConfig: ApiDriverConfig | null = null;

const randomLetters = (min: number, max: number): string => {
    const length = Math.floor(Math.random() * (max - min + 1)) + min;
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
};

const generateUserStyleDisplayName = (): string => {
    const parts = ['User', randomLetters(2, 7)];
    const extraParts = Math.random() < 0.5 ? 0 : 1; // total sections: 2 or 3 after "User"
    for (let i = 0; i < extraParts; i++) {
        parts.push(randomLetters(2, 8));
    }
    return parts.join(' ');
};

const assertNoCacheHeaders = (endpoint: string, headers: Headers) => {
    const cacheControl = headers.get('cache-control');
    if (!cacheControl || !cacheControl.includes('no-store')) {
        throw new Error(
            `API endpoint ${endpoint} must have Cache-Control: no-store header. `
                + `Got: ${cacheControl || '(none)'}. `
                + `This prevents stale data from being served after updates.`,
        );
    }
};

import { DEFAULT_ADMIN_EMAIL, DEFAULT_PASSWORD } from './test-helpers';

export type AuthToken = string;

// Re-export for convenience
export type { ApiDriverConfig } from './firebase-emulator-config';

/**
 * HTTP-based API driver for testing against the Firebase emulator.
 *
 * This class implements the operations defined in IApiClient with a token-based authentication model.
 * It follows the pattern: method(data, token) where token is a Firebase auth token.
 *
 * @see IApiClient for the complete list of supported operations
 */
export class ApiDriver implements PublicAPI, API<AuthToken>, AdminAPI<AuthToken>, TestAPI {
    private readonly config: ApiDriverConfig;

    static readonly matchers = {
        balanceHasUpdate: () => (balances: GroupBalances) => balances.simplifiedDebts && balances.simplifiedDebts.length >= 0 && !!balances.lastUpdated,
    };

    /**
     * Create an ApiDriver instance using an async factory method.
     * Fetches configuration from the running emulator's /api/config endpoint.
     * @returns Promise<ApiDriver> configured for the emulator environment
     */
    static async create(): Promise<ApiDriver> {
        if (!cachedConfig) {
            cachedConfig = await getApiDriverConfig();
        }
        return new ApiDriver(cachedConfig);
    }

    /**
     * Create an ApiDriver instance with explicit config.
     * Prefer using ApiDriver.create() which fetches config from the running app.
     * @param config - Configuration for the API driver
     */
    constructor(config: ApiDriverConfig) {
        this.config = config;
    }

    /**
     * Create a new ApiDriver instance with a different host.
     * Useful for testing multi-tenant configurations.
     * @param host - The new host to use (e.g., '127.0.0.1' or 'localhost')
     */
    withHost(host: string): ApiDriver {
        const currentUrl = new URL(this.config.baseUrl);
        currentUrl.hostname = host;
        return new ApiDriver({
            ...this.config,
            baseUrl: currentUrl.toString().replace(/\/$/, ''), // Remove trailing slash
        });
    }

    async createUser(userRegistration: UserRegistration = new UserRegistrationBuilder().build()): Promise<AuthenticatedFirebaseUser> {
        let registrationError: unknown = null;

        try {
            await this.register(userRegistration);
        } catch (error) {
            registrationError = error;
            if (!this.isRegistrationRecoverable(error)) {
                throw error;
            }
        }

        try {
            const { uid, token } = await this.firebaseSignIn(userRegistration);

            return {
                uid,
                token,
                displayName: userRegistration.displayName,
            };
        } catch (signInError) {
            if (registrationError) {
                throw registrationError;
            }

            throw signInError;
        }
    }

    async borrowTestUser(): Promise<PooledTestUser> {
        const poolUser = (await this.apiRequest('/test-pool/borrow', 'POST', {})) as { email: Email; token: string; password: string; };

        const { email, password, token } = poolUser;

        // Always use the custom token approach - it's more reliable than caching ID tokens
        // The custom token won't be revoked and can be exchanged for a fresh ID token each time
        const res = await this.firebaseSignIn({ email, password, token });

        if (!email) throw Error();
        if (!password) throw Error();

        return {
            ...res,
            email,
            password,
        };
    }

    private async firebaseSignIn(userInfo: { email: Email; password: string; token?: string; }): Promise<UserToken> {
        // Use Firebase Auth REST API to sign in

        let signInResponse: Response;
        if (userInfo.token) {
            // Exchange custom token for ID token
            signInResponse = await fetch(`${this.config.authBaseUrl}/v1/accounts:signInWithCustomToken?key=${this.config.firebaseApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: userInfo.token,
                    returnSecureToken: true,
                }),
            });
        } else {
            signInResponse = await fetch(`${this.config.authBaseUrl}/v1/accounts:signInWithPassword?key=${this.config.firebaseApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userInfo.email,
                    password: userInfo.password,
                    returnSecureToken: true,
                }),
            });
        }

        if (!signInResponse.ok) {
            const error = (await signInResponse.json()) as { error?: { message?: string; }; };
            throw new Error(`Custom token exchange failed: ${error.error?.message || 'Unknown error'}`);
        }

        const authData = (await signInResponse.json()) as { idToken: string; };

        // We need the UID. In a real test setup, you might need to use the Admin SDK
        // to get this, but for this test, we'll just decode the token (INSECURE, FOR TESTING ONLY).
        const decodedToken = JSON.parse(Buffer.from(authData.idToken.split('.')[1], 'base64').toString()) as { user_id: string; };

        return {
            uid: toUserId(decodedToken.user_id),
            token: authData.idToken,
        };
    }

    async returnTestUser(email: Email): Promise<void> {
        await this.apiRequest('/test-pool/return', 'POST', { email });
    }

    async createExpense(data: CreateExpenseRequest, token: AuthToken): Promise<ExpenseDTO> {
        const response = await this.apiRequest('/expenses', 'POST', data, token);
        return response as ExpenseDTO;
    }

    async updateExpense(expenseId: ExpenseId | string, data: UpdateExpenseRequest, token: AuthToken): Promise<ExpenseDTO> {
        const response = await this.apiRequest(`/expenses?id=${expenseId}`, 'PUT', data, token);
        return response as ExpenseDTO;
    }

    async deleteExpense(expenseId: ExpenseId | string, token: AuthToken): Promise<void> {
        await this.apiRequest(`/expenses?id=${expenseId}`, 'DELETE', null, token);
    }

    async getExpense(expenseId: ExpenseId | string, token: AuthToken): Promise<ExpenseDTO> {
        const response = await this.apiRequest(`/expenses/${expenseId}/full-details`, 'GET', null, token);
        return response.expense;
    }

    async createSettlement(data: CreateSettlementRequest, token: AuthToken): Promise<SettlementDTO> {
        const response = await this.apiRequest('/settlements', 'POST', data, token);
        return response as SettlementDTO;
    }

    async updateSettlement(settlementId: SettlementId | string, data: UpdateSettlementRequest, token: AuthToken): Promise<SettlementWithMembers> {
        const response = await this.apiRequest(`/settlements/${settlementId}`, 'PUT', data, token);
        return response as SettlementWithMembers;
    }

    async deleteSettlement(settlementId: SettlementId | string, token: AuthToken): Promise<void> {
        await this.apiRequest(`/settlements/${settlementId}`, 'DELETE', null, token);
    }

    // Reaction operations
    async toggleExpenseReaction(expenseId: ExpenseId | string, emoji: ReactionEmoji, token: AuthToken): Promise<ReactionToggleResponse> {
        return await this.apiRequest(`/expenses/${expenseId}/reactions`, 'POST', { emoji }, token);
    }

    async toggleGroupCommentReaction(groupId: GroupId | string, commentId: CommentId | string, emoji: ReactionEmoji, token: AuthToken): Promise<ReactionToggleResponse> {
        return await this.apiRequest(`/groups/${groupId}/comments/${commentId}/reactions`, 'POST', { emoji }, token);
    }

    async toggleExpenseCommentReaction(expenseId: ExpenseId | string, commentId: CommentId | string, emoji: ReactionEmoji, token: AuthToken): Promise<ReactionToggleResponse> {
        return await this.apiRequest(`/expenses/${expenseId}/comments/${commentId}/reactions`, 'POST', { emoji }, token);
    }

    async toggleSettlementReaction(settlementId: SettlementId | string, emoji: ReactionEmoji, token: AuthToken): Promise<ReactionToggleResponse> {
        return await this.apiRequest(`/settlements/${settlementId}/reactions`, 'POST', { emoji }, token);
    }

    async pollGroupBalancesUntil(groupId: GroupId | string, token: string, matcher: Matcher<GroupBalances>, options?: PollOptions): Promise<GroupBalances> {
        return pollUntil(() => this.getGroupBalances(groupId, token), matcher, { errorMsg: `Group ${groupId} balance condition not met`, ...options });
    }

    async waitForBalanceUpdate(groupId: GroupId | string, token: AuthToken): Promise<GroupBalances> {
        return this.pollGroupBalancesUntil(groupId, token, ApiDriver.matchers.balanceHasUpdate(), { timeout: 2000 });
    }

    async generateShareableLink(groupId: GroupId | string, expiresAt: ISOString | string | undefined = undefined, token: AuthToken): Promise<ShareLinkResponse> {
        const body: Record<string, unknown> = { groupId };
        if (expiresAt) {
            body.expiresAt = expiresAt;
        }

        return await this.apiRequest('/groups/share', 'POST', body, token);
    }

    async joinGroupByLink(shareToken: ShareLinkToken | string, groupDisplayName: DisplayName | string, token?: AuthToken): Promise<JoinGroupResponse> {
        return await this.apiRequest('/groups/join', 'POST', { shareToken, groupDisplayName }, token);
    }

    async previewGroupByLink(shareToken: ShareLinkToken, token: AuthToken): Promise<PreviewGroupResponse> {
        return await this.apiRequest('/groups/preview', 'POST', { shareToken }, token);
    }

    async createGroupWithMembers(name: string | GroupName, members: UserToken[], creatorToken: AuthToken): Promise<GroupDTO> {
        // Step 1: Create group with just the creator
        const creatorDisplayName = toDisplayName(`Owner ${Math.random().toString(36).slice(2, 8)}`);

        const groupData: CreateGroupRequest = {
            name: typeof name === 'string' ? toGroupName(name) : name,
            groupDisplayName: creatorDisplayName,
            description: `Test group created at ${new Date().toISOString()}`,
        };

        const group = await this.createGroup(groupData, creatorToken);

        // Step 2: If there are other members, generate a share link and have them join
        const otherMembers = members.filter((m) => m.token !== creatorToken);
        await this.addMembersViaShareLink(group.id, otherMembers, creatorToken);
        const { group: updatedGroup } = await this.getGroupFullDetails(group.id, undefined, creatorToken);
        return updatedGroup;
    }

    async addMembersViaShareLink(groupId: GroupId | string, toAdd: UserToken[], creatorToken: AuthToken) {
        if (toAdd.length > 0) {
            const { shareToken } = await this.generateShareableLink(groupId, undefined, creatorToken);

            // Step 3: Have other members join using the share link
            for (const member of toAdd) {
                const displayName = toDisplayName(generateUserStyleDisplayName());
                await this.joinGroupByLink(shareToken, displayName, member.token);
            }
        }
    }

    async createGroup(groupData: CreateGroupRequest, token: AuthToken): Promise<GroupDTO> {
        return (await this.apiRequest('/groups', 'POST', groupData, token)) as GroupDTO;
    }

    async getGroupFullDetails(groupId: GroupId | string, options: GetGroupFullDetailsOptions | undefined = undefined, token: AuthToken): Promise<GroupFullDetailsDTO> {
        let url = `/groups/${groupId}/full-details`;
        const queryParams: string[] = [];

        if (options?.expenseLimit) {
            queryParams.push(`expenseLimit=${options.expenseLimit}`);
        }
        if (options?.expenseCursor) {
            queryParams.push(`expenseCursor=${encodeURIComponent(options.expenseCursor)}`);
        }
        if (options?.settlementLimit) {
            queryParams.push(`settlementLimit=${options.settlementLimit}`);
        }
        if (options?.settlementCursor) {
            queryParams.push(`settlementCursor=${encodeURIComponent(options.settlementCursor)}`);
        }

        if (queryParams.length > 0) {
            url += `?${queryParams.join('&')}`;
        }

        return await this.apiRequest(url, 'GET', null, token);
    }

    async getExpenseFullDetails(expenseId: ExpenseId | string, token: AuthToken): Promise<ExpenseFullDetailsDTO> {
        return await this.apiRequest(`/expenses/${expenseId}/full-details`, 'GET', null, token);
    }

    async updateGroup(groupId: GroupId | string, data: UpdateGroupRequest, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}`, 'PUT', data, token);
    }

    async deleteGroup(groupId: GroupId | string, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}`, 'DELETE', null, token);
    }

    async updateGroupPermissions(groupId: GroupId | string, permissions: Partial<GroupPermissions>, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/security/permissions`, 'PATCH', permissions, token);
    }

    async updateMemberRole(groupId: GroupId | string, memberId: UserId | string, role: MemberRole, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/members/${memberId}/role`, 'PATCH', { role }, token);
    }

    async updateGroupMemberDisplayName(groupId: GroupId | string, displayName: DisplayName | string, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/members/display-name`, 'PUT', { displayName }, token);
    }

    async approveMember(groupId: GroupId | string, memberId: UserId | string, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/members/${memberId}/approve`, 'POST', {}, token);
    }

    async rejectMember(groupId: GroupId | string, memberId: UserId | string, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/members/${memberId}/reject`, 'POST', {}, token);
    }

    async getPendingMembers(groupId: GroupId | string, token: AuthToken): Promise<GroupMembershipDTO[]> {
        const response = await this.apiRequest(`/groups/${groupId}/members/pending`, 'GET', null, token);
        return Array.isArray(response) ? (response as GroupMembershipDTO[]) : [];
    }

    async listGroups(params: ListGroupsOptions | undefined = undefined, token: AuthToken): Promise<ListGroupsResponse> {
        const queryParams = new URLSearchParams();
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.cursor) queryParams.append('cursor', params.cursor);
        if (params?.order) queryParams.append('order', params.order);
        if (params?.includeMetadata !== undefined) queryParams.append('includeMetadata', params.includeMetadata.toString());
        if (params?.statusFilter) {
            const statusValue = Array.isArray(params.statusFilter) ? params.statusFilter.join(',') : params.statusFilter;
            queryParams.append('statusFilter', statusValue);
        }
        const queryString = queryParams.toString();
        return await this.apiRequest(`/groups${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
    }

    async getActivityFeed(options: GetActivityFeedOptions | undefined = undefined, token: AuthToken): Promise<ActivityFeedResponse> {
        const queryParams = new URLSearchParams();
        if (options?.limit) queryParams.append('limit', options.limit.toString());
        if (options?.cursor) queryParams.append('cursor', options.cursor);
        const queryString = queryParams.toString();
        return await this.apiRequest(`/activity-feed${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
    }

    async getGroupActivityFeed(groupId: GroupId, options: GetActivityFeedOptions | undefined = undefined, token: AuthToken): Promise<ActivityFeedResponse> {
        const queryParams = new URLSearchParams();
        if (options?.limit) queryParams.append('limit', options.limit.toString());
        if (options?.cursor) queryParams.append('cursor', options.cursor);
        const queryString = queryParams.toString();
        return await this.apiRequest(`/groups/${groupId}/activity-feed${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
    }

    async register(userData: UserRegistration): Promise<RegisterResponse> {
        return await this.apiRequest('/register', 'POST', userData);
    }

    async login(credentials: LoginRequest): Promise<LoginResponse> {
        return await this.apiRequest('/login', 'POST', credentials);
    }

    async sendPasswordResetEmail(request: PasswordResetRequest): Promise<void> {
        await this.apiRequest('/password-reset', 'POST', request);
    }

    async sendEmailVerification(request: EmailVerificationRequest): Promise<void> {
        await this.apiRequest('/email-verification', 'POST', request);
    }

    async leaveGroup(groupId: GroupId | string, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/leave`, 'POST', null, token);
    }

    async archiveGroupForUser(groupId: GroupId | string, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/archive`, 'POST', null, token);
    }

    async unarchiveGroupForUser(groupId: GroupId | string, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/unarchive`, 'POST', null, token);
    }

    async removeGroupMember(groupId: GroupId | string, memberId: UserId | string, token: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/members/${memberId}`, 'DELETE', null, token);
    }

    async getConfig(): Promise<ClientAppConfiguration> {
        return await this.apiRequest('/config', 'GET', null);
    }

    async getBootstrapConfig(): Promise<ClientAppConfiguration> {
        return await this.apiRequest('/bootstrap-config', 'GET', null);
    }

    async getHealth(): Promise<HealthResponse> {
        return await this.apiRequest('/health', 'GET', null);
    }

    async getCurrentPolicy(policyId: PolicyId): Promise<CurrentPolicyResponse> {
        return await this.apiRequest(`/policies/${policyId}/current`, 'GET', null);
    }

    async getPrivacyPolicy(): Promise<string> {
        return this.fetchPolicyText('/policies/privacy-policy/text');
    }

    async getTermsOfService(): Promise<string> {
        return this.fetchPolicyText('/policies/terms-of-service/text');
    }

    async getCookiePolicy(): Promise<string> {
        return this.fetchPolicyText('/policies/cookie-policy/text');
    }

    /**
     * Fetch a shareable page (returns HTML with OG tags for social media previews).
     * Used for testing the /join endpoint that serves SSR HTML for crawlers.
     * Note: Shareable pages are served at the hosting root (e.g., /join), not under /api.
     */
    async getShareablePage(path: string): Promise<{ html: string; headers: Headers; }> {
        const hostingUrl = this.config.baseUrl.replace(/\/api$/, '');
        const url = `${hostingUrl}${path}`;
        const hostname = new URL(hostingUrl).hostname;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'text/html',
                Host: hostname,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`API request to ${path} failed with status ${response.status}: ${errorText}`);
            (error as any).status = response.status;
            throw error;
        }

        return {
            html: await response.text(),
            headers: response.headers,
        };
    }

    private async fetchPolicyText(endpoint: string): Promise<string> {
        const url = `${this.config.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'text/plain',
                Host: 'localhost',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`API request to ${endpoint} failed with status ${response.status}: ${errorText}`);
            (error as any).status = response.status;
            throw error;
        }

        return response.text();
    }

    async acceptMultiplePolicies(acceptances: AcceptPolicyRequest[], token: AuthToken): Promise<AcceptMultiplePoliciesResponse> {
        return await this.apiRequest('/user/policies/accept-multiple', 'POST', { acceptances }, token);
    }

    async getUserPolicyStatus(token: AuthToken): Promise<UserPolicyStatusResponse> {
        return await this.apiRequest('/user/policies/status', 'GET', null, token);
    }

    async changePassword(passwordRequest: PasswordChangeRequest, token: AuthToken): Promise<void> {
        await this.apiRequest('/user/change-password', 'POST', passwordRequest, token);
    }

    async updateUserProfile(profileData: UpdateUserProfileRequest, token: AuthToken): Promise<void> {
        await this.apiRequest('/user/profile', 'PUT', profileData, token);
    }

    async changeEmail(changeEmailRequest: ChangeEmailRequest, token: AuthToken): Promise<void> {
        await this.apiRequest('/user/change-email', 'POST', changeEmailRequest, token);
    }

    async getUserProfile(token: AuthToken): Promise<UserProfileResponse> {
        return await this.apiRequest('/user/profile', 'GET', null, token);
    }

    // Account Merge API methods
    async initiateMerge(request: InitiateMergeRequest, token: AuthToken): Promise<InitiateMergeResponse> {
        return await this.apiRequest('/merge', 'POST', request, token);
    }

    async getMergeStatus(jobId: string, token: AuthToken): Promise<MergeJobResponse> {
        return await this.apiRequest(`/merge/${jobId}`, 'GET', null, token);
    }

    // URL Utility methods
    async resolveRedirect(request: ResolveRedirectRequest, token: AuthToken): Promise<ResolveRedirectResponse> {
        return await this.apiRequest('/utils/resolve-redirect', 'POST', request, token);
    }

    // Comment API methods
    async createGroupComment(groupId: GroupId | string, text: CommentText | string, attachmentIds?: AttachmentId[], token?: AuthToken): Promise<CommentDTO> {
        return await this.apiRequest(`/groups/${groupId}/comments`, 'POST', { text, attachmentIds }, token);
    }

    async createExpenseComment(expenseId: ExpenseId | string, text: CommentText | string, attachmentIds?: AttachmentId[], token?: AuthToken): Promise<CommentDTO> {
        return await this.apiRequest(`/expenses/${expenseId}/comments`, 'POST', { text, attachmentIds }, token);
    }

    async listGroupComments(groupId: GroupId | string, options: ListCommentsOptions | undefined = undefined, token: AuthToken): Promise<ListCommentsResponse> {
        const params = new URLSearchParams();
        if (options?.cursor) params.append('cursor', options.cursor);
        if (options?.limit) params.append('limit', options.limit.toString());
        const query = params.toString() ? `?${params.toString()}` : '';

        return await this.apiRequest(`/groups/${groupId}/comments${query}`, 'GET', null, token);
    }

    async listExpenseComments(expenseId: ExpenseId | string, options: ListCommentsOptions | undefined = undefined, token: AuthToken): Promise<ListCommentsResponse> {
        const params = new URLSearchParams();
        if (options?.cursor) params.append('cursor', options.cursor);
        if (options?.limit) params.append('limit', options.limit.toString());
        const query = params.toString() ? `?${params.toString()}` : '';

        const response = await this.apiRequest(`/expenses/${expenseId}/comments${query}`, 'GET', null, token);
        return response;
    }

    async deleteGroupComment(groupId: GroupId | string, commentId: CommentId | string, token?: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/comments/${commentId}`, 'DELETE', null, token);
    }

    async deleteExpenseComment(expenseId: ExpenseId | string, commentId: CommentId | string, token?: AuthToken): Promise<void> {
        await this.apiRequest(`/expenses/${expenseId}/comments/${commentId}`, 'DELETE', null, token);
    }

    // Attachment API methods
    async uploadAttachment(
        groupId: GroupId | string,
        type: 'receipt' | 'comment',
        file: File | Buffer,
        contentType: string,
        token?: AuthToken,
    ): Promise<UploadAttachmentResponse> {
        // Convert File to Buffer if needed (File has arrayBuffer method, Buffer doesn't)
        let buffer: Buffer;
        if ('arrayBuffer' in file && typeof file.arrayBuffer === 'function') {
            buffer = Buffer.from(await file.arrayBuffer());
        } else {
            buffer = file as Buffer;
        }
        return await this.binaryRequest(`/groups/${groupId}/attachments?type=${type}`, buffer, contentType, token);
    }

    async deleteAttachment(groupId: GroupId | string, attachmentId: AttachmentId | string, token?: AuthToken): Promise<void> {
        await this.apiRequest(`/groups/${groupId}/attachments/${attachmentId}`, 'DELETE', null, token);
    }

    // ===== ADMIN API: USER MANAGEMENT =====

    /**
     * Update user account status (admin-only)
     */
    async updateUser(uid: UserId, updates: UpdateUserStatusRequest, token: AuthToken): Promise<void> {
        await this.apiRequest(`/admin/users/${uid}`, 'PUT', updates, token);
    }

    /**
     * Update user role (admin-only)
     */
    async updateUserRole(uid: UserId, updates: UpdateUserRoleRequest, token: AuthToken): Promise<void> {
        await this.apiRequest(`/admin/users/${uid}/role`, 'PUT', updates, token);
    }

    /**
     * Update user profile (displayName, email) - admin-only
     */
    async updateUserProfileAdmin(uid: UserId, updates: UpdateUserProfileAdminRequest, token: AuthToken): Promise<void> {
        await this.apiRequest(`/admin/users/${uid}/profile`, 'PUT', updates, token);
    }

    private async apiRequest(
        endpoint: string,
        method: string = 'POST',
        body: unknown = null,
        token: string | null = null,
        options = {
            /** by default - authenticated responses should not be cached */
            assertHeaders: (endpoint: string, headers: Headers) => token && assertNoCacheHeaders(endpoint, headers),
        },
    ): Promise<any> {
        const url = `${this.config.baseUrl}${endpoint}`;
        const fetchOptions: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/x-serialized-json',
                Host: 'localhost', // todo: extract this from the url if it's important
                ...(token && { Authorization: `Bearer ${token}` }),
            },
        };

        if (body && method !== 'GET') {
            fetchOptions.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const errorText = await response.text();
                let parsedError: unknown = errorText;
                if (errorText) {
                    try {
                        parsedError = ApiSerializer.deserialize(errorText);
                    } catch {
                        parsedError = errorText;
                    }
                }

                // Create an error object with status and message properties for better testing
                const error = new Error(`API request to ${endpoint} failed with status ${response.status}: ${typeof parsedError === 'string' ? parsedError : JSON.stringify(parsedError)}`);
                (error as any).status = response.status;
                (error as any).response = parsedError;
                throw error;
            }

            // Only assert cache headers on successful responses
            // Error responses may have different caching requirements
            options.assertHeaders(endpoint, response.headers);

            // Handle cases where the response might be empty
            const responseText = await response.text();
            return responseText ? ApiSerializer.deserialize(responseText) : {};
        } catch (error) {
            // Check for connection errors that might indicate emulator restart
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error(`Cannot connect to emulator at ${url}. Please ensure the Firebase emulator is running.`);
            }
            throw error;
        }
    }

    private async binaryRequest(endpoint: string, buffer: Buffer, contentType: string, token?: string | null): Promise<any> {
        const url = `${this.config.baseUrl}${endpoint}`;
        const fetchOptions: RequestInit = {
            method: 'POST',
            headers: {
                'Content-Type': contentType,
                Accept: 'application/x-serialized-json',
                Host: 'localhost',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            // Use type assertion for Buffer - Node's fetch accepts Buffer
            body: buffer as unknown as BodyInit,
        };

        try {
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const errorText = await response.text();
                let parsedError: unknown = errorText;
                if (errorText) {
                    try {
                        parsedError = ApiSerializer.deserialize(errorText);
                    } catch {
                        parsedError = errorText;
                    }
                }

                const error = new Error(`API request to ${endpoint} failed with status ${response.status}: ${typeof parsedError === 'string' ? parsedError : JSON.stringify(parsedError)}`);
                (error as any).status = response.status;
                (error as any).response = parsedError;
                throw error;
            }

            const responseText = await response.text();
            return responseText ? ApiSerializer.deserialize(responseText) : {};
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error(`Cannot connect to emulator at ${url}. Please ensure the Firebase emulator is running.`);
            }
            throw error;
        }
    }

    async getGroupBalances(groupId: GroupId | string, token: AuthToken) {
        const res = await this.getGroupFullDetails(groupId, undefined, token);
        return res.balances;
    }

    async getGroupExpenses(groupId: GroupId | string, token: AuthToken) {
        const res = await this.getGroupFullDetails(groupId, undefined, token);
        return res.expenses;
    }

    async acceptCurrentPublishedPolicies(token: AuthToken): Promise<void> {
        // Get user's policy status which includes all existing policies
        const policyStatus = await this.apiRequest('/user/policies/status', 'GET', null, token);

        if (!policyStatus.policies || policyStatus.policies.length === 0) {
            return;
        }

        // Build acceptances for all policies (both accepted and unaccepted)
        // This ensures test users accept everything regardless of current status
        const acceptances = policyStatus.policies.map((policy: any) => ({
            policyId: policy.policyId,
            versionHash: policy.currentVersionHash,
        }));

        await this.apiRequest('/user/policies/accept-multiple', 'POST', { acceptances }, token);
    }

    async clearUserPolicyAcceptances(token: AuthToken): Promise<void> {
        // Clear all policy acceptances for the user to reset their state
        await this.apiRequest('/user/clear-policy-acceptances', 'POST', {}, token);
    }

    async promoteUserToAdmin(uid: UserId): Promise<void> {
        // Promote user to system_admin role (test/emulator only)
        await this.apiRequest('/test-pool/promote-to-admin', 'POST', { uid });
    }

    async createAdminUser(request: CreateAdminUserRequest): Promise<PooledTestUser> {
        // Create an admin user directly, bypassing policy checks (test/emulator only)
        // Used during bootstrap to create initial admin before policies exist
        const result = await this.apiRequest('/test/create-admin', 'POST', request) as PooledTestUser;

        // Exchange custom token for ID token so the returned token is usable
        const credentials = await this.firebaseSignIn({
            email: result.email,
            password: result.password,
            token: result.token,
        });

        return {
            ...result,
            uid: credentials.uid,
            token: credentials.token,
        };
    }

    // ===== ADMIN API: POLICY MANAGEMENT =====

    async createPolicy(request: CreatePolicyRequest, token: AuthToken): Promise<CreatePolicyResponse> {
        return await this.apiRequest('/admin/policies', 'POST', request, token) as CreatePolicyResponse;
    }

    async listPolicies(token?: AuthToken): Promise<ListPoliciesResponse> {
        return await this.apiRequest('/admin/policies', 'GET', null, token) as ListPoliciesResponse;
    }

    /**
     * Helper method to get a single policy by ID with all its versions.
     * Not part of the AdminAPI interface - used internally by tests/scripts.
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
        return await this.apiRequest(`/admin/policies/${policyId}/versions/${versionHash}`, 'GET', null, token) as PolicyVersion & { versionHash: VersionHash; };
    }

    async updatePolicy(policyId: PolicyId, request: UpdatePolicyRequest, token: AuthToken): Promise<UpdatePolicyResponse> {
        return await this.apiRequest(`/admin/policies/${policyId}`, 'PUT', request, token) as UpdatePolicyResponse;
    }

    async publishPolicy(policyId: PolicyId, versionHash: VersionHash, token: AuthToken): Promise<PublishPolicyResponse> {
        return await this.apiRequest(`/admin/policies/${policyId}/publish`, 'POST', { versionHash }, token) as PublishPolicyResponse;
    }

    async deletePolicyVersion(policyId: PolicyId, versionHash: VersionHash, token: AuthToken): Promise<DeletePolicyVersionResponse> {
        return await this.apiRequest(`/admin/policies/${policyId}/versions/${versionHash}`, 'DELETE', null, token) as DeletePolicyVersionResponse;
    }

    // ===== ADMIN API: USER/TENANT BROWSING =====

    async listAuthUsers(options: ListAuthUsersOptions, token: AuthToken): Promise<ListAuthUsersResponse> {
        const query = `?${new URLSearchParams(options as any).toString()}`;
        return await this.apiRequest(`/admin/browser/users/auth${query}`, 'GET', null, token) as ListAuthUsersResponse;
    }

    async listFirestoreUsers(options: ListFirestoreUsersOptions, token: AuthToken): Promise<ListFirestoreUsersResponse> {
        const query = `?${new URLSearchParams(options as any).toString()}`;
        return await this.apiRequest(`/admin/browser/users/firestore${query}`, 'GET', null, token) as ListFirestoreUsersResponse;
    }

    async listAllTenants(token?: AuthToken): Promise<ListAllTenantsResponse> {
        return await this.apiRequest('/admin/browser/tenants', 'GET', null, token) as ListAllTenantsResponse;
    }

    // ===== ADMIN API: TENANT MANAGEMENT =====

    async adminUpsertTenant(request: AdminUpsertTenantRequest, token: AuthToken): Promise<AdminUpsertTenantResponse> {
        return await this.apiRequest('/admin/tenants', 'POST', request, token) as AdminUpsertTenantResponse;
    }

    async publishTenantTheme(request: PublishTenantThemeRequest, token: AuthToken): Promise<PublishTenantThemeResponse> {
        return await this.apiRequest('/admin/tenants/publish', 'POST', request, token) as PublishTenantThemeResponse;
    }

    async uploadTenantImage(tenantId: string, assetType: 'logo' | 'favicon', file: File | Buffer, contentType: string, token?: AuthToken): Promise<{ url: string; }> {
        const url = `${this.config.baseUrl}/admin/tenants/${tenantId}/assets/${assetType}`;
        const body = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': contentType,
                Accept: 'application/json',
                Host: 'localhost',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            // Buffer is compatible with fetch body at runtime, but TS types don't recognize it
            body: body as unknown as BodyInit,
        });

        if (!response.ok) {
            const errorText = await response.text();
            let parsedError: unknown = errorText;
            try {
                parsedError = JSON.parse(errorText);
            } catch {
                // keep as text
            }
            const error = new Error(`API request to /admin/tenants/${tenantId}/assets/${assetType} failed with status ${response.status}`);
            (error as any).status = response.status;
            (error as any).response = parsedError;
            throw error;
        }

        return await response.json() as { url: string; };
    }

    // ===== ADMIN API: TENANT SETTINGS =====

    async getTenantSettings(token?: AuthToken): Promise<TenantSettingsResponse> {
        return await this.apiRequest('/settings/tenant', 'GET', null, token) as TenantSettingsResponse;
    }

    async updateTenantBranding(request: UpdateTenantBrandingRequest, token: AuthToken): Promise<void> {
        await this.apiRequest('/settings/tenant/branding', 'PUT', request, token);
    }

    async getTenantDomains(token?: AuthToken): Promise<TenantDomainsResponse> {
        return await this.apiRequest('/settings/tenant/domains', 'GET', null, token) as TenantDomainsResponse;
    }

    async addTenantDomain(request: AddTenantDomainRequest, token: AuthToken): Promise<void> {
        await this.apiRequest('/settings/tenant/domains', 'POST', request, token);
    }

    async getEnvironmentDiagnostics(token: AuthToken): Promise<EnvironmentDiagnosticsResponse> {
        return await this.apiRequest('/env', 'GET', null, token) as EnvironmentDiagnosticsResponse;
    }

    // ===== ADMIN API: TENANT IMAGE LIBRARY =====

    async listTenantImages(tenantId: string, token?: AuthToken): Promise<ListTenantImagesResponse> {
        return await this.apiRequest(`/admin/tenants/${tenantId}/images`, 'GET', null, token) as ListTenantImagesResponse;
    }

    async uploadTenantLibraryImage(tenantId: string, name: string, file: File | Buffer, contentType: string, token?: AuthToken): Promise<UploadTenantLibraryImageResponse> {
        const url = `${this.config.baseUrl}/admin/tenants/${tenantId}/images?name=${encodeURIComponent(name)}`;
        const body = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': contentType,
                Accept: 'application/json',
                Host: 'localhost',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: body as unknown as BodyInit,
        });

        if (!response.ok) {
            const errorText = await response.text();
            let parsedError: unknown = errorText;
            try {
                parsedError = JSON.parse(errorText);
            } catch {
                // keep as text
            }
            const error = new Error(`API request to /admin/tenants/${tenantId}/images failed with status ${response.status}`);
            (error as any).status = response.status;
            (error as any).response = parsedError;
            throw error;
        }

        return await response.json() as UploadTenantLibraryImageResponse;
    }

    async renameTenantImage(tenantId: string, imageId: TenantImageId, request: RenameTenantImageRequest, token?: AuthToken): Promise<void> {
        await this.apiRequest(`/admin/tenants/${tenantId}/images/${imageId}`, 'PATCH', request, token);
    }

    async deleteTenantImage(tenantId: string, imageId: TenantImageId, token?: AuthToken): Promise<void> {
        await this.apiRequest(`/admin/tenants/${tenantId}/images/${imageId}`, 'DELETE', null, token);
    }

    async getDefaultAdminUser(): Promise<PooledTestUser> {
        try {
            const credentials = await this.firebaseSignIn({
                email: DEFAULT_ADMIN_EMAIL,
                password: DEFAULT_PASSWORD,
            });

            return {
                ...credentials,
                email: DEFAULT_ADMIN_EMAIL,
                password: DEFAULT_PASSWORD,
            };
        } catch (error) {
            const hint = `Default admin (${DEFAULT_ADMIN_EMAIL}) unavailable. Ensure the Bill Splitter test account exists (run firebase/scripts/start-with-data.ts).`;
            if (error instanceof Error) {
                error.message = `${hint} Original error: ${error.message}`;
                throw error;
            }
            throw new Error(hint);
        }
    }

    private isRegistrationRecoverable(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        const message = error.message ?? '';
        if (message.includes('EMAIL_EXISTS') || message.includes('EMAIL_ALREADY_EXISTS')) {
            return true;
        }

        const response = (error as { response?: unknown; }).response;
        if (response && typeof response === 'object') {
            const errorObj = (response as { error?: { code?: string; detail?: string; }; }).error;
            if (errorObj?.code === 'REGISTRATION_FAILED' || errorObj?.code === 'ALREADY_EXISTS') {
                return true;
            }
            if (errorObj?.detail === 'EMAIL_ALREADY_EXISTS') {
                return true;
            }
        }

        return false;
    }
}
