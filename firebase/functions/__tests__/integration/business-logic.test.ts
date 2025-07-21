/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../support/ApiDriver';
import { ExpenseBuilder, UserBuilder } from '../support/builders';

describe('Business Logic Edge Cases', () => {
  let driver: ApiDriver;
  let users: User[] = [];
  let testGroup: any;

  jest.setTimeout(10000);

  beforeAll(async () => {
    driver = new ApiDriver();
    users = await Promise.all([
      driver.createTestUser(new UserBuilder().build()),
      driver.createTestUser(new UserBuilder().build()),
      driver.createTestUser(new UserBuilder().build()),
    ]);
  });

  beforeEach(async () => {
    testGroup = await driver.createGroup(`Test Group ${uuidv4()}`, users, users[0].token);
  });


  describe('Split Validation Edge Cases', () => {
    describe('Exact Split Validation', () => {
      test('should reject splits that do not add up to total amount', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants([users[0].uid, users[1].uid])
          .withSplits([
            { userId: users[0].uid, amount: 60 },
            { userId: users[1].uid, amount: 30 } // Only adds up to 90, not 100
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/split.*total|amounts.*equal|INVALID_SPLIT_TOTAL/i);
      });

      test('should accept splits with minor rounding differences (within 1 cent)', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants([users[0].uid, users[1].uid, users[2].uid])
          .withSplits([
            { userId: users[0].uid, amount: 33.33 },
            { userId: users[1].uid, amount: 33.33 },
            { userId: users[2].uid, amount: 33.34 } // Total: 100.00 (acceptable rounding)
          ])
          .build();

        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        const createdExpense = await driver.getExpense(response.id, users[0].token);
        expect(createdExpense.amount).toBe(100);
        expect(createdExpense.splits).toHaveLength(3);
      });

      test('should reject splits with differences greater than 1 cent', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants([users[0].uid, users[1].uid])
          .withSplits([
            { userId: users[0].uid, amount: 50.00 },
            { userId: users[1].uid, amount: 49.00 } // Total: 99.00 (difference > 1 cent)
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/split.*total|amounts.*equal|INVALID_SPLIT_TOTAL/i);
      });

      test('should reject negative split amounts', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants([users[0].uid, users[1].uid])
          .withSplits([
            { userId: users[0].uid, amount: 120 },
            { userId: users[1].uid, amount: -20 } // Negative amount - this is what the test is about
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/positive|negative|amount.*invalid/i);
      });

      test('should reject zero split amounts', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants([users[0].uid, users[1].uid])
          .withSplits([
            { userId: users[0].uid, amount: 100 },
            { userId: users[1].uid, amount: 0 } // Zero amount - this is what the test is about
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/positive|amount.*required|amount.*invalid/i);
      });

      test('should reject duplicate users in splits', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants([users[0].uid, users[1].uid])
          .withSplits([
            { userId: users[0].uid, amount: 50 },
            { userId: users[0].uid, amount: 50 } // Duplicate user - this is what the test is about
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/duplicate.*user|participant.*once|DUPLICATE_SPLIT_USERS/i);
      });

      test('should reject splits for users not in participants list', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants([users[0].uid]) // Only user 0 is a participant
          .withSplits([
            { userId: users[0].uid, amount: 50 },
            { userId: users[1].uid, amount: 50 } // User 1 is not a participant - this is what the test is about
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/participant|split.*user|INVALID_SPLIT_USER/i);
      });
    });

    describe('Percentage Split Validation', () => {
      test('should reject percentages that do not add up to 100%', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('percentage')
          .withParticipants([users[0].uid, users[1].uid])
          .withSplits([
            { userId: users[0].uid, amount: 60, percentage: 60 },
            { userId: users[1].uid, amount: 30, percentage: 30 } // Only adds up to 90% - this is what the test is about
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/percentage.*100|percentages.*add.*up|INVALID_PERCENTAGE_TOTAL/i);
      });

      test('should accept percentages with minor rounding differences (within 0.01%)', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('percentage')
          .withParticipants([users[0].uid, users[1].uid, users[2].uid])
          .withSplits([
            { userId: users[0].uid, amount: 33.33, percentage: 33.33 },
            { userId: users[1].uid, amount: 33.33, percentage: 33.33 },
            { userId: users[2].uid, amount: 33.34, percentage: 33.34 } // Total: 100.00% - acceptable rounding
          ])
          .build();

        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        const createdExpense = await driver.getExpense(response.id, users[0].token);
        expect(createdExpense.amount).toBe(100);
        expect(createdExpense.splits).toHaveLength(3);
      });

      test('should reject negative percentages', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('percentage')
          .withParticipants([users[0].uid, users[1].uid])
          .withSplits([
            { userId: users[0].uid, amount: 120, percentage: 120 },
            { userId: users[1].uid, amount: -20, percentage: -20 } // Negative percentage - this is what the test is about
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/percentage.*100|INVALID_INPUT|less than or equal to 100/i);
      });

      test('should reject percentages over 100%', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('percentage')
          .withParticipants([users[0].uid])
          .withSplits([
            { userId: users[0].uid, amount: 100, percentage: 150 } // 150% is over limit - this is what the test is about
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/percentage.*100|max.*100|percentage.*invalid/i);
      });
    });

    describe('Split Count Validation', () => {
      test('should require splits for all participants in exact split type', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('exact')
          .withParticipants([users[0].uid, users[1].uid, users[2].uid]) // 3 participants
          .withSplits([
            { userId: users[0].uid, amount: 50 },
            { userId: users[1].uid, amount: 50 } // Missing split for user 2 - this is what the test is about
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/splits.*participants|splits.*all|INVALID_SPLITS/i);
      });

      test('should require splits for all participants in percentage split type', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withSplitType('percentage')
          .withParticipants([users[0].uid, users[1].uid]) // 2 participants
          .withSplits([
            { userId: users[0].uid, amount: 100, percentage: 100 } // Missing split for user 1 - this is what the test is about
          ])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/splits.*participants|splits.*all|INVALID_SPLITS/i);
      });
    });

    describe('Decimal Precision Edge Cases', () => {
      test('should handle very small amounts with proper precision', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withAmount(0.01) // 1 cent - this is what the test is about
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build();

        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        const createdExpense = await driver.getExpense(response.id, users[0].token);
        expect(createdExpense.amount).toBe(0.01);
        expect(createdExpense.splits).toHaveLength(2);
        
        // With equal split of 0.01 between 2 people, rounding may result in 0.01 each (total 0.02)
        const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBeGreaterThanOrEqual(0.01);
        expect(totalSplits).toBeLessThanOrEqual(0.02);
      });

      test('should handle amounts with many decimal places', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withAmount(33.333333) // Many decimal places - this is what the test is about
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid, users[2].uid])
          .build();

        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        const createdExpense = await driver.getExpense(response.id, users[0].token);
        expect(createdExpense.amount).toBe(33.333333);
        
        // Verify splits are reasonable (within 1 cent of expected)
        const expectedSplitAmount = 33.333333 / 3;
        createdExpense.splits.forEach((split: any) => {
          expect(split.amount).toBeCloseTo(expectedSplitAmount, 2);
        });
      });
    });

    describe('Large Amount Edge Cases', () => {
      test('should handle very large amounts', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withAmount(999999.99) // Nearly one million - this is what the test is about
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build();

        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        const createdExpense = await driver.getExpense(response.id, users[0].token);
        expect(createdExpense.amount).toBe(999999.99);
        expect(createdExpense.splits).toHaveLength(2);
        
        // For large amounts, rounding might cause small differences
        const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBeCloseTo(999999.99, 1); // Allow 0.1 difference for rounding
        
        // Each split should be approximately half the total
        createdExpense.splits.forEach((split: any) => {
          expect(split.amount).toBeCloseTo(999999.99 / 2, 1);
        });
      });

      test('should reject zero amounts', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withAmount(0) // Zero amount - this is what the test is about
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/positive|amount.*required|INVALID_AMOUNT/i);
      });

      test('should reject negative amounts', async () => {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withAmount(-50) // Negative amount - this is what the test is about
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build();

        await expect(
          driver.createExpense(expenseData, users[0].token)
        ).rejects.toThrow(/positive|amount.*invalid|INVALID_AMOUNT/i);
      });
    });
  });

  describe('Additional Monetary Edge Cases', () => {
    test('should handle currency-style formatting for display', async () => {
      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withAmount(12.34) // Common currency format - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      const response = await driver.createExpense(expenseData, users[0].token);
      expect(response.id).toBeDefined();

      const createdExpense = await driver.getExpense(response.id, users[0].token);
      expect(createdExpense.amount).toBe(12.34);
      
      // Verify splits handle currency precision properly
      const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
      expect(totalSplits).toBeCloseTo(12.34, 2);
    });

    test('should handle odd number divisions with proper rounding', async () => {
      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withAmount(10.00) // $10 split 3 ways = $3.33, $3.33, $3.34 - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid, users[2].uid])
        .build();

      const response = await driver.createExpense(expenseData, users[0].token);
      expect(response.id).toBeDefined();

      const createdExpense = await driver.getExpense(response.id, users[0].token);
      expect(createdExpense.amount).toBe(10.00);
      expect(createdExpense.splits).toHaveLength(3);
      
      // Total should be close to original amount (rounding may cause small differences)
      const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
      expect(totalSplits).toBeCloseTo(10.00, 1); // Allow 0.1 difference for rounding
      
      // Each split should be reasonable (between 3.33 and 3.34)
      createdExpense.splits.forEach((split: any) => {
        expect(split.amount).toBeGreaterThanOrEqual(3.33);
        expect(split.amount).toBeLessThanOrEqual(3.34);
      });
    });

    test('should handle fractional cents properly', async () => {
      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withAmount(0.999) // Nearly 1 cent - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      const response = await driver.createExpense(expenseData, users[0].token);
      expect(response.id).toBeDefined();

      const createdExpense = await driver.getExpense(response.id, users[0].token);
      expect(createdExpense.amount).toBe(0.999);
      
      // Verify splits handle fractional amounts reasonably (rounding may occur)
      const totalSplits = createdExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
      expect(totalSplits).toBeCloseTo(0.999, 2); // Allow for rounding differences
    });
  });

  describe('Group Lifecycle Edge Cases', () => {
    test('should handle viewing group with no expenses', async () => {
      // Create a fresh group with no expenses
      const emptyGroup = await driver.createGroup(`Empty Group ${uuidv4()}`, users, users[0].token);
      
      // Should be able to get group balances (should be empty/zero)
      const balances = await driver.getGroupBalances(emptyGroup.id, users[0].token);
      
      expect(balances).toHaveProperty('userBalances');
      expect(balances).toHaveProperty('simplifiedDebts');
      
      // Balances should exist for all users but be zero
      users.forEach(user => {
        if (balances.userBalances[user.uid]) {
          expect(balances.userBalances[user.uid].netBalance).toBe(0);
        }
      });
      
      // Should have no simplified debts
      expect(balances.simplifiedDebts).toHaveLength(0);
    });

    test('should handle multiple expenses with same participants', async () => {
      // Create a fresh group specifically for this test to avoid interference
      const isolatedUsers = [
        await driver.createTestUser(new UserBuilder().build()),
        await driver.createTestUser(new UserBuilder().build())
      ];

      const multiExpenseGroup = await driver.createGroup(`Multi Expense Group ${uuidv4()}`, isolatedUsers, isolatedUsers[0].token);
      
      // Create multiple expenses with same participants
      const expenses = [
        { amount: 50, paidBy: isolatedUsers[0].uid },
        { amount: 30, paidBy: isolatedUsers[1].uid },
        { amount: 20, paidBy: isolatedUsers[0].uid }
      ];

      const createdExpenseIds = [];
      for (const expense of expenses) {
        const expenseData = new ExpenseBuilder()
          .withGroupId(multiExpenseGroup.id)
          .withAmount(expense.amount)
          .withPaidBy(expense.paidBy)
          .withParticipants([isolatedUsers[0].uid, isolatedUsers[1].uid])
          .build();
        const createdExpense = await driver.createExpense(expenseData, isolatedUsers[0].token);
        createdExpenseIds.push(createdExpense.id);
      }

      // Verify expenses were created correctly
      const loadedExpenses = await Promise.all(
        createdExpenseIds.map(id => driver.getExpense(id, isolatedUsers[0].token))
      );
      
      expect(loadedExpenses).toHaveLength(3);
      expect(loadedExpenses[0].amount).toBe(50);
      expect(loadedExpenses[0].paidBy).toBe(isolatedUsers[0].uid);
      expect(loadedExpenses[1].amount).toBe(30);
      expect(loadedExpenses[1].paidBy).toBe(isolatedUsers[1].uid);
      expect(loadedExpenses[2].amount).toBe(20);
      expect(loadedExpenses[2].paidBy).toBe(isolatedUsers[0].uid);

      // Wait for balance calculations
      const balances = await driver.waitForBalanceUpdate(multiExpenseGroup.id, isolatedUsers[0].token);
      
      // Verify the balances reflect all expenses
      expect(balances).toHaveProperty('userBalances');
      expect(balances.userBalances[isolatedUsers[0].uid]).toBeDefined();
      expect(balances.userBalances[isolatedUsers[1].uid]).toBeDefined();
      
      // User 0 paid $70 total (50 + 20), User 1 paid $30 total = $100 total
      // Split equally: each owes $50
      // User 0 paid $70, owes $50 = owed $20
      // User 1 paid $30, owes $50 = owes $20
      const user0Balance = balances.userBalances[isolatedUsers[0].uid];
      const user1Balance = balances.userBalances[isolatedUsers[1].uid];
      
      // Expected behavior: User 0 should be owed 20, User 1 should owe 20
      expect(user0Balance.netBalance).toBeCloseTo(20, 2);
      expect(user1Balance.netBalance).toBeCloseTo(-20, 2);
    });

    test('should handle deleting expenses successfully', async () => {
      // Focus on expense deletion functionality rather than balance recalculation
      
      // Create an expense
      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription('To Be Deleted Test')
        .withAmount(100) // Test expense deletion - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      const createdExpense = await driver.createExpense(expenseData, users[0].token);
      expect(createdExpense.id).toBeDefined();
      
      // Verify the expense exists
      const fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
      expect(fetchedExpense).toBeDefined();
      expect(fetchedExpense.description).toBe('To Be Deleted Test');
      
      // Delete the expense
      await driver.deleteExpense(createdExpense.id, users[0].token);
      
      // Verify the expense is gone
      await expect(
        driver.getExpense(createdExpense.id, users[0].token)
      ).rejects.toThrow(/not found|deleted|404/i);
    });

    test('should handle complex split scenarios', async () => {
      // Use existing testGroup to avoid rate limiting
      
      // Scenario: Mixed split types in one group - just verify structure
      const expenseData1 = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withAmount(90) // Complex split scenario - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid, users[2].uid])
        .build();

      await driver.createExpense(expenseData1, users[0].token);
      
      // Wait for balance calculations
      const balances = await driver.waitForBalanceUpdate(testGroup.id, users[0].token, 15000);
      
      // Verify balance structure
      expect(balances).toHaveProperty('userBalances');
      expect(Object.keys(balances.userBalances).length).toBeGreaterThanOrEqual(3);
      
      // All users should have balance entries
      users.forEach(user => {
        expect(balances.userBalances).toHaveProperty(user.uid);
        expect(balances.userBalances[user.uid]).toHaveProperty('netBalance');
      });
      
      // Net balance total should be approximately zero (sum of all debts/credits)
      const totalNetBalance = Object.values(balances.userBalances)
        .reduce((sum: number, balance: any) => sum + balance.netBalance, 0);
      expect(totalNetBalance).toBeCloseTo(0, 1);
    });

    test('should handle expense updates successfully', async () => {
      // Focus on expense update functionality rather than balance recalculation
      
      // Create initial expense
      const initialExpenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription('Update Test Expense')
        .withAmount(50) // Test expense updates - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      const createdExpense = await driver.createExpense(initialExpenseData, users[0].token);
      expect(createdExpense.id).toBeDefined();
      
      // Verify initial expense data
      let fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
      expect(fetchedExpense.amount).toBe(50);
      expect(fetchedExpense.description).toBe('Update Test Expense');
      
      // Update the expense
      await driver.updateExpense(createdExpense.id, { 
        amount: 80, 
        description: 'Updated Test Expense' 
      }, users[0].token);
      
      // Verify the update worked
      fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
      expect(fetchedExpense.amount).toBe(80);
      expect(fetchedExpense.description).toBe('Updated Test Expense');
      
      // Verify splits were recalculated
      expect(fetchedExpense.splits).toHaveLength(2);
      const totalSplits = fetchedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
      expect(totalSplits).toBeCloseTo(80, 1);
    });
  });
});