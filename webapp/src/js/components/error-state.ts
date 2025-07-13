import { BaseComponent } from './base-component.js';
import { ButtonComponent } from './button.js';

interface ErrorStateConfig {
  id: string;
  message?: string;
  type?: 'inline' | 'page' | 'toast';
  icon?: boolean;
  dismissible?: boolean;
  autoHideAfter?: number;
  onDismiss?: () => void;
}

export class ErrorStateComponent extends BaseComponent<HTMLDivElement> {
  private config: ErrorStateConfig;
  private autoHideTimeout: number | null = null;
  private dismissButton: ButtonComponent | null = null;

  constructor(config: ErrorStateConfig) {
    super();
    this.config = {
      type: 'inline',
      icon: true,
      dismissible: false,
      ...config
    };
  }

  protected render(): HTMLDivElement {
    const { id, message = '', type, icon, dismissible } = this.config;
    const typeClass = `error-state--${type}`;

    const errorDiv = document.createElement('div');
    errorDiv.id = id;
    errorDiv.className = `error-state ${typeClass}`;
    errorDiv.setAttribute('role', 'alert');
    if (!message) errorDiv.style.display = 'none';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'error-state__content';

    if (icon) {
      const iconElement = document.createElement('i');
      iconElement.className = 'error-state__icon fas fa-exclamation-circle';
      contentDiv.appendChild(iconElement);
    }

    const messageSpan = document.createElement('span');
    messageSpan.className = 'error-state__message';
    if (message) messageSpan.textContent = message;
    contentDiv.appendChild(messageSpan);

    errorDiv.appendChild(contentDiv);

    if (dismissible) {
      this.dismissButton = new ButtonComponent({
        variant: 'icon',
        icon: 'fas fa-times',
        ariaLabel: 'Dismiss error',
        onClick: () => {
          this.hide();
          if (this.config.onDismiss) {
            this.config.onDismiss();
          }
        }
      });
      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'error-state__dismiss-container';
      this.dismissButton.mount(buttonContainer);
      
      const buttonElement = buttonContainer.querySelector('button');
      if (buttonElement) {
        buttonElement.className = 'error-state__dismiss';
      }
      
      errorDiv.appendChild(buttonContainer);
    }

    return errorDiv;
  }

  protected setupEventListeners(): void {
    if (!this.element) return;
    
    const messageSpan = this.element.querySelector('.error-state__message');
    if (messageSpan && this.config.message) {
      messageSpan.textContent = this.config.message;
    }

    if (this.config.message && this.config.autoHideAfter) {
      this.setAutoHide(this.config.autoHideAfter);
    }
  }

  showError(message: string): void {
    if (this.element) {
      const messageSpan = this.element.querySelector('.error-state__message');
      if (messageSpan) {
        messageSpan.textContent = message;
      }
      this.element.style.display = 'block';
      
      if (this.config.type === 'toast') {
        this.element.classList.add('error-state--visible');
      }

      if (this.autoHideTimeout) {
        clearTimeout(this.autoHideTimeout);
      }

      if (this.config.autoHideAfter) {
        this.setAutoHide(this.config.autoHideAfter);
      }
    }
    this.config.message = message;
  }

  hide(): void {
    if (this.element) {
      if (this.config.type === 'toast') {
        this.element.classList.remove('error-state--visible');
        setTimeout(() => {
          if (this.element) {
            this.element.style.display = 'none';
          }
        }, 300);
      } else {
        this.element.style.display = 'none';
      }
    }

    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }
  }

  setType(type: 'inline' | 'page' | 'toast'): void {
    if (this.element) {
      this.element.classList.remove('error-state--inline', 'error-state--page', 'error-state--toast');
      this.element.classList.add(`error-state--${type}`);
    }
    this.config.type = type;
  }

  setDismissible(dismissible: boolean): void {
    if (this.element) {
      const existingButton = this.element.querySelector('.error-state__dismiss');
      
      if (dismissible && !existingButton) {
        this.dismissButton = new ButtonComponent({
          variant: 'icon',
          icon: 'fas fa-times',
          ariaLabel: 'Dismiss error',
          onClick: () => {
            this.hide();
            if (this.config.onDismiss) {
              this.config.onDismiss();
            }
          }
        });
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'error-state__dismiss-container';
        this.dismissButton.mount(buttonContainer);
        
        const buttonElement = buttonContainer.querySelector('button');
        if (buttonElement) {
          buttonElement.className = 'error-state__dismiss';
        }
        
        this.element.appendChild(buttonContainer);
      } else if (!dismissible && existingButton) {
        if (this.dismissButton) {
          this.dismissButton.unmount();
          this.dismissButton = null;
        }
        const container = this.element.querySelector('.error-state__dismiss-container');
        if (container) {
          container.remove();
        } else {
          existingButton.remove();
        }
      }
    }
    this.config.dismissible = dismissible;
  }

  private setAutoHide(duration: number): void {
    this.autoHideTimeout = window.setTimeout(() => {
      this.hide();
    }, duration);
  }

  protected cleanup(): void {
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }
    
    if (this.dismissButton) {
      this.dismissButton.unmount();
      this.dismissButton = null;
    }
  }
}