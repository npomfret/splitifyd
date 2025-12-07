import { apiClient, ApiError } from '@/app/apiClient.ts';
import { useSuccessMessage } from '@/app/hooks/useSuccessMessage.ts';
import { translateApiError } from '@/utils/error-translation';
import { GroupId, GroupMember, toDisplayName } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { TFunction } from 'i18next';
import { useCallback, useEffect, useState } from 'preact/hooks';

interface UseGroupDisplayNameOptions {
    groupId: GroupId;
    members: GroupMember[];
    currentUserUid: string | undefined;
    isOpen: boolean;
    t: TFunction;
    onGroupUpdated?: () => Promise<void> | void;
}

interface UseGroupDisplayNameResult {
    displayName: string;
    initialDisplayName: string;
    validationError: string | null;
    serverError: string | null;
    successMessage: ReadonlySignal<string | null>;
    isSaving: boolean;
    isDirty: boolean;
    handleChange: (value: string) => void;
    handleSubmit: (event: Event) => Promise<void>;
}

export function useGroupDisplayName({
    groupId,
    members,
    currentUserUid,
    isOpen,
    t,
    onGroupUpdated,
}: UseGroupDisplayNameOptions): UseGroupDisplayNameResult {
    const [displayNameSignal] = useState(() => signal(''));
    const [initialDisplayNameSignal] = useState(() => signal(''));
    const [validationErrorSignal] = useState(() => signal<string | null>(null));
    const [serverErrorSignal] = useState(() => signal<string | null>(null));
    const [isSavingSignal] = useState(() => signal(false));
    const successMessage = useSuccessMessage();

    // Initialize display name when modal opens
    useEffect(() => {
        if (!isOpen || !currentUserUid) {
            return;
        }

        const member = members.find((m) => m.uid === currentUserUid);
        if (!member) {
            return;
        }

        const fallbackName = member.groupDisplayName.trim() || '';
        displayNameSignal.value = fallbackName;
        initialDisplayNameSignal.value = fallbackName;
        validationErrorSignal.value = null;
        serverErrorSignal.value = null;
    }, [isOpen, members, currentUserUid]);

    // Clear success message when modal closes
    useEffect(() => {
        if (!isOpen) {
            successMessage.clearMessage();
        }
    }, [isOpen, successMessage]);

    const handleChange = useCallback((value: string) => {
        displayNameSignal.value = value;
        if (validationErrorSignal.value) {
            validationErrorSignal.value = null;
        }
        if (serverErrorSignal.value) {
            serverErrorSignal.value = null;
        }
        successMessage.clearMessage();
    }, [successMessage]);

    const handleSubmit = useCallback(async (event: Event) => {
        event.preventDefault();

        const trimmedName = displayNameSignal.value.trim();

        if (!trimmedName) {
            validationErrorSignal.value = t('groupDisplayNameSettings.errors.required');
            return;
        }

        if (trimmedName.length > 50) {
            validationErrorSignal.value = t('groupDisplayNameSettings.errors.tooLong');
            return;
        }

        if (trimmedName === initialDisplayNameSignal.value) {
            validationErrorSignal.value = t('groupDisplayNameSettings.errors.notChanged');
            return;
        }

        isSavingSignal.value = true;
        validationErrorSignal.value = null;
        serverErrorSignal.value = null;
        successMessage.clearMessage();

        try {
            await apiClient.updateGroupMemberDisplayName(groupId, toDisplayName(trimmedName));
            // Activity feed handles refresh automatically via SSE
            await onGroupUpdated?.();

            initialDisplayNameSignal.value = trimmedName;
            successMessage.showSuccess(t('groupDisplayNameSettings.success'));
        } catch (error: unknown) {
            if (error instanceof ApiError && error.code === 'DISPLAY_NAME_TAKEN') {
                serverErrorSignal.value = t('groupDisplayNameSettings.errors.taken');
            } else {
                serverErrorSignal.value = translateApiError(error, t, t('groupDisplayNameSettings.errors.unknown'));
            }
        } finally {
            isSavingSignal.value = false;
        }
    }, [groupId, t, onGroupUpdated, successMessage]);

    return {
        displayName: displayNameSignal.value,
        initialDisplayName: initialDisplayNameSignal.value,
        validationError: validationErrorSignal.value,
        serverError: serverErrorSignal.value,
        successMessage: successMessage.message,
        isSaving: isSavingSignal.value,
        isDirty: displayNameSignal.value.trim() !== initialDisplayNameSignal.value,
        handleChange,
        handleSubmit,
    };
}
