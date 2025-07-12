
import { BaseComponent } from './base-component';
import { NavigationConfig, NavigationAction } from '../types/components';
import { createElementSafe, appendChildren } from '../utils/safe-dom';

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

    const nav = createElementSafe('nav', { className: 'nav-header' });

    if (backUrl) {
      const backLink = createElementSafe('a', {
        href: backUrl,
        className: 'back-link'
      });
      const backIcon = createElementSafe('i', { className: 'fas fa-arrow-left' });
      backLink.appendChild(backIcon);
      backLink.appendChild(document.createTextNode(' ' + backText));
      nav.appendChild(backLink);
    }

    const pageTitle = createElementSafe('h1', {
      className: 'page-title',
      textContent: title
    });
    nav.appendChild(pageTitle);

    const headerActions = createElementSafe('div', { className: 'header-actions' });
    
    actions.forEach(action => {
      if (action.type === 'button') {
        const button = createElementSafe('button', {
          className: `button ${action.class || 'button--secondary'}`,
          id: action.id || '',
          disabled: action.disabled || false
        });
        
        if (action.icon) {
          const icon = createElementSafe('i', { className: action.icon });
          button.appendChild(icon);
        }
        
        if (action.text) {
          if (action.icon) {
            button.appendChild(document.createTextNode(' '));
          }
          button.appendChild(document.createTextNode(action.text));
        }
        
        headerActions.appendChild(button);
      } else if (action.type === 'link') {
        const link = createElementSafe('a', {
          href: action.href || '#',
          className: `button ${action.class || 'button--secondary'}`,
          id: action.id || ''
        });
        
        if (action.icon) {
          const icon = createElementSafe('i', { className: action.icon });
          link.appendChild(icon);
        }
        
        if (action.text) {
          if (action.icon) {
            link.appendChild(document.createTextNode(' '));
          }
          link.appendChild(document.createTextNode(action.text));
        }
        
        headerActions.appendChild(link);
      }
    });

    nav.appendChild(headerActions);

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
