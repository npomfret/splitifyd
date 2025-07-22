// Common mocks for testing

// Mock for preact-router
export const mockRouter = {
  navigate: () => {},
  getCurrentUrl: () => '/',
};

// Mock for user data
export const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  emailVerified: true,
};

// Mock for group data
export const mockGroup = {
  id: 'group-123',
  name: 'Test Group',
  description: 'A test group',
  members: [mockUser.uid],
  createdBy: mockUser.uid,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

// Mock for expense data  
export const mockExpense = {
  id: 'expense-123',
  groupId: mockGroup.id,
  description: 'Test Expense',
  amount: 100.00,
  paidBy: mockUser.uid,
  splitBetween: [mockUser.uid],
  category: 'food',
  date: new Date('2025-01-01T00:00:00Z'),
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

// Common test constants
export const TEST_CONSTANTS = {
  VALID_EMAIL: 'test@example.com',
  INVALID_EMAIL: 'invalid-email',
  VALID_PASSWORD: 'password123',
  SHORT_PASSWORD: '123',
  LONG_TEXT: 'a'.repeat(1000),
} as const;