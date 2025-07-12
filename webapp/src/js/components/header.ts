
import { authManager } from '../auth';
import { HeaderConfig } from '../types/components';
import { BaseComponent } from './base-component';
import { createElementSafe, appendChildren } from '../utils/safe-dom';

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

    const header = createElementSafe('header', { className: 'header' });

    const container = createElementSafe('div', { className: 'container header-container' });

    const headerTitle = createElementSafe('h1', { className: 'header-title' });
    const headerLink = createElementSafe('a', { 
      className: 'header-link', 
      href: titleLink,
      textContent: title 
    });
    headerTitle.appendChild(headerLink);
    container.appendChild(headerTitle);

    if (showLogout) {
      const logoutBtn = createElementSafe('button', { 
        className: 'button button--secondary',
        id: 'logoutBtn'
      });
      const icon = createElementSafe('i', { className: 'fas fa-sign-out-alt' });
      const span = createElementSafe('span', { textContent: 'Logout' });
      appendChildren(logoutBtn, [icon, span]);
      container.appendChild(logoutBtn);
    }

    header.appendChild(container);

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
