import { useComputed } from '@preact/signals';
import { Amount } from '@splitifyd/shared';
import { ZERO } from '@splitifyd/shared';
import { expenseFormStore } from '../stores/expense-form-store';

/**
 * Hook that provides access to form state and validation
 * Focuses only on exposing reactive form values and validation state
 */
export function useFormState() {
    // Form validation state
    const saving = useComputed(() => expenseFormStore.saving);
    const formError = useComputed(() => expenseFormStore.error);
    const validationErrors = useComputed(() => expenseFormStore.validationErrors);
    const isFormValid = useComputed(() => expenseFormStore.isFormValid);
    const hasRequiredFields = useComputed(() => expenseFormStore.hasRequiredFields);

    // Form field values
    const description = useComputed(() => expenseFormStore.description);
    const amount = useComputed(() => expenseFormStore.amount);
    const currency = useComputed(() => expenseFormStore.currency);
    const date = useComputed(() => expenseFormStore.date);
    const time = useComputed(() => expenseFormStore.time);
    const paidBy = useComputed(() => expenseFormStore.paidBy);
    const category = useComputed(() => expenseFormStore.category);
    const splitType = useComputed(() => expenseFormStore.splitType);
    const participants = useComputed(() => expenseFormStore.participants);
    const splits = useComputed(() => expenseFormStore.splits);

    // Wrapper for updateField to handle type issues
    const updateField = (field: string, value: any) => {
        expenseFormStore.updateField(field as any, value);
    };

    const handleAmountChange = (e: Event) => {
        const input = e.target as HTMLInputElement;
        // Parse string input to number at the UI boundary
        // Convert empty string to 0, preserve user decimals during typing
        const nonEmptyValue = input.value.trim() === '' ? ZERO : input.value;
        expenseFormStore.updateField('amount', nonEmptyValue);
    };

    const handleParticipantToggle = (memberId: string) => {
        expenseFormStore.toggleParticipant(memberId);
    };

    return {
        // State
        saving: saving.value,
        formError: formError.value,
        validationErrors: validationErrors.value,
        isFormValid: isFormValid.value,
        hasRequiredFields: hasRequiredFields.value,

        // Form values
        description: description.value,
        amount: amount.value,
        currency: currency.value,
        date: date.value,
        time: time.value,
        paidBy: paidBy.value,
        category: category.value,
        splitType: splitType.value,
        participants: participants.value,
        splits: splits.value,

        // Actions
        updateField,
        handleAmountChange,
        handleParticipantToggle,
        updateSplitAmount: (userId: string, amount: Amount) => expenseFormStore.updateSplitAmount(userId, amount),
        updateSplitPercentage: (userId: string, percentage: number) => expenseFormStore.updateSplitPercentage(userId, percentage),
    };
}
