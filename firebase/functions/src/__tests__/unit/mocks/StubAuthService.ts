import type { Email, UserId } from '@billsplit-wl/shared';
import type { CreateRequest, DecodedIdToken, UpdateRequest, UserRecord } from 'firebase-admin/auth';
import { ErrorDetail, Errors } from '../../../errors';
import type { EmailChangeEmailContext, EmailVerificationEmailContext, IAuthService, PasswordResetEmailContext, WelcomeEmailContext } from '../../../services/auth';

/**
 * In-memory stub implementation of IAuthService for unit testing
 * Provides predictable behavior for testing user authentication operations
 */
export class StubAuthService implements IAuthService {
    private users = new Map<string, UserRecord>();
    private customTokens = new Map<string, string>();
    private decodedTokens = new Map<string, DecodedIdToken>();
    private deletedUsers = new Set<string>();
    private passwords = new Map<string, string>();

    // Helper methods to set up test data
    setUser(uid: string, user: Partial<UserRecord> & { uid: string; }, options: { password?: string; } = {}) {
        const fullUser: UserRecord = {
            uid,
            email: user.email,
            emailVerified: user.emailVerified ?? false,
            displayName: user.displayName,
            photoURL: user.photoURL,
            phoneNumber: user.phoneNumber,
            disabled: user.disabled ?? false,
            metadata: user.metadata ?? {
                creationTime: new Date().toISOString(),
                lastSignInTime: new Date().toISOString(),
                lastRefreshTime: new Date().toISOString(),
                toJSON: () => ({}),
            },
            customClaims: user.customClaims ?? {},
            providerData: user.providerData ?? [],
            tenantId: user.tenantId,
            tokensValidAfterTime: user.tokensValidAfterTime,
            toJSON: () => ({}),
        };

        this.users.set(uid, fullUser);

        if (options.password) {
            this.passwords.set(uid, options.password);
        } else if (!this.passwords.has(uid)) {
            // Default password used by many unit tests
            this.passwords.set(uid, 'ValidPass123!');
        }
    }

    setDecodedToken(token: string, decoded: DecodedIdToken) {
        this.decodedTokens.set(token, decoded);
    }

    markUserAsDeleted(uid: string) {
        this.deletedUsers.add(uid);
        this.users.delete(uid);
        this.passwords.delete(uid);
    }

    // Clear all test data
    clear() {
        this.users.clear();
        this.customTokens.clear();
        this.decodedTokens.clear();
        this.deletedUsers.clear();
        this.passwords.clear();
    }

    // IAuthService implementation
    async createUser(userData: CreateRequest): Promise<UserRecord> {
        const uid = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Check for duplicate email
        if (userData.email) {
            const existingUser = Array.from(this.users.values()).find((u) => u.email === userData.email);
            if (existingUser && !this.deletedUsers.has(existingUser.uid)) {
                throw Errors.alreadyExists('Email', ErrorDetail.EMAIL_ALREADY_EXISTS);
            }
        }

        const user: UserRecord = {
            uid,
            email: userData.email ?? undefined,
            emailVerified: userData.emailVerified ?? false,
            displayName: userData.displayName ?? undefined,
            photoURL: userData.photoURL ?? undefined,
            phoneNumber: userData.phoneNumber ?? undefined,
            disabled: userData.disabled ?? false,
            metadata: {
                creationTime: new Date().toISOString(),
                lastSignInTime: new Date().toISOString(),
                lastRefreshTime: new Date().toISOString(),
                toJSON: () => ({}),
            },
            customClaims: {},
            providerData: [],
            tenantId: undefined,
            tokensValidAfterTime: new Date().toISOString(),
            toJSON: () => ({}),
        };

        this.setUser(uid, user, { password: userData.password });
        return user;
    }

    async getUser(uid: UserId): Promise<UserRecord | null> {
        if (this.deletedUsers.has(uid)) {
            throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND, uid);
        }
        return this.users.get(uid) || null;
    }

    async getUserByEmail(email: Email): Promise<UserRecord | null> {
        const user = Array.from(this.users.values()).find((u) => u.email === email && !this.deletedUsers.has(u.uid));
        return user ?? null;
    }

    async updateUser(uid: string, updates: UpdateRequest): Promise<UserRecord> {
        const existingUser = this.users.get(uid);
        if (!existingUser || this.deletedUsers.has(uid)) {
            throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND, uid);
        }

        // Check for email conflicts if updating email
        if (updates.email && updates.email !== existingUser.email) {
            const conflictingUser = Array.from(this.users.values()).find((u) => u.email === updates.email);
            if (conflictingUser && !this.deletedUsers.has(conflictingUser.uid)) {
                throw Errors.alreadyExists('Email', ErrorDetail.EMAIL_ALREADY_EXISTS);
            }
        }

        const updatedUser: UserRecord = {
            ...existingUser,
            email: updates.email ?? existingUser.email,
            emailVerified: updates.emailVerified ?? existingUser.emailVerified,
            displayName: updates.displayName ?? existingUser.displayName,
            photoURL: updates.photoURL === null ? undefined : (updates.photoURL ?? existingUser.photoURL),
            phoneNumber: updates.phoneNumber ?? existingUser.phoneNumber,
            disabled: updates.disabled ?? existingUser.disabled,
            metadata: {
                ...existingUser.metadata,
                lastRefreshTime: new Date().toISOString(),
                toJSON: () => ({}),
            },
            toJSON: () => ({}),
        };

        this.setUser(uid, updatedUser, { password: updates.password });
        return updatedUser;
    }

    async deleteUser(uid: string): Promise<void> {
        const user = this.users.get(uid);
        if (!user || this.deletedUsers.has(uid)) {
            throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND, uid);
        }
        this.markUserAsDeleted(uid);
    }

    async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
        const decoded = this.decodedTokens.get(idToken);
        if (!decoded) {
            throw Errors.authInvalid(ErrorDetail.TOKEN_INVALID);
        }
        return decoded;
    }

    async createCustomToken(uid: string, additionalClaims?: object): Promise<string> {
        const user = this.users.get(uid);
        if (!user || this.deletedUsers.has(uid)) {
            throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND, uid);
        }

        const token = `custom-token-${uid}-${Date.now()}`;
        this.customTokens.set(uid, token);

        return token;
    }

    async verifyPassword(email: Email, password: string): Promise<boolean> {
        const user = Array.from(this.users.values()).find((u) => u.email === email);
        if (!user || this.deletedUsers.has(user.uid)) {
            return false;
        }

        const storedPassword = this.passwords.get(user.uid);
        if (!storedPassword) {
            return false;
        }

        return storedPassword === password;
    }

    async sendPasswordResetEmail(_email: Email, _context: PasswordResetEmailContext): Promise<void> {
        // Stub implementation - always succeeds silently (like the real implementation)
        // In a real scenario, this would send an email, but for testing we just return
    }

    async sendWelcomeEmail(_email: Email, _context: WelcomeEmailContext): Promise<void> {
        // Stub implementation - always succeeds silently (like the real implementation)
        // In a real scenario, this would send an email, but for testing we just return
    }

    async sendEmailVerification(_email: Email, _context: EmailVerificationEmailContext): Promise<void> {
        // Stub implementation - always succeeds silently (like the real implementation)
        // In a real scenario, this would send an email, but for testing we just return
    }

    async sendEmailChangeVerification(_currentEmail: Email, _context: EmailChangeEmailContext): Promise<void> {
        // Stub implementation - always succeeds silently (like the real implementation)
        // In a real scenario, this would send an email, but for testing we just return
    }
}
