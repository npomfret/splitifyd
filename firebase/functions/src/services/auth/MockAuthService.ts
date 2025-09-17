/**
 * Mock Auth Service Implementation
 *
 * Mock implementation of IAuthService for unit testing.
 * Provides configurable responses and behavior tracking without Firebase dependencies.
 *
 * Design Principles:
 * - No Firebase dependencies
 * - Configurable responses for different test scenarios
 * - Call tracking for verification in tests
 * - Error simulation for error handling tests
 * - State management for consistent test behavior
 */

import type { UserRecord, UpdateRequest, CreateRequest, GetUsersResult, DecodedIdToken, ListUsersResult, DeleteUsersResult } from 'firebase-admin/auth';

import { IAuthService } from './IAuthService';
import { AuthErrorCode } from './auth-types';
import { ApiError } from '../../utils/errors';
import { HTTP_STATUS } from '../../constants';

/**
 * Mock user record for testing - internal interface
 */
interface MockUserData {
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    emailVerified: boolean;
    disabled: boolean;
    phoneNumber?: string;
    customClaims?: { [key: string]: any };
    tokensValidAfterTime?: string;
    metadata?: {
        lastSignInTime?: string;
        lastRefreshTime?: string;
    };
}

/**
 * Mock configuration for controlling behavior
 */
export interface MockAuthConfig {
    shouldThrowError?: boolean;
    errorCode?: string;
    errorMessage?: string;
    simulateDelay?: number;
}

/**
 * Call tracking for verification in tests
 */
export interface MethodCall {
    method: string;
    args: any[];
    timestamp: Date;
}

export class MockAuthService implements IAuthService {
    private users = new Map<string, MockUserData>();
    private emailToUid = new Map<string, string>();
    private phoneToUid = new Map<string, string>();
    private calls: MethodCall[] = [];
    private config: MockAuthConfig = {};
    private nextUid = 1;

    /**
     * Reset mock state
     */
    reset(): void {
        this.users.clear();
        this.emailToUid.clear();
        this.phoneToUid.clear();
        this.calls = [];
        this.config = {};
        this.nextUid = 1;
    }

    /**
     * Record a method call
     */
    private recordCall(method: string, args: any[]): void {
        this.calls.push({
            method,
            args: JSON.parse(JSON.stringify(args)), // Deep clone to avoid mutations
            timestamp: new Date(),
        });
    }

    /**
     * Simulate configured errors or delays
     */
    private async simulateBehavior(): Promise<void> {
        if (this.config.simulateDelay) {
            await new Promise((resolve) => setTimeout(resolve, this.config.simulateDelay));
        }

        if (this.config.shouldThrowError) {
            const errorCode = this.config.errorCode || AuthErrorCode.SERVICE_UNAVAILABLE;
            const errorMessage = this.config.errorMessage || 'Mock error';
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, errorCode, errorMessage);
        }
    }

    /**
     * Generate a mock UID
     */
    private generateUid(): string {
        return `mock-uid-${this.nextUid++}`;
    }

    /**
     * Create internal mock user data
     */
    private createMockUserData(data: Partial<MockUserData> = {}): MockUserData {
        const uid = data.uid || this.generateUid();

        return {
            uid,
            email: data.email,
            displayName: data.displayName,
            photoURL: data.photoURL,
            emailVerified: data.emailVerified ?? false,
            disabled: data.disabled ?? false,
            phoneNumber: data.phoneNumber,
            customClaims: data.customClaims,
            tokensValidAfterTime: data.tokensValidAfterTime,
            metadata: data.metadata,
        };
    }

    /**
     * Convert internal user data to UserRecord format
     */
    private toUserRecord(userData: MockUserData): UserRecord {
        const now = new Date().toISOString();

        return {
            uid: userData.uid,
            email: userData.email,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            emailVerified: userData.emailVerified,
            disabled: userData.disabled,
            metadata: {
                creationTime: userData.metadata?.lastSignInTime || now,
                lastSignInTime: userData.metadata?.lastSignInTime,
                lastRefreshTime: userData.metadata?.lastRefreshTime,
                toJSON(): object {
                    return {
                        creationTime: this.creationTime,
                        ...(this.lastSignInTime && { lastSignInTime: this.lastSignInTime }),
                        ...(this.lastRefreshTime && { lastRefreshTime: this.lastRefreshTime }),
                    };
                },
            },
            customClaims: userData.customClaims,
            providerData: [],
            phoneNumber: userData.phoneNumber,
            tokensValidAfterTime: userData.tokensValidAfterTime,
            toJSON(): object {
                return {
                    uid: this.uid,
                    email: this.email,
                    displayName: this.displayName,
                    photoURL: this.photoURL,
                    emailVerified: this.emailVerified,
                    disabled: this.disabled,
                    metadata: this.metadata,
                    customClaims: this.customClaims,
                    providerData: this.providerData,
                    phoneNumber: this.phoneNumber,
                    tokensValidAfterTime: this.tokensValidAfterTime,
                };
            },
        } as UserRecord;
    }

    /**
     * Remove a user from the mock store
     */
    removeUser(uid: string): void {
        const user = this.users.get(uid);
        if (user) {
            if (user.email) {
                this.emailToUid.delete(user.email);
            }
            if (user.phoneNumber) {
                this.phoneToUid.delete(user.phoneNumber);
            }
            this.users.delete(uid);
        }
    }

    // ========================================================================
    // IAuthService Implementation
    // ========================================================================

    async createUser(userData: CreateRequest): Promise<UserRecord> {
        this.recordCall('createUser', [userData]);
        await this.simulateBehavior();

        // Check for duplicate email
        if (userData.email && this.emailToUid.has(userData.email)) {
            throw new ApiError(HTTP_STATUS.CONFLICT, AuthErrorCode.EMAIL_ALREADY_EXISTS, 'Email already exists');
        }

        const uid = this.generateUid();
        const mockUserData = this.createMockUserData({
            uid,
            email: userData.email,
            displayName: userData.displayName ?? undefined,
            photoURL: userData.photoURL ?? undefined,
            emailVerified: userData.emailVerified ?? false,
            disabled: userData.disabled ?? false,
            phoneNumber: userData.phoneNumber ?? undefined,
        });

        this.users.set(uid, mockUserData);
        if (userData.email) {
            this.emailToUid.set(userData.email, uid);
        }
        if (userData.phoneNumber) {
            this.phoneToUid.set(userData.phoneNumber, uid);
        }

        return this.toUserRecord(mockUserData);
    }

    async getUser(uid: string): Promise<UserRecord | null> {
        this.recordCall('getUser', [uid]);
        await this.simulateBehavior();

        const userData = this.users.get(uid);
        return userData ? this.toUserRecord(userData) : null;
    }

    async getUsers(uids: { uid: string }[]): Promise<GetUsersResult> {
        this.recordCall('getUsers', [uids]);
        await this.simulateBehavior();

        const users: UserRecord[] = [];
        const notFound: { uid: string }[] = [];

        for (const { uid } of uids) {
            const userData = this.users.get(uid);
            if (userData) {
                users.push(this.toUserRecord(userData));
            } else {
                notFound.push({ uid });
            }
        }

        return { users, notFound };
    }

    async updateUser(uid: string, updates: UpdateRequest): Promise<UserRecord> {
        this.recordCall('updateUser', [uid, updates]);
        await this.simulateBehavior();

        const existingUser = this.users.get(uid);
        if (!existingUser) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, AuthErrorCode.USER_NOT_FOUND, 'User not found');
        }

        // Handle email updates
        if (updates.email && updates.email !== existingUser.email) {
            if (this.emailToUid.has(updates.email)) {
                throw new ApiError(HTTP_STATUS.CONFLICT, AuthErrorCode.EMAIL_ALREADY_EXISTS, 'Email already exists');
            }
            if (existingUser.email) {
                this.emailToUid.delete(existingUser.email);
            }
            this.emailToUid.set(updates.email, uid);
        }

        // Handle phone number updates
        if (updates.phoneNumber !== undefined) {
            if (existingUser.phoneNumber) {
                this.phoneToUid.delete(existingUser.phoneNumber);
            }
            if (updates.phoneNumber) {
                this.phoneToUid.set(updates.phoneNumber, uid);
            }
        }

        // Normalize updates - convert null to undefined for compatibility
        const normalizedUpdates = {
            ...updates,
            displayName: updates.displayName === null ? undefined : updates.displayName,
            photoURL: updates.photoURL === null ? undefined : updates.photoURL,
            phoneNumber: updates.phoneNumber === null ? undefined : updates.phoneNumber,
        };

        const updatedUserData = this.createMockUserData({
            ...existingUser,
            ...normalizedUpdates,
            uid, // Ensure UID doesn't change
        });

        this.users.set(uid, updatedUserData);
        return this.toUserRecord(updatedUserData);
    }

    async deleteUser(uid: string): Promise<void> {
        this.recordCall('deleteUser', [uid]);
        await this.simulateBehavior();

        const user = this.users.get(uid);
        if (!user) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, AuthErrorCode.USER_NOT_FOUND, 'User not found');
        }

        this.removeUser(uid);
    }

    async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
        this.recordCall('verifyIdToken', [idToken]);
        await this.simulateBehavior();

        // Mock decoded token - you can configure this for specific test scenarios
        const mockToken: DecodedIdToken = {
            uid: 'mock-decoded-uid',
            aud: 'mock-project',
            iss: 'mock-issuer',
            auth_time: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
            sub: 'mock-decoded-uid',
            firebase: {
                identities: {},
                sign_in_provider: 'custom',
            },
        };

        return mockToken;
    }

    async createCustomToken(uid: string, additionalClaims?: object): Promise<string> {
        this.recordCall('createCustomToken', [uid, additionalClaims]);
        await this.simulateBehavior();

        // Check if user exists
        if (!this.users.has(uid)) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, AuthErrorCode.USER_NOT_FOUND, 'User not found');
        }

        return `mock-custom-token-${uid}-${Date.now()}`;
    }

    async getUserByEmail(email: string): Promise<UserRecord | null> {
        this.recordCall('getUserByEmail', [email]);
        await this.simulateBehavior();

        const uid = this.emailToUid.get(email);
        if (!uid) return null;
        const userData = this.users.get(uid);
        return userData ? this.toUserRecord(userData) : null;
    }

    async getUserByPhoneNumber(phoneNumber: string): Promise<UserRecord | null> {
        this.recordCall('getUserByPhoneNumber', [phoneNumber]);
        await this.simulateBehavior();

        const uid = this.phoneToUid.get(phoneNumber);
        if (!uid) return null;
        const userData = this.users.get(uid);
        return userData ? this.toUserRecord(userData) : null;
    }

    async listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult> {
        this.recordCall('listUsers', [maxResults, pageToken]);
        await this.simulateBehavior();

        const allUserData = Array.from(this.users.values());
        const limit = maxResults || 1000;
        const startIndex = pageToken ? parseInt(pageToken, 10) : 0;
        const endIndex = startIndex + limit;

        const userData = allUserData.slice(startIndex, endIndex);
        const users = userData.map((data) => this.toUserRecord(data));
        const nextPageToken = endIndex < allUserData.length ? endIndex.toString() : undefined;

        return {
            users,
            pageToken: nextPageToken,
        };
    }

    async deleteUsers(uids: string[]): Promise<DeleteUsersResult> {
        this.recordCall('deleteUsers', [uids]);
        await this.simulateBehavior();

        let successCount = 0;
        let failureCount = 0;
        const errors: Array<{ index: number; error: { code: string; message: string; toJSON(): object } }> = [];

        for (let i = 0; i < uids.length; i++) {
            const uid = uids[i];
            if (this.users.has(uid)) {
                this.removeUser(uid);
                successCount++;
            } else {
                failureCount++;
                errors.push({
                    index: i,
                    error: {
                        code: 'auth/user-not-found',
                        message: 'User not found',
                        toJSON(): object {
                            return { code: this.code, message: this.message };
                        },
                    },
                });
            }
        }

        return {
            successCount,
            failureCount,
            errors,
        };
    }

    async generatePasswordResetLink(email: string): Promise<string> {
        this.recordCall('generatePasswordResetLink', [email]);
        await this.simulateBehavior();

        return `https://mock-reset-link.com?email=${encodeURIComponent(email)}`;
    }

    async generateEmailVerificationLink(email: string): Promise<string> {
        this.recordCall('generateEmailVerificationLink', [email]);
        await this.simulateBehavior();

        return `https://mock-verification-link.com?email=${encodeURIComponent(email)}`;
    }

    async setCustomUserClaims(uid: string, customClaims: object): Promise<void> {
        this.recordCall('setCustomUserClaims', [uid, customClaims]);
        await this.simulateBehavior();

        const user = this.users.get(uid);
        if (!user) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, AuthErrorCode.USER_NOT_FOUND, 'User not found');
        }

        user.customClaims = { ...customClaims };
        this.users.set(uid, user);
    }

    async revokeRefreshTokens(uid: string): Promise<void> {
        this.recordCall('revokeRefreshTokens', [uid]);
        await this.simulateBehavior();

        const user = this.users.get(uid);
        if (!user) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, AuthErrorCode.USER_NOT_FOUND, 'User not found');
        }

        user.tokensValidAfterTime = new Date().toISOString();
        this.users.set(uid, user);
    }
}
