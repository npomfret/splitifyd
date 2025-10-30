import { describe, expect, it } from 'vitest';
import { areDisplayNamesEquivalent, normalizeDisplayNameForComparison } from '../base58-normalization';

describe('normalizeDisplayNameForComparison', () => {
    it('should convert to lowercase', () => {
        expect(normalizeDisplayNameForComparison('Alice')).toBe('aiice');
        expect(normalizeDisplayNameForComparison('ALICE')).toBe('aiice');
        expect(normalizeDisplayNameForComparison('aLiCe')).toBe('aiice');
    });

    it('should replace 0 (zero) with o', () => {
        expect(normalizeDisplayNameForComparison('B0b')).toBe('bob');
        expect(normalizeDisplayNameForComparison('User0')).toBe('usero');
        expect(normalizeDisplayNameForComparison('Test000')).toBe('testooo');
    });

    it('should replace l (lowercase L) with i', () => {
        expect(normalizeDisplayNameForComparison('Alice')).toBe('aiice');
        expect(normalizeDisplayNameForComparison('leo')).toBe('ieo');
        expect(normalizeDisplayNameForComparison('Bill')).toBe('biii');
    });

    it('should handle combined replacements', () => {
        expect(normalizeDisplayNameForComparison('Al1ce')).toBe('ai1ce'); // l→i, 1 stays
        expect(normalizeDisplayNameForComparison('ALICE')).toBe('aiice'); // uppercase→lowercase, l→i
        expect(normalizeDisplayNameForComparison('B0b')).toBe('bob');     // 0→o
        expect(normalizeDisplayNameForComparison('BOB')).toBe('bob');     // uppercase→lowercase
    });

    it('should preserve spaces and other allowed characters', () => {
        expect(normalizeDisplayNameForComparison('John Doe')).toBe('john doe');
        expect(normalizeDisplayNameForComparison('Jane_Smith')).toBe('jane_smith');
        expect(normalizeDisplayNameForComparison('Bob-Jones')).toBe('bob-jones');
        expect(normalizeDisplayNameForComparison('Alice.Brown')).toBe('aiice.brown');
    });

    it('should handle edge cases', () => {
        expect(normalizeDisplayNameForComparison('')).toBe('');
        expect(normalizeDisplayNameForComparison('   ')).toBe('   '); // spaces preserved
        expect(normalizeDisplayNameForComparison('123')).toBe('123');
        expect(normalizeDisplayNameForComparison('000')).toBe('ooo');
        expect(normalizeDisplayNameForComparison('lll')).toBe('iii');
    });
});

describe('areDisplayNamesEquivalent', () => {
    it('should detect exact matches', () => {
        expect(areDisplayNamesEquivalent('Alice', 'Alice')).toBe(true);
        expect(areDisplayNamesEquivalent('Bob', 'Bob')).toBe(true);
    });

    it('should detect case-insensitive matches', () => {
        expect(areDisplayNamesEquivalent('Alice', 'ALICE')).toBe(true);
        expect(areDisplayNamesEquivalent('alice', 'Alice')).toBe(true);
        expect(areDisplayNamesEquivalent('BOB', 'bob')).toBe(true);
    });

    it('should detect confusable character matches with 0/O', () => {
        expect(areDisplayNamesEquivalent('Bob', 'B0b')).toBe(true);
        expect(areDisplayNamesEquivalent('B0b', 'BOB')).toBe(true);
        expect(areDisplayNamesEquivalent('User0', 'UserO')).toBe(true);
    });

    it('should detect confusable character matches with I/l', () => {
        expect(areDisplayNamesEquivalent('Alice', 'AIice')).toBe(true);
        expect(areDisplayNamesEquivalent('Alice', 'Alìce')).toBe(false); // different unicode char
        expect(areDisplayNamesEquivalent('Bill', 'BiII')).toBe(true);
        expect(areDisplayNamesEquivalent('leo', 'Leo')).toBe(true);
    });

    it('should handle whitespace in comparison', () => {
        expect(areDisplayNamesEquivalent('  Alice  ', 'Alice')).toBe(true);
        expect(areDisplayNamesEquivalent('Bob', '  Bob  ')).toBe(true);
        expect(areDisplayNamesEquivalent('  John Doe  ', 'John Doe')).toBe(true);
    });

    it('should detect different names', () => {
        expect(areDisplayNamesEquivalent('Alice', 'Bob')).toBe(false);
        expect(areDisplayNamesEquivalent('John', 'Jane')).toBe(false);
        expect(areDisplayNamesEquivalent('User1', 'User2')).toBe(false);
    });

    it('should handle complex confusable scenarios', () => {
        // All of these should be considered the same:
        expect(areDisplayNamesEquivalent('Alice', 'Alice')).toBe(true);
        expect(areDisplayNamesEquivalent('Alice', 'ALICE')).toBe(true);
        expect(areDisplayNamesEquivalent('Alice', 'AIice')).toBe(true);

        // All of these should be considered the same:
        expect(areDisplayNamesEquivalent('B0b', 'Bob')).toBe(true);
        expect(areDisplayNamesEquivalent('B0b', 'BOB')).toBe(true);
        expect(areDisplayNamesEquivalent('B0b', 'b0b')).toBe(true);
    });
});
