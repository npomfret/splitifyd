import { describe, expect, it } from 'vitest';
import { GroupsErrorManager } from '@/app/stores/helpers/groups-error-manager';
import { ApiError } from '@/app/apiClient';

describe('GroupsErrorManager', () => {
    it('categorises validation errors and exposes the validation message', () => {
        const manager = new GroupsErrorManager();
        const validationError = new ApiError('Name is required', 'VALIDATION_GROUP_NAME', undefined, {
            url: '/groups',
            method: 'POST',
            status: 400,
        });

        manager.handleApiError(validationError);

        expect(manager.validationError).toBe('Name is required');
        expect(manager.networkError).toBeNull();
        expect(manager.combinedError).toBe('Name is required');
    });

    it('categorises non-validation errors as network errors', () => {
        const manager = new GroupsErrorManager();
        const networkError = new ApiError('Server unavailable', 'E_HTTP_500', undefined, {
            url: '/groups',
            method: 'GET',
            status: 500,
        });

        manager.handleApiError(networkError);

        expect(manager.networkError).toBe('Server unavailable');
        expect(manager.validationError).toBeNull();
        expect(manager.combinedError).toBe('Server unavailable');
    });

    it('clears validation and network errors independently', () => {
        const manager = new GroupsErrorManager();

        manager.setValidationError('Validation failed');
        manager.setNetworkError('Network failed');
        manager.clearValidationError();

        expect(manager.validationError).toBeNull();
        expect(manager.networkError).toBe('Network failed');

        manager.clearAll();
        expect(manager.networkError).toBeNull();
        expect(manager.combinedError).toBeNull();
    });
});
