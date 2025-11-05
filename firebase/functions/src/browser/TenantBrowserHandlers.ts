import type { Request, Response } from 'express';
import { logger } from '../logger';
import type { IFirestoreReader } from '../services/firestore';
import { Timestamp } from '../firestore-wrapper';

/**
 * Normalize Firestore Timestamp values to ISO strings for JSON serialization
 */
function normalizeFirestoreValue(value: unknown): unknown {
    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(normalizeFirestoreValue);
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, normalizeFirestoreValue(val)]);
        return Object.fromEntries(entries);
    }

    return value;
}

/**
 * Handlers for tenant browsing/admin operations
 * These are system-admin only endpoints for viewing tenant configurations
 */
export class TenantBrowserHandlers {
    constructor(private readonly firestoreReader: IFirestoreReader) {}

    /**
     * List all tenant configurations
     * System admin only - allows viewing all tenants in the system
     */
    listAllTenants = async (_req: Request, res: Response): Promise<void> => {
        try {
            logger.info('Fetching all tenant configurations');
            const tenants = await this.firestoreReader.listAllTenants();

            // Normalize Timestamp objects to ISO strings for JSON serialization
            const serialized = tenants.map((tenant) => normalizeFirestoreValue(tenant));

            res.json({
                tenants: serialized,
                count: tenants.length,
            });
        } catch (error) {
            logger.error('Failed to list all tenants', error as Error);
            throw error;
        }
    };
}
