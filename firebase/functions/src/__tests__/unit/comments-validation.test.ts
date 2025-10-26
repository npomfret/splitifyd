import { describe, expect, it } from 'vitest';
import { CommentQueryBuilder } from '@splitifyd/test-support';
import { validateCommentId, validateCreateExpenseComment, validateCreateGroupComment, validateListCommentsQuery } from '../../comments/validation';
import { ApiError } from '../../utils/errors';

describe('Comments Validation', () => {
    describe('validateCreateGroupComment', () => {
        it('should validate a valid group comment request', () => {
            const result = validateCreateGroupComment('group123', { text: 'This is a test comment' });

            expect(result.text).toBe('This is a test comment');
            expect(result.groupId).toBe('group123');
        });

        it('should trim and sanitize comment text and target id', () => {
            const result = validateCreateGroupComment('  group123  ', { text: '  <b>Comment</b>  ' });

            expect(result.text).toBe('Comment');
            expect(result.groupId).toBe('group123');
        });

        it('should throw error for empty comment text', () => {
            expect(() => validateCreateGroupComment('group123', { text: '' })).toThrow(ApiError);
            expect(() => validateCreateGroupComment('group123', { text: '' })).toThrow('Comment text is required');
        });

        it('should throw error for comment text that is too long', () => {
            const longText = 'a'.repeat(501);
            expect(() => validateCreateGroupComment('group123', { text: longText })).toThrow(ApiError);
            expect(() => validateCreateGroupComment('group123', { text: longText })).toThrow('Comment cannot exceed 500 characters');
        });

        it('should throw error for missing text', () => {
            expect(() => validateCreateGroupComment('group123', {})).toThrow(ApiError);
        });

        it('should throw error for invalid target id', () => {
            expect(() => validateCreateGroupComment('', { text: 'Valid comment' })).toThrow(ApiError);
            expect(() => validateCreateGroupComment('', { text: 'Valid comment' })).toThrow('group ID is required');
        });
    });

    describe('validateCreateExpenseComment', () => {
        it('should validate a valid expense comment request', () => {
            const result = validateCreateExpenseComment('expense123', { text: 'Expense comment' });

            expect(result.text).toBe('Expense comment');
            expect(result.expenseId).toBe('expense123');
        });

        it('should trim and sanitize comment text and target id', () => {
            const result = validateCreateExpenseComment('  expense123  ', { text: '  <script>alert(1)</script>hi  ' });

            expect(result.text).toBe('hi');
            expect(result.expenseId).toBe('expense123');
        });

        it('should throw error for empty comment text', () => {
            expect(() => validateCreateExpenseComment('expense123', { text: '' })).toThrow(ApiError);
            expect(() => validateCreateExpenseComment('expense123', { text: '' })).toThrow('Comment text is required');
        });

        it('should throw error for comment text that is too long', () => {
            const longText = 'a'.repeat(501);
            expect(() => validateCreateExpenseComment('expense123', { text: longText })).toThrow(ApiError);
            expect(() => validateCreateExpenseComment('expense123', { text: longText })).toThrow('Comment cannot exceed 500 characters');
        });

        it('should throw error for missing text', () => {
            expect(() => validateCreateExpenseComment('expense123', {})).toThrow(ApiError);
        });

        it('should throw error for invalid target id', () => {
            expect(() => validateCreateExpenseComment('', { text: 'Valid comment' })).toThrow(ApiError);
            expect(() => validateCreateExpenseComment('', { text: 'Valid comment' })).toThrow('Invalid expense ID');
        });
    });

    describe('validateListCommentsQuery', () => {
        it('should validate valid query with default limit', () => {
            const query = new CommentQueryBuilder()
                .withEmptyQuery()
                .build();

            const result = validateListCommentsQuery(query);

            expect(result.limit).toBe(8); // Default limit
            expect(result.cursor).toBeUndefined();
        });

        it('should validate query with cursor and custom limit', () => {
            const query = new CommentQueryBuilder()
                .withCursor('comment123')
                .withLimit('10')
                .build();

            const result = validateListCommentsQuery(query);

            expect(result.cursor).toBe('comment123');
            expect(result.limit).toBe(10);
        });

        it('should enforce maximum limit', () => {
            const query = new CommentQueryBuilder()
                .withLimit('150') // Exceeds max of 100
                .build();

            expect(() => validateListCommentsQuery(query)).toThrow(ApiError);
        });

        it('should enforce minimum limit', () => {
            const query = new CommentQueryBuilder()
                .withLimit('0') // Below min of 1
                .build();

            expect(() => validateListCommentsQuery(query)).toThrow(ApiError);
        });

        it('should throw error for invalid limit format', () => {
            const query = new CommentQueryBuilder()
                .withInvalidLimit('not-a-number')
                .build();

            expect(() => validateListCommentsQuery(query)).toThrow(ApiError);
        });
    });

    describe('validateCommentId', () => {
        it('should validate valid comment ID', () => {
            const result = validateCommentId('comment123');

            expect(result).toBe('comment123');
        });

        it('should trim comment ID', () => {
            const result = validateCommentId('  comment123  ');

            expect(result).toBe('comment123');
        });

        it('should throw error for null comment ID', () => {
            expect(() => validateCommentId(null)).toThrow(ApiError);
            expect(() => validateCommentId(null)).toThrow('Invalid comment ID');
        });

        it('should throw error for empty comment ID', () => {
            expect(() => validateCommentId('')).toThrow(ApiError);
            expect(() => validateCommentId('')).toThrow('Invalid comment ID');
        });

        it('should throw error for non-string comment ID', () => {
            expect(() => validateCommentId(123)).toThrow(ApiError);
            expect(() => validateCommentId(123)).toThrow('Invalid comment ID');
        });
    });

    describe('XSS Protection', () => {
        it('should sanitize potentially harmful input', () => {
            const result = validateCreateGroupComment('safe-group-id', { text: '<script>alert("xss")</script>Safe text' });

            // The exact sanitization depends on the sanitizeString implementation
            // but should remove script tags and harmful content
            expect(result.text).not.toContain('<script>');
            expect(result.groupId).not.toContain('<script>');
        });

        it('should handle complex XSS attempts', () => {
            const maliciousTexts = ['<script>alert("xss")</script>Normal text', '<img src=x onerror=alert(1)>', 'data:text/html,<script>alert(1)</script>'];

            maliciousTexts.forEach((maliciousText) => {
                const result = validateCreateGroupComment('safe-group-id', { text: maliciousText });

                // Should sanitize script tags and harmful content
                // The exact sanitization depends on sanitizeString implementation
                expect(result.text).not.toContain('<script>');
                expect(result.text).not.toContain('onerror=');
            });

            // Test other potentially problematic inputs that should be trimmed/handled
            const borderlineCases = [
                'javascript:alert("xss")', // This might be allowed as plain text
                'onload="alert(1)"', // This might be allowed as plain text
            ];

            borderlineCases.forEach((caseText) => {
                const result = validateCreateGroupComment('safe-group-id', { text: caseText });

                // Just verify the validation doesn't crash and returns some result
                expect(result.text).toBeDefined();
                expect(typeof result.text).toBe('string');
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle Unicode characters properly', () => {
            const unicodeText = '👋 Hello 世界 🌟 Émoji tëst';
            const result = validateCreateGroupComment('group123', { text: unicodeText });

            expect(result.text).toBe(unicodeText);
        });

        it('should handle maximum allowed text length exactly', () => {
            const maxText = 'x'.repeat(500);
            const result = validateCreateGroupComment('group123', { text: maxText });

            expect(result.text).toBe(maxText);
            expect(result.text.length).toBe(500);
        });

        it('should handle whitespace-only text as empty', () => {
            const whitespaceOnlyTexts = ['   ', '\t\t', '\n\n', ' \t \n '];

            whitespaceOnlyTexts.forEach((whitespaceText) => {
                expect(() => validateCreateGroupComment('group123', { text: whitespaceText })).toThrow('Comment text is required');
            });
        });
    });
});
