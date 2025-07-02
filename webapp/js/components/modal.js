class Modal {
    constructor(options = {}) {
        this.id = options.id || `modal_${Date.now()}`;
        this.title = options.title || '';
        this.content = options.content || '';
        this.size = options.size || 'medium';
        this.closeOnBackdrop = options.closeOnBackdrop !== false;
        this.closeOnEscape = options.closeOnEscape !== false;
        this.onClose = options.onClose || null;
        this.modal = null;
        this.isOpen = false;
    }

    open() {
        if (this.isOpen) return;
        
        this.create();
        document.body.appendChild(this.modal);
        document.body.classList.add('modal-open');
        
        this.attachEventListeners();
        
        requestAnimationFrame(() => {
            this.modal.classList.add('modal--open');
        });
        
        this.isOpen = true;
        this.focusFirstInput();
    }

    close() {
        if (!this.isOpen) return;
        
        this.modal.classList.remove('modal--open');
        
        setTimeout(() => {
            if (this.modal && this.modal.parentNode) {
                this.modal.parentNode.removeChild(this.modal);
            }
            document.body.classList.remove('modal-open');
            this.isOpen = false;
            
            if (this.onClose) {
                this.onClose();
            }
        }, 200);
    }

    create() {
        this.modal = document.createElement('div');
        this.modal.className = `modal modal--${this.size}`;
        this.modal.id = this.id;
        
        this.modal.innerHTML = `
            <div class="modal__backdrop"></div>
            <div class="modal__container">
                <div class="modal__content">
                    <div class="modal__header">
                        <h3 class="modal__title">${this.title}</h3>
                        <button type="button" class="modal__close" aria-label="Close modal">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal__body">
                        ${this.content}
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const closeBtn = this.modal.querySelector('.modal__close');
        const backdrop = this.modal.querySelector('.modal__backdrop');
        
        closeBtn?.addEventListener('click', () => this.close());
        
        if (this.closeOnBackdrop) {
            backdrop?.addEventListener('click', () => this.close());
        }
        
        if (this.closeOnEscape) {
            document.addEventListener('keydown', this.handleEscape.bind(this));
        }
    }

    handleEscape(e) {
        if (e.key === 'Escape' && this.isOpen) {
            this.close();
        }
    }

    focusFirstInput() {
        const firstInput = this.modal.querySelector('input, textarea, select, button');
        if (firstInput) {
            firstInput.focus();
        }
    }

    setContent(content) {
        this.content = content;
        if (this.isOpen) {
            const bodyElement = this.modal.querySelector('.modal__body');
            if (bodyElement) {
                bodyElement.innerHTML = content;
            }
        }
    }

    setTitle(title) {
        this.title = title;
        if (this.isOpen) {
            const titleElement = this.modal.querySelector('.modal__title');
            if (titleElement) {
                titleElement.textContent = title;
            }
        }
    }
}

class CreateGroupModal extends Modal {
    constructor() {
        super({
            title: 'Create New Group',
            size: 'medium',
            content: CreateGroupModal.getFormHtml()
        });
        
        this.onSubmit = null;
    }

    static getFormHtml() {
        return `
            <form id="createGroupForm" class="form">
                <div class="form-group">
                    <label for="groupName" class="form-label required">Group Name</label>
                    <input 
                        type="text" 
                        id="groupName" 
                        name="groupName"
                        class="form-input" 
                        placeholder="e.g., Weekend Trip, House Expenses"
                        required
                        maxlength="50"
                        autocomplete="off"
                    >
                    <div class="form-error" id="groupNameError"></div>
                </div>
                
                <div class="form-group">
                    <label for="groupDescription" class="form-label">Description (Optional)</label>
                    <textarea 
                        id="groupDescription" 
                        name="groupDescription"
                        class="form-input form-textarea" 
                        placeholder="Brief description of what this group is for..."
                        maxlength="200"
                        rows="3"
                    ></textarea>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Initial Members (Optional)</label>
                    <p class="form-hint">You can add members later from the group settings</p>
                    <div id="membersContainer" class="members-input-container">
                        <div class="member-input-row">
                            <input 
                                type="email" 
                                class="form-input member-email" 
                                placeholder="friend@example.com"
                                autocomplete="email"
                            >
                            <button type="button" class="button button--icon remove-member" disabled>
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                    </div>
                    <button type="button" id="addMemberBtn" class="button button--secondary button--small">
                        + Add Another Member
                    </button>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="button button--secondary" id="cancelBtn">
                        Cancel
                    </button>
                    <button type="submit" class="button button--primary" id="submitBtn">
                        <span class="button-text">Create Group</span>
                        <span class="button-loading" style="display: none;">Creating...</span>
                    </button>
                </div>
            </form>
        `;
    }

    open() {
        super.open();
        this.attachFormListeners();
    }

    attachFormListeners() {
        const form = document.getElementById('createGroupForm');
        const addMemberBtn = document.getElementById('addMemberBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const groupNameInput = document.getElementById('groupName');
        
        form?.addEventListener('submit', this.handleSubmit.bind(this));
        addMemberBtn?.addEventListener('click', this.addMemberRow.bind(this));
        cancelBtn?.addEventListener('click', () => this.close());
        groupNameInput?.addEventListener('input', this.validateGroupName.bind(this));
        
        this.attachMemberRowListeners();
    }

    addMemberRow() {
        const container = document.getElementById('membersContainer');
        const newRow = document.createElement('div');
        newRow.className = 'member-input-row';
        newRow.innerHTML = `
            <input 
                type="email" 
                class="form-input member-email" 
                placeholder="friend@example.com"
                autocomplete="email"
            >
            <button type="button" class="button button--icon remove-member">
                <span aria-hidden="true">&times;</span>
            </button>
        `;
        
        container.appendChild(newRow);
        this.attachMemberRowListeners();
        
        const newInput = newRow.querySelector('.member-email');
        newInput?.focus();
    }

    attachMemberRowListeners() {
        document.querySelectorAll('.remove-member').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });
        
        document.querySelectorAll('.remove-member').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('.member-input-row');
                const container = document.getElementById('membersContainer');
                
                if (container.children.length > 1) {
                    row.remove();
                } else {
                    row.querySelector('.member-email').value = '';
                }
                
                this.updateRemoveButtons();
            });
        });
        
        this.updateRemoveButtons();
    }

    updateRemoveButtons() {
        const container = document.getElementById('membersContainer');
        const removeButtons = container.querySelectorAll('.remove-member');
        
        removeButtons.forEach((btn, index) => {
            btn.disabled = container.children.length === 1;
        });
    }

    validateGroupName() {
        const input = document.getElementById('groupName');
        const error = document.getElementById('groupNameError');
        const value = input.value.trim();
        
        if (!value) {
            this.setFieldError('groupName', 'Group name is required');
            return false;
        }
        
        if (value.length < 2) {
            this.setFieldError('groupName', 'Group name must be at least 2 characters');
            return false;
        }
        
        this.clearFieldError('groupName');
        return true;
    }

    setFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const error = document.getElementById(`${fieldId}Error`);
        
        field?.classList.add('form-input--error');
        if (error) error.textContent = message;
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const error = document.getElementById(`${fieldId}Error`);
        
        field?.classList.remove('form-input--error');
        if (error) error.textContent = '';
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateGroupName()) {
            return;
        }
        
        const submitBtn = document.getElementById('submitBtn');
        const buttonText = submitBtn.querySelector('.button-text');
        const buttonLoading = submitBtn.querySelector('.button-loading');
        
        submitBtn.disabled = true;
        buttonText.style.display = 'none';
        buttonLoading.style.display = 'inline';
        
        try {
            const formData = new FormData(e.target);
            const memberEmails = Array.from(document.querySelectorAll('.member-email'))
                .map(input => input.value.trim())
                .filter(email => email);
            
            const groupData = {
                name: formData.get('groupName').trim(),
                description: formData.get('groupDescription')?.trim() || '',
                memberEmails
            };
            
            if (this.onSubmit) {
                await this.onSubmit(groupData);
            }
            
            this.close();
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Failed to create group. Please try again.');
        } finally {
            submitBtn.disabled = false;
            buttonText.style.display = 'inline';
            buttonLoading.style.display = 'none';
        }
    }
}