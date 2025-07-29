import { describe, it, expect, beforeEach } from 'vitest';
import { ApiClient } from './utils';
import { 
  createTestUser, 
  createOtherTestUser,
  createTestGroup,
  createTestExpense,
  TEST_CATEGORIES,
  TEST_AMOUNTS
} from '../shared/test-data-fixtures';

describe('Expenses CRUD API Integration', () => {
  let apiClient: ApiClient;
  let testUser: any;
  let authToken: string;
  let testGroup: any;

  beforeEach(async () => {
    apiClient = new ApiClient();

    // Create and authenticate test user
    const userData = createTestUser();

    testUser = await apiClient.post('/auth/register', userData);
    
    const loginResponse = await apiClient.post('/auth/login', {
      email: testUser.email,
      password: userData.password,
    });
    
    authToken = loginResponse.token;

    // Create test group for expenses
    const groupData = createTestGroup({
      name: 'Test Group for Expenses',
      description: 'A test group for expense testing',
    });

    testGroup = await apiClient.post('/groups', groupData, {
      headers: getAuthHeaders(),
    });
  });

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${authToken}`,
  });

  describe('Expense Creation', () => {
    it('should create a new expense successfully', async () => {
      const expenseData = createTestExpense({
        groupId: testGroup.id,
        description: 'Test Restaurant Bill',
        amount: TEST_AMOUNTS.LARGE,
        paidBy: testUser.uid,
        splitBetween: [testUser.uid],
        category: TEST_CATEGORIES.FOOD,
      });

      const response = await apiClient.post('/expenses', expenseData, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('groupId', expenseData.groupId);
      expect(response).toHaveProperty('description', expenseData.description);
      expect(response).toHaveProperty('amount', expenseData.amount);
      expect(response).toHaveProperty('paidBy', expenseData.paidBy);
      expect(response).toHaveProperty('splitBetween');
      expect(response.splitBetween).toEqual(expenseData.splitBetween);
      expect(response).toHaveProperty('category', expenseData.category);
      expect(response).toHaveProperty('createdAt');
      expect(response).toHaveProperty('updatedAt');
    });

    it('should reject expense creation without authentication', async () => {
      const expenseData = {
        groupId: testGroup.id,
        description: 'Test Expense',
        amount: 50.00,
        paidBy: testUser.uid,
        splitBetween: [testUser.uid],
      };

      await expect(
        apiClient.post('/expenses', expenseData)
      ).rejects.toThrow(/unauthorized|token/i);
    });

    it('should reject expense creation with invalid data', async () => {
      const expenseData = {
        groupId: testGroup.id,
        description: '', // Invalid empty description
        amount: -10, // Invalid negative amount
        paidBy: testUser.uid,
        splitBetween: [testUser.uid],
      };

      await expect(
        apiClient.post('/expenses', expenseData, {
          headers: getAuthHeaders(),
        })
      ).rejects.toThrow(/description|amount|invalid/i);
    });

    it('should reject expense creation for non-member', async () => {
      // Create another user not in the group
      const otherUserData = createOtherTestUser();

      await apiClient.post('/auth/register', otherUserData);
      const otherLoginResponse = await apiClient.post('/auth/login', {
        email: otherUserData.email,
        password: otherUserData.password,
      });

      const expenseData = createTestExpense({
        groupId: testGroup.id,
        description: 'Unauthorized Expense',
        paidBy: testUser.uid,
        splitBetween: [testUser.uid],
      });

      await expect(
        apiClient.post('/expenses', expenseData, {
          headers: {
            Authorization: `Bearer ${otherLoginResponse.token}`,
          },
        })
      ).rejects.toThrow(/forbidden|unauthorized|403/i);
    });
  });

  describe('Expense Retrieval', () => {
    let testExpense: any;

    beforeEach(async () => {
      const expenseData = createTestExpense({
        groupId: testGroup.id,
        description: 'Test Expense for Retrieval',
        amount: 75.25,
        paidBy: testUser.uid,
        splitBetween: [testUser.uid],
        category: TEST_CATEGORIES.TRANSPORT,
      });

      testExpense = await apiClient.post('/expenses', expenseData, {
        headers: getAuthHeaders(),
      });
    });

    it('should retrieve group expenses', async () => {
      const response = await apiClient.get(`/groups/${testGroup.id}/expenses`, {
        headers: getAuthHeaders(),
      });

      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBeGreaterThan(0);
      
      const foundExpense = response.find((e: any) => e.id === testExpense.id);
      expect(foundExpense).toBeDefined();
      expect(foundExpense.description).toBe(testExpense.description);
      expect(foundExpense.amount).toBe(testExpense.amount);
    });

    it('should retrieve specific expense by ID', async () => {
      const response = await apiClient.get(`/expenses/${testExpense.id}`, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('id', testExpense.id);
      expect(response).toHaveProperty('description', testExpense.description);
      expect(response).toHaveProperty('amount', testExpense.amount);
      expect(response).toHaveProperty('paidBy', testUser.uid);
      expect(response).toHaveProperty('splitBetween');
    });

    it('should reject access to non-existent expense', async () => {
      const fakeExpenseId = 'non-existent-expense-id';

      await expect(
        apiClient.get(`/expenses/${fakeExpenseId}`, {
          headers: getAuthHeaders(),
        })
      ).rejects.toThrow(/not found|404/i);
    });

    it('should filter expenses by date range', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await apiClient.get(
        `/groups/${testGroup.id}/expenses?startDate=${yesterday.toISOString()}&endDate=${tomorrow.toISOString()}`,
        { headers: getAuthHeaders() }
      );

      expect(Array.isArray(response)).toBe(true);
      const foundExpense = response.find((e: any) => e.id === testExpense.id);
      expect(foundExpense).toBeDefined();
    });

    it('should filter expenses by category', async () => {
      const response = await apiClient.get(
        `/groups/${testGroup.id}/expenses?category=transport`,
        { headers: getAuthHeaders() }
      );

      expect(Array.isArray(response)).toBe(true);
      const foundExpense = response.find((e: any) => e.id === testExpense.id);
      expect(foundExpense).toBeDefined();
      expect(foundExpense.category).toBe('transport');
    });
  });

  describe('Expense Updates', () => {
    let testExpense: any;

    beforeEach(async () => {
      const expenseData = createTestExpense({
        groupId: testGroup.id,
        description: 'Test Expense for Updates',
        amount: 100.00,
        paidBy: testUser.uid,
        splitBetween: [testUser.uid],
        category: TEST_CATEGORIES.ENTERTAINMENT,
      });

      testExpense = await apiClient.post('/expenses', expenseData, {
        headers: getAuthHeaders(),
      });
    });

    it('should update expense description and amount', async () => {
      const updateData = {
        description: 'Updated Expense Description',
        amount: 150.75,
        category: 'food',
      };

      const response = await apiClient.put(`/expenses/${testExpense.id}`, updateData, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('id', testExpense.id);
      expect(response).toHaveProperty('description', updateData.description);
      expect(response).toHaveProperty('amount', updateData.amount);
      expect(response).toHaveProperty('category', updateData.category);
      expect(response).toHaveProperty('groupId', testExpense.groupId); // Should remain unchanged
    });

    it('should update expense split distribution', async () => {
      // Add another user to the group first
      const otherUserData = createOtherTestUser();

      const otherUser = await apiClient.post('/auth/register', otherUserData);
      
      // Add other user to group
      await apiClient.post(
        `/groups/${testGroup.id}/members`,
        { userId: otherUser.uid },
        { headers: getAuthHeaders() }
      );

      const updateData = {
        splitBetween: [testUser.uid, otherUser.uid],
      };

      const response = await apiClient.put(`/expenses/${testExpense.id}`, updateData, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('splitBetween');
      expect(response.splitBetween).toContain(testUser.uid);
      expect(response.splitBetween).toContain(otherUser.uid);
      expect(response.splitBetween).toHaveLength(2);
    });

    it('should reject updates by non-group members', async () => {
      // Create another user not in the group
      const otherUserData = createOtherTestUser();

      await apiClient.post('/auth/register', otherUserData);
      const otherLoginResponse = await apiClient.post('/auth/login', {
        email: otherUserData.email,
        password: otherUserData.password,
      });

      const updateData = {
        description: 'Unauthorized Update',
      };

      await expect(
        apiClient.put(`/expenses/${testExpense.id}`, updateData, {
          headers: {
            Authorization: `Bearer ${otherLoginResponse.token}`,
          },
        })
      ).rejects.toThrow(/forbidden|unauthorized|403/i);
    });
  });

  describe('Expense Deletion', () => {
    let testExpense: any;

    beforeEach(async () => {
      const expenseData = createTestExpense({
        groupId: testGroup.id,
        description: 'Test Expense for Deletion',
        amount: 60.00,
        paidBy: testUser.uid,
        splitBetween: [testUser.uid],
        category: TEST_CATEGORIES.OTHER,
      });

      testExpense = await apiClient.post('/expenses', expenseData, {
        headers: getAuthHeaders(),
      });
    });

    it('should delete expense successfully', async () => {
      const response = await apiClient.delete(`/expenses/${testExpense.id}`, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('success', true);

      // Verify expense is deleted
      await expect(
        apiClient.get(`/expenses/${testExpense.id}`, {
          headers: getAuthHeaders(),
        })
      ).rejects.toThrow(/not found|404/i);
    });

    it('should reject deletion by non-group members', async () => {
      // Create another user not in the group
      const otherUserData = createOtherTestUser();

      await apiClient.post('/auth/register', otherUserData);
      const otherLoginResponse = await apiClient.post('/auth/login', {
        email: otherUserData.email,
        password: otherUserData.password,
      });

      await expect(
        apiClient.delete(`/expenses/${testExpense.id}`, {
          headers: {
            Authorization: `Bearer ${otherLoginResponse.token}`,
          },
        })
      ).rejects.toThrow(/forbidden|unauthorized|403/i);
    });
  });

  describe('Expense Calculations', () => {
    beforeEach(async () => {
      // Create multiple expenses for balance calculation testing
      const expenses = [
        createTestExpense({
          groupId: testGroup.id,
          description: 'Shared Dinner',
          amount: TEST_AMOUNTS.LARGE,
          paidBy: testUser.uid,
          splitBetween: [testUser.uid],
          category: TEST_CATEGORIES.FOOD,
        }),
        createTestExpense({
          groupId: testGroup.id,
          description: 'Taxi Ride',
          amount: 30.00,
          paidBy: testUser.uid,
          splitBetween: [testUser.uid],
          category: TEST_CATEGORIES.TRANSPORT,
        }),
      ];

      for (const expense of expenses) {
        await apiClient.post('/expenses', expense, {
          headers: getAuthHeaders(),
        });
      }
    });

    it('should calculate group balances correctly', async () => {
      const response = await apiClient.get(`/groups/${testGroup.id}/balances`, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('balances');
      expect(response).toHaveProperty('totalExpenses');
      expect(response.totalExpenses).toBeGreaterThan(0);
      
      // User should have positive balance since they paid everything
      expect(response.balances[testUser.uid]).toBeGreaterThan(0);
    });

    it('should get expense statistics', async () => {
      const response = await apiClient.get(`/groups/${testGroup.id}/stats`, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('totalExpenses');
      expect(response).toHaveProperty('expenseCount');
      expect(response).toHaveProperty('averageExpense');
      expect(response).toHaveProperty('categorySummary');
      
      expect(response.totalExpenses).toBeGreaterThan(0);
      expect(response.expenseCount).toBeGreaterThan(0);
      expect(response.categorySummary).toHaveProperty('food');
      expect(response.categorySummary).toHaveProperty('transport');
    });
  });
});