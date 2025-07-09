// Event handlers for group-detail.html
export function initializeGroupDetailHandlers() {
    // Back button handler
    const backButton = document.querySelector('.back-button');
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

export function closeGroupSettingsModal() {
    const modal = document.getElementById('groupSettingsModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('visible-flex');
        document.body.classList.remove('modal-open');
    }
}

export function closeInviteMembersModal() {
    const modal = document.getElementById('inviteMembersModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('visible-flex');
        document.body.classList.remove('modal-open');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeGroupDetailHandlers);

// Make functions globally available for any remaining inline handlers
window.closeGroupSettingsModal = closeGroupSettingsModal;
window.closeInviteMembersModal = closeInviteMembersModal;