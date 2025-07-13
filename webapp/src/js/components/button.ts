import { BaseComponent } from './base-component.js';

interface ButtonConfig {
  text: string;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'link';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  ariaLabel?: string;
  ariaDescribedBy?: string;
  onClick?: (event: MouseEvent) => void;
}

export class ButtonComponent extends BaseComponent<HTMLButtonElement> {
  private config: ButtonConfig;

  constructor(config: ButtonConfig) {
    super();
    this.config = {
      type: 'button',
      variant: 'primary',
      size: 'medium',
      disabled: false,
      loading: false,
      iconPosition: 'left',
      ...config
    };
  }

  protected render(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = this.config.type!;
    button.className = this.buildClassName();
    button.disabled = this.config.disabled || this.config.loading || false;
    
    if (this.config.ariaLabel) {
      button.setAttribute('aria-label', this.config.ariaLabel);
    }
    
    if (this.config.ariaDescribedBy) {
      button.setAttribute('aria-describedby', this.config.ariaDescribedBy);
    }

    if (this.config.loading) {
      button.setAttribute('aria-busy', 'true');
    }

    button.innerHTML = this.buildContent();
    
    return button;
  }

  private buildClassName(): string {
    const classes = ['button'];
    
    classes.push(`button--${this.config.variant}`);
    
    if (this.config.size !== 'medium') {
      classes.push(`button--${this.config.size}`);
    }
    
    if (this.config.loading) {
      classes.push('button--loading');
    }
    
    if (this.config.disabled) {
      classes.push('button--disabled');
    }

    return classes.join(' ');
  }

  private buildContent(): string {
    let content = '';
    
    if (this.config.loading) {
      content += '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>';
      if (this.config.text) {
        content += ` ${this.config.text}`;
      }
    } else {
      if (this.config.icon && this.config.iconPosition === 'left') {
        content += `<i class="${this.config.icon}" aria-hidden="true"></i>`;
        if (this.config.text) {
          content += ` ${this.config.text}`;
        }
      } else if (this.config.text) {
        content += this.config.text;
        if (this.config.icon && this.config.iconPosition === 'right') {
          content += ` <i class="${this.config.icon}" aria-hidden="true"></i>`;
        }
      } else if (this.config.icon) {
        content += `<i class="${this.config.icon}" aria-hidden="true"></i>`;
      }
    }
    
    return content;
  }

  protected setupEventListeners(): void {
    if (!this.element || !this.config.onClick) return;
    
    this.element.addEventListener('click', this.config.onClick);
  }

  public setLoading(loading: boolean): void {
    this.config.loading = loading;
    if (this.element) {
      this.element.disabled = this.config.disabled || loading;
      this.element.className = this.buildClassName();
      this.element.innerHTML = this.buildContent();
      
      if (loading) {
        this.element.setAttribute('aria-busy', 'true');
      } else {
        this.element.removeAttribute('aria-busy');
      }
    }
  }

  public setDisabled(disabled: boolean): void {
    this.config.disabled = disabled;
    if (this.element) {
      this.element.disabled = disabled || this.config.loading || false;
      this.element.className = this.buildClassName();
    }
  }

  public setText(text: string): void {
    this.config.text = text;
    if (this.element) {
      this.element.innerHTML = this.buildContent();
    }
  }

  protected cleanup(): void {
    if (this.element && this.config.onClick) {
      this.element.removeEventListener('click', this.config.onClick);
    }
  }
}