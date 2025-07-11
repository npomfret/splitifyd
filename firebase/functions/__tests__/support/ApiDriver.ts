// Using native fetch from Node.js 18+
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

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

export class ApiDriver {
  private readonly baseUrl: string;
  private readonly authPort: number;
  private readonly firebaseApiKey: string;

  constructor() {
    // Read emulator configuration from firebase.json
    const firebaseConfigPath = path.join(__dirname, '../../../firebase.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    
    const FUNCTIONS_PORT = firebaseConfig.emulators.functions.port;
    const FIRESTORE_PORT = firebaseConfig.emulators.firestore.port;
    const AUTH_PORT = firebaseConfig.emulators.auth.port;
    
    this.baseUrl = `http://localhost:${FUNCTIONS_PORT}/splitifyd/us-central1/api`;
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

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request to ${endpoint} failed with status ${response.status}: ${errorText}`);
    }
    // Handle cases where the response might be empty
    const responseText = await response.text();
    return responseText ? JSON.parse(responseText) : {};
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

  async getGroupExpenses(groupId: string, token: string): Promise<{ expenses: Expense[] }> {
    return await this.apiRequest(`/expenses/group?groupId=${groupId}`, 'GET', null, token);
  }

  async getGroupBalances(groupId: string, token: string): Promise<any> {
    return await this.apiRequest(`/groups/balances?groupId=${groupId}`, 'GET', null, token);
  }

  async waitForBalanceUpdate(groupId: string, token: string, delayMs: number = 2000): Promise<any> {
    // Wait for Firebase triggers to complete (they are asynchronous)
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return await this.getGroupBalances(groupId, token);
  }

  async generateShareLink(groupId: string, token: string): Promise<{ shareableUrl: string; linkId: string }> {
    return await this.apiRequest('/groups/share', 'POST', { groupId }, token);
  }

  async joinGroupViaShareLink(linkId: string, token: string): Promise<any> {
    return await this.apiRequest('/groups/join', 'POST', { linkId }, token);
  }

  async getDocument(documentId: string, token: string): Promise<any> {
    return await this.apiRequest(`/getDocument?id=${documentId}`, 'GET', null, token);
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