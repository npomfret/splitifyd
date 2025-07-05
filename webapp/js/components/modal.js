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
                        placeholder="e.g., group-1, group-2"
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

class AddExpenseModal extends Modal {
    constructor(groupId = null, groupMembers = []) {
        super({
            title: 'Add Expense',
            size: 'large',
            content: AddExpenseModal.getFormHtml()
        });
        
        this.groupId = groupId;
        this.groupMembers = groupMembers;
        this.onSubmit = null;
    }

    static getFormHtml() {
        return `
            <form id="addExpenseForm" class="form">
                <div class="form-row">
                    <div class="form-group form-group--half">
                        <label for="expenseAmount" class="form-label required">Amount</label>
                        <div class="input-group">
                            <span class="input-group-addon">$</span>
                            <input 
                                type="number" 
                                id="expenseAmount" 
                                name="amount"
                                class="form-input" 
                                placeholder="0.00"
                                step="0.01"
                                min="0.01"
                                required
                                autocomplete="off"
                            >
                        </div>
                        <div class="form-error" id="amountError"></div>
                    </div>
                    
                    <div class="form-group form-group--half">
                        <label for="expenseDate" class="form-label required">Date</label>
                        <input 
                            type="date" 
                            id="expenseDate" 
                            name="date"
                            class="form-input" 
                            required
                            autocomplete="off"
                        >
                        <div class="form-error" id="dateError"></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="expenseDescription" class="form-label required">Description</label>
                    <input 
                        type="text" 
                        id="expenseDescription" 
                        name="description"
                        class="form-input" 
                        placeholder="What was this expense for?"
                        required
                        maxlength="100"
                        autocomplete="off"
                    >
                    <div class="form-error" id="descriptionError"></div>
                </div>
                
                <div class="form-row">
                    <div class="form-group form-group--half">
                        <label for="expenseCategory" class="form-label required">Category</label>
                        <select id="expenseCategory" name="category" class="form-input" required>
                            <option value="">Select a category</option>
                        </select>
                        <div class="form-error" id="categoryError"></div>
                    </div>
                    
                    <div class="form-group form-group--half">
                        <label for="expenseGroup" class="form-label required">Group</label>
                        <select id="expenseGroup" name="groupId" class="form-input" required>
                            <option value="">Select a group</option>
                        </select>
                        <div class="form-error" id="groupError"></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="expensePayer" class="form-label required">Who paid?</label>
                    <select id="expensePayer" name="paidBy" class="form-input" required>
                        <option value="">Select who paid</option>
                    </select>
                    <div class="form-error" id="payerError"></div>
                </div>
                
                <div class="form-group">
                    <label class="form-label required">Split between</label>
                    <div id="participantsContainer" class="participants-container">
                        <p class="form-hint">Select group first to see members</p>
                    </div>
                    <div class="form-error" id="participantsError"></div>
                </div>
                
                <div class="form-group">
                    <label class="form-label required">How to split?</label>
                    <div class="split-type-selector">
                        <label class="split-type-option">
                            <input type="radio" name="splitType" value="equal" checked>
                            <span class="split-type-label">
                                <span class="split-type-icon">=</span>
                                <span>Equal Split</span>
                            </span>
                        </label>
                        <label class="split-type-option">
                            <input type="radio" name="splitType" value="exact">
                            <span class="split-type-label">
                                <span class="split-type-icon">$</span>
                                <span>Exact Amounts</span>
                            </span>
                        </label>
                        <label class="split-type-option">
                            <input type="radio" name="splitType" value="percentage">
                            <span class="split-type-label">
                                <span class="split-type-icon">%</span>
                                <span>Percentages</span>
                            </span>
                        </label>
                    </div>
                </div>
                
                <div id="splitDetailsContainer" class="split-details-container" style="display: none;">
                    <!-- Split details will be populated based on split type -->
                </div>
                
                <div class="form-group">
                    <label for="expenseReceipt" class="form-label">Receipt (Optional)</label>
                    <input 
                        type="file" 
                        id="expenseReceipt" 
                        name="receipt"
                        class="form-input" 
                        accept="image/*,.pdf"
                    >
                    <p class="form-hint">Upload an image or PDF of the receipt</p>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="button button--secondary" id="cancelBtn">
                        Cancel
                    </button>
                    <button type="submit" class="button button--primary" id="submitBtn">
                        <span class="button-text">Add Expense</span>
                        <span class="button-loading" style="display: none;">Adding...</span>
                    </button>
                </div>
            </form>
        `;
    }

    async open() {
        super.open();
        await this.initializeForm();
        this.attachFormListeners();
    }

    async initializeForm() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expenseDate').value = today;
        
        this.populateCategories();
        await this.populateGroups();
        
        if (this.groupId) {
            // Set the value and trigger change event
            const groupSelect = document.getElementById('expenseGroup');
            groupSelect.value = this.groupId;
            // Manually trigger the change to load members
            await this.handleGroupChange();
        }
    }

    populateCategories() {
        const categories = ExpenseService.getExpenseCategories();
        const select = document.getElementById('expenseCategory');
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.value;
            option.textContent = `${cat.icon} ${cat.label}`;
            select.appendChild(option);
        });
    }

    async populateGroups() {
        const select = document.getElementById('expenseGroup');
        
        try {
            const groups = await GroupService.getUserGroups();
            
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    }

    attachFormListeners() {
        const form = document.getElementById('addExpenseForm');
        const cancelBtn = document.getElementById('cancelBtn');
        const groupSelect = document.getElementById('expenseGroup');
        const splitTypeInputs = document.querySelectorAll('input[name="splitType"]');
        
        form?.addEventListener('submit', this.handleSubmit.bind(this));
        cancelBtn?.addEventListener('click', () => this.close());
        groupSelect?.addEventListener('change', () => this.handleGroupChange());
        
        splitTypeInputs.forEach(input => {
            input.addEventListener('change', () => this.handleSplitTypeChange());
        });
        
        document.getElementById('expenseAmount')?.addEventListener('input', () => this.updateSplitAmounts());
    }

    async handleGroupChange() {
        const groupId = document.getElementById('expenseGroup').value;
        if (!groupId) {
            document.getElementById('participantsContainer').innerHTML = 
                '<p class="form-hint">Select group first to see members</p>';
            document.getElementById('expensePayer').innerHTML = 
                '<option value="">Select who paid</option>';
            return;
        }
        
        try {
            const group = await GroupService.getGroup(groupId);
            const members = await GroupService.getGroupMembers(groupId);
            
            this.groupMembers = members;
            this.renderParticipants(members);
            this.renderPayers(members);
        } catch (error) {
            console.error('Error loading group members:', error);
        }
    }

    renderParticipants(members) {
        const container = document.getElementById('participantsContainer');
        container.innerHTML = members.map(member => `
            <label class="checkbox-label">
                <input 
                    type="checkbox" 
                    name="participants" 
                    value="${member.id}"
                    checked
                >
                <span>${member.displayName || member.name || member.email || 'Unknown'}</span>
            </label>
        `).join('');
    }

    renderPayers(members) {
        const select = document.getElementById('expensePayer');
        
        if (!select) {
            console.error('expensePayer select element not found');
            return;
        }
        
        select.innerHTML = '<option value="">Select who paid</option>';
        
        if (!members || members.length === 0) {
            return;
        }
        
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.displayName || member.name || member.email || 'Unknown';
            select.appendChild(option);
        });
        
        const currentUserId = localStorage.getItem('userId');
        if (currentUserId && members.some(m => m.id === currentUserId)) {
            select.value = currentUserId;
        }
    }

    handleSplitTypeChange() {
        const splitType = document.querySelector('input[name="splitType"]:checked').value;
        const container = document.getElementById('splitDetailsContainer');
        
        if (splitType === 'equal') {
            container.style.display = 'none';
        } else {
            container.style.display = 'block';
            this.renderSplitDetails(splitType);
        }
    }

    renderSplitDetails(splitType) {
        const container = document.getElementById('splitDetailsContainer');
        const participants = Array.from(document.querySelectorAll('input[name="participants"]:checked'));
        const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
        
        if (participants.length === 0) {
            container.innerHTML = '<p class="form-hint">Select participants first</p>';
            return;
        }
        
        if (splitType === 'exact') {
            container.innerHTML = `
                <h4 class="split-details-title">Enter exact amounts for each person</h4>
                <div class="split-amounts">
                    ${participants.map(input => {
                        const member = this.groupMembers.find(m => m.id === input.value);
                        const defaultAmount = amount > 0 ? (amount / participants.length).toFixed(2) : '';
                        return `
                            <div class="split-amount-row">
                                <label>${member?.displayName || member?.name || member?.email || 'Unknown'}</label>
                                <div class="input-group">
                                    <span class="input-group-addon">$</span>
                                    <input 
                                        type="number" 
                                        name="split_amount_${input.value}"
                                        class="form-input split-amount-input" 
                                        step="0.01"
                                        min="0"
                                        value="${defaultAmount}"
                                        data-user-id="${input.value}"
                                    >
                                </div>
                            </div>
                        `;
                    }).join('')}
                    <div class="split-total">
                        <strong>Total:</strong> <span id="splitTotal">$0.00</span>
                        <span id="splitDifference" class="split-difference"></span>
                    </div>
                </div>
            `;
        } else if (splitType === 'percentage') {
            container.innerHTML = `
                <h4 class="split-details-title">Enter percentage for each person</h4>
                <div class="split-amounts">
                    ${participants.map(input => {
                        const member = this.groupMembers.find(m => m.id === input.value);
                        const defaultPercentage = (100 / participants.length).toFixed(0);
                        return `
                            <div class="split-amount-row">
                                <label>${member?.displayName || member?.name || member?.email || 'Unknown'}</label>
                                <div class="input-group">
                                    <input 
                                        type="number" 
                                        name="split_percentage_${input.value}"
                                        class="form-input split-percentage-input" 
                                        step="1"
                                        min="0"
                                        max="100"
                                        value="${defaultPercentage}"
                                        data-user-id="${input.value}"
                                    >
                                    <span class="input-group-addon">%</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    <div class="split-total">
                        <strong>Total:</strong> <span id="percentageTotal">100%</span>
                        <span id="percentageDifference" class="split-difference"></span>
                    </div>
                </div>
            `;
        }
        
        this.attachSplitListeners();
        this.updateSplitAmounts();
    }

    attachSplitListeners() {
        document.querySelectorAll('.split-amount-input').forEach(input => {
            input.addEventListener('input', () => this.updateSplitTotal());
        });
        
        document.querySelectorAll('.split-percentage-input').forEach(input => {
            input.addEventListener('input', () => this.updatePercentageTotal());
        });
        
        document.querySelectorAll('input[name="participants"]').forEach(input => {
            input.addEventListener('change', () => {
                const splitType = document.querySelector('input[name="splitType"]:checked').value;
                if (splitType !== 'equal') {
                    this.renderSplitDetails(splitType);
                }
            });
        });
    }

    updateSplitAmounts() {
        this.updateSplitTotal();
        this.updatePercentageTotal();
    }

    updateSplitTotal() {
        const totalElement = document.getElementById('splitTotal');
        const differenceElement = document.getElementById('splitDifference');
        if (!totalElement) return;
        
        const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
        const inputs = document.querySelectorAll('.split-amount-input');
        const total = Array.from(inputs).reduce((sum, input) => {
            return sum + (parseFloat(input.value) || 0);
        }, 0);
        
        totalElement.textContent = `$${total.toFixed(2)}`;
        
        const difference = Math.abs(amount - total);
        if (difference > 0.01) {
            differenceElement.textContent = `(${amount > total ? '-' : '+'}$${difference.toFixed(2)})`;
            differenceElement.className = 'split-difference split-difference--error';
        } else {
            differenceElement.textContent = '✓';
            differenceElement.className = 'split-difference split-difference--success';
        }
    }

    updatePercentageTotal() {
        const totalElement = document.getElementById('percentageTotal');
        const differenceElement = document.getElementById('percentageDifference');
        if (!totalElement) return;
        
        const inputs = document.querySelectorAll('.split-percentage-input');
        const total = Array.from(inputs).reduce((sum, input) => {
            return sum + (parseFloat(input.value) || 0);
        }, 0);
        
        totalElement.textContent = `${total}%`;
        
        if (Math.abs(total - 100) > 0.01) {
            differenceElement.textContent = `(${100 - total > 0 ? '+' : ''}${(100 - total).toFixed(0)}%)`;
            differenceElement.className = 'split-difference split-difference--error';
        } else {
            differenceElement.textContent = '✓';
            differenceElement.className = 'split-difference split-difference--success';
        }
    }

    validateForm() {
        let isValid = true;
        
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        if (!amount || amount <= 0) {
            this.setFieldError('amount', 'Amount must be greater than 0');
            isValid = false;
        } else {
            this.clearFieldError('amount');
        }
        
        const description = document.getElementById('expenseDescription').value.trim();
        if (!description) {
            this.setFieldError('description', 'Description is required');
            isValid = false;
        } else {
            this.clearFieldError('description');
        }
        
        const category = document.getElementById('expenseCategory').value;
        if (!category) {
            this.setFieldError('category', 'Please select a category');
            isValid = false;
        } else {
            this.clearFieldError('category');
        }
        
        const groupId = document.getElementById('expenseGroup').value;
        if (!groupId) {
            this.setFieldError('group', 'Please select a group');
            isValid = false;
        } else {
            this.clearFieldError('group');
        }
        
        const payer = document.getElementById('expensePayer').value;
        if (!payer) {
            this.setFieldError('payer', 'Please select who paid');
            isValid = false;
        } else {
            this.clearFieldError('payer');
        }
        
        const participants = document.querySelectorAll('input[name="participants"]:checked');
        if (participants.length === 0) {
            this.setFieldError('participants', 'Select at least one participant');
            isValid = false;
        } else {
            this.clearFieldError('participants');
        }
        
        const splitType = document.querySelector('input[name="splitType"]:checked').value;
        
        if (splitType === 'exact') {
            const { ExpenseService } = window;
            const splits = Array.from(document.querySelectorAll('.split-amount-input')).map(input => ({
                userId: input.dataset.userId,
                amount: parseFloat(input.value) || 0
            }));
            
            if (!ExpenseService.validateSplitAmounts(amount, splits)) {
                this.setFieldError('participants', 'Split amounts must equal total amount');
                isValid = false;
            }
        } else if (splitType === 'percentage') {
            const { ExpenseService } = window;
            const splits = Array.from(document.querySelectorAll('.split-percentage-input')).map(input => ({
                userId: input.dataset.userId,
                percentage: parseFloat(input.value) || 0
            }));
            
            if (!ExpenseService.validateSplitPercentages(splits)) {
                this.setFieldError('participants', 'Percentages must add up to 100%');
                isValid = false;
            }
        }
        
        return isValid;
    }

    setFieldError(fieldId, message) {
        const error = document.getElementById(`${fieldId}Error`);
        if (error) error.textContent = message;
    }

    clearFieldError(fieldId) {
        const error = document.getElementById(`${fieldId}Error`);
        if (error) error.textContent = '';
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
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
            const splitType = formData.get('splitType');
            const participants = Array.from(document.querySelectorAll('input[name="participants"]:checked'))
                .map(input => input.value);
            
            let splits = undefined;
            
            if (splitType === 'exact') {
                splits = participants.map(userId => ({
                    userId,
                    amount: parseFloat(document.querySelector(`input[name="split_amount_${userId}"]`).value) || 0
                }));
            } else if (splitType === 'percentage') {
                splits = participants.map(userId => ({
                    userId,
                    percentage: parseFloat(document.querySelector(`input[name="split_percentage_${userId}"]`).value) || 0
                }));
            }
            
            const expenseData = {
                groupId: formData.get('groupId'),
                paidBy: formData.get('paidBy'),
                amount: parseFloat(formData.get('amount')),
                description: formData.get('description').trim(),
                category: formData.get('category'),
                date: formData.get('date'),
                splitType,
                participants,
                splits
            };
            
            if (this.onSubmit) {
                await this.onSubmit(expenseData);
            }
            
            this.close();
        } catch (error) {
            console.error('Error adding expense:', error);
            alert('Failed to add expense. Please try again.');
        } finally {
            submitBtn.disabled = false;
            buttonText.style.display = 'inline';
            buttonLoading.style.display = 'none';
        }
    }
}