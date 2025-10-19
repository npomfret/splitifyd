import type { RegisteredUser, UserThemeColor } from '@splitifyd/shared';
import { generateShortId, randomBoolean, randomChoice, randomString, randomUrl } from '../test-helpers';

/**
 * Builder for creating RegisteredUser objects for testing
 * Used for creating mock user data in balance calculation and other tests
 *
 * Note: photoURL is managed by Firebase Auth and is NOT stored in Firestore.
 * It is included in the RegisteredUser type for completeness when reading from Auth,
 * but should be excluded when seeding Firestore test data.
 */
export class RegisteredUserBuilder {
    private user: RegisteredUser = {
        uid: `user-${generateShortId()}`,
        displayName: `${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(4)}`,
        photoURL: randomBoolean() ? randomUrl() : null,
        emailVerified: randomBoolean(),
        themeColor: {
            light: randomChoice(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']),
            dark: randomChoice(['#1E3A8A', '#065F46', '#1F2937', '#7C2D12', '#831843', '#581C87']),
            name: randomChoice(['Red', 'Teal', 'Blue', 'Green', 'Yellow', 'Purple']),
            pattern: randomChoice(['solid', 'dots', 'stripes', 'diagonal']),
            assignedAt: new Date().toISOString(),
            colorIndex: Math.floor(Math.random() * 10),
        },
        preferredLanguage: randomChoice(['en', 'es', 'fr', 'de', 'it', 'pt']),
    };

    withUid(uid: string): RegisteredUserBuilder {
        this.user.uid = uid;
        return this;
    }

    withDisplayName(name: string): RegisteredUserBuilder {
        this.user.displayName = name;
        return this;
    }

    /**
     * Sets photoURL for the user.
     * NOTE: When seeding Firestore data, destructure to exclude photoURL:
     * const { uid, emailVerified, photoURL, ...firestoreUser } = builder.build();
     */
    withPhotoURL(photoURL: string | null): RegisteredUserBuilder {
        this.user.photoURL = photoURL;
        return this;
    }

    withEmailVerified(verified: boolean): RegisteredUserBuilder {
        this.user.emailVerified = verified;
        return this;
    }

    withThemeColor(themeColor: UserThemeColor): RegisteredUserBuilder {
        this.user.themeColor = themeColor;
        return this;
    }

    withPreferredLanguage(language: string): RegisteredUserBuilder {
        this.user.preferredLanguage = language;
        return this;
    }

    build(): RegisteredUser {
        return { ...this.user };
    }
}
