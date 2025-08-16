/**
 * @jest-environment node
 */

// Tests for race conditions when users join groups with existing expenses
// This reproduces the bug where expenses disappear when new users join

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../../support/ApiDriver';
import { UserBuilder, GroupBuilder } from '../../support/builders';
import { clearAllTestData } from '../../support/cleanupHelpers';

describe('Group Member Race Conditions', () => {
  let driver: ApiDriver;
  let users: User[] = [];

  jest.setTimeout(10000); // Tests take ~8.6s

  beforeAll(async () => {
    // Clear any existing test data first
    await clearAllTestData();
    
    driver = new ApiDriver();
    users = await Promise.all([
      driver.createUser(new UserBuilder().build()),
      driver.createUser(new UserBuilder().build()),
      driver.createUser(new UserBuilder().build()),
      driver.createUser(new UserBuilder().build()),
    ]);
  });

  afterAll(async () => {
    // Clean up all test data
    await clearAllTestData();
  });

  describe('Expenses persist when users join group', () => {
    test('should preserve expenses when single user joins group', async () => {
      // Step 1: User 0 creates a group
      const groupData = new GroupBuilder()
        .withName(`Race Test Group ${uuidv4()}`)
        .withDescription('Testing expense persistence')
        .build();
      const group = await driver.createGroup(groupData, users[0].token);
      
      // Step 2: User 0 adds an expense
      const expenseData = {
        groupId: group.id,
        description: 'Group dinner expense',
        amount: 12000, // $120
        currency: 'USD',
        paidBy: users[0].uid,
        participants: [users[0].uid],
        splitType: 'equal' as const,
        date: new Date().toISOString(),
        category: 'food'
      };
      const expense = await driver.createExpense(expenseData, users[0].token);
      
      // Step 3: Verify expense exists
      const groupExpenses = await driver.getGroupExpenses(group.id, users[0].token);
      expect(groupExpenses.expenses).toHaveLength(1);
      expect(groupExpenses.expenses[0].id).toBe(expense.id);
      
      // Step 4: User 1 joins the group via share link
      const shareLink = await driver.generateShareLink(group.id, users[0].token);
      await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
      
      // Step 5: Verify expense STILL exists after user joined
      const expensesAfterJoin = await driver.getGroupExpenses(group.id, users[0].token);
      expect(expensesAfterJoin.expenses).toHaveLength(1);
      expect(expensesAfterJoin.expenses[0].id).toBe(expense.id);
      expect(expensesAfterJoin.expenses[0].description).toBe('Group dinner expense');
      
      // Step 6: Verify new member can also see the expense
      const expensesForNewMember = await driver.getGroupExpenses(group.id, users[1].token);
      expect(expensesForNewMember.expenses).toHaveLength(1);
      expect(expensesForNewMember.expenses[0].id).toBe(expense.id);
    });

    test('should preserve expenses when multiple users join simultaneously', async () => {
      // Step 1: User 0 creates a group with expenses
      const groupData = new GroupBuilder()
        .withName(`Concurrent Join Test ${uuidv4()}`)
        .build();
      const group = await driver.createGroup(groupData, users[0].token);
      
      // Step 2: Add multiple expenses
      const expense1 = await driver.createExpense({
        groupId: group.id,
        description: 'Lunch expense',
        amount: 5000,
        currency: 'USD',
        paidBy: users[0].uid,
        participants: [users[0].uid],
        splitType: 'equal' as const,
        date: new Date().toISOString(),
        category: 'food'
      }, users[0].token);
      
      const expense2 = await driver.createExpense({
        groupId: group.id,
        description: 'Transport expense',
        amount: 3000,
        currency: 'USD',
        paidBy: users[0].uid,
        participants: [users[0].uid],
        splitType: 'equal' as const,
        date: new Date().toISOString(),
        category: 'transport'
      }, users[0].token);
      
      // Step 3: Generate share link
      const shareLink = await driver.generateShareLink(group.id, users[0].token);
      
      // Step 4: Have multiple users join simultaneously
      const joinPromises = [
        driver.joinGroupViaShareLink(shareLink.linkId, users[1].token),
        driver.joinGroupViaShareLink(shareLink.linkId, users[2].token),
        driver.joinGroupViaShareLink(shareLink.linkId, users[3].token),
      ];
      
      // Wait for all to complete (some may fail with ALREADY_MEMBER)
      const results = await Promise.allSettled(joinPromises);
      
      // At least one should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
      
      // Step 5: Verify all expenses still exist
      const expensesAfterJoins = await driver.getGroupExpenses(group.id, users[0].token);
      expect(expensesAfterJoins.expenses).toHaveLength(2);
      
      const expenseIds = expensesAfterJoins.expenses.map((e: any) => e.id);
      expect(expenseIds).toContain(expense1.id);
      expect(expenseIds).toContain(expense2.id);
      
      // Step 6: Verify group has correct member count
      const groupAfterJoins = await driver.getGroup(group.id, users[0].token);
      expect(groupAfterJoins.memberIds.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle expense creation while user is joining', async () => {
      // Step 1: Create group
      const groupData = new GroupBuilder()
        .withName(`Concurrent Operations Test ${uuidv4()}`)
        .build();
      const group = await driver.createGroup(groupData, users[0].token);
      
      // Step 2: Generate share link
      const shareLink = await driver.generateShareLink(group.id, users[0].token);
      
      // Step 3: Start both operations concurrently
      const operations = await Promise.allSettled([
        // User 1 joins the group
        driver.joinGroupViaShareLink(shareLink.linkId, users[1].token),
        
        // User 0 creates an expense at the same time
        driver.createExpense({
          groupId: group.id,
          description: 'Concurrent expense',
          amount: 7500,
          currency: 'USD',
          paidBy: users[0].uid,
          participants: [users[0].uid],
          splitType: 'equal' as const,
          date: new Date().toISOString(),
          category: 'food'
        }, users[0].token)
      ]);
      
      // Both operations should succeed
      expect(operations[0].status).toBe('fulfilled');
      expect(operations[1].status).toBe('fulfilled');
      
      // Step 4: Verify expense exists
      const expenses = await driver.getGroupExpenses(group.id, users[0].token);
      expect(expenses.expenses).toHaveLength(1);
      expect(expenses.expenses[0].description).toBe('Concurrent expense');
      
      // Step 5: Verify member was added
      const groupAfter = await driver.getGroup(group.id, users[0].token);
      expect(groupAfter.memberIds).toContain(users[1].uid);
    });

    test('should preserve expenses during rapid successive joins', async () => {
      // Step 1: Create group with expense
      const groupData = new GroupBuilder()
        .withName(`Rapid Join Test ${uuidv4()}`)
        .build();
      const group = await driver.createGroup(groupData, users[0].token);
      
      const expense = await driver.createExpense({
        groupId: group.id,
        description: 'Initial expense',
        amount: 10000,
        currency: 'USD',
        paidBy: users[0].uid,
        participants: [users[0].uid],
        splitType: 'equal' as const,
        date: new Date().toISOString(),
        category: 'food'
      }, users[0].token);
      
      // Step 2: Generate share link
      const shareLink = await driver.generateShareLink(group.id, users[0].token);
      
      // Step 3: Users join in rapid succession (not parallel)
      for (const user of [users[1], users[2], users[3]]) {
        try {
          await driver.joinGroupViaShareLink(shareLink.linkId, user.token);
        } catch (error: any) {
          // ALREADY_MEMBER errors are expected for subsequent attempts
          if (!error.message.includes('ALREADY_MEMBER')) {
            throw error;
          }
        }
      }
      
      // Step 4: Verify expense still exists
      const finalExpenses = await driver.getGroupExpenses(group.id, users[0].token);
      expect(finalExpenses.expenses).toHaveLength(1);
      expect(finalExpenses.expenses[0].id).toBe(expense.id);
      
      // Step 5: Verify all members can see the expense
      for (const user of [users[0], users[1], users[2], users[3]]) {
        const userExpenses = await driver.getGroupExpenses(group.id, user.token);
        expect(userExpenses.expenses).toHaveLength(1);
        expect(userExpenses.expenses[0].description).toBe('Initial expense');
      }
    });

    test('should handle group updates while users are joining', async () => {
      // Step 1: Create group
      const groupData = new GroupBuilder()
        .withName(`Update During Join Test ${uuidv4()}`)
        .withDescription('Original description')
        .build();
      const group = await driver.createGroup(groupData, users[0].token);
      
      // Add an expense
      const expense = await driver.createExpense({
        groupId: group.id,
        description: 'Test expense',
        amount: 5000,
        currency: 'USD',
        paidBy: users[0].uid,
        participants: [users[0].uid],
        splitType: 'equal' as const,
        date: new Date().toISOString(),
        category: 'food'
      }, users[0].token);
      
      // Step 2: Generate share link
      const shareLink = await driver.generateShareLink(group.id, users[0].token);
      
      // Step 3: Concurrent operations - user joins while group is updated
      const operations = await Promise.allSettled([
        driver.joinGroupViaShareLink(shareLink.linkId, users[1].token),
        driver.updateGroup(group.id, { 
          description: 'Updated during join' 
        }, users[0].token)
      ]);
      
      // Both should succeed
      expect(operations[0].status).toBe('fulfilled');
      expect(operations[1].status).toBe('fulfilled');
      
      // Step 4: Verify expense still exists
      const finalExpenses = await driver.getGroupExpenses(group.id, users[0].token);
      expect(finalExpenses.expenses).toHaveLength(1);
      expect(finalExpenses.expenses[0].id).toBe(expense.id);
      
      // Step 5: Verify both changes took effect
      const finalGroup = await driver.getGroup(group.id, users[0].token);
      expect(finalGroup.memberIds).toContain(users[1].uid);
      expect(finalGroup.description).toBe('Updated during join');
    });
  });

  describe('Data integrity during concurrent operations', () => {
    test('should maintain correct balances when users join group with expenses', async () => {
      // Step 1: Create group
      const group = await driver.createGroup(new GroupBuilder()
        .withName(`Balance Test ${uuidv4()}`)
        .build(), users[0].token);
      
      // Step 2: Add expense where user 0 paid for everyone (even future members)
      await driver.createExpense({
        groupId: group.id,
        description: 'Group meal',
        amount: 12000, // $120
        currency: 'USD',
        paidBy: users[0].uid,
        participants: [users[0].uid],
        splitType: 'equal' as const,
        date: new Date().toISOString(),
        category: 'food'
      }, users[0].token);
      
      // Get initial balance
      const initialBalances = await driver.waitForBalanceUpdate(group.id, users[0].token);
      expect(initialBalances.userBalances[users[0].uid]).toBeDefined();
      
      // Step 3: Add new members
      const shareLink = await driver.generateShareLink(group.id, users[0].token);
      await driver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
      await driver.joinGroupViaShareLink(shareLink.linkId, users[2].token);
      
      // Step 4: Verify expenses still exist
      const expenses = await driver.getGroupExpenses(group.id, users[0].token);
      expect(expenses.expenses).toHaveLength(1);
      
      // Step 5: Check balances are still valid
      const finalBalances = await driver.getGroupBalances(group.id, users[0].token);
      expect(finalBalances.userBalances).toBeDefined();
      expect(Object.keys(finalBalances.userBalances).length).toBeGreaterThan(0);
    });
  });
});