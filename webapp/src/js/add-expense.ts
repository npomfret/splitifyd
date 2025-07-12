import { logger } from './utils/logger.js';
import { authManager } from './auth.js';
import { apiService } from './api.js';
import { showMessage, showFieldError } from './utils/ui-messages.js';
import { waitForAuthManager } from './utils/auth-utils.js';
import { debounce } from './utils/event-utils.js';
import type { GroupDetail, Member, ExpenseData } from './types/api';

let currentGroup: GroupDetail | null = null;
let currentGroupId: string | null = null;
let selectedMembers = new Set<string>();
let lastExpenseData: ExpenseData | null = null;

async function initializeAddExpensePage(): Promise<void> {
    try {
        await waitForAuthManager();
        
        if (!authManager.getUserId()) {
            authManager.setUserId('user1');
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        currentGroupId = urlParams.get('groupId');
        const editExpenseId = urlParams.get('id');
        const isEdit = urlParams.get('edit') === 'true';
        
        if (!currentGroupId && !editExpenseId) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        if (isEdit && editExpenseId) {
            await loadExpenseForEditing(editExpenseId);
        } else {
            await loadGroupData();
            await loadUserPreferences();
        }
        initializeEventListeners();
    } catch (error) {
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', initializeAddExpensePage);

async function loadExpenseForEditing(expenseId: string): Promise<void> {
    try {
        const response = await apiService.getExpense(expenseId);
        const expense = response.data!;
        
        currentGroupId = expense.groupId;
        await loadGroupData();
        
        populateFormWithExpense(expense);
        
        const titleEl = document.querySelector('.page-title') as HTMLElement;
        const submitBtn = document.getElementById('submitButton') as HTMLButtonElement;
        titleEl.textContent = 'Edit Expense';
        submitBtn.textContent = 'Update Expense';
        
    } catch (error) {
        logger.error('Error loading expense for editing:', error);
        showMessage('Failed to load expense for editing', 'error');
    }
}

async function loadGroupData(): Promise<void> {
    try {
        const response = await apiService.getGroup(currentGroupId!);
        currentGroup = response.data!;
        
        populatePaidByOptions();
        populateMembers();
    } catch (error) {
        logger.error('Error loading group data:', error);
        showMessage('Failed to load group data', 'error');
    }
}

async function loadUserPreferences(): Promise<void> {
    try {
        const currentUserId = authManager.getUserId();
        const response = await apiService.getGroupExpenses(currentGroupId!, 1, 0);
        
        if (response.data && response.data.length > 0) {
            const lastExpense = response.data.find((expense: ExpenseData) => expense.paidBy === currentUserId);
            if (lastExpense) {
                lastExpenseData = lastExpense;
                const categoryEl = document.getElementById('category') as HTMLSelectElement;
                const descriptionEl = document.getElementById('description') as HTMLInputElement;
                categoryEl.value = lastExpense.category || '';
                descriptionEl.value = lastExpense.description;
            }
        }
    } catch (error) {
        logger.error('Error loading user preferences:', error);
    }
}

function populatePaidByOptions(): void {
    const paidBySelect = document.getElementById('paidBy') as HTMLSelectElement;
    const currentUserId = authManager.getUserId();
    
    paidBySelect.innerHTML = '<option value="">Select who paid</option>';
    
    if (!currentGroup) return;
    
    currentGroup.members.forEach((member: Member) => {
        const option = document.createElement('option');
        option.value = member.uid;
        option.textContent = member.uid === currentUserId ? 'You' : member.name;
        paidBySelect.appendChild(option);
    });
    
    paidBySelect.value = currentUserId || '';
}

function populateMembers(): void {
    const membersList = document.getElementById('membersList') as HTMLElement;
    const currentUserId = authManager.getUserId();
    
    membersList.innerHTML = '';
    
    if (!currentGroup) return;
    
    currentGroup.members.forEach((member: Member) => {
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        
        const checkbox = document.createElement('input') as HTMLInputElement;
        checkbox.type = 'checkbox';
        checkbox.id = `member-${member.uid}`;
        checkbox.value = member.uid;
        checkbox.checked = true;
        checkbox.addEventListener('change', handleMemberToggle);
        
        const label = document.createElement('label');
        label.htmlFor = `member-${member.uid}`;
        label.className = 'member-label';
        
        const memberAvatar = document.createElement('div');
        memberAvatar.className = 'member-avatar';
        memberAvatar.textContent = member.name.charAt(0).toUpperCase();
        
        const memberName = document.createElement('span');
        memberName.className = 'member-name';
        memberName.textContent = member.uid === currentUserId ? 'You' : member.name;
        
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
        window.location.href = `group-detail.html?id=${currentGroupId}`;
    });
    
    cancelBtn.addEventListener('click', () => {
        window.location.href = `group-detail.html?id=${currentGroupId}`;
    });
    
    form.addEventListener('submit', handleSubmit);
    
    document.querySelectorAll<HTMLInputElement>('input[name="splitMethod"]').forEach(radio => {
        radio.addEventListener('change', handleSplitMethodChange);
    });
    
    amountInput.addEventListener('input', debounce(updateCustomSplitInputs, 300));
}

function handleMemberToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    const memberId = target.value;
    
    if (target.checked) {
        selectedMembers.add(memberId);
    } else {
        selectedMembers.delete(memberId);
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
    const splitTotal = document.getElementById('splitTotal') as HTMLElement;
    
    customInputs.innerHTML = '';
    
    const equalSplit = selectedMembers.size > 0 ? amount / selectedMembers.size : 0;
    const currentUserId = authManager.getUserId();
    
    if (!currentGroup) return;
    
    selectedMembers.forEach(memberId => {
        const member = currentGroup?.members.find((m: Member) => m.uid === memberId);
        if (!member) return;
        
        const inputGroup = document.createElement('div');
        inputGroup.className = 'custom-split-input';
        
        const label = document.createElement('label');
        label.textContent = member.uid === currentUserId ? 'You' : member.name;
        
        const input = document.createElement('input') as HTMLInputElement;
        input.type = 'number';
        input.step = '0.01';
        input.min = '0';
        input.value = equalSplit.toFixed(2);
        input.dataset.memberId = memberId;
        input.addEventListener('input', debounce(updateSplitTotal, 300));
        
        inputGroup.appendChild(label);
        inputGroup.appendChild(input);
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
    const memberCheckboxes = document.querySelectorAll<HTMLInputElement>('#membersList input[type="checkbox"]');
    memberCheckboxes.forEach(checkbox => {
        checkbox.checked = selectedMembers.has(checkbox.value);
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
    
    try {
        const submitButton = document.getElementById('submitButton') as HTMLButtonElement;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        if (isEdit && editExpenseId) {
            await apiService.updateExpense(editExpenseId, expenseData);
        } else {
            await apiService.createExpense(expenseData);
        }
        
        showMessage('Expense added successfully!', 'success');
        
        setTimeout(() => {
            window.location.href = `group-detail.html?id=${currentGroupId}`;
        }, 1000);
        
    } catch (error) {
        logger.error('Error creating expense:', error);
        showMessage('Failed to add expense', 'error');
        
        const submitButton = document.getElementById('submitButton') as HTMLButtonElement;
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Save';
    }
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

