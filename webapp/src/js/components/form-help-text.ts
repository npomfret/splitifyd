import { BaseComponent } from './base-component.js';

interface FormHelpTextConfig {
  id: string;
  text: string;
  type?: 'default' | 'info' | 'success' | 'warning';
  icon?: boolean;
  visible?: boolean;
}

export class FormHelpTextComponent extends BaseComponent<HTMLDivElement> {
  private config: FormHelpTextConfig;

  constructor(config: FormHelpTextConfig) {
    super();
    this.config = {
      type: 'default',
      icon: false,
      visible: true,
      ...config
    };
  }

  protected render(): HTMLDivElement {
    const { id, text, type, icon, visible } = this.config;
    const typeClass = type !== 'default' ? `form-help--${type}` : '';

    const helpDiv = document.createElement('div');
    helpDiv.id = id;
    helpDiv.className = `form-help ${typeClass}`.trim();
    if (!visible) helpDiv.style.display = 'none';

    if (icon) {
      const iconElement = this.createIcon(type || 'default');
      if (iconElement) helpDiv.appendChild(iconElement);
    }

    const textSpan = document.createElement('span');
    textSpan.className = 'form-help__text';
    textSpan.textContent = text;
    helpDiv.appendChild(textSpan);

    return helpDiv;
  }

  setText(text: string): void {
    if (this.element) {
      const textSpan = this.element.querySelector('.form-help__text');
      if (textSpan) {
        textSpan.textContent = text;
      }
    }
    this.config.text = text;
  }

  setType(type: 'default' | 'info' | 'success' | 'warning'): void {
    if (this.element) {
      this.element.className = `form-help ${type !== 'default' ? `form-help--${type}` : ''}`.trim();
      
      if (this.config.icon) {
        const iconElement = this.element.querySelector('.form-help__icon');
        if (iconElement) {
          iconElement.remove();
        }
        
        const newIcon = this.createIcon(type);
        if (newIcon && this.element.firstChild) {
          this.element.insertBefore(newIcon, this.element.firstChild);
        }
      }
    }
    this.config.type = type;
  }

  show(): void {
    if (this.element) {
      this.element.style.display = 'block';
    }
    this.config.visible = true;
  }

  hide(): void {
    if (this.element) {
      this.element.style.display = 'none';
    }
    this.config.visible = false;
  }

  toggle(): void {
    if (this.config.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  private createIcon(type: string): HTMLElement | null {
    const iconMap: Record<string, string> = {
      'default': 'fa-info-circle',
      'info': 'fa-info-circle',
      'success': 'fa-check-circle',
      'warning': 'fa-exclamation-triangle'
    };
    
    const iconClass = iconMap[type];
    if (!iconClass) return null;
    
    const icon = document.createElement('i');
    icon.className = `form-help__icon fas ${iconClass}`;
    return icon;
  }
}