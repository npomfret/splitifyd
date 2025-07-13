import { BaseComponent } from './base-component.js';

export interface ButtonConfig {
  text?: string;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'link' | 'logout' | 'icon';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  iconOnly?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  title?: string;
  id?: string;
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
      iconOnly: false,
      ...config
    };
  }

  protected render(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = this.config.type!;
    button.className = this.buildClassName();
    button.disabled = this.config.disabled || this.config.loading || false;
    
    if (this.config.id) {
      button.id = this.config.id;
    }
    
    if (this.config.title) {
      button.title = this.config.title;
    }
    
    if (this.config.ariaLabel) {
      button.setAttribute('aria-label', this.config.ariaLabel);
    }
    
    if (this.config.ariaDescribedBy) {
      button.setAttribute('aria-describedby', this.config.ariaDescribedBy);
    }

    if (this.config.loading) {
      button.setAttribute('aria-busy', 'true');
    }

    this.updateButtonContent(button);
    
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

    // Add icon-only class when no text is provided or iconOnly is explicitly true
    if (this.config.iconOnly || (!this.config.text && this.config.icon)) {
      classes.push('button--icon');
    }

    return classes.join(' ');
  }

  private updateButtonContent(button: HTMLButtonElement): void {
    // Clear existing content
    button.innerHTML = '';
    
    const isIconOnly = this.config.iconOnly || (!this.config.text && this.config.icon);
    
    if (this.config.loading) {
      const spinner = document.createElement('i');
      spinner.className = 'fas fa-spinner fa-spin';
      spinner.setAttribute('aria-hidden', 'true');
      button.appendChild(spinner);
      
      if (this.config.text && !isIconOnly) {
        button.appendChild(document.createTextNode(` ${this.config.text}`));
      }
    } else {
      if (this.config.icon && this.config.iconPosition === 'left') {
        const icon = document.createElement('i');
        icon.className = this.config.icon;
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);
        
        if (this.config.text && !isIconOnly) {
          button.appendChild(document.createTextNode(` ${this.config.text}`));
        }
      } else if (this.config.text && !isIconOnly) {
        button.appendChild(document.createTextNode(this.config.text));
        
        if (this.config.icon && this.config.iconPosition === 'right') {
          button.appendChild(document.createTextNode(' '));
          const icon = document.createElement('i');
          icon.className = this.config.icon;
          icon.setAttribute('aria-hidden', 'true');
          button.appendChild(icon);
        }
      } else if (this.config.icon) {
        // Icon-only mode
        const icon = document.createElement('i');
        icon.className = this.config.icon;
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);
      }
    }
    
    // Ensure proper accessibility for icon-only buttons
    if (isIconOnly && !this.config.ariaLabel && this.config.text) {
      button.setAttribute('aria-label', this.config.text);
    }
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
      this.updateButtonContent(this.element);
      
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
      this.element.className = this.buildClassName();
      this.updateButtonContent(this.element);
    }
  }

  public setIcon(icon: string): void {
    this.config.icon = icon;
    if (this.element) {
      this.element.className = this.buildClassName();
      this.updateButtonContent(this.element);
    }
  }

  public setVariant(variant: ButtonConfig['variant']): void {
    this.config.variant = variant;
    if (this.element) {
      this.element.className = this.buildClassName();
    }
  }

  public getElement(): HTMLButtonElement | null {
    return this.element;
  }

  protected cleanup(): void {
    if (this.element && this.config.onClick) {
      this.element.removeEventListener('click', this.config.onClick);
    }
  }
}