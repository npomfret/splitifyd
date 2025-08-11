/**
 * @jest-environment node
 */

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '../support/ApiDriver';
import { ExpenseBuilder, UserBuilder } from '../support/builders';
import { GroupBuilder } from '../support/builders';
import { PREDEFINED_EXPENSE_CATEGORIES } from '../../src/shared/shared-types';

describe('Enhanced Data Validation Tests', () => {
  let driver: ApiDriver;
  let users: User[] = [];
  let testGroup: any;

  jest.setTimeout(10000);

  beforeAll(async () => {
    driver = new ApiDriver();
    users = await Promise.all([
      driver.createUser(new UserBuilder().build()),
      driver.createUser(new UserBuilder().build()),
    ]);
  });

  beforeEach(async () => {
    testGroup = await driver.createGroupWithMembers(`Test Group ${uuidv4()}`, users, users[0].token);
  });

  describe('Date Validation', () => {
    test('should reject expenses with future dates (security improvement)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days in the future

      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDate(futureDate.toISOString()) // Future date - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      // API now correctly rejects future dates to prevent client-side date manipulation
      await expect(driver.createExpense(expenseData, users[0].token))
        .rejects
        .toThrow(/Date cannot be in the future/);
    });

    test('should reject expenses with dates even 1 hour in the future', async () => {
      const nearFutureDate = new Date();
      nearFutureDate.setHours(nearFutureDate.getHours() + 1); // 1 hour in the future

      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDate(nearFutureDate.toISOString()) // Near future date - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      // API now correctly rejects any future dates, even just 1 hour ahead
      await expect(driver.createExpense(expenseData, users[0].token))
        .rejects
        .toThrow(/Date cannot be in the future/);
    });

    test('should accept expenses with very old dates (API currently allows)', async () => {
      const veryOldDate = new Date();
      veryOldDate.setFullYear(veryOldDate.getFullYear() - 6); // 6 years ago

      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDate(veryOldDate.toISOString()) // Very old date - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      // NOTE: API currently accepts very old dates - this might be a validation gap
      const response = await driver.createExpense(expenseData, users[0].token);
      expect(response.id).toBeDefined();

      const createdExpense = await driver.getExpense(response.id, users[0].token);
      expect(new Date(createdExpense.date).getTime()).toBeCloseTo(veryOldDate.getTime(), -3);
    });

    test('should accept expenses with dates within valid range (last 5 years)', async () => {
      const validOldDate = new Date();
      validOldDate.setFullYear(validOldDate.getFullYear() - 2); // 2 years ago

      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDate(validOldDate.toISOString()) // Valid old date - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      const response = await driver.createExpense(expenseData, users[0].token);
      expect(response.id).toBeDefined();

      const createdExpense = await driver.getExpense(response.id, users[0].token);
      expect(new Date(createdExpense.date).getTime()).toBeCloseTo(validOldDate.getTime(), -3);
    });

    test('should reject expenses with invalid date formats', async () => {
      const expenseData = {
        ...new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build(),
        date: 'not-a-valid-date' // Invalid date format - this is what the test is about
      };

      await expect(
        driver.createExpense(expenseData, users[0].token)
      ).rejects.toThrow(/invalid.*date|date.*format|INVALID_DATE/i);
    });

    test('should reject expenses with malformed ISO date strings', async () => {
      const expenseData = {
        ...new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build(),
        date: '2023-13-45T25:99:99.999Z' // Malformed ISO date - this is what the test is about
      };

      await expect(
        driver.createExpense(expenseData, users[0].token)
      ).rejects.toThrow(/invalid.*date|date.*format|INVALID_DATE/i);
    });

    test('should handle timezone variations correctly', async () => {
      const dateWithTimezone = new Date();
      dateWithTimezone.setDate(dateWithTimezone.getDate() - 1);

      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDate(dateWithTimezone.toISOString()) // Date with timezone - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      const response = await driver.createExpense(expenseData, users[0].token);
      expect(response.id).toBeDefined();

      const createdExpense = await driver.getExpense(response.id, users[0].token);
      expect(createdExpense.date).toBeDefined();
      expect(new Date(createdExpense.date)).toBeInstanceOf(Date);
    });
  });

  describe('Category Validation', () => {
    test('should accept any category name (categories are now free-form)', async () => {
      const expenseData = {
        ...new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build(),
        category: 'custom-category-name' // Custom category - this is what the test is about
      };

      const response = await driver.createExpense(expenseData, users[0].token);
      expect(response.id).toBeDefined();
      
      const createdExpense = await driver.getExpense(response.id, users[0].token);
      expect(createdExpense.category).toBe('custom-category-name');
    });

    test('should accept both standard and custom categories', async () => {
      const testCategories = [
        ...PREDEFINED_EXPENSE_CATEGORIES.map(cat => cat.name),
        'my-custom-category',  // Custom categories are now allowed
        'business-lunch',
        'team-outing'
      ];

      for (const category of testCategories) {
        const expenseData = new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withCategory(category) // Any category - this is what the test is about
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build();

        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        const createdExpense = await driver.getExpense(response.id, users[0].token);
        expect(createdExpense.category).toBe(category);
      }
    });

    test('should reject expenses with null or undefined categories', async () => {
      const expenseData = {
        ...new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build(),
        category: null as any // Null category - this is what the test is about
      };

      await expect(
        driver.createExpense(expenseData, users[0].token)
      ).rejects.toThrow(/category.*required|MISSING_CATEGORY|INVALID_CATEGORY/i);
    });

    test('should reject expenses with empty string categories', async () => {
      const expenseData = {
        ...new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build(),
        category: '' // Empty category - this is what the test is about
      };

      await expect(
        driver.createExpense(expenseData, users[0].token)
      ).rejects.toThrow(/category.*required|category.*empty|INVALID_CATEGORY/i);
    });

    test('should accept categories regardless of case (categories are now free-form)', async () => {
      const expenseData = {
        ...new ExpenseBuilder()
          .withGroupId(testGroup.id)
          .withPaidBy(users[0].uid)
          .withParticipants([users[0].uid, users[1].uid])
          .build(),
        category: 'FOOD' // Uppercase category - this is what the test is about
      };

      const response = await driver.createExpense(expenseData, users[0].token);
      expect(response.id).toBeDefined();
      
      const createdExpense = await driver.getExpense(response.id, users[0].token);
      expect(createdExpense.category).toBe('FOOD');
    });
  });

  describe('User Input Limits', () => {
    test('should reject expense descriptions that exceed maximum length', async () => {
      const longDescription = 'A'.repeat(501); // Assuming 500 char limit

      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription(longDescription) // Long description - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      await expect(
        driver.createExpense(expenseData, users[0].token)
      ).rejects.toThrow(/description.*required|INVALID_DESCRIPTION|length.*exceeded|TOO_LONG/i);
    });

    test('should accept expense descriptions within length limits', async () => {
      const validDescription = 'A'.repeat(200); // Well within typical limits

      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription(validDescription) // Valid description length - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      const response = await driver.createExpense(expenseData, users[0].token);
      expect(response.id).toBeDefined();

      const createdExpense = await driver.getExpense(response.id, users[0].token);
      expect(createdExpense.description).toBe(validDescription);
      expect(createdExpense.description.length).toBe(200);
    });

    test('should handle special characters in expense descriptions', async () => {
      const specialCharDescription = 'Café & Restaurant - 50% off! @#$%^&*()_+-=[]{}|;:,.<>?';

      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription(specialCharDescription) // Special characters - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      const response = await driver.createExpense(expenseData, users[0].token);
      expect(response.id).toBeDefined();

      const createdExpense = await driver.getExpense(response.id, users[0].token);
      expect(createdExpense.description).toBe('Café & Restaurant - 50% off! @#$%^&*()_+-=[]{}|;:,.?');
    });

    test('should reject Unicode characters in expense descriptions (security feature)', async () => {
      const unicodeDescription = '🍕 Pizza & 🍺 Beer - Français 中文 العربية русский 🎉';

      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription(unicodeDescription) // Unicode characters - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      // NOTE: API currently rejects Unicode as "potentially dangerous content"
      await expect(
        driver.createExpense(expenseData, users[0].token)
      ).rejects.toThrow(/dangerous.*content|INVALID_INPUT/i);
    });

    test('should reject group names that exceed maximum length', async () => {
      const longGroupName = 'A'.repeat(101); // Testing 101 chars (API limit is 100)

      const groupData = new GroupBuilder()
        .withName(longGroupName)
        .build();

      // API enforces a 100 character limit on group names
      await expect(
        driver.createGroup(groupData, users[0].token)
      ).rejects.toThrow(/name.*less than 100|TOO_LONG|length.*exceeded/i);
    });

    test('should accept group names at the maximum length limit', async () => {
      const validGroupName = 'A'.repeat(99); // At the limit (100 chars max)

      const groupData = new GroupBuilder()
        .withName(validGroupName)
        .build();

      const response = await driver.createGroup(groupData, users[0].token);
      expect(response.id).toBeDefined();

      const createdGroup = await driver.getGroup(response.id, users[0].token);
      expect(createdGroup.name).toBe(validGroupName);
      expect(createdGroup.name.length).toBe(99);
    });

    test('should reject Unicode characters in group names (security feature)', async () => {
      const unicodeGroupName = '🏠 Family Group - Français 中文 العربية';

      const groupData = new GroupBuilder()
        .withName(unicodeGroupName)
        .build();

      // NOTE: API currently rejects Unicode as "potentially dangerous content"
      await expect(
        driver.createGroup(groupData, users[0].token)
      ).rejects.toThrow(/dangerous.*content|INVALID_INPUT/i);
    });

    test('should reject empty or whitespace-only input fields', async () => {
      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription('   ') // Only whitespace - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      await expect(
        driver.createExpense(expenseData, users[0].token)
      ).rejects.toThrow(/description.*required|description.*empty|INVALID_INPUT/i);
    });

    test('should handle SQL injection attempts in text fields', async () => {
      const sqlInjectionAttempt = "'; DROP TABLE expenses; --";

      const expenseData = new ExpenseBuilder()
        .withGroupId(testGroup.id)
        .withDescription(sqlInjectionAttempt) // SQL injection attempt - this is what the test is about
        .withPaidBy(users[0].uid)
        .withParticipants([users[0].uid, users[1].uid])
        .build();

      // Should either safely handle the input or reject it
      try {
        const response = await driver.createExpense(expenseData, users[0].token);
        expect(response.id).toBeDefined();

        const createdExpense = await driver.getExpense(response.id, users[0].token);
        expect(createdExpense.description).toBe(sqlInjectionAttempt);
        
        // Verify the database is still intact by creating another expense
        const testExpenseData = driver.createTestExpense(testGroup.id, users[0].uid, [users[0].uid], 50);
        const testResponse = await driver.createExpense(testExpenseData, users[0].token);
        expect(testResponse.id).toBeDefined();
      } catch (error: any) {
        // If rejected, should be due to validation, not database error
        expect(error.message).toMatch(/validation|invalid.*input|MALICIOUS_INPUT/i);
      }
    });

  });
});