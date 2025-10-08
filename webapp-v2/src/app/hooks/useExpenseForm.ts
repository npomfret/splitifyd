import { PREDEFINED_EXPENSE_CATEGORIES } from '@splitifyd/shared';
import { getRecentAmounts } from '../stores/expense-form-store';
import { useFormInitialization } from './useFormInitialization';
import { useFormState } from './useFormState';
import { useFormSubmission } from './useFormSubmission';

interface UseExpenseFormOptions {
    groupId: string;
    expenseId?: string | null;
    isEditMode: boolean;
    isCopyMode?: boolean;
    sourceExpenseId?: string | null;
}

export function useExpenseForm({ groupId, expenseId, isEditMode, isCopyMode, sourceExpenseId }: UseExpenseFormOptions) {
    // Use the focused hooks
    const formState = useFormState();
    const formInitialization = useFormInitialization({
        groupId,
        expenseId,
        isEditMode,
        isCopyMode,
        sourceExpenseId,
    });
    const formSubmission = useFormSubmission({
        groupId,
        expenseId,
        isEditMode,
        isCopyMode,
        isInitialized: formInitialization.isInitialized,
    });

    return {
        // State from initialization
        isInitialized: formInitialization.isInitialized,
        initError: formInitialization.initError,
        loading: formInitialization.loading,
        isDataReady: formInitialization.isDataReady,

        // State from form
        saving: formState.saving,
        formError: formState.formError,
        validationErrors: formState.validationErrors,
        isFormValid: formState.isFormValid,
        hasRequiredFields: formState.hasRequiredFields,

        // Form values
        description: formState.description,
        amount: formState.amount,
        currency: formState.currency,
        date: formState.date,
        time: formState.time,
        paidBy: formState.paidBy,
        category: formState.category,
        splitType: formState.splitType,
        participants: formState.participants,
        splits: formState.splits,

        // Store data
        group: formInitialization.group,
        members: formInitialization.members,

        // Actions from form state
        handleAmountChange: formState.handleAmountChange,
        handleParticipantToggle: formState.handleParticipantToggle,
        updateField: formState.updateField,
        updateSplitAmount: formState.updateSplitAmount,
        updateSplitPercentage: formState.updateSplitPercentage,

        // Actions from submission
        handleSubmit: formSubmission.handleSubmit,
        handleCancel: formSubmission.handleCancel,
        handleSelectAll: () => formSubmission.handleSelectAll(formInitialization.members),
        handleSelectNone: () => formSubmission.handleSelectNone(formState.paidBy),

        // Helpers
        getRecentAmounts,
        PREDEFINED_EXPENSE_CATEGORIES,
    };
}
