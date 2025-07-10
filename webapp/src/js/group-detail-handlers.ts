// Event handlers for group-detail.html
export function initializeGroupDetailHandlers(): void {
    // Back button handler
    const backButton = document.querySelector('.back-button') as HTMLButtonElement;
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
    
    // Group settings modal handlers
    const groupSettingsCloseButtons = document.querySelectorAll('[onclick*="closeGroupSettingsModal"]');
    groupSettingsCloseButtons.forEach(button => {
        button.addEventListener('click', closeGroupSettingsModal);
    });
    
    // Invite members modal handlers
    const inviteMembersCloseButtons = document.querySelectorAll('[onclick*="closeInviteMembersModal"]');
    inviteMembersCloseButtons.forEach(button => {
        button.addEventListener('click', closeInviteMembersModal);
    });
}

export function closeGroupSettingsModal(): void {
    const modal = document.getElementById('groupSettingsModal') as HTMLElement;
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('visible-flex');
        document.body.classList.remove('modal-open');
    }
}

export function closeInviteMembersModal(): void {
    const modal = document.getElementById('inviteMembersModal') as HTMLElement;
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('visible-flex');
        document.body.classList.remove('modal-open');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeGroupDetailHandlers);

// Make functions globally available for any remaining inline handlers
(window as any).closeGroupSettingsModal = closeGroupSettingsModal;
(window as any).closeInviteMembersModal = closeInviteMembersModal;