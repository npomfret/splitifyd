import type { ExpenseDTO, RecentAmount } from '@billsplit-wl/shared';
import { GroupId } from '@billsplit-wl/shared';
import { toGroupId } from '@billsplit-wl/shared';
import { ExpenseId } from '@billsplit-wl/shared';
import { useFormInitialization } from './useFormInitialization';
import { useFormState } from './useFormState';
import { useFormSubmission } from './useFormSubmission';

const MAX_RECENT_AMOUNTS = 3;
const MAX_RECENT_LOCATIONS = 10;

/**
 * Derives recent amounts from group expenses.
 * Returns unique amount/currency pairs from the most recent expenses.
 */
function deriveRecentAmountsFromExpenses(expenses: ExpenseDTO[]): RecentAmount[] {
    if (!expenses || expenses.length === 0) {
        return [];
    }

    // expenses are already sorted by date (most recent first) from the store
    const seen = new Set<string>();
    const recentAmounts: RecentAmount[] = [];

    for (const expense of expenses) {
        const key = `${expense.amount}|${expense.currency}`;
        if (!seen.has(key)) {
            seen.add(key);
            recentAmounts.push({
                amount: expense.amount,
                currency: expense.currency,
            });
            if (recentAmounts.length >= MAX_RECENT_AMOUNTS) {
                break;
            }
        }
    }

    return recentAmounts;
}

/**
 * Derives recent locations from group expenses.
 * Returns unique location names from the most recent expenses that have locations.
 */
function deriveRecentLocationsFromExpenses(expenses: ExpenseDTO[]): string[] {
    if (!expenses || expenses.length === 0) {
        return [];
    }

    // expenses are already sorted by date (most recent first) from the store
    const seen = new Set<string>();
    const recentLocations: string[] = [];

    for (const expense of expenses) {
        if (expense.location?.name) {
            const key = expense.location.name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                recentLocations.push(expense.location.name);
                if (recentLocations.length >= MAX_RECENT_LOCATIONS) {
                    break;
                }
            }
        }
    }

    return recentLocations;
}

interface UseExpenseFormOptions {
    isOpen: boolean;
    groupId: GroupId;
    expenseId?: ExpenseId | null;
    isEditMode: boolean;
    isCopyMode?: boolean;
    sourceExpenseId?: ExpenseId | null;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function useExpenseForm({ isOpen, groupId, expenseId, isEditMode, isCopyMode, sourceExpenseId, onSuccess, onCancel }: UseExpenseFormOptions) {
    // Use the focused hooks
    const formState = useFormState();
    const formInitialization = useFormInitialization({
        isOpen,
        groupId,
        expenseId,
        isEditMode,
        isCopyMode,
        sourceExpenseId,
    });
    const formSubmission = useFormSubmission({
        groupId: toGroupId(groupId),
        expenseId,
        isEditMode,
        isCopyMode,
        isInitialized: formInitialization.isInitialized,
        onSuccess,
        onCancel,
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
        labels: formState.labels,
        location: formState.location,
        splitType: formState.splitType,
        participants: formState.participants,
        splits: formState.splits,

        // Receipt state
        receiptFile: formState.receiptFile,
        receiptUrl: formState.receiptUrl,
        receiptUploading: formState.receiptUploading,
        receiptError: formState.receiptError,

        // Store data
        group: formInitialization.group,
        members: formInitialization.members,

        // Actions from form state
        handleAmountChange: formState.handleAmountChange,
        handleParticipantToggle: formState.handleParticipantToggle,
        updateField: formState.updateField,
        validateOnBlur: formState.validateOnBlur,
        updateSplitAmount: formState.updateSplitAmount,
        updateSplitPercentage: formState.updateSplitPercentage,
        setReceiptFile: formState.setReceiptFile,
        clearReceiptError: formState.clearReceiptError,

        // Actions from submission
        handleSubmit: formSubmission.handleSubmit,
        handleCancel: formSubmission.handleCancel,
        handleSelectAll: () => formSubmission.handleSelectAll(formInitialization.members),
        handleSelectNone: () => formSubmission.handleSelectNone(formState.paidBy),

        // Helpers - recent amounts derived from group expenses
        recentAmounts: deriveRecentAmountsFromExpenses(formInitialization.expenses),

        // Recent locations derived from group expenses (for autocomplete suggestions)
        recentLocations: deriveRecentLocationsFromExpenses(formInitialization.expenses),

        // Recently used labels from group (for autocomplete suggestions)
        recentlyUsedLabels: formInitialization.group?.recentlyUsedLabels,
    };
}
