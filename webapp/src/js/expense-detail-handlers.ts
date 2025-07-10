// Event handlers for expense-detail.html
window.addEventListener('DOMContentLoaded', () => {
    // Back button handler
    const backButton = document.querySelector('.back-button') as HTMLButtonElement;
    if (backButton) {
        backButton.addEventListener('click', () => {
            history.back();
        });
    }
    
    // Retry button handler
    const retryButton = document.querySelector('.btn.btn-secondary[onclick*="location.reload"]') as HTMLButtonElement;
    if (retryButton) {
        retryButton.addEventListener('click', () => {
            location.reload();
        });
    }
    
    // Delete modal close handlers
    const deleteModalCloseButtons = document.querySelectorAll('[onclick*="closeDeleteModal"]');
    deleteModalCloseButtons.forEach(button => {
        button.addEventListener('click', closeDeleteModal);
    });
});

function closeDeleteModal(): void {
    const modal = document.getElementById('deleteModal') as HTMLElement;
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('visible-flex');
        document.body.classList.remove('modal-open');
    }
}

// Make function globally available for any remaining inline handlers
(window as any).closeDeleteModal = closeDeleteModal;