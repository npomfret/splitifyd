import { BaseComponent } from './base-component.js';
import { PageLayoutComponent } from './page-layout.js';
import { HeaderComponent } from './header.js';
import { FormComponents } from './form-components.js';
import { ButtonComponent, ButtonConfig } from './button.js';
import { authManager } from '../auth.js';
import { apiService } from '../api.js';
import { showMessage, showFieldError, clearErrors } from '../utils/ui-messages.js';
import { logger } from '../utils/logger.js';
import { waitForAuthManager } from '../utils/auth-utils.js';
import { ROUTES } from '../routes.js';
import type { GroupDetail, Member, ExpenseData } from '@bill-splitter/shared-types';

export class AddExpenseComponent extends BaseComponent<HTMLDivElement> {
    private pageLayout: PageLayoutComponent | null = null;
    private form: HTMLFormElement | null = null;
    private submitButton: ButtonComponent | null = null;
    private cancelButton: ButtonComponent | null = null;
    private currentGroup: GroupDetail | null = null;
    private currentGroupId: string | null = null;
    private selectedMembers = new Set<string>();
    private editExpenseId: string | null = null;
    private isEditMode = false;

    protected render(): HTMLDivElement {
        this.initialize();

        const container = document.createElement('div');
        
        this.pageLayout = new PageLayoutComponent({
            type: 'dashboard',
            header: false,
            footer: false
        });
        
        this.pageLayout.mount(container);

        const header = new HeaderComponent({
            title: 'Add Expense',
            showLogout: true
        });
        const mainContent = this.pageLayout.getContentContainer();
        if (mainContent) {
            header.mount(mainContent);
            
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'dashboard-container';
            contentWrapper.innerHTML = this.renderContent();
            mainContent.appendChild(contentWrapper);
        }

        return container;
    }

    private async initialize(): Promise<void> {
        try {
            await waitForAuthManager();
            
            if (!authManager.getUserId()) {
                authManager.setUserId('user1');
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            this.currentGroupId = urlParams.get('groupId');
            this.editExpenseId = urlParams.get('id');
            this.isEditMode = urlParams.get('edit') === 'true';
            
            if (!this.currentGroupId && !this.editExpenseId) {
                window.location.href = ROUTES.DASHBOARD;
                return;
            }
            
            if (this.isEditMode && this.editExpenseId) {
                await this.loadExpenseForEditing(this.editExpenseId);
            } else {
                await this.loadGroupData();
            }
        } catch (error: any) {
            logger.error('Failed to initialize add expense page:', error);
            showMessage('Failed to load expense form. Please try again.', 'error');
            
            setTimeout(() => {
                window.location.href = ROUTES.DASHBOARD;
            }, 3000);
        }
    }

    private renderContent(): string {
        const pageTitle = this.isEditMode ? 'Edit Expense' : 'Add Expense';
        const submitText = this.isEditMode ? 'Update Expense' : 'Save';

        return `
            <div class="expense-form-container">
                <nav class="nav-header">
                    <button class="back-button" id="backButton">
                        <i class="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                    <h1 class="page-title">${pageTitle}</h1>
                </nav>

                <form class="expense-form" id="expenseForm" novalidate>
                    ${FormComponents.formGroup({
                        label: 'Description',
                        id: 'description',
                        type: 'text',
                        required: true,
                        placeholder: 'What was this expense for?',
                        errorId: 'description-error'
                    })}

                    <div class="form-group">
                        <label for="amount" class="form-label">
                            Amount
                            <span class="form-label__required" aria-label="required">*</span>
                        </label>
                        <div class="input-group">
                            <span class="input-group-text">$</span>
                            <input 
                                type="number" 
                                id="amount" 
                                name="amount" 
                                class="form-input"
                                required
                                placeholder="0.00"
                                step="0.01"
                                min="0.01"
                                aria-describedby="amount-error"
                            >
                        </div>
                        <div id="amount-error" class="form-error" role="alert"></div>
                    </div>

                    ${FormComponents.formGroup({
                        label: 'Category',
                        id: 'category',
                        type: 'select',
                        options: [
                            { value: 'food', label: '🍽️ Food & Dining' },
                            { value: 'transport', label: '🚗 Transportation' },
                            { value: 'utilities', label: '💡 Utilities' },
                            { value: 'entertainment', label: '🎮 Entertainment' },
                            { value: 'shopping', label: '🛍️ Shopping' },
                            { value: 'accommodation', label: '🏠 Accommodation' },
                            { value: 'healthcare', label: '🏥 Healthcare' },
                            { value: 'education', label: '📚 Education' },
                            { value: 'other', label: '📌 Other' }
                        ],
                        value: 'food'
                    })}

                    <div class="form-group">
                        <label for="paidBy" class="form-label">
                            Paid by
                            <span class="form-label__required" aria-label="required">*</span>
                        </label>
                        <select id="paidBy" name="paidBy" class="form-select" required aria-describedby="paidBy-error">
                            <option value="">Select who paid</option>
                        </select>
                        <div id="paidBy-error" class="form-error" role="alert"></div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Split Method</label>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="splitMethod" value="equal" checked>
                                <span class="radio-custom"></span>
                                Split equally
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="splitMethod" value="custom">
                                <span class="radio-custom"></span>
                                Custom amounts
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">
                            Split between
                            <span class="form-label__required" aria-label="required">*</span>
                        </label>
                        <div id="membersList" class="members-list">
                            <!-- Members will be populated here -->
                        </div>
                        <div id="members-error" class="form-error" role="alert"></div>
                    </div>

                    <div id="customSplitSection" class="form-group hidden">
                        <label class="form-label">Custom Split Amounts</label>
                        <div id="customSplitInputs" class="custom-split-inputs">
                            <!-- Custom split inputs will be populated here -->
                        </div>
                        <div class="split-total">
                            <span>Total: $<span id="splitTotal">0.00</span></span>
                        </div>
                    </div>

                    <div class="form-actions">
                        <div id="cancel-button-container"></div>
                        <div id="submit-button-container"></div>
                    </div>
                </form>
            </div>
        `;
    }

    protected setupEventListeners(): void {
        if (!this.element) return;

        this.form = this.element.querySelector('#expenseForm') as HTMLFormElement;
        const backButton = this.element.querySelector('#backButton') as HTMLButtonElement;
        const splitMethodRadios = this.element.querySelectorAll('input[name="splitMethod"]');
        const customSplitSection = this.element.querySelector('#customSplitSection') as HTMLElement;

        if (!this.form) {
            logger.error('Expense form not found');
            return;
        }

        const cancelButtonContainer = this.element.querySelector('#cancel-button-container');
        const submitButtonContainer = this.element.querySelector('#submit-button-container');

        if (cancelButtonContainer) {
            const cancelConfig: ButtonConfig = {
                text: 'Cancel',
                variant: 'secondary',
                size: 'medium'
            };
            this.cancelButton = new ButtonComponent(cancelConfig);
            this.cancelButton.mount(cancelButtonContainer as HTMLElement);
            this.cancelButton.getElement()?.addEventListener('click', this.handleCancel.bind(this));
        }

        if (submitButtonContainer) {
            const submitConfig: ButtonConfig = {
                text: this.isEditMode ? 'Update Expense' : 'Save',
                type: 'submit',
                variant: 'primary',
                size: 'medium',
                icon: 'fas fa-save'
            };
            this.submitButton = new ButtonComponent(submitConfig);
            this.submitButton.mount(submitButtonContainer as HTMLElement);
        }

        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        backButton?.addEventListener('click', this.handleBack.bind(this));

        splitMethodRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                if (target.value === 'custom') {
                    customSplitSection?.classList.remove('hidden');
                    this.updateCustomSplitInputs();
                } else {
                    customSplitSection?.classList.add('hidden');
                }
            });
        });

        const memberCheckboxes = this.element.querySelectorAll('.member-checkbox');
        memberCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', this.handleMemberSelection.bind(this));
        });

        const amountInput = this.element.querySelector('#amount') as HTMLInputElement;
        amountInput?.addEventListener('input', this.updateCustomSplitInputs.bind(this));
    }

    private async loadExpenseForEditing(expenseId: string): Promise<void> {
        try {
            const response = await apiService.getExpense(expenseId);
            const expense = response.data!;
            
            this.currentGroupId = expense.groupId;
            await this.loadGroupData();
            
            this.populateFormWithExpense(expense);
        } catch (error) {
            logger.error('Error loading expense for editing:', error);
            showMessage('Failed to load expense for editing', 'error');
        }
    }

    private async loadGroupData(): Promise<void> {
        try {
            const response = await apiService.getGroup(this.currentGroupId!);
            this.currentGroup = response.data!;
            
            if (this.element) {
                this.populatePaidByOptions();
                this.populateMembers();
            }
        } catch (error) {
            logger.error('Error loading group data:', error);
            showMessage('Failed to load group data', 'error');
        }
    }

    private populatePaidByOptions(): void {
        if (!this.currentGroup || !this.element) return;

        const paidBySelect = this.element.querySelector('#paidBy') as HTMLSelectElement;
        if (!paidBySelect) return;

        paidBySelect.innerHTML = '<option value="">Select who paid</option>';
        
        this.currentGroup.members.forEach((member: Member) => {
            const option = document.createElement('option');
            option.value = member.uid;
            option.textContent = member.name;
            if (member.uid === authManager.getUserId()) {
                option.selected = true;
            }
            paidBySelect.appendChild(option);
        });
    }

    private populateMembers(): void {
        if (!this.currentGroup || !this.element) return;

        const membersList = this.element.querySelector('#membersList') as HTMLElement;
        if (!membersList) return;

        membersList.innerHTML = '';
        
        this.currentGroup.members.forEach((member: Member) => {
            const memberItem = document.createElement('label');
            memberItem.className = 'member-item';
            memberItem.innerHTML = `
                <input type="checkbox" class="member-checkbox" value="${member.uid}" checked>
                <span class="member-name">${member.name}</span>
            `;
            membersList.appendChild(memberItem);
            this.selectedMembers.add(member.uid);
        });

        const checkboxes = membersList.querySelectorAll('.member-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', this.handleMemberSelection.bind(this));
        });
    }

    private populateFormWithExpense(expense: ExpenseData): void {
        if (!this.element) return;

        const descriptionInput = this.element.querySelector('#description') as HTMLInputElement;
        const amountInput = this.element.querySelector('#amount') as HTMLInputElement;
        const categorySelect = this.element.querySelector('#category') as HTMLSelectElement;
        const paidBySelect = this.element.querySelector('#paidBy') as HTMLSelectElement;

        if (descriptionInput) descriptionInput.value = expense.description;
        if (amountInput) amountInput.value = expense.amount.toString();
        if (categorySelect) categorySelect.value = expense.category || 'food';
        if (paidBySelect) paidBySelect.value = expense.paidBy;

        if (expense.splitType) {
            const splitMethodRadio = this.element.querySelector(`input[name="splitMethod"][value="${expense.splitType === 'equal' ? 'equal' : 'custom'}"]`) as HTMLInputElement;
            if (splitMethodRadio) splitMethodRadio.checked = true;
        }

        this.selectedMembers.clear();
        expense.participants.forEach(userId => this.selectedMembers.add(userId));
        
        const memberCheckboxes = this.element.querySelectorAll('.member-checkbox') as NodeListOf<HTMLInputElement>;
        memberCheckboxes.forEach(checkbox => {
            checkbox.checked = this.selectedMembers.has(checkbox.value);
        });

        if (expense.splitType === 'exact' || expense.splitType === 'percentage') {
            const customSplitSection = this.element.querySelector('#customSplitSection') as HTMLElement;
            customSplitSection?.classList.remove('hidden');
            this.updateCustomSplitInputs();
        }
    }

    private handleMemberSelection(e: Event): void {
        const checkbox = e.target as HTMLInputElement;
        if (checkbox.checked) {
            this.selectedMembers.add(checkbox.value);
        } else {
            this.selectedMembers.delete(checkbox.value);
        }
        this.updateCustomSplitInputs();
    }

    private updateCustomSplitInputs(): void {
        if (!this.element) return;

        const customSplitInputs = this.element.querySelector('#customSplitInputs') as HTMLElement;
        const splitMethodRadio = this.element.querySelector('input[name="splitMethod"]:checked') as HTMLInputElement;
        
        if (!customSplitInputs || !splitMethodRadio || splitMethodRadio.value !== 'custom') return;

        customSplitInputs.innerHTML = '';
        
        const amountInput = this.element.querySelector('#amount') as HTMLInputElement;
        const totalAmount = parseFloat(amountInput?.value || '0');
        const equalShare = this.selectedMembers.size > 0 ? totalAmount / this.selectedMembers.size : 0;

        this.selectedMembers.forEach(memberId => {
            const member = this.currentGroup?.members.find(m => m.uid === memberId);
            if (!member) return;

            const inputGroup = document.createElement('div');
            inputGroup.className = 'custom-split-input-group';
            inputGroup.innerHTML = `
                <label for="split-${memberId}">${member.name}</label>
                <div class="input-group">
                    <span class="input-group-text">$</span>
                    <input 
                        type="number" 
                        id="split-${memberId}" 
                        class="form-input custom-split-amount" 
                        value="${equalShare.toFixed(2)}"
                        step="0.01"
                        min="0"
                        data-member-id="${memberId}"
                    >
                </div>
            `;
            customSplitInputs.appendChild(inputGroup);
        });

        const splitAmountInputs = customSplitInputs.querySelectorAll('.custom-split-amount');
        splitAmountInputs.forEach(input => {
            input.addEventListener('input', this.updateSplitTotal.bind(this));
        });

        this.updateSplitTotal();
    }

    private updateSplitTotal(): void {
        if (!this.element) return;

        const splitAmountInputs = this.element.querySelectorAll('.custom-split-amount') as NodeListOf<HTMLInputElement>;
        const splitTotalSpan = this.element.querySelector('#splitTotal') as HTMLElement;
        
        let total = 0;
        splitAmountInputs.forEach(input => {
            total += parseFloat(input.value || '0');
        });

        if (splitTotalSpan) {
            splitTotalSpan.textContent = total.toFixed(2);
        }
    }

    private validateForm(): boolean {
        clearErrors();
        
        if (!this.element) return false;

        const descriptionInput = this.element.querySelector('#description') as HTMLInputElement;
        const amountInput = this.element.querySelector('#amount') as HTMLInputElement;
        const paidBySelect = this.element.querySelector('#paidBy') as HTMLSelectElement;

        let isValid = true;

        if (!descriptionInput.value.trim()) {
            showFieldError('description', 'Description is required');
            isValid = false;
        }

        const amount = parseFloat(amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showFieldError('amount', 'Amount must be greater than 0');
            isValid = false;
        }

        if (!paidBySelect.value) {
            showFieldError('paidBy', 'Please select who paid');
            isValid = false;
        }

        if (this.selectedMembers.size === 0) {
            showFieldError('members', 'Please select at least one member');
            isValid = false;
        }

        const splitMethodRadio = this.element.querySelector('input[name="splitMethod"]:checked') as HTMLInputElement;
        if (splitMethodRadio?.value === 'custom') {
            const splitAmountInputs = this.element.querySelectorAll('.custom-split-amount') as NodeListOf<HTMLInputElement>;
            let splitTotal = 0;
            
            splitAmountInputs.forEach(input => {
                splitTotal += parseFloat(input.value || '0');
            });

            if (Math.abs(splitTotal - amount) > 0.01) {
                showFieldError('members', 'Split amounts must equal the total amount');
                isValid = false;
            }
        }

        return isValid;
    }

    private async handleSubmit(e: Event): Promise<void> {
        e.preventDefault();

        if (!this.validateForm() || !this.submitButton || !this.element) {
            return;
        }

        const descriptionInput = this.element.querySelector('#description') as HTMLInputElement;
        const amountInput = this.element.querySelector('#amount') as HTMLInputElement;
        const categorySelect = this.element.querySelector('#category') as HTMLSelectElement;
        const paidBySelect = this.element.querySelector('#paidBy') as HTMLSelectElement;
        const splitMethodRadio = this.element.querySelector('input[name="splitMethod"]:checked') as HTMLInputElement;

        const expenseData: any = {
            description: descriptionInput.value.trim(),
            amount: parseFloat(amountInput.value),
            category: categorySelect.value,
            paidBy: paidBySelect.value,
            splitType: splitMethodRadio.value === 'equal' ? 'equal' : 'exact',
            groupId: this.currentGroupId,
            participants: Array.from(this.selectedMembers),
            date: new Date().toISOString()
        };

        if (splitMethodRadio.value === 'custom') {
            const splits: Array<{userId: string, amount: number}> = [];
            const splitAmountInputs = this.element.querySelectorAll('.custom-split-amount') as NodeListOf<HTMLInputElement>;
            
            splitAmountInputs.forEach(input => {
                const memberId = input.getAttribute('data-member-id');
                if (memberId) {
                    splits.push({
                        userId: memberId,
                        amount: parseFloat(input.value || '0')
                    });
                }
            });
            
            expenseData.splits = splits;
        }

        try {
            this.submitButton.setLoading(true);
            
            if (this.isEditMode && this.editExpenseId) {
                await apiService.updateExpense(this.editExpenseId, expenseData);
                showMessage('Expense updated successfully!', 'success');
            } else {
                await apiService.createExpense(expenseData);
                showMessage('Expense added successfully!', 'success');
            }

            setTimeout(() => {
                window.location.href = `group-detail.html?id=${this.currentGroupId}`;
            }, 1000);
        } catch (error: any) {
            logger.error('Error saving expense:', error);
            showMessage('Failed to save expense. Please try again.', 'error');
        } finally {
            this.submitButton.setLoading(false);
        }
    }

    private handleBack(): void {
        if (this.currentGroupId) {
            window.location.href = `group-detail.html?id=${this.currentGroupId}`;
        } else {
            window.location.href = 'dashboard.html';
        }
    }

    private handleCancel(): void {
        this.handleBack();
    }

    protected cleanup(): void {
        if (this.form) {
            this.form.removeEventListener('submit', this.handleSubmit.bind(this));
        }
        if (this.submitButton) {
            this.submitButton.unmount();
        }
        if (this.cancelButton) {
            this.cancelButton.unmount();
        }
        if (this.pageLayout) {
            this.pageLayout.unmount();
        }
    }
}