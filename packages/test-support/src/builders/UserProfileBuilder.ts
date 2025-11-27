import type { DisplayName, Email, ISOString, PolicyId, SystemUserRole, UserId, UserProfile, VersionHash } from '@billsplit-wl/shared';
import { SystemUserRoles, toDisplayName, toEmail, toUserId } from '@billsplit-wl/shared';
import { generateShortId, randomBoolean, randomChoice, randomString, randomUrl } from '../test-helpers';

/**
 * Builder for creating UserProfile objects for testing
 * Used for server-side internal operations that need full user profile data
 */
export class UserProfileBuilder {
    private user: UserProfile;

    constructor() {
        const randomId = generateShortId();
        this.user = {
            uid: toUserId(`user-${randomId}`),
            displayName: toDisplayName(`${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(4)}`),
            email: toEmail(`${randomString(6).toLowerCase()}@example.com`),
            photoURL: randomBoolean() ? randomUrl() : null,
            emailVerified: randomBoolean(),
            role: SystemUserRoles.SYSTEM_USER,
        };
    }

    withUid(uid: UserId | string): this {
        this.user.uid = typeof uid === 'string' ? toUserId(uid) : uid;
        return this;
    }

    withDisplayName(displayName: DisplayName | string): this {
        this.user.displayName = typeof displayName === 'string' ? toDisplayName(displayName) : displayName;
        return this;
    }

    withEmail(email: Email | string): this {
        this.user.email = typeof email === 'string' ? toEmail(email) : email;
        return this;
    }

    withPhotoURL(photoURL: string | null): this {
        this.user.photoURL = photoURL;
        return this;
    }

    withEmailVerified(verified: boolean): this {
        this.user.emailVerified = verified;
        return this;
    }

    withRole(role: SystemUserRole): this {
        this.user.role = role;
        return this;
    }

    withCreatedAt(createdAt: ISOString): this {
        this.user.createdAt = createdAt;
        return this;
    }

    withUpdatedAt(updatedAt: ISOString): this {
        this.user.updatedAt = updatedAt;
        return this;
    }

    withPreferredLanguage(language: string): this {
        this.user.preferredLanguage = language;
        return this;
    }

    withAcceptedPolicies(policies: Record<PolicyId, Record<VersionHash, ISOString>>): this {
        this.user.acceptedPolicies = policies;
        return this;
    }

    build(): UserProfile {
        // Filter out undefined values to ensure Firestore compatibility
        const user = { ...this.user };
        Object.keys(user).forEach(key => {
            if (user[key as keyof UserProfile] === undefined) {
                delete user[key as keyof UserProfile];
            }
        });
        return user;
    }

    static validUser(): UserProfileBuilder {
        return new UserProfileBuilder()
            .withEmailVerified(true);
    }
}
