import { type Password, type PasswordChangeRequest, toPassword } from '@splitifyd/shared';

/**
 * Builder for creating password change request objects for testing
 * Used for testing password change operations
 */
export class PasswordChangeRequestBuilder {
    private changeData: Partial<PasswordChangeRequest> = {};

    withCurrentPassword(currentPassword: Password | string): PasswordChangeRequestBuilder {
        this.changeData.currentPassword = typeof currentPassword === 'string' ? toPassword(currentPassword) : currentPassword;
        return this;
    }

    withNewPassword(newPassword: Password | string): PasswordChangeRequestBuilder {
        this.changeData.newPassword = typeof newPassword === 'string' ? toPassword(newPassword) : newPassword;
        return this;
    }

    build(): PasswordChangeRequest {
        return { ...this.changeData } as PasswordChangeRequest;
    }
}
