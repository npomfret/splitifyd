
import { authManager } from '../auth';
import { HeaderConfig } from '../types/components';
import { BaseComponent } from './base-component';
import { createElementSafe, appendChildren } from '../utils/safe-dom';

interface ExtendedHeaderConfig extends Partial<HeaderConfig> {
  titleLink?: string;
  totalOwed?: number;
  totalOwe?: number;
  showBalances?: boolean;
}

export class HeaderComponent extends BaseComponent<HTMLElement> {
  private config: ExtendedHeaderConfig;
  
  public updateBalances(totalOwed: number, totalOwe: number): void {
    if (!this.element) return;
    
    const owedAmountEl = this.element.querySelector('.header-balance-item--positive .header-balance-amount');
    const oweAmountEl = this.element.querySelector('.header-balance-item--negative .header-balance-amount');
    
    if (owedAmountEl) {
      owedAmountEl.textContent = `$${totalOwed.toFixed(2)}`;
    }
    if (oweAmountEl) {
      oweAmountEl.textContent = `$${totalOwe.toFixed(2)}`;
    }
  }

  constructor(config: ExtendedHeaderConfig = {}) {
    super();
    this.config = config;
  }

  protected render(): HTMLElement {
    const { 
      title = 'Dashboard',
      showLogout = true,
      titleLink = '/dashboard.html',
      totalOwed = 0,
      totalOwe = 0,
      showBalances = false
    } = this.config;

    const header = createElementSafe('header', { className: 'dashboard-header' });

    const container = createElementSafe('div', { className: 'container header-container' });

    const headerTitle = createElementSafe('h1', { className: 'header-title' });
    const headerImg = createElementSafe('img', { 
      className: 'dashboard-logo',
      src: '/images/logo.svg',
      alt: 'Logo'
    });
    headerTitle.appendChild(headerImg);
    container.appendChild(headerTitle);

    if (showBalances) {
      const balanceSummary = createElementSafe('div', { className: 'header-balance-summary' });
      
      const owedItem = createElementSafe('div', { className: 'header-balance-item header-balance-item--positive' });
      const owedLabel = createElementSafe('span', { className: 'header-balance-label', textContent: 'Owed' });
      const owedAmount = createElementSafe('span', { className: 'header-balance-amount', textContent: `$${totalOwed.toFixed(2)}` });
      appendChildren(owedItem, [owedLabel, owedAmount]);
      
      const oweItem = createElementSafe('div', { className: 'header-balance-item header-balance-item--negative' });
      const oweLabel = createElementSafe('span', { className: 'header-balance-label', textContent: 'Owe' });
      const oweAmount = createElementSafe('span', { className: 'header-balance-amount', textContent: `$${totalOwe.toFixed(2)}` });
      appendChildren(oweItem, [oweLabel, oweAmount]);
      
      appendChildren(balanceSummary, [owedItem, oweItem]);
      container.appendChild(balanceSummary);
    }

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
