import { GroupsList } from './groups.js';
import { authManager } from './auth.js';
import { HeaderComponent } from './components/header.js';
import { logger } from './utils/logger.js';
import { showError } from './utils/ui-messages.js';

let groupsList: GroupsList | null = null;

export async function initializeDashboard(): Promise<void> {
  try {
    // Check authentication first
    const token = localStorage.getItem('splitifyd_auth_token');
    if (!token) {
      window.location.href = '/login.html';
      return;
    }

    // Work with existing DOM structure from dashboard.html
    const headerContainer = document.getElementById('header-container');
    if (!headerContainer) {
      logger.error('header-container element not found');
      return;
    }

    // Mount header component
    const header = new HeaderComponent({ title: 'Splitifyd', showLogout: true });
    header.mount(headerContainer);

    // Initialize groups list using existing DOM structure
    groupsList = new GroupsList('groupsContainer');
    groupsList.loadGroups();

  } catch (error: any) {
    logger.error('Failed to load dashboard:', error);
    
    // Try to show error message using UI utilities if possible
    try {
      showError('Failed to load dashboard. Please refresh the page or try again later.');
    } catch {
      // Fallback: show error in the groups container instead of clearing body
      const groupsContainer = document.getElementById('groupsContainer');
      if (groupsContainer) {
        groupsContainer.innerHTML = `
          <div style="padding: 20px; text-align: center; margin-top: 50px;">
            <h2>Unable to load dashboard</h2>
            <p>Please refresh the page or try again later.</p>
            <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">
              Refresh Page
            </button>
          </div>
        `;
      }
    }
  }
}