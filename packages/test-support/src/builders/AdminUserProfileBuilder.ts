import type { AdminUserProfile, DisplayName, ISOString, PolicyId, SystemUserRole, TenantId, UserId, VersionHash } from '@billsplit-wl/shared';
import { SystemUserRoles, toDisplayName, toTenantId, toUserId } from '@billsplit-wl/shared';
import { generateShortId, randomBoolean, randomChoice, randomString, randomUrl } from '../test-helpers';

/**
 * Builder for creating AdminUserProfile objects for testing
 * Used for admin endpoints that return full user data including Firebase Auth metadata
 *
 * Note: Email is intentionally excluded from AdminUserProfile for privacy.
 */
export class AdminUserProfileBuilder {
    private user: AdminUserProfile;

    constructor() {
        const randomId = generateShortId();
        const now = new Date().toISOString();
        this.user = {
            uid: toUserId(`user-${randomId}`),
            displayName: toDisplayName(`${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(4)}`),
            photoURL: randomBoolean() ? randomUrl() : null,
            emailVerified: randomBoolean(),
            role: SystemUserRoles.SYSTEM_USER,
            disabled: false,
            metadata: {
                creationTime: now,
                lastSignInTime: now,
            },
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

    withSignupTenantId(tenantId: TenantId | string): this {
        this.user.signupTenantId = typeof tenantId === 'string' ? toTenantId(tenantId) : tenantId;
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

    withDisabled(disabled: boolean): this {
        this.user.disabled = disabled;
        return this;
    }

    withMetadata(metadata: { creationTime: string; lastSignInTime?: string; }): this {
        this.user.metadata = metadata;
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

    build(): AdminUserProfile {
        // Filter out undefined values to ensure Firestore compatibility
        const user = { ...this.user };
        Object.keys(user).forEach(key => {
            if (user[key as keyof AdminUserProfile] === undefined) {
                delete user[key as keyof AdminUserProfile];
            }
        });
        return user;
    }

    static validUser(): AdminUserProfileBuilder {
        return new AdminUserProfileBuilder()
            .withEmailVerified(true)
            .withDisabled(false);
    }

    static systemAdmin(): AdminUserProfileBuilder {
        return new AdminUserProfileBuilder()
            .withEmailVerified(true)
            .withDisabled(false)
            .withRole(SystemUserRoles.SYSTEM_ADMIN);
    }

    static tenantAdmin(): AdminUserProfileBuilder {
        return new AdminUserProfileBuilder()
            .withEmailVerified(true)
            .withDisabled(false)
            .withRole(SystemUserRoles.TENANT_ADMIN);
    }
}
