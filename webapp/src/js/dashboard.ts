import { clearElement } from './utils/safe-dom.js';
import { GroupsList } from './groups.js';
import { authManager } from './auth.js';

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
    
    const bodyContent = `
      <div id="warningBanner" class="warning-banner" style="display: none;">
        <div class="warning-content">
          <i class="fas fa-exclamation-triangle"></i>
          <span id="warningMessage"></span>
        </div>
      </div>
      
      <header class="dashboard-header">
        <div class="dashboard-container">
          <h1 class="dashboard-title">
            <a href="dashboard.html" class="dashboard-title-link">Splitifyd</a>
          </h1>
          <button type="button" class="button button--logout" id="logoutButton">
            Logout
          </button>
        </div>
      </header>
      
      <main class="dashboard-main">
        <div class="dashboard-container">
          <section class="dashboard-content">
            <div id="groupsContainer" class="groups-container">
              <div class="loading-state" id="loadingState">
                <p>Loading your groups...</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    `;
    
    // Create body content safely
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = bodyContent;
    while (tempDiv.firstChild) {
      document.body.appendChild(tempDiv.firstChild);
    }

    // Add logout functionality
    const logoutButton = document.getElementById('logoutButton') as HTMLButtonElement;
    if (logoutButton) {
      logoutButton.addEventListener('click', (): void => {
        authManager.logout();
      });
    }

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
      loadScript('/js/firebase-config.js'),
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

  } catch (error) {
    // Handle page rendering errors
    clearElement(document.body);
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'padding: 20px; color: red; background: white;';
    
    const title = document.createElement('h1');
    title.textContent = 'Error loading dashboard';
    errorDiv.appendChild(title);
    
    const message = document.createElement('pre');
    message.textContent = error instanceof Error ? error.message : String(error);
    errorDiv.appendChild(message);
    
    document.body.appendChild(errorDiv);
  }
});