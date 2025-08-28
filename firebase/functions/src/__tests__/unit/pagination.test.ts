import { describe, it, expect, vi } from 'vitest';
import { decodeCursor, encodeCursor, buildPaginatedQuery, CursorData } from '../../utils/pagination';
import { Errors } from '../../utils/errors';

describe('Pagination Utilities', () => {
    describe('encodeCursor', () => {
        it('should encode cursor data to base64', () => {
            const cursorData: CursorData = {
                updatedAt: '2023-12-01T10:00:00.000Z',
                id: 'doc123',
            };

            const encoded = encodeCursor(cursorData);
            const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

            expect(JSON.parse(decoded)).toEqual(cursorData);
        });
    });

    describe('decodeCursor', () => {
        it('should decode valid base64 cursor', () => {
            const cursorData: CursorData = {
                updatedAt: '2023-12-01T10:00:00.000Z',
                id: 'doc123',
            };

            const encoded = Buffer.from(JSON.stringify(cursorData)).toString('base64');
            const decoded = decodeCursor(encoded);

            expect(decoded).toEqual(cursorData);
        });

        it('should throw error for invalid base64', () => {
            expect(() => decodeCursor('invalid-base64!')).toThrow(Errors.INVALID_INPUT('Invalid cursor format'));
        });

        it('should throw error for invalid JSON', () => {
            const invalidJson = Buffer.from('not-json').toString('base64');
            expect(() => decodeCursor(invalidJson)).toThrow(Errors.INVALID_INPUT('Invalid cursor format'));
        });

        it('should throw error for missing updatedAt', () => {
            const invalidData = Buffer.from(JSON.stringify({ id: 'doc123' })).toString('base64');
            expect(() => decodeCursor(invalidData)).toThrow(Errors.INVALID_INPUT('Invalid cursor format'));
        });

        it('should throw error for non-string updatedAt', () => {
            const invalidData = Buffer.from(JSON.stringify({ updatedAt: 123, id: 'doc123' })).toString('base64');
            expect(() => decodeCursor(invalidData)).toThrow(Errors.INVALID_INPUT('Invalid cursor format'));
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
            const cursorData: CursorData = {
                updatedAt: '2023-12-01T10:00:00.000Z',
                id: 'doc123',
            };
            const cursor = encodeCursor(cursorData);

            const result = buildPaginatedQuery(mockQuery, cursor, 'asc', 20);

            expect(mockQuery.orderBy).toHaveBeenCalledWith('updatedAt', 'asc');
            expect(mockQuery.limit).toHaveBeenCalledWith(20);
            expect(mockQuery.startAfter).toHaveBeenCalledWith(new Date('2023-12-01T10:00:00.000Z'));
            expect(result).toBe(mockQuery);
        });

        it('should handle invalid cursor', () => {
            expect(() => buildPaginatedQuery(mockQuery, 'invalid-cursor', 'desc', 10)).toThrow(Errors.INVALID_INPUT('Invalid cursor format'));
        });
    });
});
