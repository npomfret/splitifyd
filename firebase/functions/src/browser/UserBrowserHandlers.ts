import { AdminUserProfile, SystemUserRoles, toDisplayName, toUserId } from '@billsplit-wl/shared';
import { toEmail } from '@billsplit-wl/shared';
import type { Request, Response } from 'express';
import type { UserRecord } from 'firebase-admin/auth';
import { FirestoreCollections } from '../constants';
import { type IDocumentSnapshot, type IFirestoreDatabase, Timestamp } from '../firestore-wrapper';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import type { IFirestoreReader } from '../services/firestore';
import { validateListAuthUsersQuery, validateListFirestoreUsersQuery } from './validation';

function serializeUserRecord(record: UserRecord) {
    return {
        uid: record.uid,
        email: record.email ?? null,
        emailVerified: record.emailVerified ?? false,
        displayName: record.displayName ?? null,
        disabled: record.disabled ?? false,
        metadata: record.metadata,
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

function serializeFirestoreDocument(doc: IDocumentSnapshot): Record<string, unknown> {
    const raw = doc.data() ?? {};
    const normalized = normalizeFirestoreValue(raw);
    const details = normalized && typeof normalized === 'object' && !Array.isArray(normalized)
        ? (normalized as Record<string, unknown>)
        : { value: normalized };

    // Add uid from document ID (Firestore document ID is the user's UID)
    // Remove the legacy 'id' field if it exists in the document data
    const { id, ...rest } = details;
    return { uid: doc.id, ...rest };
}

export class UserBrowserHandlers {
    constructor(
        private readonly authService: IAuthService,
        private readonly db: IFirestoreDatabase,
        private readonly firestoreReader?: IFirestoreReader,
    ) {}

    /**
     * Enrich auth users with their Firestore data to create complete AdminUserProfile
     */
    private async enrichWithFirestoreRoles(users: UserRecord[]): Promise<AdminUserProfile[]> {
        if (!this.firestoreReader) {
            // If no firestoreReader, return auth users with minimal data (no Firestore fields)
            return users.map((authUser) => {
                // Use placeholder values for missing required fields
                const email = authUser.email || `${authUser.uid}@missing-email.local`;
                const displayName = authUser.displayName || `User ${authUser.uid.substring(0, 8)}`;

                if (!authUser.email || !authUser.displayName) {
                    logger.warn(`User ${authUser.uid} missing required fields - using placeholders (email: ${!!authUser.email}, displayName: ${!!authUser.displayName})`);
                }

                return {
                    uid: toUserId(authUser.uid),
                    displayName: toDisplayName(displayName),
                    email: toEmail(email),
                    emailVerified: authUser.emailVerified ?? false,
                    photoURL: authUser.photoURL || null,
                    role: SystemUserRoles.SYSTEM_USER,
                    disabled: authUser.disabled ?? false,
                    metadata: {
                        creationTime: authUser.metadata.creationTime,
                        lastSignInTime: authUser.metadata.lastSignInTime,
                    },
                };
            });
        }

        // Fetch Firestore user documents for all users in parallel
        const firestoreUsers = await Promise.all(
            users.map((user) => this.firestoreReader!.getUser(toUserId(user.uid))),
        );

        // Merge auth users with their Firestore data to create AdminUserProfile
        return users.map((authUser, index) => {
            const firestoreUser = firestoreUsers[index];

            // Use placeholder values for missing required fields
            const email = authUser.email || `${authUser.uid}@missing-email.local`;
            const displayName = authUser.displayName || `User ${authUser.uid.substring(0, 8)}`;

            if (!authUser.email || !authUser.displayName) {
                logger.warn(`User ${authUser.uid} missing required fields - using placeholders (email: ${!!authUser.email}, displayName: ${!!authUser.displayName})`);
            }

            // If no Firestore document, use defaults
            if (!firestoreUser) {
                logger.warn(`User ${authUser.uid} exists in Auth but missing Firestore document - using defaults`);
                return {
                    uid: toUserId(authUser.uid),
                    displayName: toDisplayName(displayName),
                    email: toEmail(email),
                    emailVerified: authUser.emailVerified ?? false,
                    photoURL: authUser.photoURL || null,
                    role: SystemUserRoles.SYSTEM_USER,
                    disabled: authUser.disabled ?? false,
                    metadata: {
                        creationTime: authUser.metadata.creationTime,
                        lastSignInTime: authUser.metadata.lastSignInTime,
                    },
                };
            }

            return {
                uid: toUserId(authUser.uid),
                displayName: toDisplayName(displayName),
                email: toEmail(email),
                emailVerified: authUser.emailVerified ?? false,
                photoURL: authUser.photoURL || null,
                role: firestoreUser.role,
                disabled: authUser.disabled ?? false,
                metadata: {
                    creationTime: authUser.metadata.creationTime,
                    lastSignInTime: authUser.metadata.lastSignInTime,
                },
                // Firestore fields
                createdAt: firestoreUser.createdAt,
                updatedAt: firestoreUser.updatedAt,
                preferredLanguage: firestoreUser.preferredLanguage,
                acceptedPolicies: firestoreUser.acceptedPolicies,
            };
        });
    }

    listAuthUsers = async (req: Request, res: Response): Promise<void> => {
        const query = validateListAuthUsersQuery(req.query);

        try {
            if (query.email) {
                const user = await this.authService.getUserByEmail(query.email);
                const enrichedUsers = user ? await this.enrichWithFirestoreRoles([user]) : [];
                res.json({ users: enrichedUsers, hasMore: false });
                return;
            }

            if (query.uid) {
                const user = await this.authService.getUser(query.uid);
                const enrichedUsers = user ? await this.enrichWithFirestoreRoles([user]) : [];
                res.json({ users: enrichedUsers, hasMore: false });
                return;
            }

            const result = await this.authService.listUsers({ limit: query.limit, pageToken: query.pageToken });
            const enrichedUsers = await this.enrichWithFirestoreRoles(result.users);

            res.json({
                users: enrichedUsers,
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
        const query = validateListFirestoreUsersQuery(req.query);

        try {
            if (query.uid) {
                const doc = await this.db.collection(FirestoreCollections.USERS).doc(query.uid).get();
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
                const snapshot = await this
                    .db
                    .collection(FirestoreCollections.USERS)
                    .where(field, '==', value)
                    .limit(query.limit)
                    .get();

                const users = snapshot.docs.map(serializeFirestoreDocument);
                res.json({ users, hasMore: false });
                return;
            }

            let collectionQuery = this.db.collection(FirestoreCollections.USERS).orderBy('__name__').limit(query.limit + 1);
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
