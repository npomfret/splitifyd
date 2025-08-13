import type {ExpenseData, Group, User as BaseUser} from '../../src/shared/shared-types';
import { getFirebaseEmulatorConfig, findProjectRoot } from '@splitifyd/test-support';

// Test-specific extension of User to include auth token
export interface User extends BaseUser {
  token: string;
}

// Re-export shared types for backward compatibility
// Polling configuration interface
interface PollOptions {
  timeout?: number;      // Total timeout in ms (default: 10000)
  interval?: number;     // Polling interval in ms (default: 500)
  errorMsg?: string;     // Custom error message
  onRetry?: (attempt: number, error?: Error) => void;  // Callback for debugging
}

// Generic matcher type
type Matcher<T> = (value: T) => boolean | Promise<boolean>;

// Response types for type safety
interface ApiResponse {
  [key: string]: any;
}


interface BalanceResponse extends ApiResponse {
  userBalances: Record<string, any>;
  lastUpdated?: string;
}


export class ApiDriver {
  private readonly baseUrl: string;
  private readonly authPort: number;
  private readonly firebaseApiKey: string;

  static readonly matchers = {
    balanceHasUpdate: () => (balances: BalanceResponse) =>
        balances.userBalances && Object.keys(balances.userBalances).length > 0 && !!balances.lastUpdated
  };


  constructor() {
    // Get Firebase emulator configuration
    const projectRoot = findProjectRoot(__dirname);
    const config = getFirebaseEmulatorConfig(projectRoot);

    this.baseUrl = config.baseUrl;
    this.authPort = config.authPort;
    this.firebaseApiKey = config.firebaseApiKey;
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
        cookiePolicyAccepted: true
      });
    } catch (error) {
      // Ignore "already exists" errors
      if (!(error instanceof Error && error.message.includes('EMAIL_EXISTS'))) {
        throw error;
      }
    }

    // Use Firebase Auth REST API to sign in
    const signInResponse = await fetch(
      `http://localhost:${this.authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userInfo.email,
          password: userInfo.password,
          returnSecureToken: true
        })
      }
    );

    if (!signInResponse.ok) {
      const error = await signInResponse.json() as { error?: { message?: string } };
      throw new Error(`Authentication failed: ${error.error?.message || 'Unknown error'}`);
    }

    const authData = await signInResponse.json() as { idToken: string };

    // We need the UID. In a real test setup, you might need to use the Admin SDK
    // to get this, but for this test, we'll just decode the token (INSECURE, FOR TESTING ONLY).
    const decodedToken = JSON.parse(Buffer.from(authData.idToken.split('.')[1], 'base64').toString()) as { user_id: string };

    return {
      uid: decodedToken.user_id,
      displayName: userInfo.displayName,
      email: userInfo.email,
      token: authData.idToken
    };
  }

  async createExpense(expenseData: Partial<ExpenseData>, token: string): Promise<ExpenseData> {
    const response = await this.apiRequest('/expenses', 'POST', expenseData, token);
    return {
      id: response.id,
      ...expenseData,
    } as ExpenseData;
  }

  async updateExpense(expenseId: string, updateData: Partial<ExpenseData>, token: string): Promise<void> {
    await this.apiRequest(`/expenses?id=${expenseId}`, 'PUT', updateData, token);
  }

  async deleteExpense(expenseId: string, token: string): Promise<void> {
    await this.apiRequest(`/expenses?id=${expenseId}`, 'DELETE', null, token);
  }

  async getExpense(expenseId: string, token: string): Promise<ExpenseData> {
    return await this.apiRequest(`/expenses?id=${expenseId}`, 'GET', null, token);
  }

  async createSettlement(settlementData: any, token: string): Promise<any> {
    const response = await this.apiRequest('/settlements', 'POST', settlementData, token);
    return response.data;
  }

  async getSettlement(settlementId: string, token: string): Promise<any> {
    const response = await this.apiRequest(`/settlements/${settlementId}`, 'GET', null, token);
    return response.data;
  }

  async updateSettlement(settlementId: string, updateData: any, token: string): Promise<any> {
    const response = await this.apiRequest(`/settlements/${settlementId}`, 'PUT', updateData, token);
    return response.data;
  }

  async deleteSettlement(settlementId: string, token: string): Promise<void> {
    await this.apiRequest(`/settlements/${settlementId}`, 'DELETE', null, token);
  }

  async listSettlements(token: string, params?: { 
    groupId: string; 
    limit?: number; 
    cursor?: string; 
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
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

  createTestExpense(groupId: string, paidBy: string, participants: string[], amount: number = 100): Partial<ExpenseData> {
    return {
      groupId,
      description: 'Test Expense',
      amount,
      paidBy,
      splitType: 'equal',
      participants,
      date: new Date().toISOString(),
      category: 'food',
    };
  }

  async listUserExpenses(token: string, params?: Record<string, any>): Promise<{ expenses: ExpenseData[] }> {
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

  async getGroupExpenses(groupId: string, token: string, limit?: number): Promise<{ expenses: ExpenseData[] }> {
    const limitParam = limit ? `&limit=${limit}` : '';
    return await this.apiRequest(`/expenses/group?groupId=${groupId}${limitParam}`, 'GET', null, token);
  }

  async getExpenseHistory(expenseId: string, token: string): Promise<{
    history: Array<{
      id: string;
      modifiedAt: string;
      modifiedBy: string;
      changeType: string;
      changes: string[];
      previousAmount?: number;
      previousDescription?: string;
      previousCategory?: string;
      previousDate?: string;
      previousParticipants?: string[];
    }>;
    count: number;
  }> {
    return await this.apiRequest(`/expenses/history?id=${expenseId}`, 'GET', null, token);
  }

  async getGroupBalances(groupId: string, token: string): Promise<any> {
    return await this.apiRequest(`/groups/balances?groupId=${groupId}`, 'GET', null, token);
  }

  async pollGroupBalancesUntil(
    groupId: string,
    token: string,
    matcher: Matcher<BalanceResponse>,
    options?: PollOptions
  ): Promise<BalanceResponse> {
    return this.pollUntil(
      () => this.getGroupBalances(groupId, token),
      matcher,
      { errorMsg: `Group ${groupId} balance condition not met`, ...options }
    );
  }

  async waitForBalanceUpdate(groupId: string, token: string, timeoutMs: number = 10000): Promise<any> {
    return this.pollGroupBalancesUntil(
        groupId,
        token,
        ApiDriver.matchers.balanceHasUpdate(),
        { timeout: timeoutMs }
    );
  }

  async pollGroupUntilBalanceUpdated(
      groupId: string,
      token: string,
      matcher: Matcher<any>,
      options?: PollOptions
  ): Promise<any> {
    return this.pollUntil(
        () => this.getGroup(groupId, token),
        matcher,
        { errorMsg: `Group ${groupId} balance condition not met`, ...options }
    );
  }

  async generateShareLink(groupId: string, token: string): Promise<{ shareablePath: string; linkId: string }> {
    return await this.apiRequest('/groups/share', 'POST', { groupId }, token);
  }

  async joinGroupViaShareLink(linkId: string, token: string): Promise<any> {
    return await this.apiRequest('/groups/join', 'POST', { linkId }, token);
  }

  async createGroupWithMembers(name: string, members: User[], creatorToken: string): Promise<Group> {
    // Step 1: Create group with just the creator
    const groupData = {
      name,
      description: `Test group created at ${new Date().toISOString()}`
    };

    const group = await this.apiRequest('/groups', 'POST', groupData, creatorToken) as Group;

    // Step 2: If there are other members, generate a share link and have them join
    const otherMembers = members.filter(m => m.token !== creatorToken);
    if (otherMembers.length > 0) {
      const shareResponse = await this.apiRequest('/groups/share', 'POST', { groupId: group.id }, creatorToken);
      const { linkId } = shareResponse;

      // Step 3: Have other members join using the share link
      for (const member of otherMembers) {
        try {
          await this.apiRequest('/groups/join', 'POST', { linkId }, member.token);
        } catch (joinError) {
          console.warn(`Failed to add member ${member.email} to group ${name}:`, joinError);
        }
      }
    }

    // Step 4: Fetch the updated group to get all members
    const updatedGroup = await this.apiRequest(`/groups/${group.id}`, 'GET', null, creatorToken);
    return updatedGroup as Group;
  }

  async createGroup(groupData: any, token: string): Promise<any> {
    return await this.apiRequest('/groups', 'POST', groupData, token);
  }

  async getGroup(groupId: string, token: string): Promise<any> {
    return await this.apiRequest(`/groups/${groupId}`, 'GET', null, token);
  }

  async getGroupMembers(groupId: string, token: string): Promise<any> {
    return await this.apiRequest(`/groups/${groupId}/members`, 'GET', null, token);
  }

  async updateGroup(groupId: string, data: any, token: string): Promise<void> {
    return await this.apiRequest(`/groups/${groupId}`, 'PUT', data, token);
  }

  async deleteGroup(groupId: string, token: string): Promise<void> {
    return await this.apiRequest(`/groups/${groupId}`, 'DELETE', null, token);
  }

  async listGroups(token: string, params?: { limit?: number; cursor?: string; order?: 'asc' | 'desc' }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.cursor) queryParams.append('cursor', params.cursor);
    if (params?.order) queryParams.append('order', params.order);
    const queryString = queryParams.toString();
    return await this.apiRequest(`/groups${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
  }

  async register(userData: { email: string; password: string; displayName: string; termsAccepted?: boolean; cookiePolicyAccepted?: boolean }): Promise<any> {
    // Ensure required policy acceptance fields are provided with defaults
    const registrationData = {
      ...userData,
      termsAccepted: userData.termsAccepted ?? true,
      cookiePolicyAccepted: userData.cookiePolicyAccepted ?? true
    };
    return await this.apiRequest('/register', 'POST', registrationData);
  }

  async makeInvalidApiCall(endpoint: string, method: string = 'GET', body: unknown = null, token: string | null = null): Promise<any> {
    return await this.apiRequest(endpoint, method, body, token);
  }

  async leaveGroup(groupId: string, token: string): Promise<{ success: boolean; message: string }> {
    return await this.apiRequest(`/groups/${groupId}/leave`, 'POST', null, token);
  }

  async removeGroupMember(groupId: string, memberId: string, token: string): Promise<{ success: boolean; message: string }> {
    return await this.apiRequest(`/groups/${groupId}/members/${memberId}`, 'DELETE', null, token);
  }

  private async pollUntil<T>(
      fetcher: () => Promise<T>,
      matcher: Matcher<T>,
      options: PollOptions = {}
  ): Promise<T> {
    const {
      timeout = 10000,
      interval = 500,
      errorMsg = 'Condition not met',
      onRetry
    } = options;

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

      await new Promise(resolve => setTimeout(resolve, interval));
    }


    throw new Error(
        `${errorMsg} after ${timeout}ms (${attempts} attempts). ` +
        `Last error: ${lastError?.message || 'None'}`
    );
  }

  private async apiRequest(endpoint: string, method: string = 'POST', body: unknown = null, token: string | null = null): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
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

        throw new Error(`API request to ${endpoint} failed with status ${response.status}: ${errorText}`);
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
