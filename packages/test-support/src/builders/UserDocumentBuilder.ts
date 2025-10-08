import { SystemUserRoles, USER_COLORS, UserThemeColor } from '@splitifyd/shared';
import { Timestamp } from 'firebase-admin/firestore';
import { generateShortId } from '../test-helpers';

// Define UserDocument interface to match the firebase functions schema
// This avoids circular dependency while matching the expected structure
interface UserDocument {
    id: string;
    email?: string;
    displayName?: string;
    role?: typeof SystemUserRoles.SYSTEM_USER | typeof SystemUserRoles.SYSTEM_ADMIN;
    themeColor?: string | UserThemeColor;
    preferredLanguage?: string;
    photoURL?: string | null;
    acceptedPolicies?: Record<string, string>;
    termsAcceptedAt?: Timestamp;
    cookiePolicyAcceptedAt?: Timestamp;
    passwordChangedAt?: Timestamp;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

/**
 * Builder for UserDocument - Firestore user document structure
 * Used for testing server-side user document operations
 */
export class UserDocumentBuilder {
    private userDoc: UserDocument;

    constructor(uid?: string) {
        // Default user document with sensible defaults
        this.userDoc = {
            id: uid || `user-${generateShortId()}`,
            email: `user-${generateShortId()}@example.com`,
            displayName: `User ${generateShortId()}`,
            role: SystemUserRoles.SYSTEM_USER,
            themeColor: {
                light: USER_COLORS[0].light,
                dark: USER_COLORS[0].dark,
                name: USER_COLORS[0].name,
                pattern: 'solid',
                assignedAt: new Date().toISOString(),
                colorIndex: 0,
            },
            preferredLanguage: 'en',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            acceptedPolicies: {},
        };
    }

    withId(id: string): this {
        this.userDoc.id = id;
        return this;
    }

    withEmail(email: string): this {
        this.userDoc.email = email;
        return this;
    }

    withDisplayName(displayName: string): this {
        this.userDoc.displayName = displayName;
        return this;
    }

    withRole(role: typeof SystemUserRoles.SYSTEM_USER | typeof SystemUserRoles.SYSTEM_ADMIN): this {
        this.userDoc.role = role;
        return this;
    }

    withThemeColor(themeColor: string | UserThemeColor): this {
        this.userDoc.themeColor = themeColor;
        return this;
    }

    withPreferredLanguage(language: string): this {
        this.userDoc.preferredLanguage = language;
        return this;
    }

    withPhotoURL(photoURL: string | null): this {
        this.userDoc.photoURL = photoURL;
        return this;
    }

    withAcceptedPolicies(policies: Record<string, string>): this {
        this.userDoc.acceptedPolicies = policies;
        return this;
    }

    withTermsAcceptedAt(timestamp: Timestamp): this {
        this.userDoc.termsAcceptedAt = timestamp;
        return this;
    }

    withCookiePolicyAcceptedAt(timestamp: Timestamp): this {
        this.userDoc.cookiePolicyAcceptedAt = timestamp;
        return this;
    }

    withPasswordChangedAt(timestamp: Timestamp): this {
        this.userDoc.passwordChangedAt = timestamp;
        return this;
    }

    withCreatedAt(timestamp: Timestamp): this {
        this.userDoc.createdAt = timestamp;
        return this;
    }

    withUpdatedAt(timestamp: Timestamp): this {
        this.userDoc.updatedAt = timestamp;
        return this;
    }

    asSystemUser(): this {
        this.userDoc.role = SystemUserRoles.SYSTEM_USER;
        return this;
    }

    asAdminUser(): this {
        this.userDoc.role = SystemUserRoles.SYSTEM_ADMIN;
        return this;
    }

    build(): UserDocument {
        return { ...this.userDoc };
    }
}
