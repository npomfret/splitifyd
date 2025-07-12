
import { BaseComponent } from './base-component';
import { NavigationConfig, NavigationAction } from '../types/components';

interface ExtendedNavigationAction extends NavigationAction {
  type?: 'button' | 'link';
  disabled?: boolean;
  handler?: (event: MouseEvent) => void;
}

interface ExtendedNavigationConfig extends Partial<NavigationConfig> {
  backText?: string;
  actions?: ExtendedNavigationAction[];
}

export class NavigationComponent extends BaseComponent<HTMLElement> {
  private config: ExtendedNavigationConfig;

  constructor(config: ExtendedNavigationConfig = {}) {
    super();
    this.config = config;
  }

  protected render(): HTMLElement {
    const { title = '', backUrl = null, backText = 'Back', actions = [] } = this.config;

    const nav = document.createElement('nav');
    nav.className = 'nav-header';

    let backButtonHTML = '';
    if (backUrl) {
      backButtonHTML = `
        <a href="${backUrl}" class="back-link">
          <i class="fas fa-arrow-left"></i> ${backText}
        </a>
      `;
    }

    const actionsHTML = actions.map(action => {
      if (action.type === 'button') {
        return `
          <button class="button ${action.class || 'button--secondary'}" id="${action.id || ''}" ${action.disabled ? 'disabled' : ''}>
            ${action.icon ? `<i class="${action.icon}"></i>` : ''}
            ${action.text || ''}
          </button>
        `;
      } else if (action.type === 'link') {
        return `
          <a href="${action.href || '#'}" class="button ${action.class || 'button--secondary'}" id="${action.id || ''}">
            ${action.icon ? `<i class="${action.icon}"></i>` : ''}
            ${action.text || ''}
          </a>
        `;
      }
      return '';
    }).join('');

    nav.innerHTML = `
      ${backButtonHTML}
      <h1 class="page-title">${title}</h1>
      <div class="header-actions">
        ${actionsHTML}
      </div>
    `;

    this.element = nav;
    return nav;
  }

  protected setupEventListeners(): void {
    if (!this.element) return;

    this.config.actions?.forEach(action => {
      if (action.type === 'button' && action.id && action.handler) {
        const button = this.element?.querySelector(`#${action.id}`) as HTMLButtonElement | null;
        if (button) {
          button.addEventListener('click', action.handler);
        }
      }
    });
  }

  protected cleanup(): void {
    if (!this.element) return;

    this.config.actions?.forEach(action => {
      if (action.type === 'button' && action.id && action.handler) {
        const button = this.element?.querySelector(`#${action.id}`) as HTMLButtonElement | null;
        if (button) {
          button.removeEventListener('click', action.handler);
        }
      }
    });
  }
}
