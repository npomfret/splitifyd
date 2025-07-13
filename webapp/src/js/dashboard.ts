import { authManager } from './auth.js';
import { HeaderComponent } from './components/header.js';
import { logger } from './utils/logger.js';
import { showError } from './utils/ui-messages.js';
import { apiCall } from './api.js';
import { firebaseAuthInstance } from './firebase-init.js';

let groupsList: any | null = null;

export async function initializeDashboard(): Promise<void> {
  try {
    // Check authentication first
    const token = localStorage.getItem('splitifyd_auth_token');
    if (!token) {
      window.location.href = '/login.html';
      return;
    }

    // Ensure user document exists before proceeding
    await ensureUserDocumentExists();

    // Work with existing DOM structure from dashboard.html
    const headerContainer = document.getElementById('header-container');
    if (!headerContainer) {
      logger.error('header-container element not found');
      return;
    }

    // Mount header component
    const header = new HeaderComponent({ title: 'Splitifyd', showLogout: true });
    header.mount(headerContainer);

    // Dynamically import GroupsList when needed
    const { GroupsList } = await import('./groups.js');
    
    // Initialize groups list using existing DOM structure
    groupsList = new GroupsList('groupsContainer');
    await groupsList.loadGroups();

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

async function ensureUserDocumentExists(): Promise<void> {
  try {
    // Try a simple groups list call to see if user document exists
    // This will fail if the user document doesn't exist in Firestore
    await apiCall('/listDocuments', { method: 'GET' });
    // If successful, user document exists (or at least the call works)
  } catch (error: any) {
    // If we get a 401, that's an auth issue, not a missing user document
    if (error.message?.includes('401')) {
      throw error;
    }
    
    // For other errors (likely missing user document), try to create it
    logger.log('User document may not exist, attempting to create it');
    try {
      await createUserDocument();
      logger.log('User document created, retrying original request');
    } catch (createError: any) {
      logger.error('Failed to create user document:', createError);
      // If user document creation fails, let the original error bubble up
      throw error;
    }
  }
}

async function createUserDocument(): Promise<void> {
  if (!firebaseAuthInstance) {
    throw new Error('Firebase not initialized');
  }
  
  const firebaseUser = firebaseAuthInstance.getCurrentUser();
  if (!firebaseUser) {
    throw new Error('No authenticated user found');
  }

  const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
  
  await apiCall('/createUserDocument', {
    method: 'POST',
    body: JSON.stringify({ displayName })
  });
  
  logger.log('User document created successfully');
}