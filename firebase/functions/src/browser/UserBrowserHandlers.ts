import { AdminUserProfile, SystemUserRoles, toDisplayName, toUserId } from '@billsplit-wl/shared';
import { toEmail } from '@billsplit-wl/shared';
import type { Request, Response } from 'express';
import { FirestoreCollections } from '../constants';
import { type IDocumentSnapshot, type IFirestoreDatabase, Timestamp } from '../firestore-wrapper';
import { logger } from '../logger';
import type { IAuthService } from '../services/auth';
import type { IFirestoreReader } from '../services/firestore';
import type { UserDocument } from '../schemas';
import { validateListAuthUsersQuery, validateListFirestoreUsersQuery } from './validation';

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
     * Enrich Firestore users with their Auth data to create complete AdminUserProfile.
     * Starts from Firestore (source of truth for app users) and enriches with Auth metadata.
     */
    private async enrichWithAuthData(firestoreUsers: UserDocument[]): Promise<AdminUserProfile[]> {
        // Fetch Auth records for all users in parallel
        const authUsers = await Promise.all(
            firestoreUsers.map((user) => this.authService.getUser(user.id)),
        );

        return firestoreUsers.map((firestoreUser, index) => {
            const authUser = authUsers[index];

            // Auth data - use defaults if Auth record is missing (shouldn't happen normally)
            const email = authUser?.email || firestoreUser.email || `${firestoreUser.id}@missing-email.local`;
            const displayName = authUser?.displayName || `User ${firestoreUser.id.substring(0, 8)}`;

            if (!authUser) {
                logger.warn(`User ${firestoreUser.id} exists in Firestore but missing Auth record`);
            }

            return {
                uid: firestoreUser.id,
                displayName: toDisplayName(displayName),
                email: toEmail(email),
                emailVerified: authUser?.emailVerified ?? false,
                photoURL: authUser?.photoURL || null,
                role: firestoreUser.role,
                disabled: authUser?.disabled ?? false,
                metadata: {
                    creationTime: authUser?.metadata.creationTime ?? firestoreUser.createdAt ?? new Date().toISOString(),
                    lastSignInTime: authUser?.metadata.lastSignInTime ?? undefined, // Convert null to undefined
                },
                // Firestore fields
                createdAt: firestoreUser.createdAt,
                updatedAt: firestoreUser.updatedAt,
                preferredLanguage: firestoreUser.preferredLanguage,
                acceptedPolicies: firestoreUser.acceptedPolicies,
            };
        });
    }

    /**
     * List Firestore users with pagination
     */
    private async listFirestoreUserDocuments(options: { limit: number; cursor?: string }): Promise<{ users: UserDocument[]; nextCursor?: string; hasMore: boolean }> {
        if (!this.firestoreReader) {
            throw new Error('FirestoreReader is required for listing users');
        }

        let query = this.db.collection(FirestoreCollections.USERS).orderBy('__name__').limit(options.limit + 1);
        if (options.cursor) {
            query = query.startAfter(options.cursor);
        }

        const snapshot = await query.get();
        const docs = snapshot.docs.slice(0, options.limit);
        const hasMore = snapshot.docs.length > options.limit;
        const nextCursor = hasMore ? docs[docs.length - 1]?.id : undefined;

        // Get full user documents via FirestoreReader for proper validation
        const users = await Promise.all(
            docs.map((doc) => this.firestoreReader!.getUser(toUserId(doc.id))),
        );

        // Filter out nulls (shouldn't happen, but be safe)
        const validUsers = users.filter((u): u is UserDocument => u !== null);

        return { users: validUsers, nextCursor, hasMore };
    }

    listAuthUsers = async (req: Request, res: Response): Promise<void> => {
        const query = validateListAuthUsersQuery(req.query);

        try {
            // Search by email - look up in Auth first (email not stored in Firestore)
            if (query.email) {
                const authUser = await this.authService.getUserByEmail(query.email);
                if (!authUser) {
                    res.json({ users: [], hasMore: false });
                    return;
                }
                const firestoreUser = await this.firestoreReader?.getUser(toUserId(authUser.uid));
                if (!firestoreUser) {
                    res.json({ users: [], hasMore: false });
                    return;
                }
                const enrichedUsers = await this.enrichWithAuthData([firestoreUser]);
                res.json({ users: enrichedUsers, hasMore: false });
                return;
            }

            // Search by UID - look up in Firestore
            if (query.uid) {
                const firestoreUser = await this.firestoreReader?.getUser(toUserId(query.uid));
                if (!firestoreUser) {
                    res.json({ users: [], hasMore: false });
                    return;
                }
                const enrichedUsers = await this.enrichWithAuthData([firestoreUser]);
                res.json({ users: enrichedUsers, hasMore: false });
                return;
            }

            // List users - start from Firestore, enrich with Auth
            const result = await this.listFirestoreUserDocuments({
                limit: query.limit,
                cursor: query.pageToken,
            });
            const enrichedUsers = await this.enrichWithAuthData(result.users);

            res.json({
                users: enrichedUsers,
                nextPageToken: result.nextCursor,
                hasMore: result.hasMore,
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
