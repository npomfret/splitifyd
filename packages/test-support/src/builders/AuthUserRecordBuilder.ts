import type { UserRecord } from 'firebase-admin/auth';
import { generateShortId } from '../test-helpers';

/**
 * Builder for creating Firebase Auth UserRecord objects for testing
 * Used for setting up StubAuthService with properly typed user records
 */
export class AuthUserRecordBuilder {
    private data: {
        uid: string;
        email?: string;
        emailVerified: boolean;
        displayName?: string;
        photoURL?: string | undefined;
        phoneNumber?: string | undefined;
        disabled: boolean;
        customClaims: object;
        tenantId?: string | undefined;
        tokensValidAfterTime?: string | undefined;
    };

    constructor() {
        const userId = `user-${generateShortId()}`;
        this.data = {
            uid: userId,
            email: `${userId}@test.com`,
            emailVerified: true,
            displayName: `Test User ${userId.slice(-4)}`,
            photoURL: undefined,
            phoneNumber: undefined,
            disabled: false,
            customClaims: {},
            tenantId: undefined,
            tokensValidAfterTime: undefined,
        };
    }

    withUid(uid: string): AuthUserRecordBuilder {
        this.data.uid = uid;
        return this;
    }

    withEmail(email: string): AuthUserRecordBuilder {
        this.data.email = email;
        return this;
    }

    withDisplayName(displayName: string): AuthUserRecordBuilder {
        this.data.displayName = displayName;
        return this;
    }

    withEmailVerified(verified: boolean): AuthUserRecordBuilder {
        this.data.emailVerified = verified;
        return this;
    }

    withPhotoURL(photoURL: string | undefined): AuthUserRecordBuilder {
        this.data.photoURL = photoURL;
        return this;
    }

    withPhoneNumber(phoneNumber: string | undefined): AuthUserRecordBuilder {
        this.data.phoneNumber = phoneNumber;
        return this;
    }

    withDisabled(disabled: boolean): AuthUserRecordBuilder {
        this.data.disabled = disabled;
        return this;
    }

    withCustomClaims(claims: object): AuthUserRecordBuilder {
        this.data.customClaims = claims;
        return this;
    }

    withTenantId(tenantId: string): AuthUserRecordBuilder {
        this.data.tenantId = tenantId;
        return this;
    }

    build(): UserRecord {
        return {
            uid: this.data.uid,
            email: this.data.email,
            emailVerified: this.data.emailVerified,
            displayName: this.data.displayName,
            photoURL: this.data.photoURL,
            phoneNumber: this.data.phoneNumber,
            disabled: this.data.disabled,
            metadata: {
                creationTime: new Date().toISOString(),
                lastSignInTime: new Date().toISOString(),
                lastRefreshTime: new Date().toISOString(),
                toJSON: () => ({}),
            },
            customClaims: { ...this.data.customClaims },
            providerData: [],
            tenantId: this.data.tenantId,
            tokensValidAfterTime: this.data.tokensValidAfterTime,
            toJSON: () => ({}),
        } as UserRecord;
    }
}