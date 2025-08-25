import { validateCreateComment, validateListCommentsQuery, validateTargetId, validateCommentId } from '../../comments/validation';
import { ApiError } from '../../utils/errors';
import { CommentTargetTypes } from '../../shared/shared-types';

describe('Comments Validation', () => {
    describe('validateCreateComment', () => {
        it('should validate valid group comment request', () => {
            const validRequest = {
                text: 'This is a test comment',
                targetType: CommentTargetTypes.GROUP,
                targetId: 'group123',
            };

            const result = validateCreateComment(validRequest);

            expect(result.text).toBe('This is a test comment');
            expect(result.targetType).toBe(CommentTargetTypes.GROUP);
            expect(result.targetId).toBe('group123');
            expect(result.groupId).toBeUndefined();
        });

        it('should validate valid expense comment request', () => {
            const validRequest = {
                text: 'This is an expense comment',
                targetType: CommentTargetTypes.EXPENSE,
                targetId: 'expense123',
                groupId: 'group456',
            };

            const result = validateCreateComment(validRequest);

            expect(result.text).toBe('This is an expense comment');
            expect(result.targetType).toBe(CommentTargetTypes.EXPENSE);
            expect(result.targetId).toBe('expense123');
            expect(result.groupId).toBe('group456');
        });

        it('should trim and sanitize comment text', () => {
            const request = {
                text: '  Test comment with spaces  ',
                targetType: CommentTargetTypes.GROUP,
                targetId: 'group123',
            };

            const result = validateCreateComment(request);

            expect(result.text).toBe('Test comment with spaces');
        });

        it('should throw error for empty comment text', () => {
            const request = {
                text: '',
                targetType: CommentTargetTypes.GROUP,
                targetId: 'group123',
            };

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Comment text is required');
        });

        it('should throw error for comment text that is too long', () => {
            const request = {
                text: 'a'.repeat(501), // 501 characters, exceeds 500 limit
                targetType: CommentTargetTypes.GROUP,
                targetId: 'group123',
            };

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Comment cannot exceed 500 characters');
        });

        it('should throw error for missing text', () => {
            const request = {
                targetType: CommentTargetTypes.GROUP,
                targetId: 'group123',
            };

            expect(() => validateCreateComment(request)).toThrow(ApiError);
        });

        it('should throw error for invalid target type', () => {
            const request = {
                text: 'Test comment',
                targetType: 'invalid',
                targetId: 'group123',
            };

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Target type must be either "group" or "expense"');
        });

        it('should throw error for missing target ID', () => {
            const request = {
                text: 'Test comment',
                targetType: CommentTargetTypes.GROUP,
            };

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Target ID is required');
        });

        it('should throw error for empty target ID', () => {
            const request = {
                text: 'Test comment',
                targetType: CommentTargetTypes.GROUP,
                targetId: '',
            };

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Target ID is required');
        });

        it('should require group ID for expense comments', () => {
            const request = {
                text: 'Test expense comment',
                targetType: CommentTargetTypes.EXPENSE,
                targetId: 'expense123',
            };

            expect(() => validateCreateComment(request)).toThrow(ApiError);
            expect(() => validateCreateComment(request)).toThrow('Group ID is required for expense comments');
        });

        it('should not require group ID for group comments', () => {
            const request = {
                text: 'Test group comment',
                targetType: CommentTargetTypes.GROUP,
                targetId: 'group123',
                groupId: 'group456', // Optional for group comments
            };

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
            const query = {};

            const result = validateListCommentsQuery(query);

            expect(result.limit).toBe(20); // Default limit
            expect(result.cursor).toBeUndefined();
        });

        it('should validate query with cursor and custom limit', () => {
            const query = {
                cursor: 'comment123',
                limit: '10',
            };

            const result = validateListCommentsQuery(query);

            expect(result.cursor).toBe('comment123');
            expect(result.limit).toBe(10);
        });

        it('should enforce maximum limit', () => {
            const query = {
                limit: '150', // Exceeds max of 100
            };

            expect(() => validateListCommentsQuery(query)).toThrow(ApiError);
        });

        it('should enforce minimum limit', () => {
            const query = {
                limit: '0', // Below min of 1
            };

            expect(() => validateListCommentsQuery(query)).toThrow(ApiError);
        });

        it('should throw error for invalid limit format', () => {
            const query = {
                limit: 'not-a-number',
            };

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
            const request = {
                text: '<script>alert("xss")</script>Test comment',
                targetType: CommentTargetTypes.GROUP,
                targetId: '<script>group123</script>',
            };

            const result = validateCreateComment(request);

            // The exact sanitization depends on the sanitizeString implementation
            // but should remove script tags and harmful content
            expect(result.text).not.toContain('<script>');
            expect(result.targetId).not.toContain('<script>');
        });
    });
});