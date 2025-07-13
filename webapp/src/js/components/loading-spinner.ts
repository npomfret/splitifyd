import { BaseComponent } from './base-component.js';

interface LoadingSpinnerConfig {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'overlay' | 'inline';
  showMessage?: boolean;
  customClass?: string;
}

export class LoadingSpinnerComponent extends BaseComponent<HTMLDivElement> {
  private config: LoadingSpinnerConfig;

  constructor(config: LoadingSpinnerConfig = {}) {
    super();
    this.config = {
      message: 'Loading...',
      size: 'medium',
      variant: 'default',
      showMessage: true,
      ...config
    };
  }

  protected render(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = this.buildClassName();
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    
    if (this.config.variant === 'overlay') {
      container.setAttribute('aria-label', this.config.message || 'Loading');
    }

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner__icon';
    spinner.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>';
    container.appendChild(spinner);

    if (this.config.showMessage && this.config.message) {
      const message = document.createElement('p');
      message.className = 'loading-spinner__message';
      message.textContent = this.config.message;
      container.appendChild(message);
    }

    if (this.config.variant === 'overlay') {
      this.addOverlayStyles(container);
    }

    return container;
  }

  private buildClassName(): string {
    const classes = ['loading-spinner'];
    
    classes.push(`loading-spinner--${this.config.variant}`);
    classes.push(`loading-spinner--${this.config.size}`);
    
    if (this.config.customClass) {
      classes.push(this.config.customClass);
    }

    return classes.join(' ');
  }

  private addOverlayStyles(container: HTMLDivElement): void {
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.zIndex = '9999';
  }

  public updateMessage(message: string): void {
    this.config.message = message;
    if (this.element) {
      const messageElement = this.element.querySelector('.loading-spinner__message');
      if (messageElement) {
        messageElement.textContent = message;
      } else if (this.config.showMessage) {
        const newMessage = document.createElement('p');
        newMessage.className = 'loading-spinner__message';
        newMessage.textContent = message;
        this.element.appendChild(newMessage);
      }
      
      if (this.config.variant === 'overlay') {
        this.element.setAttribute('aria-label', message);
      }
    }
  }

  public show(): void {
    if (this.element) {
      this.element.style.display = this.config.variant === 'overlay' ? 'flex' : 'block';
      this.element.setAttribute('aria-hidden', 'false');
    }
  }

  public hide(): void {
    if (this.element) {
      this.element.style.display = 'none';
      this.element.setAttribute('aria-hidden', 'true');
    }
  }

  public static createOverlay(message = 'Loading...'): LoadingSpinnerComponent {
    return new LoadingSpinnerComponent({
      variant: 'overlay',
      message,
      size: 'large'
    });
  }

  public static createInline(message?: string): LoadingSpinnerComponent {
    return new LoadingSpinnerComponent({
      variant: 'inline',
      message,
      size: 'small',
      showMessage: !!message
    });
  }
}