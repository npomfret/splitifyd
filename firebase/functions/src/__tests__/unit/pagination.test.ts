import { CursorDataBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '../../errors';
import { buildPaginatedQuery, decodeCursor, encodeCursor } from '../../utils/pagination';

describe('Pagination Utilities', () => {
    describe('encodeCursor', () => {
        it('should encode cursor data to base64', () => {
            const cursorData = new CursorDataBuilder()
                .withUpdatedAt('2023-12-01T10:00:00.000Z')
                .withId('doc123')
                .build();

            const encoded = encodeCursor(cursorData);
            const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

            expect(JSON.parse(decoded)).toEqual(cursorData);
        });
    });

    describe('decodeCursor', () => {
        it('should decode valid base64 cursor', () => {
            const cursorData = new CursorDataBuilder()
                .withUpdatedAt('2023-12-01T10:00:00.000Z')
                .withId('doc123')
                .build();

            const encoded = Buffer.from(JSON.stringify(cursorData)).toString('base64');
            const decoded = decodeCursor(encoded);

            expect(decoded).toEqual(cursorData);
        });

        it('should throw error for invalid base64', () => {
            expect(() => decodeCursor('invalid-base64!')).toThrowError(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
            );
        });

        it('should throw error for invalid JSON', () => {
            const invalidJson = Buffer.from('not-json').toString('base64');
            expect(() => decodeCursor(invalidJson)).toThrowError(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
            );
        });

        it('should throw error for missing updatedAt', () => {
            const invalidData = Buffer.from(JSON.stringify({ id: 'doc123' })).toString('base64');
            expect(() => decodeCursor(invalidData)).toThrowError(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
            );
        });

        it('should throw error for non-string updatedAt', () => {
            const invalidData = Buffer.from(JSON.stringify({ updatedAt: 123, id: 'doc123' })).toString('base64');
            expect(() => decodeCursor(invalidData)).toThrowError(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
            );
        });

        it('should throw error for missing id', () => {
            const invalidData = Buffer.from(JSON.stringify({ updatedAt: '2023-12-01T10:00:00.000Z' })).toString('base64');
            expect(() => decodeCursor(invalidData)).toThrowError(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
            );
        });

        it('should throw error for non-string id', () => {
            const invalidData = Buffer.from(JSON.stringify({ updatedAt: '2023-12-01T10:00:00.000Z', id: 123 })).toString('base64');
            expect(() => decodeCursor(invalidData)).toThrowError(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
            );
        });

        it('should throw error for invalid date format', () => {
            const invalidData = Buffer.from(JSON.stringify({ updatedAt: 'not-a-date', id: 'doc123' })).toString('base64');
            expect(() => decodeCursor(invalidData)).toThrowError(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
            );
        });
    });

    describe('buildPaginatedQuery', () => {
        let mockQuery: any;

        beforeEach(() => {
            mockQuery = {
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                startAfter: vi.fn().mockReturnThis(),
            };
        });

        it('should build query without cursor', () => {
            const result = buildPaginatedQuery(mockQuery, undefined, 'desc', 10);

            expect(mockQuery.orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
            expect(mockQuery.limit).toHaveBeenCalledWith(10);
            expect(mockQuery.startAfter).not.toHaveBeenCalled();
            expect(result).toBe(mockQuery);
        });

        it('should build query with cursor', () => {
            const cursorData = new CursorDataBuilder()
                .withUpdatedAt('2023-12-01T10:00:00.000Z')
                .withId('doc123')
                .build();
            const cursor = encodeCursor(cursorData);

            const result = buildPaginatedQuery(mockQuery, cursor, 'asc', 20);

            expect(mockQuery.orderBy).toHaveBeenCalledWith('updatedAt', 'asc');
            expect(mockQuery.limit).toHaveBeenCalledWith(20);
            expect(mockQuery.startAfter).toHaveBeenCalledWith(new Date('2023-12-01T10:00:00.000Z'));
            expect(result).toBe(mockQuery);
        });

        it('should handle invalid cursor', () => {
            expect(() => buildPaginatedQuery(mockQuery, 'invalid-cursor', 'desc', 10)).toThrowError(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
            );
        });
    });
});
