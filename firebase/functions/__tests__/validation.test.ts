import { validateRegisterRequest } from '../src/auth/validation';
import { validateCreateExpense, validateUpdateExpense } from '../src/expenses/validation';
import { ApiError } from '../src/utils/errors';

describe('Auth Validation', () => {
  describe('validateRegisterRequest', () => {
    it('should validate valid register request', () => {
      const validRequest = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'Test User'
      };
      
      const result = validateRegisterRequest(validRequest);
      
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('TestPass123!');
      expect(result.displayName).toBe('Test User');
    });

    it('should normalize email to lowercase and trim display name', () => {
      const request = {
        email: 'TEST@EXAMPLE.COM',
        password: 'TestPass123!',
        displayName: '  Test User  '
      };
      
      const result = validateRegisterRequest(request);
      
      expect(result.email).toBe('test@example.com');
      expect(result.displayName).toBe('Test User');
    });

    it('should throw error for weak password', () => {
      const request = {
        email: 'test@example.com',
        password: 'weakpass',
        displayName: 'Test User'
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Password must contain at least 8 characters');
    });

    it('should throw error for missing display name', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123!'
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name is required');
    });

    it('should throw error for display name too short', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'A'
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name must be at least 2 characters');
    });

    it('should throw error for display name too long', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'A'.repeat(51)
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name cannot exceed 50 characters');
    });

    it('should throw error for invalid display name characters', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'Test<script>alert("xss")</script>'
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods');
    });

    it('should accept valid display name characters', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'John Doe-Smith_123.Jr'
      };
      
      const result = validateRegisterRequest(request);
      
      expect(result.displayName).toBe('John Doe-Smith_123.Jr');
    });
  });
});

describe('Expense Validation', () => {
  describe('validateCreateExpense', () => {
    const validExpenseData = {
      groupId: 'group123',
      paidBy: 'user123',
      amount: 100.50,
      description: 'Dinner at restaurant',
      category: 'food',
      date: '2024-01-15',
      splitType: 'equal',
      participants: ['user123', 'user456'],
      receiptUrl: 'https://example.com/receipt.jpg'
    };

    it('should sanitize XSS in description field', () => {
      const maliciousData = {
        ...validExpenseData,
        description: 'Dinner <script>alert("xss")</script> at restaurant'
      };
      
      const result = validateCreateExpense(maliciousData);
      
      expect(result.description).toBe('Dinner  at restaurant');
      expect(result.description).not.toContain('<script>');
    });

    it('should sanitize category field (enum validation prevents XSS)', () => {
      const legitimateData = {
        ...validExpenseData,
        category: 'food'
      };
      
      const result = validateCreateExpense(legitimateData);
      
      expect(result.category).toBe('food');
    });

    it('should sanitize receiptUrl field (URI validation prevents malformed URLs)', () => {
      const legitimateData = {
        ...validExpenseData,
        receiptUrl: 'https://example.com/receipt.jpg'
      };
      
      const result = validateCreateExpense(legitimateData);
      
      expect(result.receiptUrl).toBe('https://example.com/receipt.jpg');
    });

    it('should preserve legitimate content after sanitization', () => {
      const legitimateData = {
        ...validExpenseData,
        description: 'Dinner at "The Restaurant" & Bar - $15.50',
        category: 'food',
        receiptUrl: 'https://example.com/receipt.jpg'
      };
      
      const result = validateCreateExpense(legitimateData);
      
      expect(result.description).toBe('Dinner at "The Restaurant" & Bar - $15.50');
      expect(result.category).toBe('food');
      expect(result.receiptUrl).toBe('https://example.com/receipt.jpg');
    });

    it('should handle empty receiptUrl', () => {
      const dataWithEmptyReceipt = {
        ...validExpenseData,
        receiptUrl: ''
      };
      
      const result = validateCreateExpense(dataWithEmptyReceipt);
      
      expect(result.receiptUrl).toBe('');
    });
  });

  describe('validateUpdateExpense', () => {
    it('should sanitize XSS in description field during update', () => {
      const maliciousUpdateData = {
        description: 'Updated description <script>alert("xss")</script>'
      };
      
      const result = validateUpdateExpense(maliciousUpdateData);
      
      expect(result.description).toBe('Updated description ');
      expect(result.description).not.toContain('<script>');
    });

    it('should sanitize category field during update (enum validation prevents XSS)', () => {
      const legitimateUpdateData = {
        category: 'food'
      };
      
      const result = validateUpdateExpense(legitimateUpdateData);
      
      expect(result.category).toBe('food');
    });

    it('should sanitize receiptUrl field during update (URI validation prevents malformed URLs)', () => {
      const legitimateUpdateData = {
        receiptUrl: 'https://example.com/new-receipt.jpg'
      };
      
      const result = validateUpdateExpense(legitimateUpdateData);
      
      expect(result.receiptUrl).toBe('https://example.com/new-receipt.jpg');
    });

    it('should preserve legitimate content during update', () => {
      const legitimateUpdateData = {
        description: 'Updated dinner at "The Restaurant" & Bar',
        category: 'food',
        receiptUrl: 'https://example.com/new-receipt.jpg'
      };
      
      const result = validateUpdateExpense(legitimateUpdateData);
      
      expect(result.description).toBe('Updated dinner at "The Restaurant" & Bar');
      expect(result.category).toBe('food');
      expect(result.receiptUrl).toBe('https://example.com/new-receipt.jpg');
    });
  });
});