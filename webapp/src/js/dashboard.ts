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

  // Render dashboard header
  if (headerContainer) {
    headerContainer.innerHTML = `
      <header class="dashboard-header">
        <div class="header-container">
          <h1 class="dashboard-title">
            <a href="/dashboard.html" class="dashboard-title-link">
              <img src="/images/logo.svg" alt="Bill Splitter" class="dashboard-logo">
            </a>
          </h1>
          <div class="header-balance-summary">
            <div class="header-balance-item header-balance-item--negative">
              <span class="header-balance-label">You Owe</span>
              <span class="header-balance-amount" id="total-owe-amount">$0.00</span>
            </div>
            <div class="header-balance-item header-balance-item--positive">
              <span class="header-balance-label">Owed to You</span>
              <span class="header-balance-amount" id="total-owed-amount">$0.00</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="button button--secondary" id="logout-button">
              <i class="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>
    `;
    
    // Initialize logout button
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        authManager.logout();
      });
    }
  }

  // Create header component with updateBalances method
  const headerComponent = {
    updateBalances: (totalOwed: number, totalOwe: number) => {
      const owedElement = document.getElementById('total-owed-amount');
      const oweElement = document.getElementById('total-owe-amount');
      
      if (owedElement) {
        owedElement.textContent = `$${totalOwed.toFixed(2)}`;
      }
      
      if (oweElement) {
        oweElement.textContent = `$${totalOwe.toFixed(2)}`;
      }
    }
  };

  // Dynamically import GroupsList when needed
  const { GroupsList } = await import('./groups.js');
  
  // Initialize groups list using existing DOM structure
  groupsList = new GroupsList('groupsContainer', headerComponent);
  await groupsList.loadGroups();
}