import {
    type CreateExpenseRequest,
    CreateCommentResponse,
    CurrentPolicyResponse,
    ExpenseData,
    ExpenseFullDetails,
    ExpenseHistoryResponse,
    Group,
    GroupBalances,
    GroupFullDetails,
    GroupMembersResponse,
    GroupPermissions,
    JoinGroupResponse,
    LeaveGroupResponse,
    ListCommentsApiResponse,
    ListExpensesResponse,
    ListGroupsResponse,
    ListSettlementsResponse,
    MemberRole,
    MessageResponse,
    PendingMembersResponse,
    RegisterResponse,
    RemoveGroupMemberResponse,
    SecurityPreset,
    type Settlement,
    SettlementListItem,
    ShareLinkResponse,
    User as BaseUser,
    UserPoliciesResponse,
    UserProfileResponse,
} from '@splitifyd/shared';

import type {DocumentData} from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import {getFirebaseEmulatorConfig} from './firebase-emulator-config';
import {Matcher, PollOptions, pollUntil} from "./Polling";

const config = getFirebaseEmulatorConfig();
const FIREBASE_API_KEY = config.firebaseApiKey;
const FIREBASE_AUTH_URL = `http://localhost:${config.authPort}`;
const API_BASE_URL = config.baseUrl;

// Test-specific extension of User to include auth token
export interface User extends BaseUser {
    token: string;
}

/**
 * Helper functions for querying change collections in tests
 */

// New minimal change document structure
export interface MinimalChangeDocument extends DocumentData {
    id: string;
    type: 'group' | 'expense' | 'settlement';
    action: 'created' | 'updated' | 'deleted';
    timestamp: admin.firestore.Timestamp;
    users: string[];
    groupId?: string; // Only for expense/settlement
}

export interface MinimalBalanceChangeDocument extends DocumentData {
    groupId: string;
    type: 'balance';
    action: 'recalculated';
    timestamp: admin.firestore.Timestamp;
    users: string[];
}

// Type aliases for test compatibility
export interface GroupChangeDocument extends MinimalChangeDocument {
    type: 'group';
}

export interface ExpenseChangeDocument extends MinimalChangeDocument {
    type: 'expense';
    groupId: string;
}

export interface SettlementChangeDocument extends MinimalChangeDocument {
    type: 'settlement';
    groupId: string;
}

export interface BalanceChangeDocument extends MinimalBalanceChangeDocument {
}

export class ApiDriver {
    private readonly baseUrl: string;
    private readonly authPort: number;
    private readonly firebaseApiKey: string;

    static readonly matchers = {
        balanceHasUpdate: () => (balances: GroupBalances) => balances.userBalances && Object.keys(balances.userBalances).length > 0 && !!balances.lastUpdated,
    };

    constructor() {
        this.baseUrl = API_BASE_URL;
        this.authPort = Number(new URL(FIREBASE_AUTH_URL).port);
        this.firebaseApiKey = FIREBASE_API_KEY;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    async createUser(userInfo: { email: string; password: string; displayName: string }): Promise<User> {
        try {
            // Register user via API
            await this.apiRequest('/register', 'POST', {
                email: userInfo.email,
                password: userInfo.password,
                displayName: userInfo.displayName,
                termsAccepted: true,
                cookiePolicyAccepted: true,
            });
        } catch (error) {
            // Ignore "already exists" errors
            if (!(error instanceof Error && error.message.includes('EMAIL_EXISTS'))) {
                throw error;
            }
        }
        return await this.firebaseSignIn(userInfo);
    }

    async borrowTestUser(): Promise<User> {
        const poolUser = await this.apiRequest('/test-pool/borrow', 'POST', {});
        const {user: {displayName, email, password}, token} = poolUser;
        return await this.firebaseSignIn({email, password, displayName, token})
    }

    private async firebaseSignIn(userInfo: { email: string; password: string; displayName: string, token?: string }) {
        // Use Firebase Auth REST API to sign in

        let signInResponse: Response;
        if (userInfo.token) {
            // Exchange custom token for ID token
            signInResponse = await fetch(
                `http://localhost:${this.authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${this.firebaseApiKey}`,
                {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        token: userInfo.token,
                        returnSecureToken: true
                    })
                }
            );
        } else {
            signInResponse = await fetch(`http://localhost:${this.authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.firebaseApiKey}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    email: userInfo.email,
                    password: userInfo.password,
                    returnSecureToken: true,
                }),
            });
        }

        if (!signInResponse.ok) {
            const error = (await signInResponse.json()) as { error?: { message?: string } };
            throw new Error(`Custom token exchange failed: ${error.error?.message || 'Unknown error'}`);
        }

        const authData = (await signInResponse.json()) as { idToken: string };

        // We need the UID. In a real test setup, you might need to use the Admin SDK
        // to get this, but for this test, we'll just decode the token (INSECURE, FOR TESTING ONLY).
        const decodedToken = JSON.parse(Buffer.from(authData.idToken.split('.')[1], 'base64').toString()) as { user_id: string };

        return {
            uid: decodedToken.user_id,
            displayName: userInfo.displayName,
            email: userInfo.email,
            token: authData.idToken,
        };
    }

    async returnTestUser(email: string): Promise<void> {
        await this.apiRequest('/test-pool/return', 'POST', {email});
    }

    async getTestPoolStatus(): Promise<any> {
        return await this.apiRequest('/test-pool/status', 'GET');
    }

    async resetTestPool(): Promise<any> {
        return await this.apiRequest('/test-pool/reset', 'POST');
    }

    async createExpense(expenseData: Partial<CreateExpenseRequest>, token: string): Promise<ExpenseData> {
        const response = await this.apiRequest('/expenses', 'POST', expenseData, token);
        return response as ExpenseData;
    }

    async updateExpense(expenseId: string, updateData: Partial<ExpenseData>, token: string): Promise<ExpenseData> {
        return await this.apiRequest(`/expenses?id=${expenseId}`, 'PUT', updateData, token);
    }

    async deleteExpense(expenseId: string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/expenses?id=${expenseId}`, 'DELETE', null, token);
    }

    async getExpense(expenseId: string, token: string): Promise<ExpenseData> {
        return await this.apiRequest(`/expenses?id=${expenseId}`, 'GET', null, token);
    }

    async createSettlement(settlementData: any, token: string): Promise<Settlement> {
        const response = await this.apiRequest('/settlements', 'POST', settlementData, token);
        return response.data as Settlement;
    }

    async getSettlement(settlementId: string, token: string): Promise<SettlementListItem> {
        const response = await this.apiRequest(`/settlements/${settlementId}`, 'GET', null, token);
        return response.data;
    }

    async updateSettlement(settlementId: string, updateData: any, token: string): Promise<SettlementListItem> {
        const response = await this.apiRequest(`/settlements/${settlementId}`, 'PUT', updateData, token);
        return response.data;
    }

    async deleteSettlement(settlementId: string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/settlements/${settlementId}`, 'DELETE', null, token);
    }

    async listSettlements(
        token: string,
        params?: {
            groupId: string;
            limit?: number;
            cursor?: string;
            userId?: string;
            startDate?: string;
            endDate?: string;
        },
    ): Promise<ListSettlementsResponse> {
        const queryParams = new URLSearchParams();
        if (params?.groupId) queryParams.append('groupId', params.groupId);
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.cursor) queryParams.append('cursor', params.cursor);
        if (params?.userId) queryParams.append('userId', params.userId);
        if (params?.startDate) queryParams.append('startDate', params.startDate);
        if (params?.endDate) queryParams.append('endDate', params.endDate);
        const queryString = queryParams.toString();
        const response = await this.apiRequest(`/settlements${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
        return response.data;
    }

    async listUserExpenses(token: string, params?: Record<string, any>): Promise<ListExpensesResponse> {
        let endpoint = '/expenses/user';
        if (params) {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(key, value.toString());
                }
            });
            if (queryParams.toString()) {
                endpoint += '?' + queryParams.toString();
            }
        }
        return await this.apiRequest(endpoint, 'GET', null, token);
    }

    async getGroupExpenses(groupId: string, token: string, limit?: number): Promise<ListExpensesResponse> {
        const limitParam = limit ? `&limit=${limit}` : '';
        return await this.apiRequest(`/expenses/group?groupId=${groupId}${limitParam}`, 'GET', null, token);
    }

    async getExpenseHistory(expenseId: string, token: string): Promise<ExpenseHistoryResponse> {
        return await this.apiRequest(`/expenses/history?id=${expenseId}`, 'GET', null, token);
    }

    async getGroupBalances(groupId: string, token: string): Promise<GroupBalances> {
        return await this.apiRequest(`/groups/balances?groupId=${groupId}`, 'GET', null, token);
    }

    async pollGroupBalancesUntil(groupId: string, token: string, matcher: Matcher<GroupBalances>, options?: PollOptions): Promise<GroupBalances> {
        return pollUntil(() => this.getGroupBalances(groupId, token), matcher, {errorMsg: `Group ${groupId} balance condition not met`, ...options});
    }

    async waitForBalanceUpdate(groupId: string, token: string, timeoutMs: number = 10000): Promise<GroupBalances> {
        return this.pollGroupBalancesUntil(groupId, token, ApiDriver.matchers.balanceHasUpdate(), {timeout: timeoutMs});
    }

    async pollGroupUntilBalanceUpdated(groupId: string, token: string, matcher: Matcher<Group>, options?: PollOptions): Promise<Group> {
        return pollUntil(() => this.getGroup(groupId, token), matcher, {errorMsg: `Group ${groupId} balance condition not met`, ...options});
    }

    async generateShareLink(groupId: string, token: string): Promise<ShareLinkResponse> {
        return await this.apiRequest('/groups/share', 'POST', {groupId}, token);
    }

    async joinGroupViaShareLink(linkId: string, token: string): Promise<JoinGroupResponse> {
        return await this.apiRequest('/groups/join', 'POST', {linkId}, token);
    }

    async createGroupWithMembers(name: string, members: User[], creatorToken: string): Promise<Group> {
        // Step 1: Create group with just the creator
        const groupData = {name, description: `Test group created at ${new Date().toISOString()}`};

        const group = await this.createGroup(groupData, creatorToken);

        // Step 2: If there are other members, generate a share link and have them join
        const otherMembers = members.filter((m) => m.token !== creatorToken);
        if (otherMembers.length > 0) {
            const shareResponse = await this.generateShareLink(group.id, creatorToken);
            const {linkId} = shareResponse;

            // Step 3: Have other members join using the share link
            for (const member of otherMembers) {
                await this.joinGroupViaShareLink(linkId, member.token);
            }
        }

        // Step 4: Fetch the updated group to get all members
        const updatedGroup = await this.getGroup(group.id, creatorToken);

        for (const member of members) {
            // sanity check
            if (!(member.uid in updatedGroup.members))
                throw Error(`member ${JSON.stringify(member)} has been added to group, but does not appear in the members collection: ${JSON.stringify(Object.keys(group.members))}`);
        }

        return updatedGroup;
    }

    async createGroup(groupData: any, token: string): Promise<Group> {
        return (await this.apiRequest('/groups', 'POST', groupData, token)) as Group;
    }

    async getGroup(groupId: string, token: string): Promise<Group> {
        return (await this.apiRequest(`/groups/${groupId}`, 'GET', null, token)) as Group;
    }

    async getGroupMembers(groupId: string, token: string): Promise<GroupMembersResponse> {
        return await this.apiRequest(`/groups/${groupId}/members`, 'GET', null, token);
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
    ): Promise<GroupFullDetails> {
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

    async getExpenseFullDetails(expenseId: string, token: string): Promise<ExpenseFullDetails> {
        return await this.apiRequest(`/expenses/${expenseId}/full-details`, 'GET', null, token);
    }

    async updateGroup(groupId: string, data: any, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}`, 'PUT', data, token);
    }

    async deleteGroup(groupId: string, token: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}`, 'DELETE', null, token);
    }

    async applySecurityPreset(groupId: string, token: string, preset: SecurityPreset): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/security/preset`, 'POST', {preset}, token);
    }

    async updateGroupPermissions(groupId: string, token: string, permissions: Partial<GroupPermissions>): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/permissions`, 'PUT', {permissions}, token);
    }

    async setMemberRole(groupId: string, token: string, targetUserId: string, role: MemberRole): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/members/${targetUserId}/role`, 'PUT', {role}, token);
    }

    async approveMember(groupId: string, token: string, targetUserId: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/members/approve`, 'PUT', {targetUserId}, token);
    }

    async rejectMember(groupId: string, token: string, targetUserId: string): Promise<MessageResponse> {
        return await this.apiRequest(`/groups/${groupId}/members/reject`, 'PUT', {targetUserId}, token);
    }

    async getPendingMembers(groupId: string, token: string): Promise<PendingMembersResponse> {
        return await this.apiRequest(`/groups/${groupId}/members/pending`, 'GET', null, token);
    }

    async listGroups(token: string, params?: { limit?: number; cursor?: string; order?: 'asc' | 'desc'; includeMetadata?: boolean }): Promise<ListGroupsResponse> {
        const queryParams = new URLSearchParams();
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.cursor) queryParams.append('cursor', params.cursor);
        if (params?.order) queryParams.append('order', params.order);
        if (params?.includeMetadata !== undefined) queryParams.append('includeMetadata', params.includeMetadata.toString());
        const queryString = queryParams.toString();
        return await this.apiRequest(`/groups${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
    }

    async register(userData: { email: string; password: string; displayName: string; termsAccepted?: boolean; cookiePolicyAccepted?: boolean }): Promise<RegisterResponse> {
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

    async getAllPolicies(): Promise<UserPoliciesResponse> {
        return await this.apiRequest('/policies/current', 'GET', null, null);
    }

    async getPolicy(policyId: string): Promise<CurrentPolicyResponse> {
        return await this.apiRequest(`/policies/${policyId}/current`, 'GET', null, null);
    }

    async getUserProfile(token: string | null): Promise<UserProfileResponse> {
        return await this.apiRequest('/user/profile', 'GET', null, token);
    }

    async updateUserProfile(token: string | null, updates: { displayName?: string; photoURL?: string | null }): Promise<UserProfileResponse> {
        return await this.apiRequest('/user/profile', 'PUT', updates, token);
    }

    async changePassword(token: string | null, currentPassword: string, newPassword: string): Promise<MessageResponse> {
        return await this.apiRequest('/user/change-password', 'POST', {currentPassword, newPassword}, token);
    }

    async sendPasswordResetEmail(email: string): Promise<MessageResponse> {
        return await this.apiRequest('/user/reset-password', 'POST', {email}, null);
    }

    async deleteUserAccount(token: string | null, confirmDelete: boolean): Promise<MessageResponse> {
        return await this.apiRequest('/user/account', 'DELETE', {confirmDelete}, token);
    }

    // Comment API methods
    async createGroupComment(groupId: string, text: string, token: string): Promise<CreateCommentResponse> {
        return await this.apiRequest(`/groups/${groupId}/comments`, 'POST', { text }, token);
    }

    async createExpenseComment(expenseId: string, text: string, token: string): Promise<CreateCommentResponse> {
        return await this.apiRequest(`/expenses/${expenseId}/comments`, 'POST', { text }, token);
    }

    async listGroupComments(groupId: string, token: string, params?: Record<string, any>): Promise<ListCommentsApiResponse> {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(key, value.toString());
                }
            });
        }
        const queryString = queryParams.toString();
        return await this.apiRequest(`/groups/${groupId}/comments${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
    }

    async listExpenseComments(expenseId: string, token: string, params?: Record<string, any>): Promise<ListCommentsApiResponse> {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(key, value.toString());
                }
            });
        }
        const queryString = queryParams.toString();
        return await this.apiRequest(`/expenses/${expenseId}/comments${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
    }

    // todo: this should be private
    async apiRequest(endpoint: string, method: string = 'POST', body: unknown = null, token: string | null = null): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token && {Authorization: `Bearer ${token}`}),
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
                throw new Error(`Cannot connect to emulator. Please ensure the Firebase emulator is running.`);
            }
            throw error;
        }
    }
}

