import { navigationService } from '@/services/navigation.service';
import { logError } from '@/utils/browser-logger.ts';
import { GroupId, UserId, toUserId } from '@billsplit-wl/shared';
import { ExpenseId } from '@billsplit-wl/shared';
import { useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { expenseFormStore } from '../stores/expense-form-store';

interface UseFormSubmissionOptions {
    groupId: GroupId;
    expenseId?: ExpenseId | null;
    isEditMode: boolean;
    isCopyMode?: boolean;
    isInitialized: boolean;
}

/**
 * Hook that handles form submission, navigation, and auto-save functionality
 * Focuses on the business logic around saving and navigation
 */
export function useFormSubmission({ groupId, expenseId, isEditMode, isCopyMode, isInitialized }: UseFormSubmissionOptions) {
    // Form values for auto-save dependency
    const description = useComputed(() => expenseFormStore.description);
    const amount = useComputed(() => expenseFormStore.amount);
    const date = useComputed(() => expenseFormStore.date);
    const time = useComputed(() => expenseFormStore.time);
    const paidBy = useComputed(() => expenseFormStore.paidBy);
    const label = useComputed(() => expenseFormStore.label);
    const splitType = useComputed(() => expenseFormStore.splitType);
    const participants = useComputed(() => expenseFormStore.participants);
    const splits = useComputed(() => expenseFormStore.splits);

    // Auto-save functionality for new expenses (not for copy mode to avoid overwriting drafts)
    useEffect(() => {
        if (!isEditMode && !isCopyMode && isInitialized) {
            const timer = setTimeout(() => {
                if (description.value || amount.value) {
                    expenseFormStore.saveDraft(groupId);
                }
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [description.value, amount.value, date.value, time.value, paidBy.value, label.value, splitType.value, participants.value, splits.value, isEditMode, isCopyMode, isInitialized]);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        if (!groupId) return;

        try {
            if (isEditMode && expenseId) {
                await expenseFormStore.updateExpense(groupId, expenseId);
                // Navigate back to expense detail after successful update
                await navigationService.goToExpenseDetail(groupId, expenseId);
            } else {
                await expenseFormStore.saveExpense(groupId);
                // Navigate back to group detail after creating new expense (including copy mode)
                await navigationService.goToGroup(groupId);
            }
        } catch (error) {
            logError('Failed to save expense', error);
        }
    };

    const handleCancel = () => {
        if (expenseFormStore.hasUnsavedChanges()) {
            const confirmed = confirm('You have unsaved changes. Are you sure you want to leave?');
            if (!confirmed) {
                return;
            }
        }

        if (isEditMode && expenseId) {
            // Navigate back to expense detail when canceling edit
            void navigationService.goToExpenseDetail(groupId, expenseId);
        } else {
            // Navigate back to group detail when canceling create
            void navigationService.goToGroup(groupId);
        }
    };

    const handleSelectAll = (members: Array<{ uid: string; }>) => {
        const allMemberIds = members.map((m) => toUserId(m.uid));
        expenseFormStore.setParticipants(allMemberIds);
    };

    const handleSelectNone = (paidBy: string | null) => {
        // Keep only the payer
        expenseFormStore.setParticipants(paidBy ? [toUserId(paidBy)] : []);
    };

    return {
        handleSubmit,
        handleCancel,
        handleSelectAll,
        handleSelectNone,
    };
}
