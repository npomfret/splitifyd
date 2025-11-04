import type {CommentText, Email, GroupName, UserId, VersionHash} from '@splitifyd/shared';
import {
    AcceptMultiplePoliciesResponse,
    type ActivityFeedResponse,
    ApiSerializer,
    AuthenticatedFirebaseUser,
    ChangeEmailRequest,
    CommentDTO,
    type CreateExpenseRequest,
    type CreateGroupRequest,
    type CreateSettlementRequest,
    CurrentPolicyResponse,
    DisplayName,
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
    JoinGroupResponse,
    type ListCommentsOptions,
    ListCommentsResponse,
    type ListGroupsOptions,
    ListGroupsResponse,
    type MemberRole,
    MessageResponse,
    PasswordChangeRequest,
    PolicyId,
    PooledTestUser,
    type PreviewGroupResponse,
    RegisterResponse,
    type SettlementDTO,
    SettlementId,
    SettlementWithMembers,
    ShareLinkResponse,
    toGroupName,
    type UpdateGroupRequest,
    type UpdateSettlementRequest,
    UpdateUserProfileRequest,
    UserPolicyStatusResponse,
    UserProfileResponse,
    UserRegistration,
    UserToken,
} from '@splitifyd/shared';
import { UserRegistrationBuilder } from './builders';
import { getFirebaseEmulatorConfig } from './firebase-emulator-config';
import { Matcher, PollOptions, pollUntil } from './Polling';

const config = getFirebaseEmulatorConfig();
const FIREBASE_API_KEY = config.firebaseApiKey;
const FIREBASE_AUTH_URL = `http://localhost:${config.authPort}`;
const API_BASE_URL = config.baseUrl;

/**
 * HTTP-based API driver for testing against the Firebase emulator.
 *
 * This class implements the operations defined in IApiClient with a token-based authentication model.
 * It follows the pattern: method(data, token) where token is a Firebase auth token.
 *
 * @see IApiClient for the complete list of supported operations
 */
export class ApiDriver {
    private baseUrl: string;
    private readonly authPort: number;
    private readonly firebaseApiKey: string;

    static readonly matchers = {
        balanceHasUpdate: () => (balances: GroupBalances) => balances.simplifiedDebts && balances.simplifiedDebts.length >= 0 && !!balances.lastUpdated,
    };

    constructor() {
        this.baseUrl = API_BASE_URL;
        this.authPort = Number(new URL(FIREBASE_AUTH_URL).port);
        this.firebaseApiKey = FIREBASE_API_KEY;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    overrideBaseUrl(baseUrl: string): void {
        this.baseUrl = baseUrl;
    }

    async createUser(userRegistration: UserRegistration = new UserRegistrationBuilder()
        .build()): Promise<AuthenticatedFirebaseUser>
    {
        let registrationError: unknown = null;

        try {
            await this.apiRequest('/register', 'POST', userRegistration);
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
            signInResponse = await fetch(`http://localhost:${this.authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${this.firebaseApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: userInfo.token,
                    returnSecureToken: true,
                }),
            });
        } else {
            signInResponse = await fetch(`http://localhost:${this.authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.firebaseApiKey}`, {
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
            uid: decodedToken.user_id,
            token: authData.idToken,
        };
    }

    async returnTestUser(email: Email): Promise<void> {
        await this.apiRequest('/test-pool/return', 'POST', { email });
    }

    async createExpense(expenseData: Partial<CreateExpenseRequest>, token: string): Promise<ExpenseDTO> {
        const response = await this.apiRequest('/expenses', 'POST', expenseData, token);
        return response as ExpenseDTO;
    }

    async updateExpense(expenseId: ExpenseId | string, data: Partial<CreateExpenseRequest>, token: string): Promise<ExpenseDTO> {
        return await this.apiRequest(`/expenses?id=${expenseId}`, 'PUT', data, token);
    }

    async deleteExpense(expenseId: ExpenseId | string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/expenses?id=${expenseId}`, 'DELETE', null, token);
    }

    async getExpense(expenseId: ExpenseId | string, token: string): Promise<ExpenseDTO> {
        const response = await this.apiRequest(`/expenses/${expenseId}/full-details`, 'GET', null, token);
        return response.expense;
    }

    async createSettlement(settlementData: CreateSettlementRequest, token: string): Promise<SettlementDTO> {
        const response = await this.apiRequest('/settlements', 'POST', settlementData, token);
        return response as SettlementDTO;
    }

    async updateSettlement(settlementId: SettlementId | string, updateData: UpdateSettlementRequest, token: string): Promise<SettlementWithMembers> {
        const response = await this.apiRequest(`/settlements/${settlementId}`, 'PUT', updateData, token);
        return response;
    }

    async deleteSettlement(settlementId: SettlementId | string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/settlements/${settlementId}`, 'DELETE', null, token);
    }

    async pollGroupBalancesUntil(groupId: GroupId | string, token: string, matcher: Matcher<GroupBalances>, options?: PollOptions): Promise<GroupBalances> {
        return pollUntil(() => this.getGroupBalances(groupId, token), matcher, { errorMsg: `Group ${groupId} balance condition not met`, ...options });
    }

    async waitForBalanceUpdate(groupId: GroupId | string, token: string, timeoutMs: number = 1000): Promise<GroupBalances> {
        return this.pollGroupBalancesUntil(groupId, token, ApiDriver.matchers.balanceHasUpdate(), { timeout: timeoutMs });
    }

    async generateShareableLink(groupId: GroupId | string, expiresAt: string | undefined = undefined, token: string): Promise<ShareLinkResponse> {
        const body: Record<string, unknown> = { groupId };
        if (expiresAt) {
            body.expiresAt = expiresAt;
        }

        return await this.apiRequest('/groups/share', 'POST', body, token);
    }

    async joinGroupByLink(shareToken: string, token: string, groupDisplayName?: string): Promise<JoinGroupResponse> {
        const displayName = groupDisplayName || `Test User ${Date.now()}`;
        return await this.apiRequest('/groups/join', 'POST', { shareToken, groupDisplayName: displayName }, token);
    }

    async previewGroupByLink(shareToken: string, token: string): Promise<PreviewGroupResponse> {
        return await this.apiRequest('/groups/preview', 'POST', { shareToken }, token);
    }

    async createGroupWithMembers(name: string | GroupName, members: UserToken[], creatorToken: string): Promise<GroupDTO> {
        // Step 1: Create group with just the creator
        const creatorDisplayName = `Owner ${Math.random().toString(36).slice(2, 8)}`;

        const groupData = {
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

    async addMembersViaShareLink(groupId: GroupId | string, toAdd: UserToken[], creatorToken: string) {
        if (toAdd.length > 0) {
            const { shareToken } = await this.generateShareableLink(groupId, undefined, creatorToken);

            // Step 3: Have other members join using the share link
            for (const member of toAdd) {
                await this.joinGroupByLink(shareToken, member.token);
            }
        }
    }

    async createGroup(groupData: CreateGroupRequest, token: string): Promise<GroupDTO> {
        return (await this.apiRequest('/groups', 'POST', groupData, token)) as GroupDTO;
    }

    async getGroup(groupId: GroupId | string, token: string): Promise<GroupDTO> {
        const res = await this.getGroupFullDetails(groupId, undefined, token);
        return res.group;
    }

    async getGroupFullDetails(groupId: GroupId | string, options: GetGroupFullDetailsOptions | undefined = undefined, token: string,): Promise<GroupFullDetailsDTO> {
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

    async getExpenseFullDetails(expenseId: ExpenseId | string, token: string): Promise<ExpenseFullDetailsDTO> {
        return await this.apiRequest(`/expenses/${expenseId}/full-details`, 'GET', null, token);
    }

    async updateGroup(groupId: GroupId | string, data: UpdateGroupRequest, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}`, 'PUT', data, token);
    }

    async deleteGroup(groupId: GroupId | string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}`, 'DELETE', null, token);
    }

    async updateGroupPermissions(groupId: GroupId | string, permissions: Partial<GroupPermissions>, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/security/permissions`, 'PATCH', permissions, token);
    }

    async updateMemberRole(groupId: GroupId | string, memberId: UserId | string, role: MemberRole, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/members/${memberId}/role`, 'PATCH', { role }, token);
    }

    async updateGroupMemberDisplayName(groupId: GroupId | string, displayName: DisplayName | string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/members/display-name`, 'PUT', { displayName }, token);
    }

    async approveMember(groupId: GroupId | string, memberId: UserId | string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/members/${memberId}/approve`, 'POST', {}, token);
    }

    async rejectMember(groupId: GroupId | string, memberId: UserId | string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/members/${memberId}/reject`, 'POST', {}, token);
    }

    async getPendingMembers(groupId: GroupId | string, token: string): Promise<GroupMembershipDTO[]> {
        const response = await this.apiRequest(`/groups/${groupId}/members/pending`, 'GET', null, token);
        return Array.isArray(response?.members) ? (response.members as GroupMembershipDTO[]) : [];
    }

    async listGroups(params: ListGroupsOptions | undefined = undefined, token: string): Promise<ListGroupsResponse> {
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

    async getActivityFeed(token: string, options?: GetActivityFeedOptions): Promise<ActivityFeedResponse> {
        const queryParams = new URLSearchParams();
        if (options?.limit) queryParams.append('limit', options.limit.toString());
        if (options?.cursor) queryParams.append('cursor', options.cursor);
        const queryString = queryParams.toString();
        return await this.apiRequest(`/activity-feed${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
    }

    async register(userData: { email: Email; password: string; displayName: DisplayName; termsAccepted?: boolean; cookiePolicyAccepted?: boolean; privacyPolicyAccepted?: boolean; },): Promise<RegisterResponse> {
        // Ensure required policy acceptance fields are provided with defaults
        const registrationData = {
            ...userData,
            termsAccepted: userData.termsAccepted ?? true,
            cookiePolicyAccepted: userData.cookiePolicyAccepted ?? true,
            privacyPolicyAccepted: userData.privacyPolicyAccepted ?? true,
        };
        return await this.apiRequest('/register', 'POST', registrationData);
    }

    async makeInvalidApiCall(endpoint: string, method: string = 'GET', body: unknown = null, token: string | null = null): Promise<any> {
        return await this.apiRequest(endpoint, method, body, token);
    }

    async leaveGroup(groupId: GroupId | string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/leave`, 'POST', null, token);
    }

    async archiveGroupForUser(groupId: GroupId | string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/archive`, 'POST', null, token);
    }

    async unarchiveGroupForUser(groupId: GroupId | string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/unarchive`, 'POST', null, token);
    }

    async removeGroupMember(groupId: GroupId | string, memberId: UserId | string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/members/${memberId}`, 'DELETE', null, token);
    }

    async getPolicy(policyId: PolicyId): Promise<CurrentPolicyResponse> {
        return await this.apiRequest(`/policies/${policyId}/current`, 'GET', null, null);
    }

    async getCurrentPolicy(policyId: PolicyId): Promise<CurrentPolicyResponse> {
        return this.getPolicy(policyId);
    }

    async acceptMultiplePolicies(acceptances: Array<{ policyId: PolicyId; versionHash: VersionHash; }>, token: string): Promise<AcceptMultiplePoliciesResponse> {
        return await this.apiRequest('/user/policies/accept-multiple', 'POST', { acceptances }, token);
    }

    async getUserPolicyStatus(token: string): Promise<UserPolicyStatusResponse> {
        return await this.apiRequest('/user/policies/status', 'GET', null, token);
    }

    async changePassword(passwordRequest: PasswordChangeRequest, token: string): Promise<MessageResponse> {
        return await this.apiRequest('/user/change-password', 'POST', passwordRequest, token);
    }

    async updateUserProfile(profileData: UpdateUserProfileRequest, token: string): Promise<UserProfileResponse> {
        return await this.apiRequest('/user/profile', 'PUT', profileData, token);
    }

    async changeEmail(changeEmailRequest: ChangeEmailRequest, token: string): Promise<UserProfileResponse> {
        return await this.apiRequest('/user/change-email', 'POST', changeEmailRequest, token);
    }

    // Comment API methods
    async createGroupComment(groupId: GroupId | string, text: CommentText | string, token: string): Promise<CommentDTO> {
        return await this.apiRequest(`/groups/${groupId}/comments`, 'POST', { text }, token);
    }

    async createExpenseComment(expenseId: ExpenseId | string, text: CommentText, token: string): Promise<CommentDTO> {
        return await this.apiRequest(`/expenses/${expenseId}/comments`, 'POST', { text }, token);
    }

    async listGroupComments(groupId: GroupId | string, options: ListCommentsOptions | undefined = undefined, token: string): Promise<ListCommentsResponse> {
        const params = new URLSearchParams();
        if (options?.cursor) params.append('cursor', options.cursor);
        if (options?.limit) params.append('limit', options.limit.toString());
        const query = params.toString() ? `?${params.toString()}` : '';

        return await this.apiRequest(`/groups/${groupId}/comments${query}`, 'GET', null, token);
    }

    async listExpenseComments(expenseId: ExpenseId | string, options: ListCommentsOptions | undefined = undefined, token: string): Promise<ListCommentsResponse> {
        const params = new URLSearchParams();
        if (options?.cursor) params.append('cursor', options.cursor);
        if (options?.limit) params.append('limit', options.limit.toString());
        const query = params.toString() ? `?${params.toString()}` : '';

        const response = await this.apiRequest(`/expenses/${expenseId}/comments${query}`, 'GET', null, token);
        return response;
    }

    private async apiRequest(endpoint: string, method: string = 'POST', body: unknown = null, token: string | null = null): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/x-serialized-json',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
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

    async getGroupBalances(groupId: GroupId | string, token: string) {
        const res = await this.getGroupFullDetails(groupId, undefined, token);
        return res.balances;
    }

    async getGroupExpenses(groupId: GroupId | string, token: string) {
        const res = await this.getGroupFullDetails(groupId, undefined, token);
        return res.expenses;
    }

    async getSettlement(groupId: GroupId | string, settlementId: SettlementId | string, token: string) {
        let res;

        try {
            res = await this.getGroupFullDetails(groupId, undefined, token);
        } catch (error: any) {
            // If getGroupFullDetails fails, it means the user can't access the group
            // This should be treated as NOT_GROUP_MEMBER regardless of the specific error code
            if (error.status === 403 || error.status === 404 || (error.message && (error.message.includes('Group not found') || error.message.includes('403')))) {
                const groupError = new Error(`Group access denied`);
                (groupError as any).status = 403;
                (groupError as any).message = 'status 403: NOT_GROUP_MEMBER';
                throw groupError;
            }

            // Re-throw other errors as-is
            throw error;
        }

        // At this point, we have group access, so check if settlement exists
        const settlement = res.settlements.settlements.find((s: any) => s.id === settlementId);

        if (!settlement) {
            // Create an error object with status and message properties to match expected test behavior
            const error = new Error(`Settlement not found`);
            (error as any).status = 404;
            (error as any).message = 'status 404: SETTLEMENT_NOT_FOUND';
            throw error;
        }

        return settlement;
    }

    async acceptCurrentPublishedPolicies(token: string): Promise<void> {
        // Get user's policy status which includes all existing policies
        const policyStatus = await this.apiRequest('/user/policies/status', 'GET', null, token);

        if (!policyStatus.policies || policyStatus.policies.length === 0) {
            console.log('No policies found to accept');
            return;
        }

        // Build acceptances for all policies (both accepted and unaccepted)
        // This ensures test users accept everything regardless of current status
        const acceptances = policyStatus.policies.map((policy: any) => ({
            policyId: policy.policyId,
            versionHash: policy.currentVersionHash,
        }));

        // console.log(`Accepting ${acceptances.length} policies for test user`);
        await this.apiRequest('/user/policies/accept-multiple', 'POST', { acceptances }, token);
    }

    async clearUserPolicyAcceptances(token: string): Promise<void> {
        // Clear all policy acceptances for the user to reset their state
        await this.apiRequest('/user/clear-policy-acceptances', 'POST', {}, token);
    }

    async resetPoliciesToBaseState(adminToken?: string): Promise<void> {
        // Reset all policies to fresh base content with timestamp to avoid duplicates
        const standardPolicies = ['terms-of-service', 'privacy-policy', 'cookie-policy'];
        const timestamp = Date.now();

        for (const policyId of standardPolicies) {
            const policyName = policyId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
            const baseContent = `${policyName} base version reset at ${timestamp}.`;

            try {
                await this.apiRequest(`/admin/policies/${policyId}`, 'PUT', { text: baseContent, publish: true }, adminToken);
                console.log(`✓ Reset policy ${policyId} to base content`);
            } catch (error) {
                console.warn(`Failed to reset policy ${policyId}:`, error);
            }
        }
    }

    async cleanupTestEnvironment(adminToken?: string): Promise<void> {
        // First, reset standard policies
        await this.resetPoliciesToBaseState(adminToken);

        // Then handle any non-standard policies by accepting them for test users
        // This prevents non-standard policies from interfering with tests
        try {
            // Get a test user to check what policies exist
            const testUser = await this.borrowTestUser();
            const policyStatus = await this.apiRequest('/user/policies/status', 'GET', null, testUser.token);

            // Check for and warn about non-standard policies
            if (policyStatus.policies && Array.isArray(policyStatus.policies)) {
                for (const policy of policyStatus.policies) {
                    if (!['terms-of-service', 'privacy-policy', 'cookie-policy'].includes(policy.policyId)) {
                        console.warn(`Found non-standard policy: ${policy.policyId} - accepting it to prevent test interference`);
                    }
                }

                // Accept all policies (including non-standard ones) to ensure clean state
                // This way non-standard policies won't appear in the acceptance modal during tests
                await this.acceptCurrentPublishedPolicies(testUser.token);
            }

            // Return the test user
            await this.returnTestUser(testUser.email);
            console.log('✓ Test environment cleanup completed');
        } catch (error) {
            console.warn('Failed to complete full environment cleanup:', error);
        }
    }

    // Policy administration methods for testing
    async updatePolicy(policyId: PolicyId, text: string, publish: boolean = true, adminToken?: string): Promise<any> {
        // Try with the adminToken first, then fall back to regular token
        const token = adminToken;
        return await this.apiRequest(`/admin/policies/${policyId}`, 'PUT', {
            text,
            publish,
        }, token);
    }

    async createPolicy(policyName: string, text: string, adminToken?: string): Promise<any> {
        // Try with the adminToken first, then fall back to regular token
        const token = adminToken;
        return await this.apiRequest('/admin/policies', 'POST', {
            policyName,
            text,
        }, token);
    }

    // Internal policy methods that bypass HTTP validation (for testing)
    async ensurePoliciesExist(): Promise<void> {
        const standardPolicies = ['terms-of-service', 'privacy-policy', 'cookie-policy'];

        for (const policyId of standardPolicies) {
            const policyName = policyId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
            const baseContent = `${policyName} base version.`;

            try {
                await this.apiRequest(`/policies/${policyId}/current`, 'GET');
            } catch (error) {
                await this.createPolicy(policyName, baseContent);
            }
        }
    }

    async updateSpecificPolicy(policyId: PolicyId, userToken?: string): Promise<void> {
        const timestamp = Date.now();
        const policyName = policyId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        const safeContent = `${policyName} version ${timestamp}. Updated policy content for testing.`;

        try {
            // Use the admin API for policy updates
            await this.updatePolicy(policyId, safeContent, true, userToken);
            console.log(`✓ Successfully updated policy ${policyId} via admin API`);
        } catch (apiError) {
            // If policy doesn't exist, create it
            try {
                await this.createPolicy(policyName, safeContent, userToken);
                console.log(`✓ Created new policy ${policyId} via admin API`);
            } catch (createError) {
                console.warn(`Failed to update or create policy ${policyId}:`, createError);
                throw createError;
            }
        }
    }

    private isRegistrationRecoverable(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        const message = error.message ?? '';
        if (message.includes('EMAIL_EXISTS') || message.includes('AUTH_EMAIL_ALREADY_EXISTS')) {
            return true;
        }

        const response = (error as { response?: unknown; }).response;
        if (response && typeof response === 'object') {
            const code = (response as { error?: { code?: string; }; }).error?.code;
            if (code === 'REGISTRATION_FAILED') {
                return true;
            }
        }

        return false;
    }
}
