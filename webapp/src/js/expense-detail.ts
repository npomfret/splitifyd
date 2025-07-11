import { logger } from './utils/logger.js';
import { createElementSafe, clearElement, appendChildren } from './utils/safe-dom.js';
import { apiService } from './api.js';
import { authManager } from './auth.js';
import { ExpenseService } from './expenses.js';
import { waitForAuthManager } from './utils/auth-utils.js';
import type { User } from './types/global';
import type { Member, GroupDetail } from './types/api';
import type { ExpenseData } from './types/business-logic';

let currentExpense: ExpenseData | null = null;
let currentUser: User | null = null;
let currentGroup: GroupDetail | null = null;

async function initializeExpenseDetailPage(): Promise<void> {
    try {
        await waitForAuthManager();
        
        if (!authManager.getUserId()) {
            authManager.setUserId('user1');
        }

        const urlParams = new URLSearchParams(window.location.search);
        const expenseId = urlParams.get('id');
        
        if (!expenseId) {
            showError('No expense ID provided');
            return;
        }

        await loadExpenseDetails(expenseId);
        setupEventListeners();
    } catch (error) {
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', initializeExpenseDetailPage);

async function loadExpenseDetails(expenseId: string): Promise<void> {
    try {
        showLoading();
        
        // Use real API to get expense details
        const expense = await ExpenseService.getExpense(expenseId);
        const user: User = { uid: authManager.getUserId() || '' } as User;

        // Fetch group data to get member information for ID-to-name mapping
        const groupResponse = await apiService.getGroup(expense.groupId);
        const group = groupResponse.data!;

        currentExpense = expense;
        currentUser = user;
        currentGroup = group;

        displayExpenseDetails(expense);
        setupPermissions(expense, user);
        
    } catch (error: any) {
        logger.error('Error loading expense details:', error);
        showError(`Failed to load expense details: ${error.message || 'Unknown error'}`);
    }
}


function displayExpenseDetails(expense: ExpenseData): void {
    const amountEl = document.getElementById('expense-amount') as HTMLElement;
    const descriptionEl = document.getElementById('expense-description') as HTMLElement;
    const dateEl = document.getElementById('expense-date') as HTMLElement;
    const categoryEl = document.getElementById('expense-category') as HTMLElement;
    const loadingEl = document.getElementById('loading') as HTMLElement;
    const containerEl = document.getElementById('expense-detail-container') as HTMLElement;

    amountEl.textContent = expense.amount.toFixed(2);
    descriptionEl.textContent = expense.description;
    dateEl.textContent = formatDate(expense.date || expense.createdAt);
    categoryEl.textContent = 'General';

    displayPayerInfo(expense.paidBy, expense.splits);
    displaySplitBreakdown(expense.splits, expense.amount);
    displayGroupInfo(expense.groupId);
    
    // Receipt URL not available in ExpenseData type
    // if (expense.receiptUrl) {
    //     displayReceipt(expense.receiptUrl);
    // }

    loadingEl.style.display = 'none';
    containerEl.style.display = 'block';
}

function displayPayerInfo(paidBy: string, splits: Array<{userId: string; amount: number}>): void {
    const payerName = getUserDisplayName(paidBy);
    const initials = getInitials(payerName);
    const initialsEl = document.getElementById('payer-initials') as HTMLElement;
    const nameEl = document.getElementById('payer-name') as HTMLElement;
    const emailEl = document.getElementById('payer-email') as HTMLElement;
    
    initialsEl.textContent = initials;
    nameEl.textContent = payerName;
    emailEl.textContent = '';
    emailEl.style.display = 'none';
}

function displaySplitBreakdown(splits: Array<{userId: string; amount: number}>, totalAmount: number): void {
    const splitBreakdown = document.getElementById('split-breakdown') as HTMLElement;
    splitBreakdown.innerHTML = '';


    splits.forEach(split => {
        const userId = split.userId;
        const amount = split.amount;
        const participantRow = document.createElement('div');
        participantRow.className = 'participant-row';
        
        const userName = getUserDisplayName(userId);
        const splitAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

        clearElement(participantRow);
        
        const participantInfo = createElementSafe('div', { className: 'participant-info' });
        const userAvatar = createElementSafe('div', { className: 'user-avatar' });
        const avatarSpan = createElementSafe('span', { textContent: getInitials(userName) });
        const participantName = createElementSafe('span', { className: 'participant-name', textContent: userName });
        
        userAvatar.appendChild(avatarSpan);
        participantInfo.appendChild(userAvatar);
        participantInfo.appendChild(participantName);
        
        const participantAmount = createElementSafe('div', { 
            className: 'participant-amount', 
            textContent: `$${splitAmount.toFixed(2)}`
        });
        
        appendChildren(participantRow, [participantInfo, participantAmount]);
        
        splitBreakdown.appendChild(participantRow);
    });
}

function displayGroupInfo(groupId: string): void {
    const groupInfo = document.getElementById('group-info') as HTMLElement;
    const groupName = currentGroup ? currentGroup.name : `Group ${groupId}`;
    const memberCount = currentGroup ? currentGroup.members.length : 0;
    
    clearElement(groupInfo);
    
    const groupNameSpan = createElementSafe('span', { className: 'group-name', textContent: groupName });
    const groupMembersSpan = createElementSafe('span', { className: 'group-members', textContent: `${memberCount} members` });
    
    appendChildren(groupInfo, [groupNameSpan, groupMembersSpan]);
}

function displayReceipt(receiptUrl: string): void {
    const receiptSection = document.getElementById('receipt-section') as HTMLElement;
    const receiptImage = document.getElementById('receipt-image') as HTMLImageElement;
    
    receiptImage.src = receiptUrl;
    receiptSection.style.display = 'block';
}

function setupPermissions(expense: ExpenseData, user: User): void {
    // ExpenseData from business-logic doesn't have createdBy, assume paidBy is creator
    const isCreator = expense.paidBy === user.uid;
    const editBtn = document.getElementById('edit-expense-btn') as HTMLButtonElement;
    const deleteBtn = document.getElementById('delete-expense-btn') as HTMLButtonElement;
    
    if (isCreator) {
        editBtn.style.display = 'block';
        deleteBtn.style.display = 'block';
    }
}

function setupEventListeners(): void {
    const editBtn = document.getElementById('edit-expense-btn') as HTMLButtonElement;
    const deleteBtn = document.getElementById('delete-expense-btn') as HTMLButtonElement;
    const confirmBtn = document.getElementById('confirm-delete-btn') as HTMLButtonElement;
    
    editBtn.addEventListener('click', editExpense);
    deleteBtn.addEventListener('click', showDeleteModal);
    confirmBtn.addEventListener('click', deleteExpense);
    
    // Back button handler
    const backButton = document.querySelector('.back-button') as HTMLButtonElement;
    if (backButton) {
        backButton.addEventListener('click', () => {
            history.back();
        });
    }
    
    // Retry button handler
    const retryButton = document.querySelector('.btn.btn-secondary[onclick*="location.reload"]') as HTMLButtonElement;
    if (retryButton) {
        retryButton.addEventListener('click', () => {
            location.reload();
        });
    }
    
    // Delete modal close handlers
    const deleteModalCloseButtons = document.querySelectorAll('[onclick*="closeDeleteModal"]');
    deleteModalCloseButtons.forEach(button => {
        button.addEventListener('click', closeDeleteModal);
    });
}

function editExpense(): void {
    if (!currentExpense) return;
    
    const urlParams = new URLSearchParams({
        id: currentExpense.id,
        edit: 'true'
    });
    window.location.href = `add-expense.html?${urlParams.toString()}`;
}

function showDeleteModal(): void {
    if (!currentExpense) return;
    
    const descEl = document.getElementById('delete-expense-description') as HTMLElement;
    const amountEl = document.getElementById('delete-expense-amount') as HTMLElement;
    const modalEl = document.getElementById('delete-confirmation-modal') as HTMLElement;
    
    descEl.textContent = currentExpense.description;
    amountEl.textContent = `$${currentExpense.amount.toFixed(2)}`;
    modalEl.style.display = 'flex';
}

function closeDeleteModal(): void {
    // Try both modal IDs to handle different modal implementations
    const modalEl1 = document.getElementById('delete-confirmation-modal') as HTMLElement;
    const modalEl2 = document.getElementById('deleteModal') as HTMLElement;
    
    if (modalEl1) {
        modalEl1.style.display = 'none';
    }
    
    if (modalEl2) {
        modalEl2.classList.add('hidden');
        modalEl2.classList.remove('visible-flex');
        document.body.classList.remove('modal-open');
    }
}

async function deleteExpense(): Promise<void> {
    if (!currentExpense) return;
    
    try {
        const deleteBtn = document.getElementById('confirm-delete-btn') as HTMLButtonElement;
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Deleting...';

        await ExpenseService.deleteExpense(currentExpense.id);
        
        closeDeleteModal();
        
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('return') || 'dashboard.html';
        window.location.href = returnUrl;
        
    } catch (error) {
        logger.error('Error deleting expense:', error);
        alert('Failed to delete expense. Please try again.');
        
        const deleteBtn = document.getElementById('confirm-delete-btn') as HTMLButtonElement;
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete Expense';
    }
}

function getUserDisplayName(userId: string): string {
    if (!currentGroup || !currentUser) return userId;
    
    const member = currentGroup.members.find((m: Member) => m.uid === userId);
    if (!member) return userId;
    
    // Show "You" for current user, otherwise show the member's name
    return member.uid === currentUser.uid ? 'You' : member.name;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function showLoading(): void {
    const loadingEl = document.getElementById('loading') as HTMLElement;
    const containerEl = document.getElementById('expense-detail-container') as HTMLElement;
    const errorEl = document.getElementById('error-message') as HTMLElement;
    
    loadingEl.style.display = 'block';
    containerEl.style.display = 'none';
    errorEl.style.display = 'none';
}

function showError(message: string): void {
    const loadingEl = document.getElementById('loading') as HTMLElement;
    const containerEl = document.getElementById('expense-detail-container') as HTMLElement;
    const errorEl = document.getElementById('error-message') as HTMLElement;
    const errorTextEl = errorEl.querySelector('p') as HTMLParagraphElement;
    
    loadingEl.style.display = 'none';
    containerEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorTextEl.textContent = message;
}

(window as any).closeDeleteModal = closeDeleteModal;