import type { UpdateUserRequest } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import type { Email } from '@splitifyd/shared';
import { Password, toPassword } from '@splitifyd/shared';
import { toDisplayName } from '@splitifyd/shared';

/**
 * Builder for creating user update request objects for testing
 * Used for testing user profile update operations
 */
export class UserUpdateBuilder {
    private updateData: Partial<UpdateUserRequest> = {};

    withDisplayName(displayName: DisplayName | string): UserUpdateBuilder {
        this.updateData.displayName = typeof displayName === 'string' ? toDisplayName(displayName) : displayName;
        return this;
    }

    withEmail(email: Email): UserUpdateBuilder {
        this.updateData.email = email;
        return this;
    }

    withPhoneNumber(phoneNumber: string | null): UserUpdateBuilder {
        this.updateData.phoneNumber = phoneNumber;
        return this;
    }

    withPhotoURL(photoURL: string | null): UserUpdateBuilder {
        this.updateData.photoURL = photoURL;
        return this;
    }

    withPassword(password: string | Password): UserUpdateBuilder {
        this.updateData.password = typeof password === 'string' ? toPassword(password) : password;
        return this;
    }

    withEmailVerified(emailVerified: boolean): UserUpdateBuilder {
        this.updateData.emailVerified = emailVerified;
        return this;
    }

    withDisabled(disabled: boolean): UserUpdateBuilder {
        this.updateData.disabled = disabled;
        return this;
    }

    withPreferredLanguage(language: string): UserUpdateBuilder {
        this.updateData.preferredLanguage = language;
        return this;
    }

    build(): Partial<UpdateUserRequest> {
        return { ...this.updateData };
    }
}
