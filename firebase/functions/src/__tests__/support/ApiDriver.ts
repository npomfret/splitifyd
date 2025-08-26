import {
    type CreateExpenseRequest,
    CurrentPolicyResponse,
    ExpenseData,
    ExpenseFullDetails,
    ExpenseHistoryResponse,
    FirestoreCollections,
    Group,
    GroupBalances,
    GroupFullDetails,
    GroupMembersResponse,
    JoinGroupResponse,
    LeaveGroupResponse,
    ListExpensesResponse,
    ListGroupsResponse,
    ListSettlementsResponse,
    MessageResponse,
    RegisterResponse,
    RemoveGroupMemberResponse,
    type Settlement,
    SettlementListItem,
    ShareLinkResponse,
    User as BaseUser,
    UserPoliciesResponse,
    UserProfileResponse,
} from '@splitifyd/shared';
import {API_BASE_URL, FIREBASE_API_KEY, FIREBASE_AUTH_URL} from "./firebase-emulator";
import type {DocumentData} from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import {firestoreDb} from "../../firebase";

// Test-specific extension of User to include auth token
export interface User extends BaseUser {
    token: string;
}

// Re-export shared types for backward compatibility
// Polling configuration interface
interface PollOptions {
    timeout?: number; // Total timeout in ms (default: 10000)
    interval?: number; // Polling interval in ms (default: 500)
    errorMsg?: string; // Custom error message
    onRetry?: (attempt: number, error?: Error) => void; // Callback for debugging
}

// Generic matcher type
type Matcher<T> = (value: T) => boolean | Promise<boolean>;


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

        // Use Firebase Auth REST API to sign in
        const signInResponse = await fetch(`http://localhost:${this.authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.firebaseApiKey}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                email: userInfo.email,
                password: userInfo.password,
                returnSecureToken: true,
            }),
        });

        if (!signInResponse.ok) {
            const error = (await signInResponse.json()) as { error?: { message?: string } };
            throw new Error(`Authentication failed: ${error.error?.message || 'Unknown error'}`);
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

    async getExpenseHistory(
        expenseId: string,
        token: string,
    ): Promise<ExpenseHistoryResponse> {
        return await this.apiRequest(`/expenses/history?id=${expenseId}`, 'GET', null, token);
    }

    async getGroupBalances(groupId: string, token: string): Promise<GroupBalances> {
        return await this.apiRequest(`/groups/balances?groupId=${groupId}`, 'GET', null, token);
    }

    async pollGroupBalancesUntil(groupId: string, token: string, matcher: Matcher<GroupBalances>, options?: PollOptions): Promise<GroupBalances> {
        return this.pollUntil(() => this.getGroupBalances(groupId, token), matcher, {errorMsg: `Group ${groupId} balance condition not met`, ...options});
    }

    async waitForBalanceUpdate(groupId: string, token: string, timeoutMs: number = 10000): Promise<GroupBalances> {
        return this.pollGroupBalancesUntil(groupId, token, ApiDriver.matchers.balanceHasUpdate(), {timeout: timeoutMs});
    }

    async pollGroupUntilBalanceUpdated(groupId: string, token: string, matcher: Matcher<Group>, options?: PollOptions): Promise<Group> {
        return this.pollUntil(() => this.getGroup(groupId, token), matcher, {errorMsg: `Group ${groupId} balance condition not met`, ...options});
    }

    async generateShareLink(groupId: string, token: string): Promise<ShareLinkResponse> {
        return await this.apiRequest('/groups/share', 'POST', {groupId}, token);
    }

    async joinGroupViaShareLink(linkId: string, token: string): Promise<JoinGroupResponse> {
        return await this.apiRequest('/groups/join', 'POST', {linkId}, token);
    }

    async createGroupWithMembers(name: string, members: User[], creatorToken: string): Promise<Group> {
        // Step 1: Create group with just the creator
        const groupData = {name, description: `Test group created at ${new Date().toISOString()}`,};

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

        for (const member of members) {// sanity check
            if(!(member.uid in updatedGroup.members))
                throw Error(`member ${JSON.stringify(member)} has been added to group, but does not appear in the members collection: ${JSON.stringify(Object.keys(group.members))}`)
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

    async getGroupFullDetails(groupId: string, token: string, options?: {
        expenseLimit?: number;
        expenseCursor?: string;
        settlementLimit?: number;
        settlementCursor?: string;
    }): Promise<GroupFullDetails> {
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

    async listGroups(token: string, params?: { limit?: number; cursor?: string; order?: 'asc' | 'desc' }): Promise<ListGroupsResponse> {
        const queryParams = new URLSearchParams();
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.cursor) queryParams.append('cursor', params.cursor);
        if (params?.order) queryParams.append('order', params.order);
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
        return await this.apiRequest('/user/change-password', 'POST', { currentPassword, newPassword }, token);
    }

    async sendPasswordResetEmail(email: string): Promise<MessageResponse> {
        return await this.apiRequest('/user/reset-password', 'POST', { email }, null);
    }

    async deleteUserAccount(token: string | null, confirmDelete: boolean): Promise<MessageResponse> {
        return await this.apiRequest('/user/account', 'DELETE', { confirmDelete }, token);
    }

    private async pollUntil<T>(fetcher: () => Promise<T>, matcher: Matcher<T>, options: PollOptions = {}): Promise<T> {
        const {timeout = 10000, interval = 500, errorMsg = 'Condition not met', onRetry} = options;

        const startTime = Date.now();
        let lastError: Error | null = null;
        let attempts = 0;

        while (Date.now() - startTime < timeout) {
            try {
                attempts++;
                const result = await fetcher();
                if (await matcher(result)) {
                    return result;
                }
            } catch (error) {
                lastError = error as Error;
            }

            if (onRetry) {
                onRetry(attempts, lastError || undefined);
            }

            await new Promise((resolve) => setTimeout(resolve, interval));
        }

        throw new Error(`${errorMsg} after ${timeout}ms (${attempts} attempts). ` + `Last error: ${lastError?.message || 'None'}`);
    }

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

    async mostRecentGroupChangeEvent(group: Group) {
        const changes = await this.getGroupChanges(group.id);
        return changes[0];// they are most recent first
    }

    async countGroupChanges(groupId: string) {
        return (await this.getGroupChanges(groupId)).length;
    }

    async countExpenseChanges(groupId: string) {
        return (await this.getExpenseChanges(groupId)).length;
    }

    async countBalanceChanges(groupId: string) {
        return (await this.getBalanceChanges(groupId)).length;
    }

    async mostRecentExpenseChangeEvent(groupId: string) {
        const changes = await this.getExpenseChanges(groupId);
        return changes[0]; // they are most recent first
    }

    async waitForGroupCreationEvent(groupId: string, creator: User) {
        await this.waitForGroupEvent('created', groupId, creator, 1);
    }

    async waitForGroupUpdatedEvent(groupId: string, creator: User, expectedCount = 1) {
        await this.waitForGroupEvent('updated', groupId, creator, expectedCount);
    }

    async waitForExpenseCreationEvent(groupId: string, expenseId: string, participants: User[]) {
        await this.waitForExpenseEvent('created', groupId, expenseId, participants, 1);
    }

    async waitForExpenseUpdatedEvent(groupId: string, expenseId: string, participants: User[], expectedCount = 1) {
        await this.waitForExpenseEvent('updated', groupId, expenseId, participants, expectedCount);
    }

    async waitForExpenseEvent(action: string, groupId: string, expenseId: string, participants: User[], expectedCount: number) {
        await this.waitForExpenseChanges(groupId, (changes) => {
            const found = changes.filter(doc => {
                if (doc.type !== 'expense')
                    throw Error("should not get here");

                if (doc.id !== expenseId)
                    return false;

                if (doc.action !== action)
                    return false;

                // Check all participants are in the users array
                return participants.every(p => doc.users.includes(p.uid));
            });

            return found.length === expectedCount;
        });
    }

    async waitForBalanceRecalculationEvent(groupId: string, participants: User[], expectedCount = 1) {
        await this.waitForBalanceChanges(groupId, (changes) => {
            const found = changes.filter(doc => {
                if (doc.type !== 'balance')
                    throw Error("should not get here");

                if (doc.action !== 'recalculated')
                    return false;

                // Check all participants are in the users array
                return participants.every(p => doc.users.includes(p.uid));
            });

            return found.length >= expectedCount;
        });
    }

    async waitForGroupEvent(action: string, groupId: string, creator: User, expectedCount: number, timeout: number = 2000) {
        await this.waitForGroupChanges(groupId, (changes) => {
            const found = changes.filter(doc => {
                if (doc.type !== 'group')
                    throw Error("should not get here")

                if (doc.action !== action)
                    return false;

                return doc.users.includes(creator.uid);
            });

            return found.length === expectedCount;
        }, timeout);
    }

    async waitForGroupChanges(groupId: string, matcher: Matcher<GroupChangeDocument[]>, timeout = 2000) {
        const endTime = Date.now() + timeout;
        while(Date.now() < endTime) {
            const changes = await this.getGroupChanges(groupId);
            if(matcher(changes))
                return;
        }

        const changes = await this.getGroupChanges(groupId);
        console.error(`${changes.length} observed`);
        for (const change of changes) {
            console.error(` * ${JSON.stringify(change)}`)
        }

        throw Error(`timeout waiting for group changes`);
    }

    async waitForExpenseChanges(groupId: string, matcher: Matcher<ExpenseChangeDocument[]>, timeout = 2000) {
        const endTime = Date.now() + timeout;
        while(Date.now() < endTime) {
            const changes = await this.getExpenseChanges(groupId);
            if(matcher(changes))
                return;
        }
        throw Error(`timeout waiting for expense changes`);
    }

    async waitForSettlementChanges(groupId: string, matcher: Matcher<SettlementChangeDocument[]>, timeout = 2000) {
        const endTime = Date.now() + timeout;
        while(Date.now() < endTime) {
            const changes = await this.getSettlementChanges(groupId);
            if(matcher(changes))
                return;
        }
        throw Error(`timeout waiting for settlement changes`);
    }

    async waitForBalanceChanges(groupId: string, matcher: Matcher<BalanceChangeDocument[]>, timeout = 2000) {
        const endTime = Date.now() + timeout;
        while(Date.now() < endTime) {
            const changes = await this.getBalanceChanges(groupId);
            if(matcher(changes))
                return;
        }
        throw Error(`timeout waiting for balance changes`);
    }

    async getExpenseChanges(groupId: string): Promise<ExpenseChangeDocument[]> {
        return await this.getTransactionChanges(groupId, 'expense') as ExpenseChangeDocument[];
    }

    async getSettlementChanges(groupId: string): Promise<SettlementChangeDocument[]> {
        return await this.getTransactionChanges(groupId, 'settlement') as SettlementChangeDocument[];
    }

    async getTransactionChanges(groupId: string, type: string) {
        const snapshot = await firestoreDb.collection(FirestoreCollections.TRANSACTION_CHANGES)
            .where('groupId', '==', groupId)
            .where('type', '==', type)
            .orderBy('timestamp', 'desc')
            .get();

        return snapshot.docs.map(doc => doc.data() as MinimalChangeDocument);
    }

    async getBalanceChanges(groupId: string): Promise<BalanceChangeDocument[]> {
        const snapshot = await firestoreDb.collection(FirestoreCollections.BALANCE_CHANGES)
            .where('groupId', '==', groupId)
            .orderBy('timestamp', 'desc')
            .get();

        return snapshot.docs.map(doc => doc.data() as BalanceChangeDocument);
    }

    async getGroupChanges(groupId: string): Promise<GroupChangeDocument[]> {
        const snapshot = await firestoreDb.collection(FirestoreCollections.GROUP_CHANGES)
            .where('id', '==', groupId)
            .orderBy('timestamp', 'desc')
            .get();

        return snapshot.docs.map(doc => doc.data() as GroupChangeDocument);
    }

    /**
     * Wait for a specific user to be a member of a group
     */
    async waitForUserJoinGroup(groupId: string, userId: string, token: string, timeout = 5000): Promise<Group> {
        return this.pollUntil(
            () => this.getGroup(groupId, token),
            (group) => group.members.hasOwnProperty(userId),
            {
                timeout,
                errorMsg: `User ${userId} did not join group ${groupId}`
            }
        );
    }

    /**
     * Wait for group change records to be created
     */
    async waitForGroupChangeRecords(groupId: string, userId: string, minimumCount = 1, timeout = 3000): Promise<GroupChangeDocument[]> {
        return this.pollUntil(
            () => this.getGroupChangesForUser(groupId, userId),
            (changes) => changes.length >= minimumCount,
            {
                timeout,
                errorMsg: `Expected at least ${minimumCount} group change record(s) for user ${userId} in group ${groupId}`
            }
        );
    }

    /**
     * Get group changes filtered by user
     */
    async getGroupChangesForUser(groupId: string, userId: string): Promise<GroupChangeDocument[]> {
        const snapshot = await firestoreDb.collection('group-changes')
            .where('id', '==', groupId)
            .where('users', 'array-contains', userId)
            .get();

        return snapshot.docs.map(doc => doc.data() as GroupChangeDocument);
    }

    /**
     * Wait for settlement creation event to be tracked
     */
    async waitForSettlementCreationEvent(groupId: string, settlementId: string, participants: User[]) {
        return this.waitForSettlementEvent('created', groupId, settlementId, participants, 1);
    }

    /**
     * Wait for settlement updated event to be tracked
     */
    async waitForSettlementUpdatedEvent(groupId: string, settlementId: string, participants: User[], expectedCount = 1) {
        return this.waitForSettlementEvent('updated', groupId, settlementId, participants, expectedCount);
    }

    /**
     * Wait for settlement deleted event to be tracked
     */
    async waitForSettlementDeletedEvent(groupId: string, settlementId: string, participants: User[]) {
        return this.waitForSettlementEvent('deleted', groupId, settlementId, participants, 1);
    }

    /**
     * Generic method to wait for settlement events
     */
    async waitForSettlementEvent(action: string, groupId: string, settlementId: string, participants: User[], expectedCount: number) {
        const participantUids = participants.map(p => p.uid);
        
        return this.waitForSettlementChanges(groupId, (changes) => {
            const relevantChanges = changes.filter(change => 
                change.id === settlementId &&
                change.action === action &&
                change.type === 'settlement' &&
                participantUids.every(uid => change.users.includes(uid))
            );
            return relevantChanges.length >= expectedCount;
        });
    }

    /**
     * Count settlement changes for a group
     */
    async countSettlementChanges(groupId: string): Promise<number> {
        const changes = await this.getSettlementChanges(groupId);
        return changes.length;
    }

    /**
     * Get most recent settlement change event
     */
    async mostRecentSettlementChangeEvent(groupId: string) {
        const changes = await this.getSettlementChanges(groupId);
        return changes.length > 0 ? changes[0] : null;
    }

}
