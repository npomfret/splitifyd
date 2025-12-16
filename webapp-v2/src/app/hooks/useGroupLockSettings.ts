import { apiClient } from '@/app/apiClient.ts';
import { useSuccessMessage } from '@/app/hooks/useSuccessMessage.ts';
import { translateApiError } from '@/utils/error-translation';
import { GroupDTO } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { TFunction } from 'i18next';
import { useCallback, useEffect, useState } from 'preact/hooks';

interface UseGroupLockSettingsOptions {
    group: GroupDTO;
    isOpen: boolean;
    t: TFunction;
    onGroupUpdated?: () => Promise<void> | void;
}

interface UseGroupLockSettingsResult {
    locked: boolean;
    isSubmitting: boolean;
    error: string | null;
    successMessage: ReadonlySignal<string | null>;
    toggleLocked: () => Promise<void>;
    clearSuccessMessage: () => void;
}

export function useGroupLockSettings({
    group,
    isOpen,
    t,
    onGroupUpdated,
}: UseGroupLockSettingsOptions): UseGroupLockSettingsResult {
    const [lockedSignal] = useState(() => signal(false));
    const [isSubmittingSignal] = useState(() => signal(false));
    const [errorSignal] = useState(() => signal<string | null>(null));
    const successMessage = useSuccessMessage();

    // Sync with group state when modal opens or group changes
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        lockedSignal.value = group.locked;
        errorSignal.value = null;
    }, [isOpen, group.locked]);

    // Clear success message when modal closes
    useEffect(() => {
        if (!isOpen) {
            successMessage.clearMessage();
        }
    }, [isOpen, successMessage]);

    const toggleLocked = useCallback(async () => {
        const newLockedState = !lockedSignal.value;

        isSubmittingSignal.value = true;
        errorSignal.value = null;

        try {
            await apiClient.updateGroup(group.id, {
                locked: newLockedState,
            });

            lockedSignal.value = newLockedState;

            const messageKey = newLockedState
                ? 'group.locked.lockSuccess'
                : 'group.locked.unlockSuccess';
            successMessage.showSuccess(t(messageKey));

            await onGroupUpdated?.();
        } catch (error: unknown) {
            errorSignal.value = translateApiError(
                error,
                t,
                t('group.locked.toggleFailed')
            );
        } finally {
            isSubmittingSignal.value = false;
        }
    }, [group.id, t, onGroupUpdated, successMessage]);

    return {
        locked: lockedSignal.value,
        isSubmitting: isSubmittingSignal.value,
        error: errorSignal.value,
        successMessage: successMessage.message,
        toggleLocked,
        clearSuccessMessage: successMessage.clearMessage,
    };
}
