import { apiClient } from '@/app/apiClient.ts';
import { useSuccessMessage } from '@/app/hooks/useSuccessMessage.ts';
import { translateApiError } from '@/utils/error-translation';
import { GroupCurrencySettings, GroupDTO } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { TFunction } from 'i18next';
import { useCallback, useEffect, useState } from 'preact/hooks';

interface UseGroupCurrencySettingsOptions {
    group: GroupDTO;
    isOpen: boolean;
    t: TFunction;
    onGroupUpdated?: () => Promise<void> | void;
}

interface UseGroupCurrencySettingsResult {
    // State
    enabled: boolean;
    permittedCurrencies: string[];
    defaultCurrency: string;
    isSubmitting: boolean;
    validationError: string | null;
    successMessage: ReadonlySignal<string | null>;
    hasChanges: boolean;
    isFormValid: boolean;

    // Actions
    toggleEnabled: (enabled: boolean) => void;
    addCurrency: (code: string) => void;
    removeCurrency: (code: string) => void;
    setDefaultCurrency: (code: string) => void;
    handleSave: () => Promise<void>;
    clearSuccessMessage: () => void;
}

function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
}

export function useGroupCurrencySettings({
    group,
    isOpen,
    t,
    onGroupUpdated,
}: UseGroupCurrencySettingsOptions): UseGroupCurrencySettingsResult {
    // Form state signals
    const [enabledSignal] = useState(() => signal(false));
    const [permittedSignal] = useState(() => signal<string[]>([]));
    const [defaultCurrencySignal] = useState(() => signal(''));

    // Initial state for change detection
    const [initialEnabledSignal] = useState(() => signal(false));
    const [initialPermittedSignal] = useState(() => signal<string[]>([]));
    const [initialDefaultSignal] = useState(() => signal(''));

    // UI state
    const [isSubmittingSignal] = useState(() => signal(false));
    const [validationErrorSignal] = useState(() => signal<string | null>(null));
    const successMessage = useSuccessMessage();

    // Initialize form state when modal opens
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const settings = group.currencySettings;
        const hasSettings = !!settings;

        // Set initial state
        initialEnabledSignal.value = hasSettings;
        initialPermittedSignal.value = settings?.permitted || [];
        initialDefaultSignal.value = settings?.default || '';

        // Set form state
        enabledSignal.value = hasSettings;
        permittedSignal.value = settings?.permitted || [];
        defaultCurrencySignal.value = settings?.default || '';

        validationErrorSignal.value = null;
    }, [isOpen, group.currencySettings]);

    // Clear success message when modal closes
    useEffect(() => {
        if (!isOpen) {
            successMessage.clearMessage();
        }
    }, [isOpen, successMessage]);

    const validate = useCallback((): string | null => {
        if (!enabledSignal.value) {
            return null; // No validation needed when disabled
        }

        if (permittedSignal.value.length === 0) {
            return t('groupSettings.currencySettings.noCurrenciesSelected');
        }

        if (!defaultCurrencySignal.value) {
            return t('groupSettings.currencySettings.defaultNotInPermitted');
        }

        if (!permittedSignal.value.includes(defaultCurrencySignal.value)) {
            return t('groupSettings.currencySettings.defaultNotInPermitted');
        }

        return null;
    }, [t]);

    const toggleEnabled = useCallback((enabled: boolean) => {
        enabledSignal.value = enabled;
        validationErrorSignal.value = null;
        successMessage.clearMessage();

        // If enabling and no currencies selected, don't auto-populate
        // Let user select their own currencies
    }, [successMessage]);

    const addCurrency = useCallback((code: string) => {
        if (!permittedSignal.value.includes(code)) {
            permittedSignal.value = [...permittedSignal.value, code];

            // Auto-set default to first currency if none set
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

        // If we removed the default currency, set default to first remaining
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

    const handleSave = useCallback(async () => {
        const errorMessage = validate();
        if (errorMessage) {
            validationErrorSignal.value = errorMessage;
            return;
        }

        isSubmittingSignal.value = true;
        validationErrorSignal.value = null;

        try {
            // Build the currency settings payload
            let currencySettings: GroupCurrencySettings | null = null;

            if (enabledSignal.value && permittedSignal.value.length > 0) {
                currencySettings = {
                    permitted: permittedSignal.value as GroupCurrencySettings['permitted'],
                    default: defaultCurrencySignal.value as GroupCurrencySettings['default'],
                };
            }

            // Call API - null clears settings, object sets them
            await apiClient.updateGroup(group.id, {
                currencySettings: enabledSignal.value ? currencySettings : null,
            });

            // Update initial state to reflect saved values
            initialEnabledSignal.value = enabledSignal.value;
            initialPermittedSignal.value = [...permittedSignal.value];
            initialDefaultSignal.value = defaultCurrencySignal.value;

            successMessage.showSuccess(t('groupSettings.currencySettings.saveSuccess'));
            await onGroupUpdated?.();
        } catch (error: unknown) {
            validationErrorSignal.value = translateApiError(error, t, t('groupSettings.currencySettings.saveFailed'));
        } finally {
            isSubmittingSignal.value = false;
        }
    }, [group.id, t, onGroupUpdated, successMessage, validate]);

    // Calculate hasChanges
    const hasChanges =
        enabledSignal.value !== initialEnabledSignal.value ||
        (enabledSignal.value && !arraysEqual(permittedSignal.value, initialPermittedSignal.value)) ||
        (enabledSignal.value && defaultCurrencySignal.value !== initialDefaultSignal.value);

    // Calculate isFormValid
    const isFormValid = !enabledSignal.value || (permittedSignal.value.length > 0 && !!defaultCurrencySignal.value);

    return {
        enabled: enabledSignal.value,
        permittedCurrencies: permittedSignal.value,
        defaultCurrency: defaultCurrencySignal.value,
        isSubmitting: isSubmittingSignal.value,
        validationError: validationErrorSignal.value,
        successMessage: successMessage.message,
        hasChanges,
        isFormValid,
        toggleEnabled,
        addCurrency,
        removeCurrency,
        setDefaultCurrency,
        handleSave,
        clearSuccessMessage: successMessage.clearMessage,
    };
}
