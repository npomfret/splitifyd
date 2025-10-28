import { CreateExpenseCommentRequest, CreateGroupCommentRequest } from '@splitifyd/shared';
import { describe, expect, it } from 'vitest';
import { validateCommentId, validateCreateExpenseComment, validateCreateGroupComment, validateListCommentsQuery } from '../../../comments/validation';
import { HTTP_STATUS } from '../../../constants';
import { ApiError } from '../../../utils/errors';

describe('comments/validation', () => {
    describe('validateCreateGroupComment', () => {
        it('returns sanitized payload for valid input', () => {
            const requestBody = { text: '   <script>alert("xss")</script>Hello Team   ' };

            const result = validateCreateGroupComment('group-123', requestBody) as CreateGroupCommentRequest;

            expect(result.groupId).toBe('group-123');
            expect(result.text).not.toContain('<');
            expect(result.text).toContain('Hello Team');
            expect(result.text).toBe(result.text.trim());
        });

        it('throws ApiError for blank text', () => {
            expect(() => validateCreateGroupComment('group-123', { text: '  ' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_COMMENT_TEXT',
                }),
            );
        });
    });

    describe('validateCreateExpenseComment', () => {
        it('returns sanitized payload for valid input', () => {
            const requestBody = { text: '<b>Expense</b> update' };

            const result = validateCreateExpenseComment('expense-123', requestBody) as CreateExpenseCommentRequest;

            expect(result.expenseId).toBe('expense-123');
            expect(result.text).toContain('Expense');
            expect(result.text).not.toContain('<');
        });

        it('throws ApiError for missing text field', () => {
            expect(() => validateCreateExpenseComment('expense-123', {})).toThrowError(ApiError);
        });
    });

    describe('validateListCommentsQuery', () => {
        it('coerces and defaults limit while ignoring unknown params', () => {
            const result = validateListCommentsQuery({ limit: '12', cursor: 'abc', other: 'ignored' });

            expect(result).toEqual({ limit: 12, cursor: 'abc' });
        });

        it('provides default limit when none supplied', () => {
            const result = validateListCommentsQuery({});
            expect(result.limit).toBe(8);
            expect(result.cursor).toBeUndefined();
        });

        it('throws ApiError for invalid limit', () => {
            expect(() => validateListCommentsQuery({ limit: 0 })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });
    });

    describe('validateCommentId', () => {
        it('returns trimmed comment id', () => {
            const commentId = validateCommentId('  comment-123  ');
            expect(commentId).toBe('comment-123');
        });

        it('throws ApiError for invalid id', () => {
            expect(() => validateCommentId('')).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_COMMENT_ID',
                }),
            );
        });
    });
});
