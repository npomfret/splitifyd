import { createElementSafe } from '../utils/safe-dom.js';

export class ModalComponent {
  static activeModals = new Map();

  static render(config) {
    const {
      id,
      title,
      body,
      footer,
      size = 'medium',
      closeButton = true
    } = config;

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
    return modalOverlay.outerHTML;
  }

  static show(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('visible-flex');
      document.body.classList.add('modal-open');
      this.activeModals.set(modalId, modal);
      this.attachCloseHandlers(modalId);
    }
  }

  static hide(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('visible-flex');
      if (this.activeModals.size === 1) {
        document.body.classList.remove('modal-open');
      }
      this.activeModals.delete(modalId);
    }
  }

  static attachCloseHandlers(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const closeBtn = modal.querySelector(`[data-modal-close="${modalId}"]`);
    if (closeBtn) {
      closeBtn.onclick = () => this.hide(modalId);
    }

    modal.onclick = (e) => {
      if (e.target === modal) {
        this.hide(modalId);
      }
    };
  }

  static confirm(config) {
    const {
      title = 'Confirm',
      message = 'Are you sure?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      confirmClass = 'button--danger',
      onConfirm,
      onCancel
    } = config;

    const modalId = `confirmModal_${Date.now()}`;
    
    const bodyElement = createElementSafe('p', { textContent: message });
    
    const footerElement = createElementSafe('div');
    const cancelButton = createElementSafe('button', {
      className: 'button button--secondary',
      id: `${modalId}_cancel`,
      textContent: cancelText
    });
    const confirmButton = createElementSafe('button', {
      className: `button ${confirmClass}`,
      id: `${modalId}_confirm`,
      textContent: confirmText
    });
    
    footerElement.appendChild(cancelButton);
    footerElement.appendChild(confirmButton);

    const modalHtml = this.render({
      id: modalId,
      title,
      body: bodyElement,
      footer: footerElement
    });

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild);

    this.show(modalId);

    document.getElementById(`${modalId}_confirm`).onclick = () => {
      this.hide(modalId);
      document.getElementById(modalId).remove();
      if (onConfirm) onConfirm();
    };

    document.getElementById(`${modalId}_cancel`).onclick = () => {
      this.hide(modalId);
      document.getElementById(modalId).remove();
      if (onCancel) onCancel();
    };
  }
}