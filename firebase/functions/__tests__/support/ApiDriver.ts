// Using native fetch from Node.js 18+
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface User {
  uid: string;
  email: string;
  token: string;
  displayName: string;
}

export interface Group {
  id: string;
  name: string;
  members: any[];
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: string;
  participants: string[];
  splits: any[];
  date: string;
  category: string;
  receiptUrl?: string;
}

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

interface ListDocumentsResponse extends ApiResponse {
  documents: Array<{
    id: string;
    data: any;
    createdAt: string;
    updatedAt: string;
  }>;
  count: number;
  hasMore: boolean;
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

  async checkEmulatorStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async waitForEmulatorRestart(maxWaitMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.checkEmulatorStatus()) {
        // Wait an additional 2 seconds for emulator to fully initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Emulator failed to restart within ${maxWaitMs}ms`);
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
      email: userInfo.email,
      displayName: userInfo.displayName,
      token: authData.idToken
    };
  }

  async createGroup(name: string, members: User[], creatorToken: string): Promise<Group> {
    const groupData = {
      data: {
        name,
        members: members.map(user => ({
          uid: user.uid,
          email: user.email,
          name: user.displayName,
          initials: user.displayName.split(' ').map(n => n[0]).join('')
        })),
      },
    };

    const response = await this.apiRequest('/createDocument', 'POST', groupData, creatorToken);
    return {
      id: response.id,
      name,
      members: groupData.data.members,
    };
  }

  async createExpense(expenseData: Partial<Expense>, token: string): Promise<Expense> {
    const response = await this.apiRequest('/expenses', 'POST', expenseData, token);
    return {
      id: response.id,
      ...expenseData,
    } as Expense;
  }

  async updateExpense(expenseId: string, updateData: Partial<Expense>, token: string): Promise<void> {
    await this.apiRequest(`/expenses?id=${expenseId}`, 'PUT', updateData, token);
  }

  async deleteExpense(expenseId: string, token: string): Promise<void> {
    await this.apiRequest(`/expenses?id=${expenseId}`, 'DELETE', null, token);
  }

  async getExpense(expenseId: string, token: string): Promise<Expense> {
    return await this.apiRequest(`/expenses?id=${expenseId}`, 'GET', null, token);
  }

  async getGroupExpenses(groupId: string, token: string, limit?: number): Promise<{ expenses: Expense[] }> {
    const limitParam = limit ? `&limit=${limit}` : '';
    return await this.apiRequest(`/expenses/group?groupId=${groupId}${limitParam}`, 'GET', null, token);
  }

  async getGroupBalances(groupId: string, token: string): Promise<any> {
    return await this.apiRequest(`/groups/balances?groupId=${groupId}`, 'GET', null, token);
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
  async pollGetDocumentUntil(
    documentId: string,
    token: string,
    matcher: Matcher<any>,
    options?: PollOptions
  ): Promise<any> {
    return this.pollUntil(
      () => this.getDocument(documentId, token),
      matcher,
      { errorMsg: `Document ${documentId} condition not met`, ...options }
    );
  }

  async pollListDocumentsUntil(
    token: string,
    matcher: Matcher<ListDocumentsResponse>,
    options?: PollOptions
  ): Promise<ListDocumentsResponse> {
    return this.pollUntil(
      () => this.apiRequest('/listDocuments', 'GET', {}, token) as Promise<ListDocumentsResponse>,
      matcher,
      { errorMsg: 'List documents condition not met', ...options }
    );
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

  // Common matchers
  static readonly matchers = {
    // Document matchers
    documentHasField: (field: string) => (doc: any) => doc?.data?.[field] !== undefined,
    documentFieldEquals: (field: string, value: any) => (doc: any) => doc?.data?.[field] === value,
    documentFieldGreaterThan: (field: string, value: number) => (doc: any) => doc?.data?.[field] > value,
    
    // List documents matchers
    listContainsDocumentWithId: (docId: string) => (response: ListDocumentsResponse) => 
      response.documents.some(doc => doc.id === docId),
    
    listDocumentHasExpenseMetadata: (docId: string, expectedCount?: number) => (response: ListDocumentsResponse) => {
      const doc = response.documents.find(d => d.id === docId);
      if (!doc) return false;
      if (doc.data.expenseCount === undefined || doc.data.lastExpenseTime === undefined) return false;
      return expectedCount === undefined || doc.data.expenseCount === expectedCount;
    },
    
    // Balance matchers
    balanceIsNonZero: () => (balances: BalanceResponse) => 
      balances.userBalances && Object.values(balances.userBalances).some((b: any) => b.netBalance !== 0),
    
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

  async waitForGroupStats(groupId: string, token: string, expectedExpenseCount?: number, timeoutMs: number = 10000): Promise<any> {
    const matcher = (doc: any) => {
      if (doc?.data?.expenseCount === undefined) return false;
      return expectedExpenseCount === undefined || doc.data.expenseCount === expectedExpenseCount;
    };
    
    return this.pollGetDocumentUntil(
      groupId,
      token,
      matcher,
      { timeout: timeoutMs, errorMsg: 'Group stats update timeout' }
    );
  }

  async waitForListDocumentsExpenseMetadata(groupId: string, token: string, expectedExpenseCount?: number, timeoutMs: number = 10000): Promise<any> {
    const response = await this.pollListDocumentsUntil(
      token,
      ApiDriver.matchers.listDocumentHasExpenseMetadata(groupId, expectedExpenseCount),
      { 
        timeout: timeoutMs, 
        interval: 1000, // Longer delay for emulator consistency
        errorMsg: 'List documents expense metadata timeout'
      }
    );
    
    // Return just the group document for backward compatibility
    return response.documents.find(doc => doc.id === groupId);
  }


  async generateShareLink(groupId: string, token: string): Promise<{ shareableUrl: string; linkId: string }> {
    return await this.apiRequest('/groups/share', 'POST', { groupId }, token);
  }

  async joinGroupViaShareLink(linkId: string, token: string): Promise<any> {
    return await this.apiRequest('/groups/join', 'POST', { linkId }, token);
  }

  async createDocument(data: any, token: string): Promise<{ id: string }> {
    return await this.apiRequest('/createDocument', 'POST', { data }, token);
  }

  async listDocuments(token: string): Promise<ListDocumentsResponse> {
    return await this.apiRequest('/listDocuments', 'GET', {}, token);
  }

  async getDocument(documentId: string, token: string): Promise<any> {
    return await this.apiRequest(`/getDocument?id=${documentId}`, 'GET', null, token);
  }

  async createUserDocument(data: any, token: string): Promise<any> {
    return await this.apiRequest('/createUserDocument', 'POST', data, token);
  }

  async listUserExpenses(token: string, params?: Record<string, any>): Promise<{ expenses: Expense[] }> {
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

  async updateDocument(documentId: string, data: any, token: string): Promise<void> {
    return await this.apiRequest(`/updateDocument?id=${documentId}`, 'PUT', data, token);
  }

  async register(userData: { email: string; password: string; displayName: string }): Promise<any> {
    return await this.apiRequest('/register', 'POST', userData);
  }

  async expectRequestToFail(endpoint: string, method: string, body: any, token: string, expectedStatus: number): Promise<void> {
    try {
      await this.apiRequest(endpoint, method, body, token);
      throw new Error(`Expected request to fail with status ${expectedStatus}, but it succeeded`);
    } catch (error) {
      if (error instanceof Error && error.message.includes(`status ${expectedStatus}`)) {
        return; // Expected failure
      }
      throw error;
    }
  }





  // Helper methods for creating test data
  createTestUsers(): Promise<User[]> {
    return Promise.all([
      this.createTestUser({
        email: `test-${uuidv4()}@example.com`,
        password: 'Password123!',
        displayName: 'Test User 1'
      }),
      this.createTestUser({
        email: `test-${uuidv4()}@example.com`,
        password: 'Password123!',
        displayName: 'Test User 2'
      })
    ]);
  }

  createTestExpense(groupId: string, paidBy: string, participants: string[], amount: number = 100): Partial<Expense> {
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

  createTestExpenseWithExactSplits(groupId: string, paidBy: string, splits: Array<{userId: string, amount: number}>): Partial<Expense> {
    return {
      groupId,
      description: 'Exact Split Expense',
      amount: splits.reduce((sum, split) => sum + split.amount, 0),
      paidBy,
      splitType: 'exact',
      participants: splits.map(s => s.userId),
      splits,
      date: new Date().toISOString(),
      category: 'utilities',
    };
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
