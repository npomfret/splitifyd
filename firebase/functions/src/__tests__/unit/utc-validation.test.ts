import { describe, it, expect } from '@jest/globals';
import { validateCreateExpense } from '../../expenses/validation';
import { createSettlementSchema } from '../../settlements/validation';
import { isUTCFormat, parseUTCOnly, validateUTCDate } from '../../utils/dateHelpers';

describe('UTC Date Validation', () => {
  describe('dateHelpers', () => {
    describe('isUTCFormat', () => {
      it('should accept valid UTC formats', () => {
        expect(isUTCFormat('2025-01-11T00:00:00.000Z')).toBe(true);
        expect(isUTCFormat('2025-01-11T00:00:00Z')).toBe(true);
        expect(isUTCFormat('2025-01-11T00:00:00+00:00')).toBe(true);
        expect(isUTCFormat('2025-01-11T00:00:00-00:00')).toBe(true);
      });

      it('should reject non-UTC formats', () => {
        expect(isUTCFormat('2025-01-11T00:00:00-05:00')).toBe(false);
        expect(isUTCFormat('2025-01-11T00:00:00+02:00')).toBe(false);
        expect(isUTCFormat('2025-01-11')).toBe(false);
        expect(isUTCFormat('2025-01-11 00:00:00')).toBe(false);
        expect(isUTCFormat('invalid-date')).toBe(false);
      });
    });

    describe('parseUTCOnly', () => {
      it('should parse valid UTC dates', () => {
        const date1 = parseUTCOnly('2025-01-11T00:00:00.000Z');
        expect(date1).toBeDefined();
        expect(date1).not.toBeNull();
        // Check it's a valid Firestore Timestamp
        if (date1) {
          const dateObj = date1.toDate();
          expect(dateObj).toBeInstanceOf(Date);
          expect(dateObj.toISOString()).toBe('2025-01-11T00:00:00.000Z');
        }

        const date2 = parseUTCOnly('2025-01-11T12:30:45Z');
        expect(date2).toBeDefined();
        expect(date2).not.toBeNull();
        if (date2) {
          const dateObj = date2.toDate();
          expect(dateObj).toBeInstanceOf(Date);
          expect(dateObj.toISOString()).toBe('2025-01-11T12:30:45.000Z');
        }
      });

      it('should throw for non-UTC dates', () => {
        expect(() => parseUTCOnly('2025-01-11T00:00:00-05:00')).toThrow('Date must be in UTC format');
        expect(() => parseUTCOnly('2025-01-11')).toThrow('Date must be in UTC format');
        expect(() => parseUTCOnly('invalid')).toThrow('Date must be in UTC format');
      });
    });

    describe('validateUTCDate', () => {
      it('should accept valid UTC dates', () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayUTC = today.toISOString();
        
        const result1 = validateUTCDate(todayUTC);
        expect(result1.valid).toBe(true);
        expect(result1.error).toBeUndefined();
        
        const result2 = validateUTCDate('2024-01-01T00:00:00.000Z');
        expect(result2.valid).toBe(true);
        expect(result2.error).toBeUndefined();
      });

      it('should reject future dates', () => {
        const future = new Date();
        future.setDate(future.getDate() + 2); // 2 days in future, beyond 24h buffer
        const futureUTC = future.toISOString();
        
        const result = validateUTCDate(futureUTC);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Date cannot be in the future');
      });

      it('should reject non-UTC dates', () => {
        const result1 = validateUTCDate('2025-01-11T00:00:00-05:00');
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain('Date must be in UTC format');
        
        const result2 = validateUTCDate('2025-01-11');
        expect(result2.valid).toBe(false);
        expect(result2.error).toContain('Date must be in UTC format');
      });

      it('should reject invalid dates', () => {
        const result1 = validateUTCDate('invalid-date');
        expect(result1.valid).toBe(false);
        expect(result1.error).toContain('Date must be in UTC format');
        
        const result2 = validateUTCDate('2025-13-01T00:00:00Z');
        expect(result2.valid).toBe(false);
        expect(result2.error).toContain('Invalid date');
      });
    });
  });

  describe('Expense Validation', () => {
    it('should accept expenses with UTC dates', () => {
      const validExpense = {
        groupId: 'group123',
        description: 'Test expense',
        amount: 50.00,
        paidBy: 'user123',
        category: 'food',
        currency: 'USD',
        date: '2024-01-01T00:00:00.000Z',
        splitType: 'equal',
        participants: ['user123', 'user456'],
        splits: [
          { userId: 'user123', amount: 25 },
          { userId: 'user456', amount: 25 }
        ]
      };

      expect(() => validateCreateExpense(validExpense)).not.toThrow();
    });

    it('should reject expenses with non-UTC dates', () => {
      const invalidExpense = {
        groupId: 'group123',
        description: 'Test expense',
        amount: 50.00,
        paidBy: 'user123',
        category: 'food',
        currency: 'USD',
        date: '2024-01-01T00:00:00-05:00', // Non-UTC timezone
        splitType: 'equal',
        participants: ['user123', 'user456'],
        splits: [
          { userId: 'user123', amount: 25 },
          { userId: 'user456', amount: 25 }
        ]
      };

      expect(() => validateCreateExpense(invalidExpense)).toThrow('Date must be in UTC format');
    });

    it('should reject expenses with future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 2); // 2 days in future, beyond 24h buffer
      
      const futureExpense = {
        groupId: 'group123',
        description: 'Test expense',
        amount: 50.00,
        paidBy: 'user123',
        category: 'food',
        currency: 'USD',
        date: future.toISOString(),
        splitType: 'equal',
        participants: ['user123', 'user456'],
        splits: [
          { userId: 'user123', amount: 25 },
          { userId: 'user456', amount: 25 }
        ]
      };

      expect(() => validateCreateExpense(futureExpense)).toThrow('Date cannot be in the future');
    });
  });

  describe('Settlement Validation', () => {
    it('should accept settlements with UTC dates', () => {
      const validSettlement = {
        groupId: 'group123',
        payerId: 'user123',
        payeeId: 'user456',
        amount: 100.00,
        currency: 'USD',
        date: '2024-01-01T00:00:00.000Z',
        note: 'Test settlement'
      };

      const result = createSettlementSchema.validate(validSettlement);
      expect(result.error).toBeUndefined();
    });

    it('should accept settlements without dates (server will use current time)', () => {
      const validSettlement = {
        groupId: 'group123',
        payerId: 'user123',
        payeeId: 'user456',
        amount: 100.00,
        currency: 'USD'
      };

      const result = createSettlementSchema.validate(validSettlement);
      expect(result.error).toBeUndefined();
    });

    it('should reject settlements with non-UTC dates', () => {
      const invalidSettlement = {
        groupId: 'group123',
        payerId: 'user123',
        payeeId: 'user456',
        amount: 100.00,
        currency: 'USD',
        date: '2024-01-01T00:00:00-05:00', // Non-UTC timezone
        note: 'Test settlement'
      };

      const result = createSettlementSchema.validate(invalidSettlement);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Date must be in UTC format');
    });

    it('should reject settlements with future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 2); // 2 days in future, beyond 24h buffer
      
      const futureSettlement = {
        groupId: 'group123',
        payerId: 'user123',
        payeeId: 'user456',
        amount: 100.00,
        currency: 'USD',
        date: future.toISOString(),
        note: 'Test settlement'
      };

      const result = createSettlementSchema.validate(futureSettlement);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Date cannot be in the future');
    });
  });
});