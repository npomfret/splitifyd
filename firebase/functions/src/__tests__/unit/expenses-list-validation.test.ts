import { describe, expect, it } from 'vitest';
import { validateListExpensesQuery } from '../../expenses/validation';
import { HTTP_STATUS } from '../../constants';

describe('expenses/validation - list queries', () => {
    describe('validateListExpensesQuery', () => {
        it('returns validated params with defaults', () => {
            const result = validateListExpensesQuery({});

            expect(result.limit).toBe(20);
            expect(result.cursor).toBeUndefined();
            expect(result.includeDeleted).toBe(false);
        });

        it('coerces string limit to number', () => {
            const result = validateListExpensesQuery({ limit: '50' });

            expect(result.limit).toBe(50);
        });

        it('accepts cursor parameter', () => {
            const result = validateListExpensesQuery({ cursor: 'abc123' });

            expect(result.cursor).toBe('abc123');
        });

        it('parses includeDeleted boolean string', () => {
            const result = validateListExpensesQuery({ includeDeleted: 'true' });

            expect(result.includeDeleted).toBe(true);
        });

        it('treats non-true strings as false for includeDeleted', () => {
            const result = validateListExpensesQuery({ includeDeleted: 'false' });

            expect(result.includeDeleted).toBe(false);
        });

        it('throws ApiError for invalid limit', () => {
            expect(() => validateListExpensesQuery({ limit: 'abc' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for zero limit', () => {
            expect(() => validateListExpensesQuery({ limit: '0' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for negative limit', () => {
            expect(() => validateListExpensesQuery({ limit: '-5' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for limit exceeding max (100)', () => {
            expect(() => validateListExpensesQuery({ limit: '150' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('handles null/undefined input gracefully', () => {
            const result = validateListExpensesQuery(null);
            expect(result.limit).toBe(20);

            const result2 = validateListExpensesQuery(undefined);
            expect(result2.limit).toBe(20);
        });
    });
});
