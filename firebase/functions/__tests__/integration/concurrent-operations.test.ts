/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../support/ApiDriver';
import { ExpenseBuilder, UserBuilder } from '../support/builders';

describe('Concurrent Operations and Transaction Integrity', () => {
  let driver: ApiDriver;
  let users: User[] = [];
  let testGroup: any;

  jest.setTimeout(25000); // Timeout for concurrent operations

  beforeAll(async () => {
    driver = new ApiDriver();
    
    // Create more users for concurrent testing
    users = await Promise.all([
      driver.createTestUser(new UserBuilder().build()),
      driver.createTestUser(new UserBuilder().build()),
      driver.createTestUser(new UserBuilder().build()),
      driver.createTestUser(new UserBuilder().build()),
      driver.createTestUser(new UserBuilder().build()),
    ]);
  });

  beforeEach(async () => {
    testGroup = await driver.createGroup(`Concurrent Test Group ${uuidv4()}`, users, users[0].token);
  });

  describe('Race Conditions', () => {
    test('should handle concurrent expense creation in same group', async () => {
      const concurrentExpenses = 10;
      const expensePromises = [];

      // Create multiple expenses concurrently from different users
      for (let i = 0; i < concurrentExpenses; i++) {
        const userIndex = i % users.length;
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription(`Concurrent Expense ${i}`)
          .withAmount(50 + i)
          .withPaidBy(users[userIndex].uid)
          .withParticipants(users.map(u => u.uid))
          .build();

        expensePromises.push(
          driver.createExpense(expenseData, users[userIndex].token)
            .then(response => ({ success: true, id: response.id, index: i }))
            .catch(error => ({ success: false, error: error.message, index: i }))
        );
      }

      // Wait for all operations to complete
      const results = await Promise.all(expensePromises);

      // Verify all expenses were created successfully
      const successfulExpenses = results.filter(r => r.success);
      const failedExpenses = results.filter(r => !r.success);

      expect(successfulExpenses.length).toBe(concurrentExpenses);
      expect(failedExpenses.length).toBe(0);

      // Verify all expenses exist in the group
      const groupExpenses = await driver.getGroupExpenses(testGroup.id, users[0].token);
      expect(groupExpenses.expenses.length).toBe(concurrentExpenses);

      // Verify no duplicate IDs
      const expenseIds = successfulExpenses
        .filter((e): e is { success: boolean; id: string; index: number } => 'id' in e)
        .map(e => e.id);
      const uniqueIds = new Set(expenseIds);
      expect(uniqueIds.size).toBe(concurrentExpenses);
    });

    test('should handle concurrent balance updates correctly', async () => {
      // Create initial expenses to establish balances
      const initialExpenses = [
        { amount: 100, paidBy: users[0].uid },
        { amount: 80, paidBy: users[1].uid },
        { amount: 60, paidBy: users[2].uid },
      ];

      for (const expense of initialExpenses) {
        await driver.createExpense(new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription(`Initial Expense ${expense.amount}`)
          .withAmount(expense.amount)
          .withPaidBy(expense.paidBy)
          .withParticipants(users.slice(0, 3).map(u => u.uid))
          .build(), users[0].token);
      }

      // Wait for initial balance calculations
      await driver.waitForBalanceUpdate(testGroup.id, users[0].token);

      // Now create concurrent expenses that will trigger balance updates
      const concurrentUpdates = 5;
      const updatePromises = [];

      for (let i = 0; i < concurrentUpdates; i++) {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription(`Concurrent Balance Update ${i}`)
          .withAmount(20)
          .withPaidBy(users[i % 3].uid)
          .withParticipants(users.slice(0, 3).map(u => u.uid))
          .build();

        updatePromises.push(
          driver.createExpense(expenseData, users[i % 3].token)
        );
      }

      // Execute all updates concurrently
      await Promise.all(updatePromises);

      // Wait for balance calculations to complete
      const finalBalances = await driver.waitForBalanceUpdate(testGroup.id, users[0].token, 20000);

      // Verify balance consistency
      expect(finalBalances).toHaveProperty('userBalances');
      expect(Object.keys(finalBalances.userBalances).length).toBeGreaterThanOrEqual(3);

      // Calculate expected totals
      // Initial: 240 total (100 + 80 + 60)
      // Additional: 100 total (5 × 20)
      // Total expenses: 340

      // Verify net balance sum is zero (what's owed equals what's owing)
      const netBalanceSum = Object.values(finalBalances.userBalances)
        .reduce((sum: number, balance: any) => sum + balance.netBalance, 0);
      expect(Math.abs(netBalanceSum)).toBeLessThan(0.01); // Allow for tiny rounding errors
    });

    test('should handle concurrent group membership changes', async () => {
      // Create additional users for membership testing
      const newUsers = await Promise.all([
        driver.createTestUser(new UserBuilder().build()),
        driver.createTestUser(new UserBuilder().build()),
        driver.createTestUser(new UserBuilder().build()),
      ]);

      // Generate share link
      const shareResponse = await driver.generateShareLink(testGroup.id, users[0].token);

      // Attempt to join group concurrently with multiple users
      const joinPromises = newUsers.map((user, index) => 
        driver.joinGroupViaShareLink(shareResponse.linkId, user.token)
          .then(_ => ({ success: true, userId: user.uid, index }))
          .catch(error => ({ success: false, error: error.message, userId: user.uid, index }))
      );

      const joinResults = await Promise.all(joinPromises);

      // All should succeed since they're different users
      const successfulJoins = joinResults.filter(r => r.success);
      expect(successfulJoins.length).toBe(newUsers.length);

      // Verify final group membership
      const finalGroup = await driver.getGroupNew(testGroup.id, users[0].token);
      const memberUids = finalGroup.members.map((m: any) => m.uid);

      // Should have original 5 users + at least some new users
      // Note: Some concurrent joins might fail due to race conditions
      expect(memberUids.length).toBeGreaterThanOrEqual(5);
      expect(memberUids.length).toBeLessThanOrEqual(5 + newUsers.length);
      
      // Verify at least some new users were added (concurrent operations may have partial success)
      const addedNewUsers = newUsers.filter(user => memberUids.includes(user.uid));
      expect(addedNewUsers.length).toBeGreaterThan(0);
    });

    test('should prevent duplicate concurrent joins by same user', async () => {
      // Create a new user for this test
      const duplicateUser = await driver.createTestUser(new UserBuilder().build());

      // Generate share link
      const shareResponse = await driver.generateShareLink(testGroup.id, users[0].token);

      // Attempt to join multiple times concurrently with same user
      const joinAttempts = 5;
      const joinPromises = Array(joinAttempts).fill(null).map((_, index) =>
        driver.joinGroupViaShareLink(shareResponse.linkId, duplicateUser.token)
          .then(_ => ({ success: true, attempt: index }))
          .catch(error => ({ success: false, error: error.message, attempt: index }))
      );

      const results = await Promise.all(joinPromises);

      // Check results - in concurrent scenarios, multiple might succeed before detection
      const successfulJoins = results.filter(r => r.success);
      const failedJoins = results.filter(r => !r.success);

      // At least some should fail (duplicate detection may not catch all in true concurrent execution)
      expect(failedJoins.length).toBeGreaterThan(0);
      expect(successfulJoins.length).toBeLessThanOrEqual(joinAttempts);

      // Verify user appears only once in group
      const finalGroup = await driver.getGroupNew(testGroup.id, users[0].token);
      const userOccurrences = finalGroup.members.filter((m: any) => m.uid === duplicateUser.uid);
      expect(userOccurrences.length).toBe(1);
    });

    test('should handle concurrent expense updates on same expense', async () => {
      // Create an expense to update
      const initialExpenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription('Concurrent Update Test')
        .withAmount(100)
        .withPaidBy(users[0].uid)
        .withParticipants(users.map(u => u.uid))
        .build();

      const createdExpense = await driver.createExpense(initialExpenseData, users[0].token);

      // Attempt concurrent updates from different users
      const updatePromises = users.slice(0, 3).map((user, index) => 
        driver.updateExpense(createdExpense.id, {
          amount: 150 + (index * 10),
          description: `Updated by User ${index}`
        }, user.token)
          .then(() => ({ success: true, userId: user.uid, amount: 150 + (index * 10) }))
          .catch(error => ({ success: false, error: error.message, userId: user.uid }))
      );

      const updateResults = await Promise.all(updatePromises);

      // At least one update should succeed
      const successfulUpdates = updateResults.filter(r => r.success);
      expect(successfulUpdates.length).toBeGreaterThanOrEqual(1);

      // Verify final state is consistent
      const finalExpense = await driver.getExpense(createdExpense.id, users[0].token);
      expect(finalExpense).toBeDefined();
      expect(finalExpense.id).toBe(createdExpense.id);

      // The amount should be one of the attempted values
      const attemptedAmounts = [150, 160, 170];
      expect(attemptedAmounts).toContain(finalExpense.amount);
    });
  });

  describe('Transaction Integrity', () => {
    test('should validate split amounts match total in concurrent scenarios', async () => {
      // Test that splits validation remains consistent under concurrent load
      const invalidExpensePromises = [];
      
      // Create multiple invalid expenses concurrently
      for (let i = 0; i < 3; i++) {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription(`Invalid Split Total ${i}`)
          .withAmount(100)
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants([users[0].uid, users[1].uid])
          .withSplits([
            { userId: users[0].uid, amount: 30 },
            { userId: users[1].uid, amount: 30 } // Total is 60, not 100
          ])
          .build();

        invalidExpensePromises.push(
          driver.createExpense(expenseData, users[0].token)
            .then(() => ({ success: true, index: i }))
            .catch(error => ({ success: false, error: error.message, index: i }))
        );
      }

      const results = await Promise.all(invalidExpensePromises);
      
      // All should fail due to invalid split totals
      const failures = results.filter(r => !r.success);
      expect(failures.length).toBe(3);
      
      // Verify error messages indicate validation failure
      failures.forEach(failure => {
        if ('error' in failure) {
          expect(failure.error).toMatch(/split.*total|amounts.*equal|INVALID_SPLIT_TOTAL|PAYER_NOT_PARTICIPANT/i);
        }
      });

      // Verify no expenses were created
      const groupExpenses = await driver.getGroupExpenses(testGroup.id, users[0].token);
      expect(groupExpenses.expenses.length).toBe(0);
    });

    test('should handle partial failures in bulk operations gracefully', async () => {
      // Create a mix of valid and invalid expenses
      const mixedExpenses = [
        // Valid expense
        new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription('Valid Expense 1')
          .withAmount(50)
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build(),
        // Invalid: negative amount
        new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription('Invalid Expense - Negative')
          .withAmount(-50)
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build(),
        // Valid expense
        new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription('Valid Expense 2')
          .withAmount(75)
          .withPaidBy(users[1].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build(),
        // Invalid: bad category
        new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription('Invalid Expense - Bad Category')
          .withAmount(100)
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .withCategory('invalid-category')
          .build(),
      ];

      // Execute all operations and track results
      const results = await Promise.all(
        mixedExpenses.map((expense, index) =>
          driver.createExpense(expense, users[0].token)
            .then(response => ({ success: true, id: response.id, index }))
            .catch(error => ({ success: false, error: error.message, index }))
        )
      );

      // Should have 2 successes and 2 failures
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);

      expect(successes.length).toBe(2);
      expect(failures.length).toBe(2);

      // Verify only valid expenses were created
      const groupExpenses = await driver.getGroupExpenses(testGroup.id, users[0].token);
      expect(groupExpenses.expenses.length).toBe(2);
      
      const expenseDescriptions = groupExpenses.expenses.map((e: any) => e.description);
      expect(expenseDescriptions).toContain('Valid Expense 1');
      expect(expenseDescriptions).toContain('Valid Expense 2');
      expect(expenseDescriptions).not.toContain('Invalid Expense - Negative');
      expect(expenseDescriptions).not.toContain('Invalid Expense - Bad Category');
    });

    test('should maintain balance consistency after failed operations', async () => {
      // Create initial expense for baseline
      await driver.createExpense(new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription('Baseline Expense')
        .withAmount(100)
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build(), users[0].token);

      // Get initial balances
      const initialBalances = await driver.waitForBalanceUpdate(testGroup.id, users[0].token);
      const initialUser0Balance = initialBalances.userBalances[users[0].uid]?.netBalance || 0;

      // Attempt to create an invalid expense
      try {
        await driver.createExpense(new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withDescription('Failed Expense')
          .withAmount(0) // Invalid: zero amount
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build(), users[0].token);
      } catch (error) {
        // Expected to fail
      }

      // Verify balances remain unchanged after failed operation
      const finalBalances = await driver.getGroupBalances(testGroup.id, users[0].token);
      const finalUser0Balance = finalBalances.userBalances[users[0].uid]?.netBalance || 0;

      expect(finalUser0Balance).toBe(initialUser0Balance);
    });

    test('should handle database consistency when updating non-existent expense', async () => {
      const nonExistentExpenseId = 'non-existent-' + uuidv4();

      // Attempt to update non-existent expense
      await expect(
        driver.updateExpense(nonExistentExpenseId, {
          amount: 200,
          description: 'Updated Non-Existent'
        }, users[0].token)
      ).rejects.toThrow(/not found|404/i);

      // Verify group state remains consistent
      const groupExpenses = await driver.getGroupExpenses(testGroup.id, users[0].token);
      expect(groupExpenses.expenses).toBeDefined();
      expect(Array.isArray(groupExpenses.expenses)).toBe(true);
    });

    test('should handle concurrent deletes of same expense gracefully', async () => {
      // Create an expense to delete
      const expenseToDelete = await driver.createExpense(new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription('To Be Deleted Concurrently')
        .withAmount(50)
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build(), users[0].token);

      // Attempt to delete the same expense from multiple users concurrently
      const deletePromises = users.slice(0, 3).map(user =>
        driver.deleteExpense(expenseToDelete.id, user.token)
          .then(() => ({ success: true, userId: user.uid }))
          .catch(error => ({ success: false, error: error.message, userId: user.uid }))
      );

      const deleteResults = await Promise.all(deletePromises);

      // At least one should succeed
      const successfulDeletes = deleteResults.filter(r => r.success);
      expect(successfulDeletes.length).toBeGreaterThanOrEqual(1);

      // Verify expense is actually deleted
      await expect(
        driver.getExpense(expenseToDelete.id, users[0].token)
      ).rejects.toThrow(/not found|deleted|404/i);

      // Verify group expenses list is consistent
      const finalExpenses = await driver.getGroupExpenses(testGroup.id, users[0].token);
      const expenseIds = finalExpenses.expenses.map((e: any) => e.id);
      expect(expenseIds).not.toContain(expenseToDelete.id);
    });
  });
});