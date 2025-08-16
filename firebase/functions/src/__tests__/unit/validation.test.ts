import { validateRegisterRequest } from '../../auth/validation';
import { validateCreateExpense, validateUpdateExpense } from '../../expenses/validation';
import { ApiError } from '../../utils/errors';

describe('Auth Validation', () => {
  describe('validateRegisterRequest', () => {
    it('should validate valid register request', () => {
      const validRequest = {
        email: 'test@example.com',
        password: 'TestPass123\!',
        displayName: 'Test User',
        termsAccepted: true,
        cookiePolicyAccepted: true
      };
      
      const result = validateRegisterRequest(validRequest);
      
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('TestPass123\!');
      expect(result.displayName).toBe('Test User');
      expect(result.termsAccepted).toBe(true);
      expect(result.cookiePolicyAccepted).toBe(true);
    });

    it('should normalize email to lowercase and trim display name', () => {
      const request = {
        email: 'TEST@EXAMPLE.COM',
        password: 'TestPass123\!',
        displayName: '  Test User  ',
        termsAccepted: true,
        cookiePolicyAccepted: true
      };
      
      const result = validateRegisterRequest(request);
      
      expect(result.email).toBe('test@example.com');
      expect(result.displayName).toBe('Test User');
    });

    it('should throw error for weak password', () => {
      const request = {
        email: 'test@example.com',
        password: 'weakpass',
        displayName: 'Test User',
        termsAccepted: true,
        cookiePolicyAccepted: true
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Password must contain at least 8 characters');
    });

    it('should throw error for missing display name', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123\!',
        termsAccepted: true,
        cookiePolicyAccepted: true
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name is required');
    });

    it('should throw error for display name too short', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123\!',
        displayName: 'A',
        termsAccepted: true,
        cookiePolicyAccepted: true
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name must be at least 2 characters');
    });

    it('should throw error for display name too long', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123\!',
        displayName: 'A'.repeat(51),
        termsAccepted: true,
        cookiePolicyAccepted: true
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name cannot exceed 50 characters');
    });

    it('should throw error for invalid display name characters', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123\!',
        displayName: 'Test<script>alert("xss")</script>',
        termsAccepted: true,
        cookiePolicyAccepted: true
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods');
    });

    it('should accept valid display name characters', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123\!',
        displayName: 'John Doe-Smith_123.Jr',
        termsAccepted: true,
        cookiePolicyAccepted: true
      };
      
      const result = validateRegisterRequest(request);
      
      expect(result.displayName).toBe('John Doe-Smith_123.Jr');
    });

    it('should throw error for missing terms acceptance', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123\!',
        displayName: 'Test User',
        cookiePolicyAccepted: true
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Terms acceptance is required');
    });

    it('should throw error for missing cookie policy acceptance', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123\!',
        displayName: 'Test User',
        termsAccepted: true
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Cookie policy acceptance is required');
    });

    it('should throw error for false terms acceptance', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123\!',
        displayName: 'Test User',
        termsAccepted: false,
        cookiePolicyAccepted: true
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('You must accept the Terms of Service');
    });

    it('should throw error for false cookie policy acceptance', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123\!',
        displayName: 'Test User',
        termsAccepted: true,
        cookiePolicyAccepted: false
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('You must accept the Cookie Policy');
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
      currency: 'USD',
      date: '2024-01-15T00:00:00.000Z',  // UTC format required
      splitType: 'equal',
      participants: ['user123', 'user456'],
      receiptUrl: 'https://example.com/receipt.jpg'
    };

    it('should validate expense with all fields', () => {
      const result = validateCreateExpense(validExpenseData);
      
      expect(result.description).toBe('Dinner at restaurant');
      expect(result.category).toBe('food');
      expect(result.receiptUrl).toBe('https://example.com/receipt.jpg');
      expect(result.amount).toBe(100.50);
      expect(result.splitType).toBe('equal');
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
    it('should validate partial update data', () => {
      const updateData = {
        description: 'Updated dinner',
        category: 'food',
        receiptUrl: 'https://example.com/new-receipt.jpg'
      };
      
      const result = validateUpdateExpense(updateData);
      
      expect(result.description).toBe('Updated dinner');
      expect(result.category).toBe('food');
      expect(result.receiptUrl).toBe('https://example.com/new-receipt.jpg');
    });
  });
});
