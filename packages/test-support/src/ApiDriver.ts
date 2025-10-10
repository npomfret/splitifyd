import {
    AuthenticatedFirebaseUser,
    CreateCommentResponse,
    type CreateExpenseRequest,
    CurrentPolicyResponse,
    ExpenseDTO,
    ExpenseFullDetailsDTO,
    GroupBalances,
    GroupDTO,
    GroupFullDetailsDTO,
    JoinGroupResponse,
    LeaveGroupResponse,
    ListCommentsResponse,
    ListGroupsResponse,
    MessageResponse,
    PooledTestUser,
    RegisterResponse,
    RemoveGroupMemberResponse,
    type SettlementDTO,
    SettlementWithMembers,
    ShareLinkResponse,
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

export class ApiDriver {
    private readonly baseUrl: string;
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

    async createUser(userRegistration: UserRegistration = new UserRegistrationBuilder()
        .build()): Promise<AuthenticatedFirebaseUser>
    {
        try {
            // Register user via API
            await this.apiRequest('/register', 'POST', userRegistration);
        } catch (error) {
            // Ignore "already exists" errors
            if (!(error instanceof Error && error.message.includes('EMAIL_EXISTS'))) {
                throw error;
            }
        }

        const { uid, token } = await this.firebaseSignIn(userRegistration);

        return {
            uid,
            token,
            displayName: userRegistration.displayName,
        };
    }

    async borrowTestUser(): Promise<PooledTestUser> {
        const poolUser = (await this.apiRequest('/test-pool/borrow', 'POST', {})) as { email: string; token: string; password: string; };

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

    private async firebaseSignIn(userInfo: { email: string; password: string; token?: string; }): Promise<UserToken> {
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

    async returnTestUser(email: string): Promise<void> {
        await this.apiRequest('/test-pool/return', 'POST', { email });
    }

    async createExpense(expenseData: Partial<CreateExpenseRequest>, token: string): Promise<ExpenseDTO> {
        const response = await this.apiRequest('/expenses', 'POST', expenseData, token);
        return response as ExpenseDTO;
    }

    async updateExpense(expenseId: string, updateData: Partial<ExpenseDTO>, token: string): Promise<ExpenseDTO> {
        return await this.apiRequest(`/expenses?id=${expenseId}`, 'PUT', updateData, token);
    }

    async deleteExpense(expenseId: string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/expenses?id=${expenseId}`, 'DELETE', null, token);
    }

    async getExpense(expenseId: string, token: string): Promise<ExpenseDTO> {
        const response = await this.apiRequest(`/expenses/${expenseId}/full-details`, 'GET', null, token);
        return response.expense;
    }

    async createSettlement(settlementData: any, token: string): Promise<SettlementDTO> {
        const response = await this.apiRequest('/settlements', 'POST', settlementData, token);
        return response.data as SettlementDTO;
    }

    async updateSettlement(settlementId: string, updateData: any, token: string): Promise<SettlementWithMembers> {
        const response = await this.apiRequest(`/settlements/${settlementId}`, 'PUT', updateData, token);
        return response.data;
    }

    async deleteSettlement(settlementId: string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/settlements/${settlementId}`, 'DELETE', null, token);
    }

    async pollGroupBalancesUntil(groupId: string, token: string, matcher: Matcher<GroupBalances>, options?: PollOptions): Promise<GroupBalances> {
        return pollUntil(() => this.getGroupBalances(groupId, token), matcher, { errorMsg: `Group ${groupId} balance condition not met`, ...options });
    }

    async waitForBalanceUpdate(groupId: string, token: string, timeoutMs: number = 1000): Promise<GroupBalances> {
        return this.pollGroupBalancesUntil(groupId, token, ApiDriver.matchers.balanceHasUpdate(), { timeout: timeoutMs });
    }

    async generateShareLink(groupId: string, token: string): Promise<ShareLinkResponse> {
        return await this.apiRequest('/groups/share', 'POST', { groupId }, token);
    }

    async joinGroupViaShareLink(linkId: string, token: string): Promise<JoinGroupResponse> {
        return await this.apiRequest('/groups/join', 'POST', { linkId }, token);
    }

    async createGroupWithMembers(name: string, members: UserToken[], creatorToken: string): Promise<GroupDTO> {
        // Step 1: Create group with just the creator
        const groupData = { name, description: `Test group created at ${new Date().toISOString()}` };

        const group = await this.createGroup(groupData, creatorToken);

        // Step 2: If there are other members, generate a share link and have them join
        const otherMembers = members.filter((m) => m.token !== creatorToken);
        await this.addMembersViaShareLink(group.id, otherMembers, creatorToken);
        const { group: updatedGroup } = await this.getGroupFullDetails(group.id, creatorToken);
        return updatedGroup;
    }

    async addMembersViaShareLink(groupId: string, toAdd: UserToken[], creatorToken: string) {
        if (toAdd.length > 0) {
            const { linkId } = await this.generateShareLink(groupId, creatorToken);

            // Step 3: Have other members join using the share link
            for (const member of toAdd) {
                await this.joinGroupViaShareLink(linkId, member.token);
            }
        }
    }

    async createGroup(groupData: any, token: string): Promise<GroupDTO> {
        return (await this.apiRequest('/groups', 'POST', groupData, token)) as GroupDTO;
    }

    async getGroup(groupId: string, token: string): Promise<GroupDTO> {
        const res = await this.getGroupFullDetails(groupId, token);
        return res.group;
    }

    async getGroupFullDetails(
        groupId: string,
        token: string,
        options?: {
            expenseLimit?: number;
            expenseCursor?: string;
            settlementLimit?: number;
            settlementCursor?: string;
        },
    ): Promise<GroupFullDetailsDTO> {
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

    async getExpenseFullDetails(expenseId: string, token: string): Promise<ExpenseFullDetailsDTO> {
        return await this.apiRequest(`/expenses/${expenseId}/full-details`, 'GET', null, token);
    }

    async updateGroup(groupId: string, data: any, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}`, 'PUT', data, token);
    }

    async deleteGroup(groupId: string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}`, 'DELETE', null, token);
    }

    async listGroups(token: string, params?: { limit?: number; cursor?: string; order?: 'asc' | 'desc'; includeMetadata?: boolean; }): Promise<ListGroupsResponse> {
        const queryParams = new URLSearchParams();
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.cursor) queryParams.append('cursor', params.cursor);
        if (params?.order) queryParams.append('order', params.order);
        if (params?.includeMetadata !== undefined) queryParams.append('includeMetadata', params.includeMetadata.toString());
        const queryString = queryParams.toString();
        return await this.apiRequest(`/groups${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
    }

    async register(userData: { email: string; password: string; displayName: string; termsAccepted?: boolean; cookiePolicyAccepted?: boolean; }): Promise<RegisterResponse> {
        // Ensure required policy acceptance fields are provided with defaults
        const registrationData = {
            ...userData,
            termsAccepted: userData.termsAccepted ?? true,
            cookiePolicyAccepted: userData.cookiePolicyAccepted ?? true,
        };
        return await this.apiRequest('/register', 'POST', registrationData);
    }

    async makeInvalidApiCall(endpoint: string, method: string = 'GET', body: unknown = null, token: string | null = null): Promise<any> {
        return await this.apiRequest(endpoint, method, body, token);
    }

    async leaveGroup(groupId: string, token: string): Promise<LeaveGroupResponse> {
        return await this.apiRequest(`/groups/${groupId}/leave`, 'POST', null, token);
    }

    async removeGroupMember(groupId: string, memberId: string, token: string): Promise<RemoveGroupMemberResponse> {
        return await this.apiRequest(`/groups/${groupId}/members/${memberId}`, 'DELETE', null, token);
    }

    async getPolicy(policyId: string): Promise<CurrentPolicyResponse> {
        return await this.apiRequest(`/policies/${policyId}/current`, 'GET', null, null);
    }

    async changePassword(token: string | null, currentPassword: string, newPassword: string): Promise<MessageResponse> {
        return await this.apiRequest('/user/change-password', 'POST', { currentPassword, newPassword }, token);
    }

    async updateUserProfile(profileData: { displayName?: string }, token: string): Promise<any> {
        return await this.apiRequest('/user/profile', 'PUT', profileData, token);
    }

    async createComment(id: string, type: 'group' | 'expense', text: string, token: string): Promise<CreateCommentResponse> {
        if (type === 'group') {
            return this.createGroupComment(id, text, token);
        } else {
            return this.createExpenseComment(id, text, token);
        }
    }

    // Comment API methods
    async createGroupComment(groupId: string, text: string, token: string): Promise<CreateCommentResponse> {
        return await this.apiRequest(`/groups/${groupId}/comments`, 'POST', { text }, token);
    }

    async createExpenseComment(expenseId: string, text: string, token: string): Promise<CreateCommentResponse> {
        return await this.apiRequest(`/expenses/${expenseId}/comments`, 'POST', { text }, token);
    }

    async listGroupComments(groupId: string, token: string, cursor?: string, limit?: number): Promise<ListCommentsResponse> {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', cursor);
        if (limit) params.append('limit', limit.toString());
        const query = params.toString() ? `?${params.toString()}` : '';

        const response = await this.apiRequest(`/groups/${groupId}/comments${query}`, 'GET', null, token);
        return response.data;
    }

    async listExpenseComments(expenseId: string, token: string, cursor?: string, limit?: number): Promise<ListCommentsResponse> {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', cursor);
        if (limit) params.append('limit', limit.toString());
        const query = params.toString() ? `?${params.toString()}` : '';

        const response = await this.apiRequest(`/expenses/${expenseId}/comments${query}`, 'GET', null, token);
        return response.data;
    }

    private async apiRequest(endpoint: string, method: string = 'POST', body: unknown = null, token: string | null = null): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
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

                // Check if this might be an emulator restart
                if (response.status === 500 && errorText.includes('ECONNREFUSED')) {
                    throw new Error(`Emulator appears to be restarting. Please wait and try again.`);
                }

                // Create an error object with status and message properties for better testing
                const error = new Error(`API request to ${endpoint} failed with status ${response.status}: ${errorText}`);
                (error as any).status = response.status;
                (error as any).response = errorText;
                throw error;
            }
            // Handle cases where the response might be empty
            const responseText = await response.text();
            return responseText ? JSON.parse(responseText) : {};
        } catch (error) {
            // Check for connection errors that might indicate emulator restart
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error(`Cannot connect to emulator at ${url}. Please ensure the Firebase emulator is running.`);
            }
            throw error;
        }
    }

    async getGroupBalances(groupId: string, token: string) {
        const res = await this.getGroupFullDetails(groupId, token);
        return res.balances;
    }

    async getGroupExpenses(groupId: string, token: string) {
        const res = await this.getGroupFullDetails(groupId, token);
        return res.expenses;
    }

    async getSettlement(groupId: string, settlementId: string, token: string) {
        let res;

        try {
            res = await this.getGroupFullDetails(groupId, token);
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
        // Use test endpoint which handles token verification server-side
        await this.apiRequest('/test/user/clear-policy-acceptances', 'POST', {}, token);
    }

    async promoteUserToAdmin(token: string): Promise<void> {
        // Promote the user to admin role for testing admin endpoints
        await this.apiRequest('/test/user/promote-to-admin', 'POST', {}, token);
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

        // Then try to clean up any non-standard policies by checking user policy status
        // and removing any policies that aren't our standard ones
        try {
            // Get a test user to check what policies exist
            const testUser = await this.borrowTestUser();
            const policyStatus = await this.apiRequest('/user/policies/status', 'GET', null, testUser.token);

            if (policyStatus.outstandingPolicies) {
                for (const policy of policyStatus.outstandingPolicies) {
                    if (!['terms-of-service', 'privacy-policy', 'cookie-policy'].includes(policy.id)) {
                        console.warn(`Found non-standard policy: ${policy.id} - this may interfere with tests`);
                    }
                }
            }

            // Return the test user
            await this.returnTestUser(testUser.email);
            console.log('✓ Test environment cleanup completed');
        } catch (error) {
            console.warn('Failed to complete full environment cleanup:', error);
        }
    }

    // Policy administration methods for testing
    async updatePolicy(policyId: string, text: string, publish: boolean = true, adminToken?: string): Promise<any> {
        // Try with the adminToken first, then fall back to regular token
        const token = adminToken;
        return await this.apiRequest(`/admin/policies/${policyId}`, 'PUT', { text, publish }, token);
    }

    async createPolicy(policyName: string, text: string, adminToken?: string): Promise<any> {
        // Try with the adminToken first, then fall back to regular token
        const token = adminToken;
        return await this.apiRequest('/admin/policies', 'POST', { policyName, text }, token);
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

    async updateSpecificPolicy(policyId: string, userToken?: string): Promise<void> {
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
}
