import { SystemUserRoles, type ClientUser, type SystemUserRole } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import type { Email } from '@splitifyd/shared';
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
            role: SystemUserRoles.SYSTEM_USER,
        };
    }

    withUid(uid: string): this {
        this.user.uid = uid;
        return this;
    }

    withEmail(email: Email): this {
        this.user.email = email;
        return this;
    }

    withDisplayName(displayName: DisplayName): this {
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

    withRole(role: SystemUserRole): this {
        this.user.role = role;
        return this;
    }

    build(): ClientUser {
        return { ...this.user };
    }

    static validUser(): ClientUserBuilder {
        return new ClientUserBuilder()
            .withEmailVerified(true);
    }
}
