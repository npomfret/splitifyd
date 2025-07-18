import { authManager } from './auth.js';
import { logger } from './utils/logger.js';
import { showError } from './utils/ui-messages.js';
import { apiCall } from './api.js';
import { firebaseAuthInstance } from './firebase-init.js';
import { AUTH_TOKEN_KEY } from './constants.js';
import { ROUTES } from './routes.js';

let groupsList: any | null = null;

export async function initializeDashboard(): Promise<void> {
  // Check authentication first
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    window.location.href = ROUTES.LOGIN;
    return;
  }

  // Work with existing DOM structure from dashboard.html
  const headerContainer = document.getElementById('header-container');
  if (!headerContainer) {
    logger.error('header-container element not found');
    return;
  }

  // TODO: Implement header without component
  if (headerContainer) {
    headerContainer.innerHTML = '<h1>Dashboard</h1><div class="balance-display">Balance: $0.00</div>';
  }

  // Dynamically import GroupsList when needed
  const { GroupsList } = await import('./groups.js');
  
  // Initialize groups list using existing DOM structure
  groupsList = new GroupsList('groupsContainer', null);
  await groupsList.loadGroups();
}