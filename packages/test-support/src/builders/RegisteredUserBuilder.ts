import type { RegisteredUser } from '@splitifyd/shared';
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
        email: `${randomString(6).toLowerCase()}@example.com`,
        photoURL: randomBoolean() ? randomUrl() : null,
        emailVerified: randomBoolean(),
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

    withEmail(email: string): RegisteredUserBuilder {
        this.user.email = email;
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

    withPreferredLanguage(language: string): RegisteredUserBuilder {
        this.user.preferredLanguage = language;
        return this;
    }

    build(): RegisteredUser {
        return { ...this.user };
    }
}
