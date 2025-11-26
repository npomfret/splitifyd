import { describe, expect, it } from 'vitest';
import { validateListAuthUsersQuery, validateListFirestoreUsersQuery } from '../../browser/validation';
import { HTTP_STATUS } from '../../constants';

describe('browser/validation', () => {
    describe('validateListAuthUsersQuery', () => {
        it('returns validated params with defaults', () => {
            const result = validateListAuthUsersQuery({});

            expect(result.limit).toBe(50);
            expect(result.pageToken).toBeUndefined();
            expect(result.email).toBeUndefined();
            expect(result.uid).toBeUndefined();
        });

        it('coerces string limit to number', () => {
            const result = validateListAuthUsersQuery({ limit: '100' });

            expect(result.limit).toBe(100);
        });

        it('accepts pageToken parameter', () => {
            const result = validateListAuthUsersQuery({ pageToken: 'token123' });

            expect(result.pageToken).toBe('token123');
        });

        it('validates and accepts email parameter', () => {
            const result = validateListAuthUsersQuery({ email: 'test@example.com' });

            expect(result.email).toBe('test@example.com');
        });

        it('validates and accepts uid parameter', () => {
            const result = validateListAuthUsersQuery({ uid: 'user123' });

            expect(result.uid).toBe('user123');
        });

        it('throws ApiError for invalid email format', () => {
            expect(() => validateListAuthUsersQuery({ email: 'invalid-email' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for empty uid', () => {
            expect(() => validateListAuthUsersQuery({ uid: '' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for invalid limit', () => {
            expect(() => validateListAuthUsersQuery({ limit: 'abc' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for limit exceeding max (1000)', () => {
            expect(() => validateListAuthUsersQuery({ limit: '1500' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('handles null/undefined input gracefully', () => {
            const result = validateListAuthUsersQuery(null);
            expect(result.limit).toBe(50);

            const result2 = validateListAuthUsersQuery(undefined);
            expect(result2.limit).toBe(50);
        });
    });

    describe('validateListFirestoreUsersQuery', () => {
        it('returns validated params with defaults', () => {
            const result = validateListFirestoreUsersQuery({});

            expect(result.limit).toBe(50);
            expect(result.cursor).toBeUndefined();
            expect(result.email).toBeUndefined();
            expect(result.uid).toBeUndefined();
            expect(result.displayName).toBeUndefined();
        });

        it('coerces string limit to number', () => {
            const result = validateListFirestoreUsersQuery({ limit: '75' });

            expect(result.limit).toBe(75);
        });

        it('accepts cursor parameter', () => {
            const result = validateListFirestoreUsersQuery({ cursor: 'cursor123' });

            expect(result.cursor).toBe('cursor123');
        });

        it('validates and accepts email parameter', () => {
            const result = validateListFirestoreUsersQuery({ email: 'test@example.com' });

            expect(result.email).toBe('test@example.com');
        });

        it('validates and accepts uid parameter', () => {
            const result = validateListFirestoreUsersQuery({ uid: 'user123' });

            expect(result.uid).toBe('user123');
        });

        it('accepts displayName parameter', () => {
            const result = validateListFirestoreUsersQuery({ displayName: 'John Doe' });

            expect(result.displayName).toBe('John Doe');
        });

        it('throws ApiError for invalid email format', () => {
            expect(() => validateListFirestoreUsersQuery({ email: 'invalid-email' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('throws ApiError for limit exceeding max (200)', () => {
            expect(() => validateListFirestoreUsersQuery({ limit: '300' })).toThrowError(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_QUERY_PARAMS',
                }),
            );
        });

        it('handles null/undefined input gracefully', () => {
            const result = validateListFirestoreUsersQuery(null);
            expect(result.limit).toBe(50);

            const result2 = validateListFirestoreUsersQuery(undefined);
            expect(result2.limit).toBe(50);
        });
    });
});
