import { logger } from './utils/logger.js';
import { AppInit } from './app-init.js';
import { apiService } from './api.js';

async function handleJoinGroup() {
    const urlParams = new URLSearchParams(window.location.search);
    const linkId = urlParams.get('linkId');
    
    if (!linkId) {
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Store the linkId for after authentication
    sessionStorage.setItem('pendingJoinLinkId', linkId);
    
    try {
        await AppInit.initialize({
            requireAuth: true,
            onAuthStateChanged: async (user) => {
                if (user) {
                    await processJoinGroup(linkId);
                } else {
                    // User needs to log in first
                    window.location.href = `index.html?join=${linkId}`;
                }
            }
        });
    } catch (error) {
        logger.error('Error initializing app:', error);
        AppInit.showError('Failed to initialize. Please try again.');
    }
}

async function processJoinGroup(linkId) {
    try {
        AppInit.showError('Joining group...', 0);
        
        const response = await apiService.joinGroupByLink(linkId);
        
        if (response.success) {
            AppInit.hideError();
            sessionStorage.removeItem('pendingJoinLinkId');
            
            // Show success message and redirect to group
            showMessage(`Successfully joined ${response.data.groupName}!`, 'success');
            
            setTimeout(() => {
                window.location.href = `group-detail.html?id=${response.data.groupId}`;
            }, 1500);
        }
    } catch (error) {
        logger.error('Error joining group:', error);
        
        if (error.message.includes('already a member')) {
            AppInit.showError('You are already a member of this group');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        } else if (error.message.includes('Invalid or expired')) {
            AppInit.showError('This invite link is invalid or has expired');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 3000);
        } else {
            AppInit.showError('Failed to join group. Please try again.');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 3000);
        }
    }
}

function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => {
            messageDiv.remove();
        }, 300);
    }, 3000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', handleJoinGroup);
