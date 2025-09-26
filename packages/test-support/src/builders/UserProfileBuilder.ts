import { randomString, randomBoolean, randomChoice, randomEmail, randomUrl, generateShortId } from '../test-helpers';
import type { RegisteredUser } from '@splitifyd/shared';

/**
 * Builder for creating RegisteredUser objects for testing
 * Used for creating mock user data in balance calculation and other tests
 */
export class UserProfileBuilder {
    private user: RegisteredUser = {
        uid: `user-${generateShortId()}`,
        displayName: `${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(4)}`,
        email: randomEmail(),
        photoURL: randomBoolean() ? randomUrl() : null,
        emailVerified: randomBoolean(),
        themeColor: {
            light: randomChoice(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']),
            dark: randomChoice(['#1E3A8A', '#065F46', '#1F2937', '#7C2D12', '#831843', '#581C87']),
            name: randomChoice(['Red', 'Teal', 'Blue', 'Green', 'Yellow', 'Purple']),
            pattern: randomChoice(['solid', 'dots', 'stripes', 'diagonal']),
            assignedAt: new Date().toISOString(),
            colorIndex: Math.floor(Math.random() * 10)
        },
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

    withThemeColor(themeColor: any): UserProfileBuilder {
        this.user.themeColor = themeColor;
        return this;
    }

    withPreferredLanguage(language: string): UserProfileBuilder {
        this.user.preferredLanguage = language;
        return this;
    }

    build(): RegisteredUser {
        return { ...this.user };
    }
}
