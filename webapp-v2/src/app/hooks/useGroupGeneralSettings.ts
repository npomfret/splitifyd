import { apiClient } from '@/app/apiClient.ts';
import { useSuccessMessage } from '@/app/hooks/useSuccessMessage.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { logError } from '@/utils/browser-logger.ts';
import { translateApiError } from '@/utils/error-translation';
import { GroupDTO, toGroupName } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { TFunction } from 'i18next';
import { useCallback, useEffect, useState } from 'preact/hooks';

interface UseGroupGeneralSettingsOptions {
    group: GroupDTO;
    isOpen: boolean;
    canManageGeneralSettings: boolean;
    t: TFunction;
    onGroupUpdated?: () => Promise<void> | void;
    onClose: () => void;
    onDelete?: () => void;
}

interface DeleteState {
    showConfirm: boolean;
    error: string | null;
    confirmationText: string;
    isDeleting: boolean;
}

interface UseGroupGeneralSettingsResult {
    groupName: string;
    groupDescription: string;
    isSubmitting: boolean;
    validationError: string | null;
    successMessage: ReadonlySignal<string | null>;
    hasChanges: boolean;
    isFormValid: boolean;
    deleteState: DeleteState;
    setGroupName: (value: string) => void;
    setGroupDescription: (value: string) => void;
    handleSubmit: (event: Event) => Promise<void>;
    handleDeleteClick: () => void;
    handleDeleteConfirm: () => Promise<void>;
    handleDeleteCancel: () => void;
    setConfirmationText: (value: string) => void;
    clearSuccessMessage: () => void;
}

export function useGroupGeneralSettings({
    group,
    isOpen,
    canManageGeneralSettings,
    t,
    onGroupUpdated,
    onClose,
    onDelete,
}: UseGroupGeneralSettingsOptions): UseGroupGeneralSettingsResult {
    const [groupNameSignal] = useState(() => signal(''));
    const [groupDescriptionSignal] = useState(() => signal(''));
    const [initialNameSignal] = useState(() => signal(''));
    const [initialDescriptionSignal] = useState(() => signal(''));
    const [isSubmittingSignal] = useState(() => signal(false));
    const [validationErrorSignal] = useState(() => signal<string | null>(null));
    const [showDeleteConfirmSignal] = useState(() => signal(false));
    const [deleteErrorSignal] = useState(() => signal<string | null>(null));
    const [confirmationTextSignal] = useState(() => signal(''));
    const [isDeletingSignal] = useState(() => signal(false));
    const successMessage = useSuccessMessage();

    // Initialize form state when modal opens
    useEffect(() => {
        if (!isOpen || !canManageGeneralSettings) {
            return;
        }

        initialNameSignal.value = group.name;
        initialDescriptionSignal.value = group.description || '';
        groupNameSignal.value = group.name;
        groupDescriptionSignal.value = group.description || '';
        validationErrorSignal.value = null;
        deleteErrorSignal.value = null;
        showDeleteConfirmSignal.value = false;
        confirmationTextSignal.value = '';
        isDeletingSignal.value = false;
    }, [isOpen, canManageGeneralSettings, group.name, group.description]);

    // Clear success message when modal closes
    useEffect(() => {
        if (!isOpen) {
            successMessage.clearMessage();
        }
    }, [isOpen, successMessage]);

    const validateForm = (): string | null => {
        const name = groupNameSignal.value.trim();

        if (!name) {
            return t('editGroupModal.validation.nameRequired');
        }

        if (name.length < 2) {
            return t('editGroupModal.validation.nameTooShort');
        }

        if (name.length > 50) {
            return t('editGroupModal.validation.nameTooLong');
        }

        return null;
    };

    const setGroupName = useCallback((value: string) => {
        groupNameSignal.value = value;
        validationErrorSignal.value = null;
        successMessage.clearMessage();
    }, [successMessage]);

    const setGroupDescription = useCallback((value: string) => {
        groupDescriptionSignal.value = value;
        validationErrorSignal.value = null;
        successMessage.clearMessage();
    }, [successMessage]);

    const handleSubmit = useCallback(async (event: Event) => {
        event.preventDefault();

        const errorMessage = validateForm();
        if (errorMessage) {
            validationErrorSignal.value = errorMessage;
            return;
        }

        const hasChanges = groupNameSignal.value !== initialNameSignal.value
            || groupDescriptionSignal.value !== initialDescriptionSignal.value;

        if (!hasChanges) {
            return;
        }

        isSubmittingSignal.value = true;
        validationErrorSignal.value = null;

        try {
            const trimmedName = toGroupName(groupNameSignal.value.trim());
            const trimmedDescription = groupDescriptionSignal.value.trim();

            await apiClient.updateGroup(group.id, {
                name: trimmedName,
                description: trimmedDescription ? trimmedDescription : undefined,
            });

            initialNameSignal.value = trimmedName;
            initialDescriptionSignal.value = trimmedDescription;
            groupNameSignal.value = trimmedName;
            groupDescriptionSignal.value = trimmedDescription;
            successMessage.showSuccess(t('editGroupModal.success.updated'));
            await onGroupUpdated?.();
        } catch (error: unknown) {
            validationErrorSignal.value = translateApiError(error, t, t('editGroupModal.validation.updateFailed'));
        } finally {
            isSubmittingSignal.value = false;
        }
    }, [group.id, t, onGroupUpdated, successMessage]);

    const handleDeleteClick = useCallback(() => {
        showDeleteConfirmSignal.value = true;
        deleteErrorSignal.value = null;
        confirmationTextSignal.value = '';
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        isDeletingSignal.value = true;
        deleteErrorSignal.value = null;

        try {
            enhancedGroupDetailStore.setDeletingGroup(true);
            showDeleteConfirmSignal.value = false;
            onDelete?.();
            onClose();

            apiClient.deleteGroup(group.id).catch((error) => {
                logError('Group deletion failed after redirect', error, { groupId: group.id });
            });
        } catch (error: unknown) {
            deleteErrorSignal.value = translateApiError(error, t, t('editGroupModal.deleteConfirmDialog.deleteFailed'));
            enhancedGroupDetailStore.setDeletingGroup(false);
            isDeletingSignal.value = false;
        }
    }, [group.id, t, onDelete, onClose]);

    const handleDeleteCancel = useCallback(() => {
        showDeleteConfirmSignal.value = false;
        deleteErrorSignal.value = null;
        confirmationTextSignal.value = '';
    }, []);

    const setConfirmationText = useCallback((value: string) => {
        confirmationTextSignal.value = value;
    }, []);

    const hasChanges = groupNameSignal.value !== initialNameSignal.value
        || groupDescriptionSignal.value !== initialDescriptionSignal.value;
    const isFormValid = groupNameSignal.value.trim().length >= 2;

    return {
        groupName: groupNameSignal.value,
        groupDescription: groupDescriptionSignal.value,
        isSubmitting: isSubmittingSignal.value,
        validationError: validationErrorSignal.value,
        successMessage: successMessage.message,
        hasChanges,
        isFormValid,
        deleteState: {
            showConfirm: showDeleteConfirmSignal.value,
            error: deleteErrorSignal.value,
            confirmationText: confirmationTextSignal.value,
            isDeleting: isDeletingSignal.value,
        },
        setGroupName,
        setGroupDescription,
        handleSubmit,
        handleDeleteClick,
        handleDeleteConfirm,
        handleDeleteCancel,
        setConfirmationText,
        clearSuccessMessage: successMessage.clearMessage,
    };
}
