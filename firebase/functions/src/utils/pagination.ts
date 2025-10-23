import type { IQuery } from '../firestore-wrapper';
import { Errors } from './errors';

export interface CursorData {
    updatedAt: string;
    id: string;
}

export function decodeCursor(cursor: string): CursorData {
    try {
        const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
        const cursorData = JSON.parse(decodedCursor);

        if (!cursorData.updatedAt || typeof cursorData.updatedAt !== 'string') {
            throw new Error('Invalid cursor: missing or invalid updatedAt');
        }

        return cursorData as CursorData;
    } catch (error) {
        throw Errors.INVALID_INPUT('Invalid cursor format');
    }
}

export function encodeCursor(data: CursorData): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
}

export function buildPaginatedQuery(baseQuery: IQuery, cursor: string | undefined, order: 'asc' | 'desc', limit: number): IQuery {
    const queryWithOrder = baseQuery.orderBy('updatedAt', order).limit(limit);

    if (!cursor) {
        return queryWithOrder;
    }

    const cursorData = decodeCursor(cursor);
    const cursorTimestamp = new Date(cursorData.updatedAt);

    return queryWithOrder.startAfter(cursorTimestamp);
}
