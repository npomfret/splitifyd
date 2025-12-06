import { ROUTES } from '@/constants/routes';
import { logError, logInfo } from '@/utils/browser-logger.ts';
import { extractTimeFromISO } from '@/utils/dateUtils.ts';
import { amountToSmallestUnit, CurrencyISOCode, toCurrencyISOCode } from '@billsplit-wl/shared';
import { ExpenseId, GroupId } from '@billsplit-wl/shared';
import { useComputed, useSignal } from '@preact/signals';
import { route } from 'preact-router';
import { useEffect } from 'preact/hooks';
import { apiClient } from '../apiClient';
import { expenseFormStore } from '../stores/expense-form-store';
import { enhancedGroupDetailStore } from '../stores/group-detail-store-enhanced';
import { useAuth } from './useAuth';

interface UseFormInitializationOptions {
    isOpen: boolean;
    groupId: GroupId;
    expenseId?: ExpenseId | null;
    isEditMode: boolean;
    isCopyMode?: boolean;
    sourceExpenseId?: ExpenseId | null;
}

/**
 * Hook that handles form initialization for different modes (create, edit, copy)
 * Manages loading data and populating the form based on the mode
 */
export function useFormInitialization({ isOpen, groupId, expenseId, isEditMode, isCopyMode, sourceExpenseId }: UseFormInitializationOptions) {
    const isInitialized = useSignal(false);
    const initError = useSignal<string | null>(null);
    const authStore = useAuth();

    // Computed values from stores
    const group = useComputed(() => enhancedGroupDetailStore.group);
    const members = useComputed(() => enhancedGroupDetailStore.members);
    const expenses = useComputed(() => enhancedGroupDetailStore.expenses);
    const loading = useComputed(() => enhancedGroupDetailStore.loading);

    // Data readiness signal - only true when initialized, loading is false AND we have members
    const isDataReady = useComputed(() => {
        return isInitialized.value && !loading.value && members.value.length > 0;
    });

    // Load expense data for edit mode
    const loadExpenseForEdit = async (expenseId: ExpenseId) => {
        const expenseDetails = await apiClient.getExpenseFullDetails(expenseId);
        const expense = expenseDetails.expense;

        if (!expense) {
            throw new Error('Expense not found');
        }

        // Check if expense is locked
        if (expense.isLocked) {
            throw new Error('This expense cannot be edited because one or more participants have left the group.');
        }

        // Populate form with existing expense data
        expenseFormStore.updateField('description', expense.description);
        expenseFormStore.updateField('amount', expense.amount);
        expenseFormStore.updateField('currency', expense.currency);
        expenseFormStore.updateField('date', expense.date.split('T')[0]);
        expenseFormStore.updateField('time', extractTimeFromISO(expense.date));
        expenseFormStore.updateField('paidBy', expense.paidBy);
        expenseFormStore.updateField('label', expense.label);
        expenseFormStore.updateField('splitType', expense.splitType);

        // Set participants from expense splits
        const participantIds = expense.splits.map((split) => split.uid);
        expenseFormStore.setParticipants(participantIds);

        // Set splits based on split type
        expense.splits.forEach((split) => {
            if (expense.splitType === 'exact') {
                expenseFormStore.updateSplitAmount(split.uid, split.amount);
            } else if (expense.splitType === 'percentage') {
                const totalUnits = amountToSmallestUnit(expense.amount, expense.currency);
                const splitUnits = amountToSmallestUnit(split.amount, expense.currency);
                const percentage = totalUnits === 0 ? 0 : (splitUnits / totalUnits) * 100;
                expenseFormStore.updateSplitPercentage(split.uid, percentage);
            }
        });
    };

    // Load expense data for copy mode
    const loadExpenseForCopy = async (sourceExpenseId: ExpenseId) => {
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
        expenseFormStore.updateField('label', sourceExpense.label);
        expenseFormStore.updateField('splitType', sourceExpense.splitType);

        // Set participants from expense splits
        const participantIds = sourceExpense.splits.map((split) => split.uid);
        expenseFormStore.setParticipants(participantIds);

        // Set splits based on split type
        sourceExpense.splits.forEach((split) => {
            if (sourceExpense.splitType === 'exact') {
                expenseFormStore.updateSplitAmount(split.uid, split.amount);
            } else if (sourceExpense.splitType === 'percentage') {
                const totalUnits = amountToSmallestUnit(sourceExpense.amount, sourceExpense.currency);
                const splitUnits = amountToSmallestUnit(split.amount, sourceExpense.currency);
                const percentage = totalUnits === 0 ? 0 : (splitUnits / totalUnits) * 100;
                expenseFormStore.updateSplitPercentage(split.uid, percentage);
            }
        });
    };

    // Set default payer and currency for create mode
    const setDefaultsForCreateMode = () => {
        // Set default payer
        const currentUser = enhancedGroupDetailStore.members.find((m) => m.uid === authStore?.user?.uid);
        if (currentUser) {
            expenseFormStore.updateField('paidBy', currentUser.uid);
        }

        // Detect currency from existing group expenses (same logic as settlement form)
        const expenses = enhancedGroupDetailStore.expenses;
        let detectedCurrency: CurrencyISOCode = toCurrencyISOCode('USD'); // Default to USD... todo: have this as a defult for each user

        // Try to get currency from most recent expense
        if (expenses && expenses.length > 0) {
            detectedCurrency = expenses[0].currency;
        }

        // Set detected currency (defaults to USD if no expenses exist)
        expenseFormStore.updateField('currency', detectedCurrency);

        // Default to all group members as participants
        const allMemberUids = enhancedGroupDetailStore.members.map((m) => m.uid);
        expenseFormStore.setParticipants(allMemberUids);
    };

    // Initialize form when modal opens
    useEffect(() => {
        // Don't initialize if modal is closed
        if (!isOpen) {
            return;
        }

        if (!groupId) {
            initError.value = 'No group ID provided';
            route(ROUTES.DASHBOARD);
            return;
        }

        const initializeForm = async () => {
            try {
                // Reset initialization state for loading indicator
                isInitialized.value = false;
                initError.value = null;

                // Reset form to clean state
                expenseFormStore.reset();

                // Check if group data is already loaded by parent component
                // Parent component (GroupDetailPage) should have already registered/loaded the group
                if (!group.value || group.value.id !== groupId) {
                    // Only load if absolutely necessary - but don't create a subscription
                    // This is a one-time load for form initialization
                    try {
                        await enhancedGroupDetailStore.loadGroup(groupId);
                    } catch (error: any) {
                        // Handle 404 errors gracefully - group might have been deleted
                        if (error?.status === 404 || (error?.message && error.message.includes('404'))) {
                            logInfo('Group not found during form initialization - likely deleted', { groupId });
                            initError.value = 'Group no longer exists';
                            return;
                        }
                        throw error;
                    }
                }

                if (isEditMode && expenseId) {
                    await loadExpenseForEdit(expenseId);
                } else if (isCopyMode && sourceExpenseId) {
                    await loadExpenseForCopy(sourceExpenseId);
                } else {
                    setDefaultsForCreateMode();
                }

                // Capture the initial state after form has been populated
                // This allows hasUnsavedChanges() to correctly detect user modifications
                expenseFormStore.captureInitialState();

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
    }, [isOpen, groupId, isEditMode, expenseId, isCopyMode, sourceExpenseId]);

    return {
        isInitialized: isInitialized.value,
        initError: initError.value,
        isDataReady: isDataReady.value,
        loading: loading.value,
        group: group.value,
        members: members.value,
        expenses: expenses.value,
    };
}
