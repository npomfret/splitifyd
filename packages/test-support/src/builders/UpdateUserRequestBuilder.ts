import type { DisplayName, Email, Password, UpdateUserRequest } from '@billsplit-wl/shared';
import { toDisplayName, toEmail, toPassword } from '@billsplit-wl/shared';

/**
 * Builder for UpdateUserRequest objects used in user admin tests
 */
export class UpdateUserRequestBuilder {
    private request: UpdateUserRequest;

    constructor() {
        this.request = {};
    }

    static empty(): UpdateUserRequestBuilder {
        return new UpdateUserRequestBuilder();
    }

    withDisplayName(name: string | DisplayName): this {
        this.request.displayName = typeof name === 'string' ? toDisplayName(name) : name;
        return this;
    }

    withEmail(email: string | Email): this {
        this.request.email = typeof email === 'string' ? toEmail(email) : email;
        return this;
    }

    withPhoneNumber(phoneNumber: string | null): this {
        this.request.phoneNumber = phoneNumber;
        return this;
    }

    withPhotoURL(photoURL: string | null): this {
        this.request.photoURL = photoURL;
        return this;
    }

    withPassword(password: string | Password): this {
        this.request.password = typeof password === 'string' ? toPassword(password) : password;
        return this;
    }

    withDisabled(disabled: boolean): this {
        this.request.disabled = disabled;
        return this;
    }

    withEmailVerified(emailVerified: boolean): this {
        this.request.emailVerified = emailVerified;
        return this;
    }

    withPreferredLanguage(language: string): this {
        this.request.preferredLanguage = language;
        return this;
    }

    build(): UpdateUserRequest {
        return { ...this.request };
    }
}
