declare global {
    interface Window {
        showError: (message: string, details?: string) => void;
        showSuccess: (message: string) => void;
        showLoading: () => void;
        clearMessages: () => void;
        closeModal: (modalId?: string) => void;
    }
}

export {};
