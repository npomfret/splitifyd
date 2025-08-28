import { useSignal } from '@preact/signals';
import type { SettlementListItem } from '@splitifyd/shared';

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
    
    // Modal data states
    const settlementToEdit = useSignal<SettlementListItem | null>(null);
    
    // Modal actions
    const openShareModal = () => {
        showShareModal.value = true;
    };
    
    const closeShareModal = () => {
        showShareModal.value = false;
    };
    
    const openSettlementForm = (settlement?: SettlementListItem) => {
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
    
    return {
        // Modal visibility states
        showShareModal: showShareModal.value,
        showSettlementForm: showSettlementForm.value,
        showSettlementHistory: showSettlementHistory.value,
        showEditModal: showEditModal.value,
        
        // Modal data
        settlementToEdit: settlementToEdit.value,
        
        // Modal actions
        openShareModal,
        closeShareModal,
        openSettlementForm,
        closeSettlementForm,
        toggleSettlementHistory,
        openEditModal,
        closeEditModal,
    };
}