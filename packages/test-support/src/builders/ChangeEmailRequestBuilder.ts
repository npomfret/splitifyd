import type { ChangeEmailRequest, Email, Password } from '@billsplit-wl/shared';
import { toEmail, toPassword } from '@billsplit-wl/shared';

/**
 * Builder for ChangeEmailRequest objects used in email change tests.
 */
export class ChangeEmailRequestBuilder {
    private request: ChangeEmailRequest;

    constructor() {
        this.request = {
            currentPassword: toPassword('default-password'),
            newEmail: toEmail('new@example.com'),
        };
    }

    withCurrentPassword(password: string | Password): this {
        this.request.currentPassword = typeof password === 'string' ? toPassword(password) : password;
        return this;
    }

    withNewEmail(email: string | Email): this {
        this.request.newEmail = typeof email === 'string' ? toEmail(email) : email;
        return this;
    }

    build(): ChangeEmailRequest {
        return { ...this.request };
    }
}
