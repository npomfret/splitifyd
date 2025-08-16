/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../../support/ApiDriver';
import { SplitTypes } from '../../../shared/shared-types';

describe('Expense Locking Debug Test', () => {
  jest.setTimeout(10000);
  
  let driver: ApiDriver;
  let user: User;

  beforeAll(async () => {
    driver = new ApiDriver();
    
    // Create one test user
    user = await driver.createUser({
      email: `testlock${uuidv4().substring(0, 6)}@test.com`,
      password: `Password123!`,
      displayName: `TestUser`
    });
  });

  test('should handle concurrent expense updates', async () => {
    // Create group
    const group = await driver.createGroup({
      name: 'Debug Test Group',
      description: 'Testing expense concurrent updates'
    }, user.token);
    
    // Create an expense
    const expense = await driver.createExpense({
      groupId: group.id,
      description: 'Test Expense',
      amount: 100,
      currency: 'USD',
      paidBy: user.uid,
      category: 'food',
      date: new Date().toISOString(),
      splitType: SplitTypes.EQUAL,
      participants: [user.uid]
    }, user.token);
    
    console.log('Created expense:', expense.id);
    
    // Try to update the expense twice simultaneously
    const updatePromises = [
      driver.updateExpense(expense.id, { amount: 200 }, user.token),
      driver.updateExpense(expense.id, { amount: 300 }, user.token),
    ];
    
    console.log('Starting concurrent updates...');
    const results = await Promise.allSettled(updatePromises);
    
    // Log the actual results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`Update ${index + 1}: SUCCESS`);
      } else {
        const error = result.reason?.response?.data?.error;
        console.log(`Update ${index + 1}: FAILED`, {
          code: error?.code,
          message: error?.message || result.reason?.message,
          status: result.reason?.response?.status,
          fullError: result.reason?.message
        });
      }
    });
    
    // Check results
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');
    
    console.log(`Results: ${successes.length} succeeded, ${failures.length} failed`);
    
    // At least one should succeed
    expect(successes.length).toBeGreaterThan(0);
    
    // Verify final state
    const expenses = await driver.getGroupExpenses(group.id, user.token);
    const updatedExpense = expenses.expenses.find((e: any) => e.id === expense.id);
    console.log('Final expense amount:', updatedExpense?.amount);
    expect([200, 300]).toContain(updatedExpense?.amount);
  });
});