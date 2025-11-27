import { describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../constants';
import { validateListSettlementsQuery } from '../../settlements/validation';

describe('settlements/validation - list queries', () => {
    describe('validateListSettlementsQuery', () => {
        it('returns validated params with defaults', () => {
            const result = validateListSettlementsQuery({});

            expect(result.limit).toBe(20);
            expect(result.cursor).toBeUndefined();
            expect(result.includeDeleted).toBe(false);
        });

        it('coerces string limit to number', () => {
            const result = validateListSettlementsQuery({ limit: '50' });

            expect(result.limit).toBe(50);
        });

        it('accepts cursor parameter', () => {
            const result = validateListSettlementsQuery({ cursor: 'abc123' });

            expect(result.cursor).toBe('abc123');
        });

        it('parses includeDeleted boolean string', () => {
            const result = validateListSettlementsQuery({ includeDeleted: 'true' });

            expect(result.includeDeleted).toBe(true);
        });

        it('treats non-true strings as false for includeDeleted', () => {
            const result = validateListSettlementsQuery({ includeDeleted: 'false' });

            expect(result.includeDeleted).toBe(false);
        });

        it('throws ApiError for invalid limit', () => {
            expect(() => validateListSettlementsQuery({ limit: 'abc' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for zero limit', () => {
            expect(() => validateListSettlementsQuery({ limit: '0' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for negative limit', () => {
            expect(() => validateListSettlementsQuery({ limit: '-5' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for limit exceeding max (100)', () => {
            expect(() => validateListSettlementsQuery({ limit: '150' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('handles null/undefined input gracefully', () => {
            const result = validateListSettlementsQuery(null);
            expect(result.limit).toBe(20);

            const result2 = validateListSettlementsQuery(undefined);
            expect(result2.limit).toBe(20);
        });
    });
});
