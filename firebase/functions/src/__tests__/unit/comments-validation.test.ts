import { validateCreateComment, validateListCommentsQuery, validateTargetId, validateCommentId } from '../../comments/validation';
import { ApiError } from '../../utils/errors';
import { CommentTargetTypes } from '@splitifyd/shared';
import { CommentRequestBuilder, CommentQueryBuilder } from '@splitifyd/test-support';



describe('Comments Validation', () => {
    describe('validateCreateComment', () => {
        it('should validate valid group comment request', () => {
            const request = new CommentRequestBuilder().withText('This is a test comment').withGroupTarget('group123').build();

            const result = validateCreateComment(request);

            expect(result.text).toBe('This is a test comment');
            expect(result.targetType).toBe(CommentTargetTypes.GROUP);
            expect(result.targetId).toBe('group123');
            expect(result.groupId).toBeUndefined();
        });

        it('should validate valid expense comment request', () => {
            const request = new CommentRequestBuilder().withText('This is an expense comment').withExpenseTarget('expense123', 'group456').build();

            const result = validateCreateComment(request);

            expect(result.text).toBe('This is an expense comment');
            expect(result.targetType).toBe(CommentTargetTypes.EXPENSE);
            expect(result.targetId).toBe('expense123');
            expect(result.groupId).toBe('group456');
        });

        it('should trim and sanitize comment text', () => {
            const request = new CommentRequestBuilder().withWhitespaceText('Test comment with spaces').withGroupTarget('group123').build();

            const result = validateCreateComment(request);

            expect(result.text).toBe('Test comment with spaces');
        });

        it('should throw error for empty comment text', () => {
            const request = new CommentRequestBuilder().withEmptyField('text').withGroupTarget('group123').build();

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Comment text is required');
        });

        it('should throw error for comment text that is too long', () => {
            const request = new CommentRequestBuilder().withLongText(501).withGroupTarget('group123').build();

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Comment cannot exceed 500 characters');
        });

        it('should throw error for missing text', () => {
            const request = new CommentRequestBuilder().withGroupTarget('group123').withMissingField('text').build();

            expect(() => validateCreateComment(request)).toThrow(ApiError);
        });

        it('should throw error for invalid target type', () => {
            const request = new CommentRequestBuilder().withText('Test comment').withTargetType('invalid').withTargetId('group123').build();

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Target type must be either "group" or "expense"');
        });

        it('should throw error for missing target ID', () => {
            const request = new CommentRequestBuilder().withText('Test comment').withTargetType(CommentTargetTypes.GROUP).withMissingField('targetId').build();

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Target ID is required');
        });

        it('should throw error for empty target ID', () => {
            const request = new CommentRequestBuilder().withText('Test comment').withTargetType(CommentTargetTypes.GROUP).withEmptyField('targetId').build();

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Target ID is required');
        });

        it('should not require group ID for expense comments (resolved internally)', () => {
            const request = new CommentRequestBuilder().withText('Test expense comment').withTargetType(CommentTargetTypes.EXPENSE).withTargetId('expense123').withMissingField('groupId').build();

            const result = validateCreateComment(request);

            expect(result.text).toBe('Test expense comment');
            expect(result.targetType).toBe(CommentTargetTypes.EXPENSE);
            expect(result.targetId).toBe('expense123');
            expect(result.groupId).toBeUndefined();
        });

        it('should not require group ID for group comments', () => {
            const request = new CommentRequestBuilder()
                .withText('Test group comment')
                .withGroupTarget('group123')
                .withGroupId('group456') // Optional for group comments
                .build();

            const result = validateCreateComment(request);

            expect(result.groupId).toBe('group456');
        });

        it('should sanitize all string fields', () => {
            const request = {
                text: '  Test comment  ',
                targetType: CommentTargetTypes.EXPENSE,
                targetId: '  expense123  ',
                groupId: '  group456  ',
            };

            const result = validateCreateComment(request);

            expect(result.text).toBe('Test comment');
            expect(result.targetId).toBe('expense123');
            expect(result.groupId).toBe('group456');
        });
    });

    describe('validateListCommentsQuery', () => {
        it('should validate valid query with default limit', () => {
            const query = new CommentQueryBuilder().withEmptyQuery().build();

            const result = validateListCommentsQuery(query);

            expect(result.limit).toBe(20); // Default limit
            expect(result.cursor).toBeUndefined();
        });

        it('should validate query with cursor and custom limit', () => {
            const query = new CommentQueryBuilder().withCursor('comment123').withLimit('10').build();

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
            const query = new CommentQueryBuilder().withInvalidLimit('not-a-number').build();

            expect(() => validateListCommentsQuery(query)).toThrow(ApiError);
        });
    });

    describe('validateTargetId', () => {
        it('should validate valid target ID', () => {
            const result = validateTargetId('target123', CommentTargetTypes.GROUP);

            expect(result).toBe('target123');
        });

        it('should trim target ID', () => {
            const result = validateTargetId('  target123  ', CommentTargetTypes.GROUP);

            expect(result).toBe('target123');
        });

        it('should throw error for null target ID', () => {
            expect(() => validateTargetId(null, CommentTargetTypes.GROUP)).toThrow(ApiError);
            expect(() => validateTargetId(null, CommentTargetTypes.GROUP)).toThrow('Invalid group ID');
        });

        it('should throw error for empty target ID', () => {
            expect(() => validateTargetId('', CommentTargetTypes.EXPENSE)).toThrow(ApiError);
            expect(() => validateTargetId('', CommentTargetTypes.EXPENSE)).toThrow('Invalid expense ID');
        });

        it('should throw error for non-string target ID', () => {
            expect(() => validateTargetId(123, CommentTargetTypes.GROUP)).toThrow(ApiError);
        });

        it('should show appropriate error message based on target type', () => {
            expect(() => validateTargetId('', CommentTargetTypes.GROUP)).toThrow('Invalid group ID');
            expect(() => validateTargetId('', CommentTargetTypes.EXPENSE)).toThrow('Invalid expense ID');
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
            const request = new CommentRequestBuilder().withXSSText().withTargetType(CommentTargetTypes.GROUP).withXSSTargetId().build();

            const result = validateCreateComment(request);

            // The exact sanitization depends on the sanitizeString implementation
            // but should remove script tags and harmful content
            expect(result.text).not.toContain('<script>');
            expect(result.targetId).not.toContain('<script>');
        });

        it('should handle complex XSS attempts', () => {
            const maliciousTexts = ['<script>alert("xss")</script>Normal text', '<img src=x onerror=alert(1)>', 'data:text/html,<script>alert(1)</script>'];

            maliciousTexts.forEach((maliciousText) => {
                const request = new CommentRequestBuilder().withText(maliciousText).withGroupTarget('safe-group-id').build();

                const result = validateCreateComment(request);

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
                const request = new CommentRequestBuilder().withText(caseText).withGroupTarget('safe-group-id').build();

                const result = validateCreateComment(request);

                // Just verify the validation doesn't crash and returns some result
                expect(result.text).toBeDefined();
                expect(typeof result.text).toBe('string');
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle Unicode characters properly', () => {
            const unicodeText = '👋 Hello 世界 🌟 Émoji tëst';
            const request = new CommentRequestBuilder().withText(unicodeText).withGroupTarget('group123').build();

            const result = validateCreateComment(request);

            expect(result.text).toBe(unicodeText);
        });

        it('should handle maximum allowed text length exactly', () => {
            const maxText = 'x'.repeat(500);
            const request = new CommentRequestBuilder().withText(maxText).withGroupTarget('group123').build();

            const result = validateCreateComment(request);

            expect(result.text).toBe(maxText);
            expect(result.text.length).toBe(500);
        });

        it('should handle whitespace-only text as empty', () => {
            const whitespaceOnlyTexts = ['   ', '\t\t', '\n\n', ' \t \n '];

            whitespaceOnlyTexts.forEach((whitespaceText) => {
                const request = new CommentRequestBuilder().withText(whitespaceText).withGroupTarget('group123').build();

                expect(() => validateCreateComment(request)).toThrow('Comment text is required');
            });
        });
    });
});
