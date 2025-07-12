
import { createElementSafe } from '../utils/safe-dom.js';
import { ModalConfig, ModalConfirmConfig } from '../types/components';
import { BaseComponent } from './base-component';
import { hideElement, showElement } from '../utils/ui-visibility.js';

interface ExtendedModalConfig extends Partial<ModalConfig> {
  body?: string | Node;
  footer?: string | Node;
  size?: 'small' | 'medium' | 'large';
  closeButton?: boolean;
}

interface InternalModalConfirmConfig extends ModalConfirmConfig {
  confirmClass?: string;
}

export class ModalComponent extends BaseComponent<HTMLElement> {
  private config: ExtendedModalConfig;

  constructor(config: ExtendedModalConfig) {
    super();
    this.config = config;
  }

  protected render(): HTMLElement {
    const { id, title, body = '', footer, size = 'medium', closeButton = true } = this.config;

    const modalOverlay = createElementSafe('div', {
      id,
      className: 'modal-overlay hidden'
    });

    const modalContent = createElementSafe('div', {
      className: `modal-content modal-${size}`
    });

    const modalHeader = createElementSafe('div', {
      className: 'modal-header'
    });

    const modalTitle = createElementSafe('h3', {
      className: 'modal-title',
      textContent: title
    });
    modalHeader.appendChild(modalTitle);

    if (closeButton) {
      const closeBtn = createElementSafe('button', {
        className: 'modal-close',
        'data-modal-close': id,
        textContent: '×'
      });
      modalHeader.appendChild(closeBtn);
    }

    const modalBody = createElementSafe('div', {
      className: 'modal-body'
    });
    
    if (typeof body === 'string') {
      modalBody.innerHTML = body;
    } else if (body instanceof Node) {
      modalBody.appendChild(body);
    }

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);

    if (footer) {
      const modalFooter = createElementSafe('div', {
        className: 'modal-footer'
      });
      
      if (typeof footer === 'string') {
        modalFooter.innerHTML = footer;
      } else if (footer instanceof Node) {
        modalFooter.appendChild(footer);
      }
      
      modalContent.appendChild(modalFooter);
    }

    modalOverlay.appendChild(modalContent);
    this.element = modalOverlay;
    return modalOverlay;
  }

  public show(): void {
    if (!this.element) return;
    showElement(this.element, 'flex'); // Use 'flex' because the modal uses 'visible-flex' class
    document.body.classList.add('modal-open');
  }

  public hide(): void {
    if (!this.element) return;
    hideElement(this.element);
    document.body.classList.remove('modal-open');
  }

  protected setupEventListeners(): void {
    if (!this.element) return;

    const closeBtn = this.element.querySelector(`[data-modal-close="${this.config.id}"]`) as HTMLButtonElement | null;
    if (closeBtn) {
      closeBtn.addEventListener('click', this.handleClose);
    }

    this.element.addEventListener('click', this.handleOverlayClick);
  }

  private handleClose = (): void => {
    this.hide();
  }

  private handleOverlayClick = (e: MouseEvent): void => {
    if (e.target === this.element) {
      this.hide();
    }
  }

  protected cleanup(): void {
    if (!this.element) return;

    const closeBtn = this.element.querySelector(`[data-modal-close="${this.config.id}"]`) as HTMLButtonElement | null;
    if (closeBtn) {
      closeBtn.removeEventListener('click', this.handleClose);
    }

    this.element.removeEventListener('click', this.handleOverlayClick);
  }

  static confirm(config: InternalModalConfirmConfig): void {
    const { title = 'Confirm', message = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel', confirmClass = 'button--danger', onConfirm, onCancel } = config;

    const modalId = `confirmModal_${Date.now()}`;
    
    const bodyElement = createElementSafe('p', { textContent: message });
    
    const footerElement = document.createElement('div');
    const cancelButton = createElementSafe('button', {
      className: 'button button--secondary',
      textContent: cancelText
    });
    const confirmButton = createElementSafe('button', {
      className: `button ${confirmClass}`,
      textContent: confirmText
    });
    
    footerElement.appendChild(cancelButton);
    footerElement.appendChild(confirmButton);

    const modal = new ModalComponent({
      id: modalId,
      title,
      body: bodyElement,
      footer: footerElement
    });

    modal.mount(document.body);
    modal.show();

    confirmButton.addEventListener('click', () => {
      modal.hide();
      modal.unmount();
      if (onConfirm) onConfirm();
    });

    cancelButton.addEventListener('click', () => {
      modal.hide();
      modal.unmount();
      if (onCancel) onCancel();
    });
  }
}
