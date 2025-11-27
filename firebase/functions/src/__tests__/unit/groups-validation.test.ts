import { describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../constants';
import { validateGroupFullDetailsQuery, validateGroupIdParam, validateListGroupsQuery } from '../../groups/validation';

describe('groups/validation', () => {
    describe('validateListGroupsQuery', () => {
        it('returns validated params with defaults', () => {
            const result = validateListGroupsQuery({});

            expect(result.limit).toBe(100);
            expect(result.cursor).toBeUndefined();
            expect(result.order).toBe('desc');
            expect(result.statusFilter).toBeUndefined();
        });

        it('coerces string limit to number', () => {
            const result = validateListGroupsQuery({ limit: '50' });

            expect(result.limit).toBe(50);
        });

        it('parses single statusFilter value', () => {
            const result = validateListGroupsQuery({ statusFilter: 'active' });

            expect(result.statusFilter).toBe('active');
        });

        it('parses multiple statusFilter values into array', () => {
            const result = validateListGroupsQuery({ statusFilter: 'active,pending' });

            expect(result.statusFilter).toEqual(['active', 'pending']);
        });

        it('filters out invalid statusFilter values', () => {
            const result = validateListGroupsQuery({ statusFilter: 'active,invalid,pending' });

            expect(result.statusFilter).toEqual(['active', 'pending']);
        });

        it('returns undefined statusFilter when all values are invalid', () => {
            const result = validateListGroupsQuery({ statusFilter: 'invalid,unknown' });

            expect(result.statusFilter).toBeUndefined();
        });

        it('accepts order parameter', () => {
            const result = validateListGroupsQuery({ order: 'asc' });

            expect(result.order).toBe('asc');
        });

        it('throws ApiError for invalid limit', () => {
            expect(() => validateListGroupsQuery({ limit: 'abc' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for limit exceeding max', () => {
            expect(() => validateListGroupsQuery({ limit: '200' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('handles null/undefined input gracefully', () => {
            const result = validateListGroupsQuery(null);
            expect(result.limit).toBe(100);

            const result2 = validateListGroupsQuery(undefined);
            expect(result2.limit).toBe(100);
        });
    });

    describe('validateGroupFullDetailsQuery', () => {
        it('returns validated params with defaults', () => {
            const result = validateGroupFullDetailsQuery({});

            expect(result.expenseLimit).toBe(8);
            expect(result.expenseCursor).toBeUndefined();
            expect(result.settlementLimit).toBe(8);
            expect(result.settlementCursor).toBeUndefined();
            expect(result.commentLimit).toBe(8);
            expect(result.commentCursor).toBeUndefined();
            expect(result.includeDeletedExpenses).toBe(false);
            expect(result.includeDeletedSettlements).toBe(false);
        });

        it('coerces string limits to numbers', () => {
            const result = validateGroupFullDetailsQuery({
                expenseLimit: '20',
                settlementLimit: '15',
                commentLimit: '10',
            });

            expect(result.expenseLimit).toBe(20);
            expect(result.settlementLimit).toBe(15);
            expect(result.commentLimit).toBe(10);
        });

        it('parses includeDeleted boolean strings', () => {
            const result = validateGroupFullDetailsQuery({
                includeDeletedExpenses: 'true',
                includeDeletedSettlements: 'true',
            });

            expect(result.includeDeletedExpenses).toBe(true);
            expect(result.includeDeletedSettlements).toBe(true);
        });

        it('accepts cursor parameters', () => {
            const result = validateGroupFullDetailsQuery({
                expenseCursor: 'cursor1',
                settlementCursor: 'cursor2',
                commentCursor: 'cursor3',
            });

            expect(result.expenseCursor).toBe('cursor1');
            expect(result.settlementCursor).toBe('cursor2');
            expect(result.commentCursor).toBe('cursor3');
        });

        it('throws ApiError for invalid expenseLimit', () => {
            expect(() => validateGroupFullDetailsQuery({ expenseLimit: 'abc' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('handles null/undefined input gracefully', () => {
            const result = validateGroupFullDetailsQuery(null);
            expect(result.expenseLimit).toBe(8);

            const result2 = validateGroupFullDetailsQuery(undefined);
            expect(result2.expenseLimit).toBe(8);
        });
    });

    describe('validateGroupIdParam', () => {
        it('returns validated group ID', () => {
            const result = validateGroupIdParam({ groupId: 'group-123' });

            expect(result).toBe('group-123');
        });

        it('trims whitespace from group ID', () => {
            const result = validateGroupIdParam({ groupId: '  group-123  ' });

            expect(result).toBe('group-123');
        });

        it('throws ApiError for missing group ID', () => {
            expect(() => validateGroupIdParam({})).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_GROUP_ID',
                }),
            );
        });

        it('throws ApiError for empty group ID', () => {
            expect(() => validateGroupIdParam({ groupId: '' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_GROUP_ID',
                }),
            );
        });

        it('throws ApiError for whitespace-only group ID', () => {
            expect(() => validateGroupIdParam({ groupId: '   ' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_GROUP_ID',
                }),
            );
        });
    });
});
