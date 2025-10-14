import type { PasswordChangeRequest } from '@splitifyd/shared';

/**
 * Builder for creating password change request objects for testing
 * Used for testing password change operations
 */
export class PasswordChangeRequestBuilder {
    private changeData: Partial<PasswordChangeRequest> = {};

    withCurrentPassword(currentPassword: string): PasswordChangeRequestBuilder {
        this.changeData.currentPassword = currentPassword;
        return this;
    }

    withNewPassword(newPassword: string): PasswordChangeRequestBuilder {
        this.changeData.newPassword = newPassword;
        return this;
    }

    build(): Partial<PasswordChangeRequest> {
        return { ...this.changeData };
    }
}
