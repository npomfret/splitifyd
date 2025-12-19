import { AdminUserProfile, toDisplayName, toUserId } from '@billsplit-wl/shared';
import type { Request, Response } from 'express';
import { logger } from '../logger';
import type { UserDocument } from '../schemas';
import type { IAuthService } from '../services/auth';
import type { IFirestoreReader } from '../services/firestore';
import { validateListAuthUsersQuery, validateListFirestoreUsersQuery } from './validation';

/**
 * Serialize a UserDocument for browser display
 * Converts internal document format to admin-friendly format with 'uid' as primary identifier
 */
function serializeUserDocument(user: UserDocument): Record<string, unknown> {
    // Remove internal 'id' field and expose as 'uid' for consistency with Auth API
    const { id, ...rest } = user as UserDocument & { id?: string; };
    return { uid: user.id, ...rest };
}

export class UserBrowserHandlers {
    constructor(
        private readonly authService: IAuthService,
        private readonly firestoreReader: IFirestoreReader,
    ) {}

    /**
     * Enrich Firestore users with their Auth data to create complete AdminUserProfile.
     * Starts from Firestore (source of truth for app users) and enriches with Auth metadata.
     *
     * Note: Email is intentionally excluded from the response for privacy.
     * Admins can still search by email (server-side only) but email is never returned.
     */
    private async enrichWithAuthData(firestoreUsers: UserDocument[]): Promise<AdminUserProfile[]> {
        // Fetch Auth records for all users in parallel
        const authUsers = await Promise.all(
            firestoreUsers.map((user) => this.authService.getUser(user.id)),
        );

        return firestoreUsers.map((firestoreUser, index) => {
            const authUser = authUsers[index];

            // Auth data - use defaults if Auth record is missing (shouldn't happen normally)
            const displayName = authUser?.displayName || `User ${firestoreUser.id.substring(0, 8)}`;

            if (!authUser) {
                logger.warn(`User ${firestoreUser.id} exists in Firestore but missing Auth record`);
            }

            return {
                uid: firestoreUser.id,
                displayName: toDisplayName(displayName),
                // email intentionally excluded for privacy
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
                signupTenantId: firestoreUser.signupTenantId,
            };
        });
    }

    /**
     * List Firestore users with pagination
     * Delegates to FirestoreReader for all database access
     */
    private async listFirestoreUserDocuments(options: { limit: number; cursor?: string; }): Promise<{ users: UserDocument[]; nextCursor?: string; hasMore: boolean; }> {
        return this.firestoreReader.listUserDocuments(options);
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
                const firestoreUser = await this.firestoreReader.getUser(toUserId(authUser.uid));
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
                const firestoreUser = await this.firestoreReader.getUser(toUserId(query.uid));
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
            // Search by UID - look up directly
            if (query.uid) {
                const user = await this.firestoreReader.getUser(toUserId(query.uid));
                if (!user) {
                    res.json({ users: [], hasMore: false });
                    return;
                }

                res.json({ users: [serializeUserDocument(user)], hasMore: false });
                return;
            }

            // Search by email or displayName - these fields are not stored in Firestore
            // (they're in Firebase Auth only), so return empty results
            if (query.email || query.displayName) {
                res.json({ users: [], hasMore: false });
                return;
            }

            // List all users with pagination
            const result = await this.firestoreReader.listUserDocuments({
                limit: query.limit,
                cursor: query.cursor,
            });

            res.json({
                users: result.users.map(serializeUserDocument),
                hasMore: result.hasMore,
                nextCursor: result.nextCursor,
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
