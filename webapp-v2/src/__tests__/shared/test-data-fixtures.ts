/**
 * Shared test data fixtures for API integration tests
 */

// Default test password that meets validation requirements
export const DEFAULT_TEST_PASSWORD = 'TestPassword123!';

/**
 * Generate a unique test user data object
 */
export function createTestUser(overrides: Partial<{
  email: string;
  password: string;
  name: string;
}> = {}) {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`,
    password: DEFAULT_TEST_PASSWORD,
    name: 'Test User',
    ...overrides,
  };
}

/**
 * Generate another unique test user (for multi-user scenarios)
 */
export function createOtherTestUser(overrides: Partial<{
  email: string;
  password: string;
  name: string;
}> = {}) {
  const timestamp = Date.now();
  return {
    email: `other-${timestamp}@example.com`,
    password: DEFAULT_TEST_PASSWORD,
    name: 'Other User',
    ...overrides,
  };
}

/**
 * Generate test group data
 */
export function createTestGroup(overrides: Partial<{
  name: string;
  description: string;
  currency: string;
}> = {}) {
  const timestamp = Date.now();
  return {
    name: `Test Group ${timestamp}`,
    description: 'A test group for integration testing',
    currency: 'USD',
    ...overrides,
  };
}

/**
 * Generate test expense data
 */
export function createTestExpense(overrides: Partial<{
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitBetween: string[];
  category: string;
  date: string;
}> = {}) {
  const timestamp = Date.now();
  return {
    description: `Test Expense ${timestamp}`,
    amount: 50.00,
    category: 'other',
    date: new Date().toISOString(),
    ...overrides,
    // These fields must be provided by caller
    groupId: overrides.groupId || '',
    paidBy: overrides.paidBy || '',
    splitBetween: overrides.splitBetween || [],
  };
}

/**
 * Common test categories for expenses
 */
export const TEST_CATEGORIES = {
  FOOD: 'food',
  TRANSPORT: 'transport', 
  ENTERTAINMENT: 'entertainment',
  UTILITIES: 'utilities',
  OTHER: 'other',
} as const;

/**
 * Common test amounts for expenses
 */
export const TEST_AMOUNTS = {
  SMALL: 10.50,
  MEDIUM: 50.00,
  LARGE: 120.00,
  VERY_LARGE: 500.00,
} as const;

/**
 * Invalid test data for validation testing
 */
export const INVALID_TEST_DATA = {
  EMPTY_EMAIL: '',
  INVALID_EMAIL: 'invalid-email',
  WEAK_PASSWORD: '123',
  EMPTY_NAME: '',
  EMPTY_DESCRIPTION: '',
  NEGATIVE_AMOUNT: -10,
  ZERO_AMOUNT: 0,
} as const;