import { type ClientUser, type SystemUserRole, SystemUserRoles } from '@billsplit-wl/shared';
import { DisplayName } from '@billsplit-wl/shared';
import type { Email, UserId } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { generateShortId, randomChoice } from '../test-helpers';
import {toEmail, toUserId} from "@billsplit-wl/shared";

/**
 * Builder for creating ClientUser objects for tests
 * Used in unit tests, e2e tests, and anywhere ClientUser mock data is needed
 */
export class ClientUserBuilder {
    private user: ClientUser;

    constructor() {
        const randomId = generateShortId();
        this.user = {
            uid: toUserId(`user-${randomId}`),
            email: toEmail(`test-${randomId}@example.com`),
            displayName: toDisplayName(`${randomChoice(['Test', 'Demo', 'Sample'])} ${randomChoice(['User', 'Person', 'Account'])}`),
            emailVerified: true,
            photoURL: null,
            role: SystemUserRoles.SYSTEM_USER,
        };
    }

    withUid(uid: UserId | string): this {
        this.user.uid = typeof uid === 'string' ? toUserId(uid) : uid;
        return this;
    }

    withEmail(email: Email | string): this {
        this.user.email = typeof email === 'string' ? toEmail(email) : email;
        return this;
    }

    withDisplayName(displayName: DisplayName | string): this {
        this.user.displayName = typeof displayName === 'string' ? toDisplayName(displayName) : displayName;
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
        // Filter out undefined values to ensure Firestore compatibility
        const user = { ...this.user };
        Object.keys(user).forEach(key => {
            if (user[key as keyof ClientUser] === undefined) {
                delete user[key as keyof ClientUser];
            }
        });
        return user;
    }

    static validUser(): ClientUserBuilder {
        return new ClientUserBuilder()
            .withEmailVerified(true);
    }
}
