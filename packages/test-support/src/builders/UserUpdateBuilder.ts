/**
 * Builder for creating user update request objects for testing
 * Used for testing user profile update operations
 */
export class UserUpdateBuilder {
    private updateData: {
        displayName?: string;
        email?: string;
        phoneNumber?: string | null;
        photoURL?: string | null;
        password?: string;
        emailVerified?: boolean;
        disabled?: boolean;
        preferredLanguage?: string;
    } = {};

    withDisplayName(displayName: string): UserUpdateBuilder {
        this.updateData.displayName = displayName;
        return this;
    }

    withEmail(email: string): UserUpdateBuilder {
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

    withPassword(password: string): UserUpdateBuilder {
        this.updateData.password = password;
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

    build(): {
        displayName?: string;
        email?: string;
        phoneNumber?: string | null;
        photoURL?: string | null;
        password?: string;
        emailVerified?: boolean;
        disabled?: boolean;
        preferredLanguage?: string;
    } {
        return { ...this.updateData };
    }
}
