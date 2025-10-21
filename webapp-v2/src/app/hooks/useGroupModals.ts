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
    const showSettlementHistory = useSignal(false);
    const showEditModal = useSignal(false);
    const showSecurityModal = useSignal(false);

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

    const toggleSettlementHistory = () => {
        showSettlementHistory.value = !showSettlementHistory.value;
    };

    const openEditModal = () => {
        showEditModal.value = true;
    };

    const closeEditModal = () => {
        showEditModal.value = false;
    };

    const openSecurityModal = () => {
        showSecurityModal.value = true;
    };

    const closeSecurityModal = () => {
        showSecurityModal.value = false;
    };

    return {
        // Modal visibility states (reactive signals)
        showShareModal,
        showSettlementForm,
        showSettlementHistory,
        showEditModal,
        showSecurityModal,

        // Modal data (reactive signal)
        settlementToEdit,

        // Modal actions
        openShareModal,
        closeShareModal,
        openSettlementForm,
        closeSettlementForm,
        toggleSettlementHistory,
        openEditModal,
        closeEditModal,
        openSecurityModal,
        closeSecurityModal,
    };
}
