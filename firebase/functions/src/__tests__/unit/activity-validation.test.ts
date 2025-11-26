import { describe, expect, it } from 'vitest';
import { validateActivityFeedQuery } from '../../activity/validation';
import { HTTP_STATUS } from '../../constants';

describe('activity/validation', () => {
    describe('validateActivityFeedQuery', () => {
        it('coerces string limit and returns cursor', () => {
            const result = validateActivityFeedQuery({ limit: '15', cursor: 'abc123' });

            expect(result).toEqual({ limit: 15, cursor: 'abc123' });
        });

        it('provides default limit when none supplied', () => {
            const result = validateActivityFeedQuery({});

            expect(result.limit).toBe(10);
            expect(result.cursor).toBeUndefined();
        });

        it('ignores unknown parameters', () => {
            const result = validateActivityFeedQuery({ limit: '5', other: 'ignored', foo: 'bar' });

            expect(result).toEqual({ limit: 5 });
        });

        it('throws ApiError for non-numeric limit', () => {
            expect(() => validateActivityFeedQuery({ limit: 'abc' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for zero limit', () => {
            expect(() => validateActivityFeedQuery({ limit: '0' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for negative limit', () => {
            expect(() => validateActivityFeedQuery({ limit: '-5' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('enforces maximum limit', () => {
            const result = validateActivityFeedQuery({ limit: '50' });
            expect(result.limit).toBe(50);

            expect(() => validateActivityFeedQuery({ limit: '101' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('handles null/undefined input gracefully', () => {
            const result = validateActivityFeedQuery(null);
            expect(result.limit).toBe(10);

            const result2 = validateActivityFeedQuery(undefined);
            expect(result2.limit).toBe(10);
        });
    });
});
