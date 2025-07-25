import * as fs from 'fs';
import * as path from 'path';
import type {ExpenseData, Group, User as BaseUser} from '../../src/types/webapp-shared-types';

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

  constructor() {
    // Read emulator configuration from firebase.json
    const firebaseConfigPath = path.join(__dirname, '../../../firebase.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    
    // Read project ID from .firebaserc
    const firebaseRcPath = path.join(__dirname, '../../../.firebaserc');
    const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
    const projectId = firebaseRc.projects.default;
    
    const FUNCTIONS_PORT = firebaseConfig.emulators.functions.port;
    const FIRESTORE_PORT = firebaseConfig.emulators.firestore.port;
    const AUTH_PORT = firebaseConfig.emulators.auth.port;
    
    this.baseUrl = `http://localhost:${FUNCTIONS_PORT}/${projectId}/us-central1/api`;
    this.authPort = AUTH_PORT;
    this.firebaseApiKey = 'AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg'; // Default API key for emulator
    
    // Set emulator environment variables
    process.env.FIRESTORE_EMULATOR_HOST = `localhost:${FIRESTORE_PORT}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
  }


  async apiRequest(endpoint: string, method: string = 'POST', body: unknown = null, token: string | null = null): Promise<any> {
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

  async createTestUser(userInfo: { email: string; password: string; displayName: string }): Promise<User> {
    try {
      // Register user via API
      await this.apiRequest('/register', 'POST', {
        email: userInfo.email,
        password: userInfo.password,
        displayName: userInfo.displayName
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

  async createGroup(name: string, members: User[], creatorToken: string): Promise<Group> {
    // Step 1: Create group with just the creator
    const groupData = {
      name,
      description: `Test group created at ${new Date().toISOString()}`,
      memberEmails: [] // Don't include other emails initially
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

  async getGroupExpenses(groupId: string, token: string, limit?: number): Promise<{ expenses: ExpenseData[] }> {
    const limitParam = limit ? `&limit=${limit}` : '';
    return await this.apiRequest(`/expenses/group?groupId=${groupId}${limitParam}`, 'GET', null, token);
  }

  async getGroupBalances(groupId: string, token: string): Promise<any> {
    return await this.apiRequest(`/groups/balances?groupId=${groupId}`, 'GET', null, token);
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

  // Generic polling method
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

  // Type-safe endpoint polling methods

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

  // Common matchers
  static readonly matchers = {
    // List documents matchers
    
    // Balance matchers
    
    balanceHasUpdate: () => (balances: BalanceResponse) => 
      balances.userBalances && Object.keys(balances.userBalances).length > 0 && !!balances.lastUpdated
  };

  // Backward compatibility - refactor existing methods to use the new polling pattern
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
      () => this.getGroupNew(groupId, token),
      matcher,
      { errorMsg: `Group ${groupId} balance condition not met`, ...options }
    );
  }


  async generateShareLink(groupId: string, token: string): Promise<{ shareableUrl: string; linkId: string }> {
    return await this.apiRequest('/groups/share', 'POST', { groupId }, token);
  }

  async joinGroupViaShareLink(linkId: string, token: string): Promise<any> {
    return await this.apiRequest('/groups/join', 'POST', { linkId }, token);
  }


  async createUserDocument(data: any, token: string): Promise<any> {
    return await this.apiRequest('/createUserDocument', 'POST', data, token);
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


  // New RESTful group endpoint methods
  async createGroupNew(groupData: any, token: string): Promise<any> {
    return await this.apiRequest('/groups', 'POST', groupData, token);
  }

  async getGroupNew(groupId: string, token: string): Promise<any> {
    return await this.apiRequest(`/groups/${groupId}`, 'GET', null, token);
  }

  async updateGroupNew(groupId: string, data: any, token: string): Promise<void> {
    return await this.apiRequest(`/groups/${groupId}`, 'PUT', data, token);
  }

  async deleteGroupNew(groupId: string, token: string): Promise<void> {
    return await this.apiRequest(`/groups/${groupId}`, 'DELETE', null, token);
  }

  async listGroupsNew(token: string, params?: { limit?: number; cursor?: string; order?: 'asc' | 'desc' }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.cursor) queryParams.append('cursor', params.cursor);
    if (params?.order) queryParams.append('order', params.order);
    const queryString = queryParams.toString();
    return await this.apiRequest(`/groups${queryString ? `?${queryString}` : ''}`, 'GET', null, token);
  }

  async register(userData: { email: string; password: string; displayName: string }): Promise<any> {
    return await this.apiRequest('/register', 'POST', userData);
  }

  // Helper methods for creating test data

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


  getBaseUrl(): string {
    return this.baseUrl;
  }
}
