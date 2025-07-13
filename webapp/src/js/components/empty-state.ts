import { BaseComponent } from './base-component';
import { ButtonComponent, ButtonConfig } from './button';

export interface EmptyStateAction extends ButtonConfig {
  text: string;
}

export interface EmptyStateConfig {
  icon?: string;
  title: string;
  message?: string;
  actions?: EmptyStateAction[];
  className?: string;
}

export class EmptyStateComponent extends BaseComponent<HTMLDivElement> {
  private config: EmptyStateConfig;
  private buttons: ButtonComponent[] = [];

  constructor(config: EmptyStateConfig) {
    super();
    this.config = config;
  }

  protected render(): HTMLDivElement {
    const container = document.createElement('div');
    
    const classes = ['empty-state'];
    if (this.config.className) {
      classes.push(...this.config.className.split(' '));
    }
    
    container.className = classes.join(' ');

    if (this.config.icon) {
      const iconContainer = document.createElement('div');
      iconContainer.className = 'empty-state__icon';
      iconContainer.innerHTML = `<i class="${this.config.icon}"></i>`;
      container.appendChild(iconContainer);
    }

    const title = document.createElement('h3');
    title.textContent = this.config.title;
    container.appendChild(title);

    if (this.config.message) {
      const message = document.createElement('p');
      message.textContent = this.config.message;
      container.appendChild(message);
    }

    if (this.config.actions && this.config.actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'empty-state__actions';

      this.config.actions.forEach(action => {
        const button = new ButtonComponent(action);
        this.buttons.push(button);
        button.mount(actionsContainer);
      });

      container.appendChild(actionsContainer);
    }

    return container;
  }

  protected cleanup(): void {
    this.buttons.forEach(button => button.unmount());
    this.buttons = [];
  }

  public setTitle(title: string): void {
    this.config.title = title;
    if (this.element) {
      const titleElement = this.element.querySelector('h3');
      if (titleElement) {
        titleElement.textContent = title;
      }
    }
  }

  public setMessage(message: string): void {
    this.config.message = message;
    if (this.element) {
      let messageElement = this.element.querySelector('p');
      if (messageElement) {
        messageElement.textContent = message;
      } else if (message) {
        messageElement = document.createElement('p');
        messageElement.textContent = message;
        const title = this.element.querySelector('h3');
        if (title && title.nextSibling) {
          this.element.insertBefore(messageElement, title.nextSibling);
        } else {
          this.element.appendChild(messageElement);
        }
      }
    }
  }
}