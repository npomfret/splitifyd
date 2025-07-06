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

    return `
      <div id="${id}" class="modal-overlay hidden">
        <div class="modal-content modal-${size}">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            ${closeButton ? `<button class="modal-close" data-modal-close="${id}">&times;</button>` : ''}
          </div>
          <div class="modal-body">
            ${body}
          </div>
          ${footer ? `
            <div class="modal-footer">
              ${footer}
            </div>
          ` : ''}
        </div>
      </div>
    `;
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
      confirmClass = 'btn-danger',
      onConfirm,
      onCancel
    } = config;

    const modalId = `confirmModal_${Date.now()}`;
    
    const modalHtml = this.render({
      id: modalId,
      title,
      body: `<p>${message}</p>`,
      footer: `
        <button class="btn btn-secondary" id="${modalId}_cancel">${cancelText}</button>
        <button class="btn ${confirmClass}" id="${modalId}_confirm">${confirmText}</button>
      `
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