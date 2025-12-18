import { apiClient } from '@/app/apiClient.ts';
import { useSuccessMessage } from '@/app/hooks/useSuccessMessage.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { logError } from '@/utils/browser-logger.ts';
import { translateApiError } from '@/utils/error-translation';
import { GroupCurrencySettings, GroupDTO, toGroupName, UpdateGroupRequest } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { TFunction } from 'i18next';
import { useCallback, useEffect, useState } from 'preact/hooks';

interface UseGroupGeneralTabSettingsOptions {
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

interface UseGroupGeneralTabSettingsResult {
    // Group details
    groupName: string;
    groupDescription: string;

    // Currency settings
    currencyEnabled: boolean;
    permittedCurrencies: string[];
    defaultCurrency: string;

    // Lock settings
    locked: boolean;

    // Form state
    isSubmitting: boolean;
    validationError: string | null;
    successMessage: ReadonlySignal<string | null>;
    hasChanges: boolean;
    isFormValid: boolean;

    // Delete state
    deleteState: DeleteState;

    // Group details actions
    setGroupName: (value: string) => void;
    setGroupDescription: (value: string) => void;

    // Currency settings actions
    toggleCurrencyEnabled: (enabled: boolean) => void;
    addCurrency: (code: string) => void;
    removeCurrency: (code: string) => void;
    setDefaultCurrency: (code: string) => void;

    // Lock settings actions
    toggleLocked: () => void;

    // Form actions
    handleSave: (event?: Event) => Promise<void>;
    handleCancel: () => void;

    // Delete actions
    handleDeleteClick: () => void;
    handleDeleteConfirm: () => Promise<void>;
    handleDeleteCancel: () => void;
    setConfirmationText: (value: string) => void;
}

function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
}

export function useGroupGeneralTabSettings({
    group,
    isOpen,
    canManageGeneralSettings,
    t,
    onGroupUpdated,
    onClose,
    onDelete,
}: UseGroupGeneralTabSettingsOptions): UseGroupGeneralTabSettingsResult {
    // ========== Group Details State ==========
    const [groupNameSignal] = useState(() => signal(''));
    const [groupDescriptionSignal] = useState(() => signal(''));
    const [initialNameSignal] = useState(() => signal(''));
    const [initialDescriptionSignal] = useState(() => signal(''));

    // ========== Currency Settings State ==========
    const [currencyEnabledSignal] = useState(() => signal(false));
    const [permittedSignal] = useState(() => signal<string[]>([]));
    const [defaultCurrencySignal] = useState(() => signal(''));
    const [initialCurrencyEnabledSignal] = useState(() => signal(false));
    const [initialPermittedSignal] = useState(() => signal<string[]>([]));
    const [initialDefaultSignal] = useState(() => signal(''));

    // ========== Lock Settings State ==========
    const [lockedSignal] = useState(() => signal(false));
    const [initialLockedSignal] = useState(() => signal(false));

    // ========== Form UI State ==========
    const [isSubmittingSignal] = useState(() => signal(false));
    const [validationErrorSignal] = useState(() => signal<string | null>(null));
    const successMessage = useSuccessMessage();

    // ========== Delete State ==========
    const [showDeleteConfirmSignal] = useState(() => signal(false));
    const [deleteErrorSignal] = useState(() => signal<string | null>(null));
    const [confirmationTextSignal] = useState(() => signal(''));
    const [isDeletingSignal] = useState(() => signal(false));

    // Initialize all form state when modal opens
    useEffect(() => {
        if (!isOpen || !canManageGeneralSettings) {
            return;
        }

        // Group details
        initialNameSignal.value = group.name;
        initialDescriptionSignal.value = group.description || '';
        groupNameSignal.value = group.name;
        groupDescriptionSignal.value = group.description || '';

        // Currency settings
        const currencySettings = group.currencySettings;
        const hasCurrencySettings = !!currencySettings;
        initialCurrencyEnabledSignal.value = hasCurrencySettings;
        initialPermittedSignal.value = currencySettings?.permitted || [];
        initialDefaultSignal.value = currencySettings?.default || '';
        currencyEnabledSignal.value = hasCurrencySettings;
        permittedSignal.value = currencySettings?.permitted || [];
        defaultCurrencySignal.value = currencySettings?.default || '';

        // Lock settings
        initialLockedSignal.value = group.locked;
        lockedSignal.value = group.locked;

        // Reset UI state
        validationErrorSignal.value = null;
        deleteErrorSignal.value = null;
        showDeleteConfirmSignal.value = false;
        confirmationTextSignal.value = '';
        isDeletingSignal.value = false;
    }, [isOpen, canManageGeneralSettings, group.name, group.description, group.currencySettings, group.locked]);

    // Clear success message when modal closes
    useEffect(() => {
        if (!isOpen) {
            successMessage.clearMessage();
        }
    }, [isOpen, successMessage]);

    // ========== Validation ==========
    const validateForm = useCallback((): string | null => {
        // Validate group name
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

        // Validate currency settings if enabled
        if (currencyEnabledSignal.value) {
            if (permittedSignal.value.length === 0) {
                return t('groupSettings.currencySettings.noCurrenciesSelected');
            }
            if (!defaultCurrencySignal.value || !permittedSignal.value.includes(defaultCurrencySignal.value)) {
                return t('groupSettings.currencySettings.defaultNotInPermitted');
            }
        }

        return null;
    }, [t]);

    // ========== Group Details Actions ==========
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

    // ========== Currency Settings Actions ==========
    const toggleCurrencyEnabled = useCallback((enabled: boolean) => {
        currencyEnabledSignal.value = enabled;
        validationErrorSignal.value = null;
        successMessage.clearMessage();
    }, [successMessage]);

    const addCurrency = useCallback((code: string) => {
        if (!permittedSignal.value.includes(code)) {
            permittedSignal.value = [...permittedSignal.value, code];
            if (!defaultCurrencySignal.value) {
                defaultCurrencySignal.value = code;
            }
        }
        validationErrorSignal.value = null;
        successMessage.clearMessage();
    }, [successMessage]);

    const removeCurrency = useCallback((code: string) => {
        const newPermitted = permittedSignal.value.filter((c) => c !== code);
        permittedSignal.value = newPermitted;
        if (defaultCurrencySignal.value === code) {
            defaultCurrencySignal.value = newPermitted[0] || '';
        }
        validationErrorSignal.value = null;
        successMessage.clearMessage();
    }, [successMessage]);

    const setDefaultCurrency = useCallback((code: string) => {
        defaultCurrencySignal.value = code;
        validationErrorSignal.value = null;
        successMessage.clearMessage();
    }, [successMessage]);

    // ========== Lock Settings Actions ==========
    const toggleLocked = useCallback(() => {
        lockedSignal.value = !lockedSignal.value;
        validationErrorSignal.value = null;
        successMessage.clearMessage();
    }, [successMessage]);

    // ========== Form Actions ==========
    const handleSave = useCallback(async (event?: Event) => {
        event?.preventDefault();

        const errorMessage = validateForm();
        if (errorMessage) {
            validationErrorSignal.value = errorMessage;
            return;
        }

        // Check if there are any changes
        const nameChanged = groupNameSignal.value !== initialNameSignal.value;
        const descriptionChanged = groupDescriptionSignal.value !== initialDescriptionSignal.value;
        const currencyEnabledChanged = currencyEnabledSignal.value !== initialCurrencyEnabledSignal.value;
        const permittedChanged = currencyEnabledSignal.value && !arraysEqual(permittedSignal.value, initialPermittedSignal.value);
        const defaultChanged = currencyEnabledSignal.value && defaultCurrencySignal.value !== initialDefaultSignal.value;
        const lockedChanged = lockedSignal.value !== initialLockedSignal.value;

        const hasAnyChanges = nameChanged || descriptionChanged || currencyEnabledChanged || permittedChanged || defaultChanged || lockedChanged;

        if (!hasAnyChanges) {
            return;
        }

        isSubmittingSignal.value = true;
        validationErrorSignal.value = null;

        try {
            // Build the update request with only changed fields
            const updateRequest: UpdateGroupRequest = {};

            if (nameChanged) {
                updateRequest.name = toGroupName(groupNameSignal.value.trim());
            }

            if (descriptionChanged) {
                const trimmedDescription = groupDescriptionSignal.value.trim();
                updateRequest.description = trimmedDescription || undefined;
            }

            if (currencyEnabledChanged || permittedChanged || defaultChanged) {
                if (currencyEnabledSignal.value && permittedSignal.value.length > 0) {
                    updateRequest.currencySettings = {
                        permitted: permittedSignal.value as GroupCurrencySettings['permitted'],
                        default: defaultCurrencySignal.value as GroupCurrencySettings['default'],
                    };
                } else {
                    updateRequest.currencySettings = null;
                }
            }

            if (lockedChanged) {
                updateRequest.locked = lockedSignal.value;
            }

            await apiClient.updateGroup(group.id, updateRequest);

            // Update initial state to reflect saved values
            if (nameChanged) {
                initialNameSignal.value = groupNameSignal.value.trim();
                groupNameSignal.value = groupNameSignal.value.trim();
            }
            if (descriptionChanged) {
                initialDescriptionSignal.value = groupDescriptionSignal.value.trim();
                groupDescriptionSignal.value = groupDescriptionSignal.value.trim();
            }
            initialCurrencyEnabledSignal.value = currencyEnabledSignal.value;
            initialPermittedSignal.value = [...permittedSignal.value];
            initialDefaultSignal.value = defaultCurrencySignal.value;
            initialLockedSignal.value = lockedSignal.value;

            successMessage.showSuccess(t('editGroupModal.success.updated'));
            await onGroupUpdated?.();
        } catch (error: unknown) {
            validationErrorSignal.value = translateApiError(error, t, t('editGroupModal.validation.updateFailed'));
        } finally {
            isSubmittingSignal.value = false;
        }
    }, [group.id, t, onGroupUpdated, successMessage, validateForm]);

    const handleCancel = useCallback(() => {
        onClose();
    }, [onClose]);

    // ========== Delete Actions ==========
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

    // ========== Computed Values ==========
    const hasDetailsChanges = groupNameSignal.value !== initialNameSignal.value
        || groupDescriptionSignal.value !== initialDescriptionSignal.value;

    const hasCurrencyChanges = currencyEnabledSignal.value !== initialCurrencyEnabledSignal.value
        || (currencyEnabledSignal.value && !arraysEqual(permittedSignal.value, initialPermittedSignal.value))
        || (currencyEnabledSignal.value && defaultCurrencySignal.value !== initialDefaultSignal.value);

    const hasLockChanges = lockedSignal.value !== initialLockedSignal.value;

    const hasChanges = hasDetailsChanges || hasCurrencyChanges || hasLockChanges;

    const isFormValid = groupNameSignal.value.trim().length >= 2
        && (!currencyEnabledSignal.value || (permittedSignal.value.length > 0 && !!defaultCurrencySignal.value));

    return {
        // Group details
        groupName: groupNameSignal.value,
        groupDescription: groupDescriptionSignal.value,

        // Currency settings
        currencyEnabled: currencyEnabledSignal.value,
        permittedCurrencies: permittedSignal.value,
        defaultCurrency: defaultCurrencySignal.value,

        // Lock settings
        locked: lockedSignal.value,

        // Form state
        isSubmitting: isSubmittingSignal.value,
        validationError: validationErrorSignal.value,
        successMessage: successMessage.message,
        hasChanges,
        isFormValid,

        // Delete state
        deleteState: {
            showConfirm: showDeleteConfirmSignal.value,
            error: deleteErrorSignal.value,
            confirmationText: confirmationTextSignal.value,
            isDeleting: isDeletingSignal.value,
        },

        // Group details actions
        setGroupName,
        setGroupDescription,

        // Currency settings actions
        toggleCurrencyEnabled,
        addCurrency,
        removeCurrency,
        setDefaultCurrency,

        // Lock settings actions
        toggleLocked,

        // Form actions
        handleSave,
        handleCancel,

        // Delete actions
        handleDeleteClick,
        handleDeleteConfirm,
        handleDeleteCancel,
        setConfirmationText,
    };
}
