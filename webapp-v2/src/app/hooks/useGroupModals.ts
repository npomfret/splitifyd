import type { ExpenseId, SettlementWithMembers, SimplifiedDebt } from '@billsplit-wl/shared';
import { useSignal } from '@preact/signals';

type ExpenseFormMode = 'add' | 'edit' | 'copy';

/**
 * Custom hook to manage all modals used in the Group Detail page
 * Centralizes modal state management to reduce complexity in the main component
 */
export function useGroupModals() {
    // Modal visibility states
    const showShareModal = useSignal(false);
    const showSettlementForm = useSignal(false);
    const showGroupSettingsModal = useSignal(false);
    const showExpenseForm = useSignal(false);
    const showExpenseDetail = useSignal(false);
    const groupSettingsInitialTab = useSignal<'identity' | 'general' | 'security'>('general');

    // Modal data states
    const settlementToEdit = useSignal<SettlementWithMembers | null>(null);
    const preselectedDebt = useSignal<SimplifiedDebt | null>(null);
    const expenseFormMode = useSignal<ExpenseFormMode>('add');
    const targetExpenseId = useSignal<ExpenseId | null>(null);

    // Modal actions
    const openShareModal = () => {
        showShareModal.value = true;
    };

    const closeShareModal = () => {
        showShareModal.value = false;
    };

    const openSettlementForm = (settlement?: SettlementWithMembers, debt?: SimplifiedDebt) => {
        settlementToEdit.value = settlement || null;
        preselectedDebt.value = debt || null;
        showSettlementForm.value = true;
    };

    const closeSettlementForm = () => {
        showSettlementForm.value = false;
        settlementToEdit.value = null;
        preselectedDebt.value = null;
    };

    const openGroupSettingsModal = (tab: 'identity' | 'general' | 'security' = 'general') => {
        groupSettingsInitialTab.value = tab;
        showGroupSettingsModal.value = true;
    };

    const closeGroupSettingsModal = () => {
        showGroupSettingsModal.value = false;
    };

    const openExpenseForm = (mode: ExpenseFormMode, expenseId?: ExpenseId) => {
        expenseFormMode.value = mode;
        targetExpenseId.value = expenseId || null;
        showExpenseForm.value = true;
    };

    const closeExpenseForm = () => {
        showExpenseForm.value = false;
        targetExpenseId.value = null;
    };

    const openExpenseDetail = (expenseId: ExpenseId) => {
        targetExpenseId.value = expenseId;
        showExpenseDetail.value = true;
    };

    const closeExpenseDetail = () => {
        showExpenseDetail.value = false;
        targetExpenseId.value = null;
    };

    return {
        // Modal visibility states (reactive signals)
        showShareModal,
        showSettlementForm,
        showGroupSettingsModal,
        showExpenseForm,
        showExpenseDetail,
        groupSettingsInitialTab,

        // Modal data (reactive signals)
        settlementToEdit,
        preselectedDebt,
        expenseFormMode,
        targetExpenseId,

        // Modal actions
        openShareModal,
        closeShareModal,
        openSettlementForm,
        closeSettlementForm,
        openGroupSettingsModal,
        closeGroupSettingsModal,
        openExpenseForm,
        closeExpenseForm,
        openExpenseDetail,
        closeExpenseDetail,
    };
}
