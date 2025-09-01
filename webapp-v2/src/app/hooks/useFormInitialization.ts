import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { ROUTES } from '@/constants/routes';
import { expenseFormStore } from '../stores/expense-form-store';
import { enhancedGroupDetailStore } from '../stores/group-detail-store-enhanced';
import { apiClient } from '../apiClient';
import { logError } from '@/utils/browser-logger.ts';
import { useAuth } from './useAuth';
import { extractTimeFromISO } from '@/utils/dateUtils.ts';

interface UseFormInitializationOptions {
    groupId: string;
    expenseId?: string | null;
    isEditMode: boolean;
    isCopyMode?: boolean;
    sourceExpenseId?: string | null;
}

/**
 * Hook that handles form initialization for different modes (create, edit, copy)
 * Manages loading data and populating the form based on the mode
 */
export function useFormInitialization({ 
    groupId, 
    expenseId, 
    isEditMode, 
    isCopyMode, 
    sourceExpenseId 
}: UseFormInitializationOptions) {
    const isInitialized = useSignal(false);
    const initError = useSignal<string | null>(null);
    const authStore = useAuth();

    // Computed values from stores
    const group = useComputed(() => enhancedGroupDetailStore.group);
    const members = useComputed(() => enhancedGroupDetailStore.members);
    const loading = useComputed(() => enhancedGroupDetailStore.loading);

    // Data readiness signal - only true when initialized, loading is false AND we have members
    const isDataReady = useComputed(() => {
        return isInitialized.value && !loading.value && members.value.length > 0;
    });

    // Load expense data for edit mode
    const loadExpenseForEdit = async (expenseId: string) => {
        const expenseDetails = await apiClient.getExpenseFullDetails(expenseId);
        const expense = expenseDetails.expense;

        if (!expense) {
            throw new Error('Expense not found');
        }

        // Populate form with existing expense data
        expenseFormStore.updateField('description', expense.description);
        expenseFormStore.updateField('amount', expense.amount);
        expenseFormStore.updateField('currency', expense.currency);
        expenseFormStore.updateField('date', expense.date.split('T')[0]);
        expenseFormStore.updateField('time', extractTimeFromISO(expense.date));
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
    };

    // Load expense data for copy mode
    const loadExpenseForCopy = async (sourceExpenseId: string) => {
        const sourceExpenseDetails = await apiClient.getExpenseFullDetails(sourceExpenseId);
        const sourceExpense = sourceExpenseDetails.expense;

        if (!sourceExpense) {
            throw new Error('Source expense not found');
        }

        // Copy all fields except date/time (keep current defaults)
        expenseFormStore.updateField('description', sourceExpense.description);
        expenseFormStore.updateField('amount', sourceExpense.amount);
        expenseFormStore.updateField('currency', sourceExpense.currency);
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
    };

    // Set default payer for create mode
    const setDefaultPayer = () => {
        const currentUser = enhancedGroupDetailStore.members.find((m) => m.uid === authStore?.user?.uid);
        if (currentUser) {
            expenseFormStore.updateField('paidBy', currentUser.uid);
        }
    };

    // Initialize form on mount
    useEffect(() => {
        if (!groupId) {
            initError.value = 'No group ID provided';
            route(ROUTES.DASHBOARD);
            return;
        }

        const initializeForm = async () => {
            try {
                // Reset form to clean state
                expenseFormStore.reset();

                // Ensure group data is loaded
                if (!group.value || group.value.id !== groupId) {
                    await enhancedGroupDetailStore.loadGroup(groupId);
                }

                if (isEditMode && expenseId) {
                    await loadExpenseForEdit(expenseId);
                } else if (isCopyMode && sourceExpenseId) {
                    await loadExpenseForCopy(sourceExpenseId);
                } else {
                    setDefaultPayer();
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

    return {
        isInitialized: isInitialized.value,
        initError: initError.value,
        isDataReady: isDataReady.value,
        loading: loading.value,
        group: group.value,
        members: members.value,
    };
}