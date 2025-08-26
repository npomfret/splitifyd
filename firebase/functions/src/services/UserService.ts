import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { firestoreDb } from '../firebase';
import { FirestoreCollections } from '@splitifyd/shared';
import { logger } from '../logger';
import { Errors } from '../utils/errors';

/**
 * User profile interface for consistent user data across the application
 */
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    emailVerified: boolean;
    themeColor?: string;
    preferredLanguage?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

/**
 * Service for fetching user profiles from Firebase Auth with request-level caching
 */
export class UserService {
    private cache = new Map<string, UserProfile>();

    /**
     * Validates that a user record has all required fields
     * @throws Error if required fields are missing
     */
    private validateUserRecord(userRecord: admin.auth.UserRecord): asserts userRecord is admin.auth.UserRecord & { email: string; displayName: string } {
        if (!userRecord.email || !userRecord.displayName) {
            throw new Error(`User ${userRecord.uid} missing required fields: email and displayName are mandatory`);
        }
    }

    /**
     * Creates a UserProfile from Firebase Auth record and Firestore data
     */
    private createUserProfile(userRecord: admin.auth.UserRecord & { email: string; displayName: string }, firestoreData: any): UserProfile {
        return {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            photoURL: userRecord.photoURL || null,
            emailVerified: userRecord.emailVerified,
            themeColor: firestoreData?.themeColor,
            preferredLanguage: firestoreData?.preferredLanguage,
            createdAt: firestoreData?.createdAt,
            updatedAt: firestoreData?.updatedAt,
        };
    }

    /**
     * Get a single user's profile by their ID
     * @param userId - The Firebase UID of the user
     * @returns The user's profile data
     * @throws If user is not found or an error occurs
     */
    async getUser(userId: string): Promise<UserProfile> {
        // Check cache first
        if (this.cache.has(userId)) {
            return this.cache.get(userId)!;
        }

        try {
            // Get user from Firebase Auth
            const userRecord = await admin.auth().getUser(userId);

            // Ensure required fields are present
            this.validateUserRecord(userRecord);

            // Get additional user data from Firestore
            const userDoc = await firestoreDb.collection(FirestoreCollections.USERS).doc(userId).get();
            const userData = userDoc.data();

            const profile = this.createUserProfile(userRecord, userData);

            // Cache the result
            this.cache.set(userId, profile);

            return profile;
        } catch (error) {
            // Check if error is from Firebase Auth (user not found)
            if ((error as any).code === 'auth/user-not-found') {
                logger.error('User not found in Firebase Auth', { userId });
                throw Errors.NOT_FOUND('User not found');
            }

            logger.error('Failed to get user profile', { error, userId });
            throw error;
        }
    }

    /**
     * Get multiple user profiles by UIDs (batch operation)
     */
    async getUsers(uids: string[]): Promise<Map<string, UserProfile>> {
        const result = new Map<string, UserProfile>();
        const uncachedUids: string[] = [];

        // Check cache for each UID
        for (const uid of uids) {
            if (this.cache.has(uid)) {
                result.set(uid, this.cache.get(uid)!);
            } else {
                uncachedUids.push(uid);
            }
        }

        // Fetch uncached users in batches (Firebase Auth supports up to 100 users per batch)
        if (uncachedUids.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < uncachedUids.length; i += batchSize) {
                const batch = uncachedUids.slice(i, i + batchSize);
                await this.fetchUserBatch(batch, result);
            }
        }

        return result;
    }

    /**
     * Fetch a batch of users and add to result map
     */
    private async fetchUserBatch(uids: string[], result: Map<string, UserProfile>): Promise<void> {
        const getUsersResult = await admin.auth().getUsers(uids.map((uid) => ({ uid })));

        // Process found users
        for (const userRecord of getUsersResult.users) {
            // Ensure required fields are present
            this.validateUserRecord(userRecord);

            // Fetch Firestore data for this user
            const userDoc = await firestoreDb.collection(FirestoreCollections.USERS).doc(userRecord.uid).get();
            const userData = userDoc.data();

            const profile = this.createUserProfile(userRecord, userData);

            // Cache and add to result
            this.cache.set(userRecord.uid, profile);
            result.set(userRecord.uid, profile);
        }

        // Handle not found users - log warning but don't throw error
        // Let calling code handle missing users gracefully
    }
}

// Export a singleton instance for use across the application
export const userService = new UserService();
