import { BaseComponent } from './base-component.js';

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
      const closeButton = document.createElement('button');
      closeButton.className = 'warning-banner__close';
      closeButton.type = 'button';
      closeButton.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
      closeButton.setAttribute('aria-label', 'Close banner');
      banner.appendChild(closeButton);
    }

    return banner;
  }

  protected setupEventListeners(): void {
    if (!this.element || !this.config.dismissible) return;

    const closeButton = this.element.querySelector('.warning-banner__close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hide());
    }
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