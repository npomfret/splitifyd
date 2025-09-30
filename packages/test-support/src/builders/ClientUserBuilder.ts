import type { ClientUser } from '@splitifyd/shared';
import { generateShortId, randomChoice } from '../test-helpers';

/**
 * Builder for creating ClientUser objects for tests
 * Used in unit tests, e2e tests, and anywhere ClientUser mock data is needed
 */
export class ClientUserBuilder {
    private user: ClientUser;

    constructor() {
        const randomId = generateShortId();
        this.user = {
            uid: `user-${randomId}`,
            email: `test-${randomId}@example.com`,
            displayName: `${randomChoice(['Test', 'Demo', 'Sample'])} ${randomChoice(['User', 'Person', 'Account'])}`,
            emailVerified: true,
            photoURL: null,
        };
    }

    withUid(uid: string): this {
        this.user.uid = uid;
        return this;
    }

    withEmail(email: string): this {
        this.user.email = email;
        return this;
    }

    withDisplayName(displayName: string): this {
        this.user.displayName = displayName;
        return this;
    }

    withEmailVerified(verified: boolean): this {
        this.user.emailVerified = verified;
        return this;
    }

    withPhotoURL(url: string | null): this {
        this.user.photoURL = url;
        return this;
    }

    build(): ClientUser {
        return { ...this.user };
    }

    static validUser(): ClientUserBuilder {
        return new ClientUserBuilder()
            .withEmailVerified(true);
    }

    static unverifiedUser(): ClientUserBuilder {
        return new ClientUserBuilder()
            .withEmailVerified(false);
    }

    static adminUser(): ClientUserBuilder {
        return new ClientUserBuilder()
            .withDisplayName('Admin User')
            .withEmailVerified(true);
    }

    /**
     * Creates a ClientUser from an existing TestUser
     * Useful for converting authentication test data to client user format
     */
    static fromTestUser(testUser: { email: string; displayName: string }, uid?: string): ClientUser {
        return new ClientUserBuilder()
            .withUid(uid || `user-${generateShortId()}`)
            .withEmail(testUser.email)
            .withDisplayName(testUser.displayName)
            .withEmailVerified(true)
            .build();
    }
}