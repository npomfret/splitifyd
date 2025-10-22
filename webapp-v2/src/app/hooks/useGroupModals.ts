import { useSignal } from '@preact/signals';
import type { SettlementWithMembers } from '@splitifyd/shared';

/**
 * Custom hook to manage all modals used in the Group Detail page
 * Centralizes modal state management to reduce complexity in the main component
 */
export function useGroupModals() {
    // Modal visibility states
    const showShareModal = useSignal(false);
    const showSettlementForm = useSignal(false);
    const showGroupSettingsModal = useSignal(false);
    const groupSettingsInitialTab = useSignal<'general' | 'security'>('general');

    // Modal data states
    const settlementToEdit = useSignal<SettlementWithMembers | null>(null);

    // Modal actions
    const openShareModal = () => {
        showShareModal.value = true;
    };

    const closeShareModal = () => {
        showShareModal.value = false;
    };

    const openSettlementForm = (settlement?: SettlementWithMembers) => {
        settlementToEdit.value = settlement || null;
        showSettlementForm.value = true;
    };

    const closeSettlementForm = () => {
        showSettlementForm.value = false;
        settlementToEdit.value = null;
    };

    const openGroupSettingsModal = (tab: 'general' | 'security' = 'general') => {
        groupSettingsInitialTab.value = tab;
        showGroupSettingsModal.value = true;
    };

    const closeGroupSettingsModal = () => {
        showGroupSettingsModal.value = false;
    };

    return {
        // Modal visibility states (reactive signals)
        showShareModal,
        showSettlementForm,
        showGroupSettingsModal,
        groupSettingsInitialTab,

        // Modal data (reactive signal)
        settlementToEdit,

        // Modal actions
        openShareModal,
        closeShareModal,
        openSettlementForm,
        closeSettlementForm,
        openGroupSettingsModal,
        closeGroupSettingsModal,
    };
}
