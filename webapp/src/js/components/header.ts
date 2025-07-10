import { authManager } from '../auth';
import { HeaderConfig } from '../types/components';

interface ExtendedHeaderConfig extends Partial<HeaderConfig> {
  titleLink?: string;
}

export class HeaderComponent {
  static render(config: ExtendedHeaderConfig = {}): string {
    const { 
      title = 'Dashboard',
      showLogout = true,
      titleLink = '/dashboard.html'
    } = config;

    return `
      <header class="header">
        <div class="container header-container">
          <h1 class="header-title">
            <a href="${titleLink}" class="header-link">${title}</a>
          </h1>
          ${showLogout ? `
            <button class="button button--secondary" id="logoutBtn">
              <i class="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          ` : ''}
        </div>
      </header>
    `;
  }

  static attachEventListeners(): void {
    const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement | null;
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        authManager.logout();
      });
    }
  }
}