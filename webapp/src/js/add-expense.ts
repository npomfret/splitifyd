import { logger } from './utils/logger.js';
import { authManager } from './auth.js';
import { apiService } from './api.js';
import { showMessage, showFieldError, showError } from './utils/ui-messages.js';
import { waitForAuthManager } from './utils/auth-utils.js';
import { clearElement, createElementSafe, appendChildren } from './utils/safe-dom.js';
import { ROUTES } from './routes.js';
import { createButton, createFormField, createSelectField, createCard, createFormSection, createMemberCheckbox } from './ui-builders.js';
import type { GroupDetail, Member, ExpenseData } from './types/api';

let currentGroup: GroupDetail | null = null;
let currentGroupId: string | null = null;
let selectedMembers = new Set<string>();
let lastExpenseData: ExpenseData | null = null;
let updateCustomSplitInputsTimeout: ReturnType<typeof setTimeout> | null = null;
let updateSplitTotalTimeout: ReturnType<typeof setTimeout> | null = null;

function renderAddExpensePage(): void {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
        logger.error('app-root element not found');
        return;
    }
    
    appRoot.innerHTML = `
        <div id="warningBanner" class="warning-banner hidden"></div>
        
        <header class="dashboard-header">
            <div class="header-container">
                <h1 class="dashboard-title">
                    <a href="/dashboard.html" class="dashboard-title-link">
                        <img src="/images/logo.svg" alt="Bill Splitter" class="dashboard-logo">
                    </a>
                </h1>
                <div class="header-balance-summary">
                    <div class="header-balance-item header-balance-item--negative">
                        <span class="header-balance-label">You Owe</span>
                        <span class="header-balance-amount">$0.00</span>
                    </div>
                    <div class="header-balance-item header-balance-item--positive">
                        <span class="header-balance-label">Owed to You</span>
                        <span class="header-balance-amount">$0.00</span>
                    </div>
                </div>
                <div class="header-actions">
                    <button class="button button--secondary" id="logoutButton">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </header>
        
        <main class="dashboard-main">
            <div class="dashboard-container">
                <div class="expense-form-container">
                    <nav class="nav-header">
                        <button class="back-button" id="backButton">
                            <i class="fas fa-arrow-left"></i>
                            <span>Back</span>
                        </button>
                        <h1 class="page-title" id="pageTitle">Add Expense</h1>
                    </nav>

                    <div id="formContainer">
                        <!-- Form will be inserted here -->
                    </div>
                </div>
            </div>
        </main>
    `;
}

function buildExpenseForm(): void {
    const formContainer = document.getElementById('formContainer');
    if (!formContainer) return;
    
    clearElement(formContainer);
    
    // Create form
    const form = createElementSafe('form', { 
        className: 'add-expense-form',
        id: 'expenseForm'
    });
    form.setAttribute('novalidate', '');
    
    // Description field
    const descriptionField = createFormField({
        label: 'Description',
        id: 'description',
        name: 'description',
        type: 'text',
        required: true,
        placeholder: 'What was this expense for?',
        maxLength: 100,
        ariaDescribedBy: 'description-error'
    });
    form.appendChild(descriptionField);
    
    // Amount field with currency symbol
    const amountGroup = createElementSafe('div', { className: 'form-group' });
    const amountLabel = createElementSafe('label', { 
        className: 'form-label',
        htmlFor: 'amount',
        textContent: 'Amount'
    });
    const requiredSpan = createElementSafe('span', {
        className: 'form-label__required',
        textContent: '*'
    });
    requiredSpan.setAttribute('aria-label', 'required');
    amountLabel.appendChild(requiredSpan);
    
    const amountInputGroup = createElementSafe('div', { className: 'amount-input-group' });
    const currencySymbol = createElementSafe('span', { 
        className: 'currency-symbol',
        textContent: '$'
    });
    const amountInput = createElementSafe('input', {
        type: 'number',
        id: 'amount',
        name: 'amount',
        className: 'form-input',
        placeholder: '0.00',
        step: '0.01',
        min: '0.01',
        required: true
    }) as HTMLInputElement;
    amountInput.setAttribute('aria-describedby', 'amount-error');
    
    const amountError = createElementSafe('div', {
        id: 'amount-error',
        className: 'form-error',
        role: 'alert'
    });
    
    amountInputGroup.appendChild(currencySymbol);
    amountInputGroup.appendChild(amountInput);
    amountGroup.appendChild(amountLabel);
    amountGroup.appendChild(amountInputGroup);
    amountGroup.appendChild(amountError);
    form.appendChild(amountGroup);
    
    // Category field
    const categoryField = createSelectField({
        label: 'Category',
        id: 'category',
        name: 'category',
        placeholder: 'Select a category',
        options: [
            { value: 'food', text: '🍽️ Food & Dining' },
            { value: 'transport', text: '🚗 Transportation' },
            { value: 'utilities', text: '💡 Utilities' },
            { value: 'entertainment', text: '🎮 Entertainment' },
            { value: 'shopping', text: '🛍️ Shopping' },
            { value: 'accommodation', text: '🏠 Accommodation' },
            { value: 'healthcare', text: '🏥 Healthcare' },
            { value: 'education', text: '📚 Education' },
            { value: 'other', text: '📌 Other' }
        ]
    });
    form.appendChild(categoryField);
    
    // Paid by field (will be populated later)
    const paidByField = createSelectField({
        label: 'Paid by',
        id: 'paidBy',
        name: 'paidBy',
        required: true,
        placeholder: 'Select who paid',
        options: [],
        ariaDescribedBy: 'paidBy-error'
    });
    form.appendChild(paidByField);
    
    // Split between section
    const splitBetweenSection = createFormSection('Split between', []);
    const membersError = createElementSafe('div', {
        id: 'members-error',
        className: 'form-error',
        role: 'alert'
    });
    const membersList = createElementSafe('div', {
        className: 'member-select-list',
        id: 'membersList'
    });
    splitBetweenSection.appendChild(membersError);
    splitBetweenSection.appendChild(membersList);
    form.appendChild(splitBetweenSection);
    
    // Split method section
    const splitMethodSection = createFormSection('Split method', []);
    const splitMethodOptions = createElementSafe('div', { className: 'split-method-options' });
    
    // Equal split option
    const equalOption = createElementSafe('div', { className: 'split-method-option' });
    const equalRadio = createElementSafe('input', {
        type: 'radio',
        name: 'splitMethod',
        value: 'equal',
        id: 'split-equal',
        className: 'split-method-radio',
        checked: true
    }) as HTMLInputElement;
    const equalLabel = createElementSafe('label', {
        className: 'split-method-label',
        htmlFor: 'split-equal',
        textContent: 'Split equally'
    });
    equalOption.appendChild(equalRadio);
    equalOption.appendChild(equalLabel);
    
    // Custom split option
    const customOption = createElementSafe('div', { className: 'split-method-option' });
    const customRadio = createElementSafe('input', {
        type: 'radio',
        name: 'splitMethod',
        value: 'custom',
        id: 'split-custom',
        className: 'split-method-radio'
    }) as HTMLInputElement;
    const customLabel = createElementSafe('label', {
        className: 'split-method-label',
        htmlFor: 'split-custom',
        textContent: 'Custom split'
    });
    customOption.appendChild(customRadio);
    customOption.appendChild(customLabel);
    
    splitMethodOptions.appendChild(equalOption);
    splitMethodOptions.appendChild(customOption);
    splitMethodSection.appendChild(splitMethodOptions);
    
    // Custom split section
    const customSplitSection = createElementSafe('div', {
        id: 'customSplitSection',
        className: 'custom-split-section',
        style: 'display: none;'
    });
    const customSplitInputs = createElementSafe('div', {
        id: 'customSplitInputs',
        className: 'custom-split-inputs'
    });
    const splitTotal = createElementSafe('div', { className: 'split-total' });
    splitTotal.innerHTML = 'Total: <span class="split-total-amount">$<span id="splitTotal">0.00</span></span>';
    customSplitSection.appendChild(customSplitInputs);
    customSplitSection.appendChild(splitTotal);
    splitMethodSection.appendChild(customSplitSection);
    
    form.appendChild(splitMethodSection);
    
    // Form actions
    const formActions = createElementSafe('div', { className: 'add-expense-actions' });
    const cancelButton = createButton({
        text: 'Cancel',
        variant: 'secondary',
        type: 'button'
    });
    cancelButton.id = 'cancelButton';
    
    const submitButton = createButton({
        text: 'Add Expense',
        variant: 'primary',
        type: 'submit'
    });
    submitButton.id = 'submitButton';
    
    formActions.appendChild(cancelButton);
    formActions.appendChild(submitButton);
    form.appendChild(formActions);
    
    formContainer.appendChild(form);
    
    // Populate paid by options and members after form is created
    if (currentGroup) {
        populatePaidByOptions();
        populateMembers();
    }
}

export async function initializeAddExpensePage(): Promise<void> {
    await waitForAuthManager();
    
    if (!authManager.getUserId()) {
        authManager.setUserId('user1');
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    currentGroupId = urlParams.get('groupId');
    const editExpenseId = urlParams.get('id');
    const isEdit = urlParams.get('edit') === 'true';
    
    if (!currentGroupId && !editExpenseId) {
        window.location.href = ROUTES.DASHBOARD;
        return;
    }
    
    // Render the page HTML
    renderAddExpensePage();
    
    if (isEdit && editExpenseId) {
        await loadExpenseForEditing(editExpenseId);
    } else {
        await loadGroupData();
        await loadUserPreferences();
    }
    
    // Build the form after data is loaded
    buildExpenseForm();
    
    // Initialize event listeners after form is built
    initializeEventListeners();
    
    // If editing, populate the form with expense data
    if (isEdit && editExpenseId) {
        const urlExpense = await apiService.getExpense(editExpenseId);
        if (urlExpense.data) {
            // Re-populate the selects after editing data is loaded
            populatePaidByOptions();
            populateMembers();
            populateFormWithExpense(urlExpense.data);
            const submitBtn = document.getElementById('submitButton') as HTMLButtonElement;
            if (submitBtn) {
                submitBtn.textContent = 'Update Expense';
            }
        }
    }
}

async function loadExpenseForEditing(expenseId: string): Promise<void> {
    const response = await apiService.getExpense(expenseId);
    const expense = response.data!;
    
    currentGroupId = expense.groupId;
    await loadGroupData();
    
    // Update page title
    const titleEl = document.getElementById('pageTitle') as HTMLElement;
    if (titleEl) {
        titleEl.textContent = 'Edit Expense';
    }
}

async function loadGroupData(): Promise<void> {
    const response = await apiService.getGroup(currentGroupId!);
    currentGroup = response.data!;
}

async function loadUserPreferences(): Promise<void> {
    const currentUserId = authManager.getUserId();
    const response = await apiService.getGroupExpenses(currentGroupId!, 1, null);
    
    if (response.expenses && response.expenses.length > 0) {
        const lastExpense = response.expenses.find((expense: ExpenseData) => expense.paidBy === currentUserId);
        if (lastExpense) {
            lastExpenseData = lastExpense;
            const categoryEl = document.getElementById('category') as HTMLSelectElement;
            const descriptionEl = document.getElementById('description') as HTMLInputElement;
            if (categoryEl && lastExpense.category) {
                categoryEl.value = lastExpense.category;
            }
            if (descriptionEl) {
                descriptionEl.value = lastExpense.description;
            }
        }
    }
}

function populatePaidByOptions(): void {
    const paidBySelect = document.getElementById('paidBy') as HTMLSelectElement;
    if (!paidBySelect) {
        logger.warn('paidBy select element not found');
        return;
    }
    
    const currentUserId = authManager.getUserId();
    
    clearElement(paidBySelect);
    const defaultOption = createElementSafe('option', { value: '', textContent: 'Select who paid' });
    paidBySelect.appendChild(defaultOption);
    
    if (!currentGroup) return;
    
    currentGroup.members.forEach((member: Member) => {
        const option = document.createElement('option');
        option.value = member.uid;
        option.textContent = member.uid === currentUserId ? 'You' : member.name;
        paidBySelect.appendChild(option);
    });
    
    paidBySelect.value = currentUserId!;
}

function populateMembers(): void {
    const membersList = document.getElementById('membersList') as HTMLElement;
    if (!membersList) {
        logger.warn('membersList element not found');
        return;
    }
    
    const currentUserId = authManager.getUserId();
    
    clearElement(membersList);
    
    if (!currentGroup) return;
    
    currentGroup.members.forEach((member: Member) => {
        const memberItem = createElementSafe('div', { className: 'member-select-item selected' });
        
        const checkbox = createElementSafe('input', {
            type: 'checkbox',
            id: `member-${member.uid}`,
            value: member.uid,
            className: 'member-checkbox',
            checked: true
        }) as HTMLInputElement;
        checkbox.addEventListener('change', handleMemberToggle);
        
        const label = createElementSafe('label', {
            htmlFor: `member-${member.uid}`,
            className: 'member-label'
        });
        
        const checkboxVisual = createElementSafe('div', { className: 'member-checkbox-visual' });
        
        const memberAvatar = createElementSafe('div', {
            className: 'member-avatar',
            textContent: member.name.charAt(0).toUpperCase()
        });
        
        const memberName = createElementSafe('span', {
            className: 'member-name',
            textContent: member.uid === currentUserId ? 'You' : member.name
        });
        
        label.appendChild(checkboxVisual);
        label.appendChild(memberAvatar);
        label.appendChild(memberName);
        
        memberItem.appendChild(checkbox);
        memberItem.appendChild(label);
        
        membersList.appendChild(memberItem);
        
        selectedMembers.add(member.uid);
    });
}

function initializeEventListeners(): void {
    const backBtn = document.getElementById('backButton') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancelButton') as HTMLButtonElement;
    const form = document.getElementById('expenseForm') as HTMLFormElement;
    const amountInput = document.getElementById('amount') as HTMLInputElement;
    
    backBtn.addEventListener('click', () => {
        window.location.href = `${ROUTES.GROUP_DETAIL}?id=${currentGroupId}`;
    });
    
    cancelBtn.addEventListener('click', () => {
        window.location.href = `${ROUTES.GROUP_DETAIL}?id=${currentGroupId}`;
    });
    
    form.addEventListener('submit', handleSubmit);
    
    document.querySelectorAll<HTMLInputElement>('input[name="splitMethod"]').forEach(radio => {
        radio.addEventListener('change', handleSplitMethodChange);
    });
    
    amountInput.addEventListener('input', () => {
        if (updateCustomSplitInputsTimeout) {
            clearTimeout(updateCustomSplitInputsTimeout);
        }
        updateCustomSplitInputsTimeout = setTimeout(updateCustomSplitInputs, 300);
    });
}

function handleMemberToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    const memberId = target.value;
    const memberItem = target.closest('.member-select-item');
    
    if (target.checked) {
        selectedMembers.add(memberId);
        memberItem?.classList.add('selected');
    } else {
        selectedMembers.delete(memberId);
        memberItem?.classList.remove('selected');
    }
    
    updateCustomSplitInputs();
}

function handleSplitMethodChange(event: Event): void {
    const customSection = document.getElementById('customSplitSection') as HTMLElement;
    const target = event.target as HTMLInputElement;
    
    if (target.value === 'custom') {
        customSection.style.display = 'block';
        updateCustomSplitInputs();
    } else {
        customSection.style.display = 'none';
    }
}

function updateCustomSplitInputs(): void {
    const splitMethodEl = document.querySelector<HTMLInputElement>('input[name="splitMethod"]:checked');
    if (!splitMethodEl) return;
    
    const splitMethod = splitMethodEl.value;
    
    if (splitMethod !== 'custom') return;
    
    const amountEl = document.getElementById('amount') as HTMLInputElement;
    const amount = parseFloat(amountEl.value) || 0;
    const customInputs = document.getElementById('customSplitInputs') as HTMLElement;
    
    clearElement(customInputs);
    
    const equalSplit = selectedMembers.size > 0 ? amount / selectedMembers.size : 0;
    const currentUserId = authManager.getUserId();
    
    if (!currentGroup) return;
    
    selectedMembers.forEach(memberId => {
        const member = currentGroup?.members.find((m: Member) => m.uid === memberId);
        if (!member) return;
        
        const inputGroup = createElementSafe('div', { className: 'custom-split-input-group' });
        
        const memberInfo = createElementSafe('div', { className: 'custom-split-member' });
        
        const avatar = createElementSafe('div', {
            className: 'member-avatar',
            textContent: member.name.charAt(0).toUpperCase()
        });
        
        const name = createElementSafe('span', {
            className: 'member-name',
            textContent: member.uid === currentUserId ? 'You' : member.name
        });
        
        memberInfo.appendChild(avatar);
        memberInfo.appendChild(name);
        
        const amountWrapper = createElementSafe('div', { className: 'custom-split-amount' });
        const input = createElementSafe('input', {
            type: 'number',
            className: 'form-input',
            step: '0.01',
            min: '0',
            value: equalSplit.toFixed(2)
        }) as HTMLInputElement;
        input.dataset.memberId = memberId;
        input.addEventListener('input', () => {
            if (updateSplitTotalTimeout) {
                clearTimeout(updateSplitTotalTimeout);
            }
            updateSplitTotalTimeout = setTimeout(updateSplitTotal, 300);
        });
        
        amountWrapper.appendChild(input);
        inputGroup.appendChild(memberInfo);
        inputGroup.appendChild(amountWrapper);
        customInputs.appendChild(inputGroup);
    });
    
    updateSplitTotal();
}

function populateFormWithExpense(expense: ExpenseData): void {
    const descriptionEl = document.getElementById('description') as HTMLInputElement;
    const amountEl = document.getElementById('amount') as HTMLInputElement;
    const categoryEl = document.getElementById('category') as HTMLSelectElement;
    const paidByEl = document.getElementById('paidBy') as HTMLSelectElement;
    
    descriptionEl.value = expense.description;
    amountEl.value = expense.amount.toString();
    categoryEl.value = expense.category || '';
    paidByEl.value = expense.paidBy;
    
    const splits = expense.splits || [];
    
    const splitMethod = determineSplitMethod(splits);
    const splitMethodEl = document.querySelector<HTMLInputElement>(`input[name="splitMethod"][value="${splitMethod}"]`);
    if (splitMethodEl) splitMethodEl.checked = true;
    
    splits.forEach(split => {
        selectedMembers.add(split.userId);
    });
    
    updateMemberCheckboxes();
    handleSplitMethodChange({ target: { value: splitMethod } } as any);
    
    if (splitMethod === 'custom') {
        populateCustomSplits(splits);
    }
}

function determineSplitMethod(splits: Array<{userId: string; amount: number}>): string {
    
    const amounts = splits.map(split => split.amount);
    const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
    const equalAmount = totalAmount / amounts.length;
    
    const isEqual = amounts.every(amount => 
        Math.abs(amount - equalAmount) < 0.01
    );
    
    return isEqual ? 'equal' : 'custom';
}

function populateCustomSplits(splits: Array<{userId: string; amount: number}>): void {
    const customInputs = document.getElementById('customSplitInputs') as HTMLElement;
    const inputs = customInputs.querySelectorAll<HTMLInputElement>('input');
    
    splits.forEach(split => {
        const input = Array.from(inputs).find(input => 
            input.dataset.memberId === split.userId
        );
        if (input) {
            input.value = split.amount.toString();
        }
    });
    
    updateSplitTotal();
}

function updateMemberCheckboxes(): void {
    const memberCheckboxes = document.querySelectorAll<HTMLInputElement>('#membersList .member-checkbox');
    memberCheckboxes.forEach(checkbox => {
        const isSelected = selectedMembers.has(checkbox.value);
        checkbox.checked = isSelected;
        const memberItem = checkbox.closest('.member-select-item');
        if (memberItem) {
            if (isSelected) {
                memberItem.classList.add('selected');
            } else {
                memberItem.classList.remove('selected');
            }
        }
    });
}

function updateSplitTotal(): void {
    const customInputs = document.querySelectorAll<HTMLInputElement>('#customSplitInputs input');
    const splitTotal = document.getElementById('splitTotal') as HTMLElement;
    
    let total = 0;
    customInputs.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    
    splitTotal.textContent = total.toFixed(2);
}

async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    
    const target = event.target as HTMLFormElement;
    const formData = new FormData(target);
    const description = (formData.get('description') as string).trim();
    const amount = parseFloat(formData.get('amount') as string);
    const category = formData.get('category') as string;
    const paidBy = formData.get('paidBy') as string;
    const splitMethod = formData.get('splitMethod') as string;
    
    if (!validateForm(description, amount, paidBy)) {
        return;
    }
    
    const splits = calculateSplits(amount, splitMethod);
    
    const expenseData = {
        description,
        amount,
        category,
        paidBy,
        groupId: currentGroupId!,
        splitType: splitMethod === 'equal' ? 'equal' : (splitMethod === 'exact' ? 'exact' : 'percentage') as 'equal' | 'exact' | 'percentage',
        participants: Array.from(selectedMembers),
        splits: Object.entries(splits).map(([userId, amount]) => ({
            userId,
            amount: parseFloat(amount as any)
        })),
        date: new Date().toISOString()
    };
    
    const urlParams = new URLSearchParams(window.location.search);
    const editExpenseId = urlParams.get('id');
    const isEdit = urlParams.get('edit') === 'true';
    
    const submitButton = document.getElementById('submitButton') as HTMLButtonElement;
    submitButton.disabled = true;
    clearElement(submitButton);
    const spinnerIcon = createElementSafe('i', { className: 'fas fa-spinner fa-spin' });
    submitButton.appendChild(spinnerIcon);
    submitButton.appendChild(document.createTextNode(' Saving...'));
    
    if (isEdit && editExpenseId) {
        await apiService.updateExpense(editExpenseId, expenseData);
    } else {
        await apiService.createExpense(expenseData);
    }
    
    showMessage('Expense added successfully!', 'success');
    
    setTimeout(() => {
        window.location.href = `${ROUTES.GROUP_DETAIL}?id=${currentGroupId}`;
    }, 1000);
}

import { validateRequired } from './utils/form-validation.js';

function validateForm(description: string, amount: number, paidBy: string): boolean {
    let isValid = true;
    
    isValid = validateRequired(description, 'description', 'Description is required') && isValid;
    isValid = validateRequired(amount, 'amount', 'Amount must be greater than 0') && isValid;
    isValid = validateRequired(paidBy, 'paidBy', 'Please select who paid') && isValid;
    
    if (selectedMembers.size === 0) {
        showFieldError('members', 'Please select at least one member');
        isValid = false;
    }
    
    const splitMethodEl = document.querySelector<HTMLInputElement>('input[name="splitMethod"]:checked');
    if (splitMethodEl && splitMethodEl.value === 'custom') {
        const customInputs = document.querySelectorAll<HTMLInputElement>('#customSplitInputs input');
        let customTotal = 0;
        
        customInputs.forEach(input => {
            customTotal += parseFloat(input.value) || 0;
        });
        
        if (Math.abs(customTotal - amount) > 0.01) {
            showMessage('Custom split amounts must equal the total amount', 'error');
            isValid = false;
        }
    }
    
    return isValid;
}

function calculateSplits(amount: number, splitMethod: string): Record<string, number> {
    const splits: Record<string, number> = {};
    
    if (splitMethod === 'equal') {
        const splitAmount = amount / selectedMembers.size;
        selectedMembers.forEach(memberId => {
            splits[memberId] = Math.round(splitAmount * 100) / 100;
        });
    } else {
        const customInputs = document.querySelectorAll<HTMLInputElement>('#customSplitInputs input');
        customInputs.forEach(input => {
            const memberId = input.dataset.memberId!;
            const memberAmount = parseFloat(input.value) || 0;
            splits[memberId] = memberAmount;
        });
    }
    
    return splits;
}

