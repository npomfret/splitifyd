import { Amount, UserId } from '@billsplit-wl/shared';
import { useComputed } from '@preact/signals';
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
    const labels = useComputed(() => expenseFormStore.labels);
    const location = useComputed(() => expenseFormStore.location);
    const splitType = useComputed(() => expenseFormStore.splitType);
    const participants = useComputed(() => expenseFormStore.participants);
    const splits = useComputed(() => expenseFormStore.splits);

    // Receipt state
    const receiptFile = useComputed(() => expenseFormStore.receiptFile);
    const receiptUrl = useComputed(() => expenseFormStore.receiptUrl);
    const receiptUploading = useComputed(() => expenseFormStore.receiptUploading);
    const receiptError = useComputed(() => expenseFormStore.receiptError);

    // Wrapper for updateField to handle type issues
    const updateField = (field: string, value: any) => {
        expenseFormStore.updateField(field as any, value);
    };

    const handleAmountChange = (e: Event) => {
        const input = e.target as HTMLInputElement;
        // Parse string input to number at the UI boundary
        // Allow empty string so users can clear the field before typing a new value
        const nonEmptyValue = input.value.trim() === '' ? '' : input.value;
        expenseFormStore.updateField('amount', nonEmptyValue);
    };

    const handleParticipantToggle = (memberId: UserId) => {
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
        labels: labels.value,
        location: location.value,
        splitType: splitType.value,
        participants: participants.value,
        splits: splits.value,

        // Receipt state
        receiptFile: receiptFile.value,
        receiptUrl: receiptUrl.value,
        receiptUploading: receiptUploading.value,
        receiptError: receiptError.value,

        // Actions
        updateField,
        handleAmountChange,
        handleParticipantToggle,
        validateOnBlur: (field: string) => expenseFormStore.validateOnBlur(field as any),
        updateSplitAmount: (userId: UserId, amount: Amount) => expenseFormStore.updateSplitAmount(userId, amount),
        updateSplitPercentage: (userId: UserId, percentage: number) => expenseFormStore.updateSplitPercentage(userId, percentage),

        // Receipt actions
        setReceiptFile: (file: File | null) => expenseFormStore.setReceiptFile(file),
        clearReceiptError: () => expenseFormStore.clearReceiptError(),
    };
}
