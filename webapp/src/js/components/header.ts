
import { authManager } from '../auth';
import { HeaderConfig } from '../types/components';
import { BaseComponent } from './base-component';

interface ExtendedHeaderConfig extends Partial<HeaderConfig> {
  titleLink?: string;
}

export class HeaderComponent extends BaseComponent<HTMLElement> {
  private config: ExtendedHeaderConfig;

  constructor(config: ExtendedHeaderConfig = {}) {
    super();
    this.config = config;
  }

  protected render(): HTMLElement {
    const { 
      title = 'Dashboard',
      showLogout = true,
      titleLink = '/dashboard.html'
    } = this.config;

    const header = document.createElement('header');
    header.className = 'header';

    header.innerHTML = `
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
    `;

    this.element = header;
    return header;
  }

  protected setupEventListeners(): void {
    if (!this.element) return;

    const logoutBtn = this.element.querySelector('#logoutBtn') as HTMLButtonElement | null;
    if (logoutBtn) {
      logoutBtn.addEventListener('click', this.handleLogout);
    }
  }

  private handleLogout = (): void => {
    authManager.logout();
  }

  protected cleanup(): void {
    if (!this.element) return;

    const logoutBtn = this.element.querySelector('#logoutBtn') as HTMLButtonElement | null;
    if (logoutBtn) {
      logoutBtn.removeEventListener('click', this.handleLogout);
    }
  }
}
