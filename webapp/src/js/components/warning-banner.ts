import { BaseComponent } from './base-component.js';
import { ButtonComponent } from './button.js';

interface WarningBannerConfig {
  message: string;
  type?: 'warning' | 'error' | 'info' | 'success';
  autoHide?: boolean;
  autoHideDelay?: number;
  dismissible?: boolean;
}

export class WarningBannerComponent extends BaseComponent<HTMLDivElement> {
  private config: WarningBannerConfig;
  private hideTimeout?: number;
  private closeButton: ButtonComponent | null = null;

  constructor(config: WarningBannerConfig) {
    super();
    this.config = {
      type: 'warning',
      autoHide: false,
      autoHideDelay: 5000,
      dismissible: true,
      ...config
    };
  }

  protected render(): HTMLDivElement {
    const banner = document.createElement('div');
    banner.id = 'warningBanner';
    banner.className = `warning-banner warning-banner--${this.config.type}`;
    
    const content = document.createElement('div');
    content.className = 'warning-banner__content';
    content.textContent = this.config.message;
    banner.appendChild(content);

    if (this.config.dismissible) {
      this.closeButton = new ButtonComponent({
        variant: 'icon',
        icon: 'fas fa-times',
        ariaLabel: 'Close banner',
        onClick: () => this.hide()
      });
      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'warning-banner__close-container';
      this.closeButton.mount(buttonContainer);
      
      const buttonElement = buttonContainer.querySelector('button');
      if (buttonElement) {
        buttonElement.className = 'warning-banner__close';
      }
      
      banner.appendChild(buttonContainer);
    }

    return banner;
  }

  protected setupEventListeners(): void {
    // No additional event listeners needed - ButtonComponent handles its own events
  }

  public show(): void {
    if (!this.element) return;
    
    this.element.classList.remove('hidden');
    this.element.setAttribute('aria-hidden', 'false');

    if (this.config.autoHide) {
      this.hideTimeout = window.setTimeout(() => {
        this.hide();
      }, this.config.autoHideDelay);
    }
  }

  public hide(): void {
    if (!this.element) return;
    
    this.element.classList.add('hidden');
    this.element.setAttribute('aria-hidden', 'true');
    
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = undefined;
    }
  }

  public updateMessage(message: string): void {
    if (!this.element) return;
    
    const content = this.element.querySelector('.warning-banner__content');
    if (content) {
      content.textContent = message;
    }
  }

  public updateType(type: WarningBannerConfig['type']): void {
    if (!this.element) return;
    
    this.element.className = this.element.className.replace(/warning-banner--\w+/, `warning-banner--${type}`);
  }

  protected cleanup(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = undefined;
    }
    
    if (this.closeButton) {
      this.closeButton.unmount();
      this.closeButton = null;
    }
  }

  public static createGlobalBanner(config: WarningBannerConfig): WarningBannerComponent {
    const banner = new WarningBannerComponent(config);
    const existingBanner = document.getElementById('warningBanner');
    
    if (existingBanner) {
      existingBanner.remove();
    }
    
    banner.mount(document.body);
    return banner;
  }
}