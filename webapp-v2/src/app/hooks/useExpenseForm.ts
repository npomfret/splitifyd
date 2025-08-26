import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { expenseFormStore, getRecentAmounts } from '../stores/expense-form-store';
import { enhancedGroupDetailStore } from '../stores/group-detail-store-enhanced';
import { apiClient } from '../apiClient';
import { ExpenseData, PREDEFINED_EXPENSE_CATEGORIES } from '@splitifyd/shared';
import { logError } from '@/utils/browser-logger.ts';
import { useAuth } from './useAuth';
import { extractTimeFromISO } from '@/utils/dateUtils.ts';

interface UseExpenseFormOptions {
    groupId: string;
    expenseId?: string | null;
    isEditMode: boolean;
    isCopyMode?: boolean;
    sourceExpenseId?: string | null;
}

export function useExpenseForm({ groupId, expenseId, isEditMode, isCopyMode, sourceExpenseId }: UseExpenseFormOptions) {
    const isInitialized = useSignal(false);
    const initError = useSignal<string | null>(null);
    const authStore = useAuth();

    // Computed values from stores
    const group = useComputed(() => enhancedGroupDetailStore.group);
    const members = useComputed(() => enhancedGroupDetailStore.members);
    const loading = useComputed(() => enhancedGroupDetailStore.loading);
    const saving = useComputed(() => expenseFormStore.saving);
    const formError = useComputed(() => expenseFormStore.error);
    const validationErrors = useComputed(() => expenseFormStore.validationErrors);
    const isFormValid = useComputed(() => expenseFormStore.isFormValid);
    const hasRequiredFields = useComputed(() => expenseFormStore.hasRequiredFields);

    // Data readiness signal - only true when initialized, loading is false AND we have members
    const isDataReady = useComputed(() => {
        // Data is ready only when initialization is complete AND loading is false AND we have members.
        // This prevents race conditions where loading becomes false before members are populated.
        return isInitialized.value && !loading.value && members.value.length > 0;
    });

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

    // Initialize form on mount
    useEffect(() => {
        if (!groupId) {
            initError.value = 'No group ID provided';
            route('/dashboard');
            return;
        }

        const initializeForm = async () => {
            try {
                // Reset form to clean state
                expenseFormStore.reset();

                // Ensure group data is loaded
                if (!group.value || group.value.id !== groupId) {
                    await enhancedGroupDetailStore.fetchGroup(groupId);
                }

                if (isEditMode && expenseId) {
                    // Edit mode: fetch existing expense and populate form
                    try {
                        const expense = await apiClient.request<ExpenseData>('/expenses', {
                            method: 'GET',
                            query: { id: expenseId },
                        });

                        if (expense) {
                            // Populate form with existing expense data
                            expenseFormStore.updateField('description', expense.description);
                            expenseFormStore.updateField('amount', expense.amount);
                            expenseFormStore.updateField('currency', expense.currency);
                            expenseFormStore.updateField('date', expense.date.split('T')[0]); // Extract date part
                            expenseFormStore.updateField('time', extractTimeFromISO(expense.date)); // Extract time part
                            expenseFormStore.updateField('paidBy', expense.paidBy);
                            expenseFormStore.updateField('category', expense.category);
                            expenseFormStore.updateField('splitType', expense.splitType);

                            // Set participants from expense splits
                            const participantIds = expense.splits.map((split) => split.userId);
                            expenseFormStore.setParticipants(participantIds);

                            // Set splits based on split type
                            expense.splits.forEach((split) => {
                                if (expense.splitType === 'exact') {
                                    expenseFormStore.updateSplitAmount(split.userId, split.amount);
                                } else if (expense.splitType === 'percentage') {
                                    const percentage = (split.amount / expense.amount) * 100;
                                    expenseFormStore.updateSplitPercentage(split.userId, percentage);
                                }
                            });
                        } else {
                            throw new Error('Expense not found');
                        }
                    } catch (error) {
                        logError('Failed to load expense for editing', error);
                        initError.value = error instanceof Error ? error.message : 'Failed to load expense for editing';
                        return;
                    }
                } else if (isCopyMode && sourceExpenseId) {
                    // Copy mode: fetch source expense and populate form (except date)
                    try {
                        const sourceExpense = await apiClient.request<ExpenseData>('/expenses', {
                            method: 'GET',
                            query: { id: sourceExpenseId },
                        });

                        if (sourceExpense) {
                            // Copy all fields except date/time (keep current defaults)
                            expenseFormStore.updateField('description', sourceExpense.description);
                            expenseFormStore.updateField('amount', sourceExpense.amount);
                            expenseFormStore.updateField('currency', sourceExpense.currency);
                            // Date and time remain at current defaults
                            expenseFormStore.updateField('paidBy', sourceExpense.paidBy);
                            expenseFormStore.updateField('category', sourceExpense.category);
                            expenseFormStore.updateField('splitType', sourceExpense.splitType);

                            // Set participants from expense splits
                            const participantIds = sourceExpense.splits.map((split) => split.userId);
                            expenseFormStore.setParticipants(participantIds);

                            // Set splits based on split type
                            sourceExpense.splits.forEach((split) => {
                                if (sourceExpense.splitType === 'exact') {
                                    expenseFormStore.updateSplitAmount(split.userId, split.amount);
                                } else if (sourceExpense.splitType === 'percentage') {
                                    const percentage = (split.amount / sourceExpense.amount) * 100;
                                    expenseFormStore.updateSplitPercentage(split.userId, percentage);
                                }
                            });
                        } else {
                            throw new Error('Source expense not found');
                        }
                    } catch (error) {
                        logError('Failed to load expense for copying', error);
                        initError.value = error instanceof Error ? error.message : 'Failed to load source expense for copying';
                        return;
                    }
                } else {
                    // Create mode: Set default payer
                    const currentUser = enhancedGroupDetailStore.members.find((m) => m.uid === authStore?.user?.uid);
                    if (currentUser) {
                        expenseFormStore.updateField('paidBy', currentUser.uid);
                    }
                }

                isInitialized.value = true;
            } catch (error) {
                logError('Failed to initialize expense form', error);
                initError.value = error instanceof Error ? error.message : 'Failed to initialize expense form';
            }
        };

        initializeForm();

        return () => {
            expenseFormStore.reset();
        };
    }, [groupId, isEditMode, expenseId, isCopyMode, sourceExpenseId]);

    // Auto-save functionality for new expenses (not for copy mode to avoid overwriting drafts)
    useEffect(() => {
        if (!isEditMode && !isCopyMode && isInitialized.value) {
            const timer = setTimeout(() => {
                if (description.value || amount.value) {
                    expenseFormStore.saveDraft(groupId);
                }
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [description.value, amount.value, date.value, time.value, paidBy.value, category.value, splitType.value, participants.value, splits.value, isEditMode, isCopyMode, isInitialized.value]);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        if (!groupId) return;

        try {
            if (isEditMode && expenseId) {
                await expenseFormStore.updateExpense(groupId, expenseId);
                // Navigate back to expense detail after successful update
                route(`/groups/${groupId}/expenses/${expenseId}`);
            } else {
                await expenseFormStore.saveExpense(groupId);
                // Navigate back to group detail after creating new expense (including copy mode)
                route(`/groups/${groupId}`);
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
            route(`/groups/${groupId}/expenses/${expenseId}`);
        } else {
            // Navigate back to group detail when canceling create
            route(`/groups/${groupId}`);
        }
    };

    const handleAmountChange = (e: Event) => {
        const input = e.target as HTMLInputElement;
        // Keep the raw string value to preserve user input (e.g., "50.00")
        // The store will handle conversion to number when needed
        expenseFormStore.updateField('amount', input.value);
    };

    const handleParticipantToggle = (memberId: string) => {
        expenseFormStore.toggleParticipant(memberId);
    };

    const handleSelectAll = () => {
        const allMemberIds = members.value.map((m) => m.uid);
        expenseFormStore.setParticipants(allMemberIds);
    };

    const handleSelectNone = () => {
        // Keep only the payer
        expenseFormStore.setParticipants(paidBy.value ? [paidBy.value] : []);
    };

    // Wrapper for updateField to handle type issues
    const updateField = (field: string, value: any) => {
        expenseFormStore.updateField(field as any, value);
    };

    return {
        // State
        isInitialized: isInitialized.value,
        initError: initError.value,
        loading: loading.value,
        saving: saving.value,
        formError: formError.value,
        validationErrors: validationErrors.value,
        isFormValid: isFormValid.value,
        hasRequiredFields: hasRequiredFields.value,
        isDataReady: isDataReady.value,
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

        // Store data
        group: group.value,
        members: members.value,

        // Actions
        handleSubmit,
        handleCancel,
        handleAmountChange,
        handleParticipantToggle,
        handleSelectAll,
        handleSelectNone,
        updateField,
        updateSplitAmount: expenseFormStore.updateSplitAmount,
        updateSplitPercentage: expenseFormStore.updateSplitPercentage,

        // Helpers
        getRecentAmounts,
        PREDEFINED_EXPENSE_CATEGORIES,
    };
}
