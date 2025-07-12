import { clearElement, createElementSafe, appendChildren } from './utils/safe-dom.js';
import { GroupsList } from './groups.js';
import { authManager } from './auth.js';
import { HeaderComponent } from './components/header.js';
import { logger } from './utils/logger.js';
import { showError } from './utils/ui-messages.js';

interface MetaElement {
  tag: string;
  attrs: Record<string, string>;
}

let groupsList: GroupsList | null = null;

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  try {
    // Add CSS to head safely
    const head = document.head;
    clearElement(head);
    
    const metaElements: MetaElement[] = [
      { tag: 'meta', attrs: { charset: 'UTF-8' } },
      { tag: 'meta', attrs: { name: 'viewport', content: 'width=device-width, initial-scale=1.0' } },
      { tag: 'meta', attrs: { 'http-equiv': 'Cache-Control', content: 'no-cache, no-store, must-revalidate' } },
      { tag: 'meta', attrs: { 'http-equiv': 'Pragma', content: 'no-cache' } },
      { tag: 'meta', attrs: { 'http-equiv': 'Expires', content: '0' } },
      { tag: 'title', attrs: { textContent: 'Splitifyd - Dashboard' } },
      { tag: 'link', attrs: { rel: 'stylesheet', href: `/css/main.css?v=${Date.now()}` } },
      { tag: 'link', attrs: { rel: 'stylesheet', href: `/css/utility.css?v=${Date.now()}` } },
      { tag: 'link', attrs: { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap', rel: 'stylesheet' } },
      { tag: 'link', attrs: { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' } }
    ];
    
    metaElements.forEach(({ tag, attrs }) => {
      const element = document.createElement(tag);
      Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'textContent') {
          element.textContent = value;
        } else {
          element.setAttribute(key, value);
        }
      });
      head.appendChild(element);
    });

    // Check authentication first
    const token = localStorage.getItem('splitifyd_auth_token');
    if (!token) {
      window.location.href = '/login.html';
      return;
    }

    // Render body content safely
    clearElement(document.body);
    
    // Create warning banner
    const warningBanner = createElementSafe('div', {
      id: 'warningBanner',
      className: 'warning-banner',
      style: 'display: none;'
    });
    const warningContent = createElementSafe('div', { className: 'warning-content' });
    const warningIcon = createElementSafe('i', { className: 'fas fa-exclamation-triangle' });
    const warningMessage = createElementSafe('span', { id: 'warningMessage' });
    appendChildren(warningContent, [warningIcon, warningMessage]);
    warningBanner.appendChild(warningContent);
    
    // Create header container
    const headerContainer = createElementSafe('div', { id: 'header-container' });
    
    // Create main content
    const main = createElementSafe('main', { className: 'dashboard-main' });
    const dashboardContainer = createElementSafe('div', { className: 'dashboard-container' });
    const dashboardContent = createElementSafe('section', { className: 'dashboard-content' });
    const groupsContainer = createElementSafe('div', {
      id: 'groupsContainer',
      className: 'groups-container'
    });
    const loadingState = createElementSafe('div', {
      className: 'loading-state',
      id: 'loadingState'
    });
    const loadingText = createElementSafe('p', { textContent: 'Loading your groups...' });
    
    loadingState.appendChild(loadingText);
    groupsContainer.appendChild(loadingState);
    dashboardContent.appendChild(groupsContainer);
    dashboardContainer.appendChild(dashboardContent);
    main.appendChild(dashboardContainer);
    
    // Append all to body
    appendChildren(document.body, [warningBanner, headerContainer, main]);

    // Mount header component
    const header = new HeaderComponent({ title: 'Splitifyd', showLogout: true });
    header.mount(headerContainer);

    // Load additional scripts
    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src + '?v=' + Date.now();
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.body.appendChild(script);
      });
    };

    // Load scripts
    Promise.all([
      loadScript('/js/warning-banner.js')
    ]).then(() => {
      // Scripts loaded successfully, now initialize groups list
      groupsList = new GroupsList('groupsContainer');
      groupsList.loadGroups();
    }).catch((error: Error) => {
      // Handle script loading errors
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding: 20px; color: red; background: white;';
      errorDiv.textContent = 'Error loading dashboard scripts: ' + error.message;
      document.body.appendChild(errorDiv);
    });

  } catch (error: any) {
    logger.error('Failed to load dashboard:', error);
    
    // Try to show error message using UI utilities if possible
    try {
      showError('Failed to load dashboard. Please refresh the page or try again later.');
    } catch {
      // Fallback if UI utilities fail
      clearElement(document.body);
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding: 20px; text-align: center; margin-top: 50px;';
      
      const title = document.createElement('h1');
      title.textContent = 'Unable to load dashboard';
      errorDiv.appendChild(title);
      
      const message = document.createElement('p');
      message.textContent = 'Please refresh the page or try again later.';
      errorDiv.appendChild(message);
      
      const retryButton = document.createElement('button');
      retryButton.textContent = 'Refresh Page';
      retryButton.style.cssText = 'margin-top: 20px; padding: 10px 20px; cursor: pointer;';
      retryButton.addEventListener('click', () => window.location.reload());
      errorDiv.appendChild(retryButton);
      
      document.body.appendChild(errorDiv);
    }
  }
});