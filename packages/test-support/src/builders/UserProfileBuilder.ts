import { randomString, randomBoolean, randomChoice, randomEmail, randomUrl, generateShortId } from '../test-helpers';

// Import UserProfile from the functions package - this is the source of truth
type UserProfile = {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    emailVerified: boolean;
    themeColor?: string;
    preferredLanguage?: string;
    createdAt?: any; // Using any to avoid firebase-admin dependency
    updatedAt?: any; // Using any to avoid firebase-admin dependency
};

/**
 * Builder for creating UserProfile objects for testing
 * Used for creating mock user data in balance calculation and other tests
 */
export class UserProfileBuilder {
    private user: UserProfile = {
        uid: `user-${generateShortId()}`,
        displayName: `${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(4)}`,
        email: randomEmail(),
        photoURL: randomBoolean() ? randomUrl() : null,
        emailVerified: randomBoolean(),
        themeColor: randomChoice(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']),
        preferredLanguage: randomChoice(['en', 'es', 'fr', 'de', 'it', 'pt']),
    };

    withUid(uid: string): UserProfileBuilder {
        this.user.uid = uid;
        return this;
    }

    withDisplayName(name: string): UserProfileBuilder {
        this.user.displayName = name;
        return this;
    }

    withEmail(email: string): UserProfileBuilder {
        this.user.email = email;
        return this;
    }

    withPhotoURL(photoURL: string | null): UserProfileBuilder {
        this.user.photoURL = photoURL;
        return this;
    }

    withEmailVerified(verified: boolean): UserProfileBuilder {
        this.user.emailVerified = verified;
        return this;
    }

    withThemeColor(color: string): UserProfileBuilder {
        this.user.themeColor = color;
        return this;
    }

    withPreferredLanguage(language: string): UserProfileBuilder {
        this.user.preferredLanguage = language;
        return this;
    }

    build(): UserProfile {
        return { ...this.user };
    }
}
