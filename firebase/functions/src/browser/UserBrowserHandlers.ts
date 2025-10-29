import type { Request, Response } from 'express';
import { FieldPath } from 'firebase-admin/firestore';
import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type { UserRecord } from 'firebase-admin/auth';
import { FirestoreCollections } from '../constants';
import { Timestamp } from '../firestore-wrapper';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';

interface ListAuthQuery {
    limit: number;
    pageToken?: string;
    email?: string;
    uid?: string;
}

interface ListFirestoreQuery {
    limit: number;
    cursor?: string;
    email?: string;
    uid?: string;
    displayName?: string;
}

const DEFAULT_AUTH_LIMIT = 50;
const MAX_AUTH_LIMIT = 1000;
const DEFAULT_FIRESTORE_LIMIT = 50;
const MAX_FIRESTORE_LIMIT = 200;

function parseLimit(raw: unknown, fallback: number, max: number): number {
    if (typeof raw === 'string') {
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
            return Math.min(parsed, max);
        }
    }

    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
        return Math.min(Math.trunc(raw), max);
    }

    return fallback;
}

function serializeUserRecord(record: UserRecord) {
    const base = record.toJSON();
    return {
        ...base,
        uid: record.uid,
        email: record.email ?? null,
        emailVerified: record.emailVerified ?? false,
        displayName: record.displayName ?? null,
        phoneNumber: record.phoneNumber ?? null,
        disabled: record.disabled ?? false,
        metadata: record.metadata,
        customClaims: record.customClaims ?? {},
        providerData: record.providerData ?? [],
    };
}

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

function serializeFirestoreDocument(doc: DocumentSnapshot): Record<string, unknown> {
    const raw = doc.data() ?? {};
    const normalized = normalizeFirestoreValue(raw);
    const details = normalized && typeof normalized === 'object' && !Array.isArray(normalized)
        ? (normalized as Record<string, unknown>)
        : { value: normalized };

    return { id: doc.id, ...details };
}

export class UserBrowserHandlers {
    constructor(private readonly authService: IAuthService, private readonly firestore: Firestore) {}

    listAuthUsers = async (req: Request, res: Response): Promise<void> => {
        const query: ListAuthQuery = {
            limit: parseLimit(req.query.limit, DEFAULT_AUTH_LIMIT, MAX_AUTH_LIMIT),
            pageToken: typeof req.query.pageToken === 'string' ? req.query.pageToken : undefined,
            email: typeof req.query.email === 'string' ? req.query.email : undefined,
            uid: typeof req.query.uid === 'string' ? req.query.uid : undefined,
        };

        try {
            if (query.email) {
                const user = await this.authService.getUserByEmail(query.email);
                res.json({ users: user ? [serializeUserRecord(user)] : [], hasMore: false });
                return;
            }

            if (query.uid) {
                const user = await this.authService.getUser(query.uid);
                res.json({ users: user ? [serializeUserRecord(user)] : [], hasMore: false });
                return;
            }

            const result = await this.authService.listUsers({ limit: query.limit, pageToken: query.pageToken });
            res.json({
                users: result.users.map(serializeUserRecord),
                nextPageToken: result.pageToken ?? undefined,
                hasMore: Boolean(result.pageToken),
            });
        } catch (error) {
            logger.error('Failed to list auth users', error as Error, {
                email: query.email,
                uid: query.uid,
            });
            throw error;
        }
    };

    listFirestoreUsers = async (req: Request, res: Response): Promise<void> => {
        const query: ListFirestoreQuery = {
            limit: parseLimit(req.query.limit, DEFAULT_FIRESTORE_LIMIT, MAX_FIRESTORE_LIMIT),
            cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
            email: typeof req.query.email === 'string' ? req.query.email : undefined,
            uid: typeof req.query.uid === 'string' ? req.query.uid : undefined,
            displayName: typeof req.query.displayName === 'string' ? req.query.displayName : undefined,
        };

        try {
            if (query.uid) {
                const doc = await this.firestore.collection(FirestoreCollections.USERS).doc(query.uid).get();
                if (!doc.exists) {
                    res.json({ users: [], hasMore: false });
                    return;
                }

                res.json({ users: [serializeFirestoreDocument(doc)], hasMore: false });
                return;
            }

            if (query.email || query.displayName) {
                const field = query.email ? 'email' : 'displayName';
                const value = query.email ?? query.displayName;
                const snapshot = await this.firestore
                    .collection(FirestoreCollections.USERS)
                    .where(field, '==', value)
                    .limit(query.limit)
                    .get();

                const users = snapshot.docs.map(serializeFirestoreDocument);
                res.json({ users, hasMore: false });
                return;
            }

            let collectionQuery = this.firestore.collection(FirestoreCollections.USERS).orderBy(FieldPath.documentId()).limit(query.limit + 1);
            if (query.cursor) {
                collectionQuery = collectionQuery.startAfter(query.cursor);
            }

            const snapshot = await collectionQuery.get();
            const docs = snapshot.docs.slice(0, query.limit);
            const hasMore = snapshot.docs.length > query.limit;
            const nextCursor = hasMore ? docs[docs.length - 1]?.id : undefined;
            const users = docs.map(serializeFirestoreDocument);

            res.json({
                users,
                hasMore,
                nextCursor,
            });
        } catch (error) {
            logger.error('Failed to list firestore users', error as Error, {
                email: query.email,
                displayName: query.displayName,
            });
            throw error;
        }
    };
}
