import { logger } from './utils/logger.js';
import { createElementSafe, clearElement, appendChildren } from './utils/safe-dom.js';
import { apiService } from './api.js';
import { authManager } from './auth.js';
import { ExpenseService } from './expenses.js';
import { waitForAuthManager } from './utils/auth-utils.js';
import { showError as showUIError } from './utils/ui-messages.js';
import { ROUTES } from './routes.js';
import type { User } from './types/global';
import type { Member, GroupDetail } from './types/api';
import type { ExpenseData } from './types/business-logic';

let currentExpense: ExpenseData | null = null;
let currentUser: User | null = null;
let currentGroup: GroupDetail | null = null;

async function initializeExpenseDetailPage(): Promise<void> {
    setupEventListeners();
    
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

    // TODO: Implement header without component
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
        headerContainer.innerHTML = '<h1>Expense Details</h1>';
    }

    // Set up navigation with proper back button
    const navContainer = document.querySelector('.nav-header');
    if (navContainer && currentExpense) {
        const groupId = currentExpense.groupId;
        navContainer.innerHTML = `<nav><a href="${ROUTES.GROUP_DETAIL}?id=${groupId}" class="back-button">← Back to Group</a><h2>Expense Details</h2></nav>`;
    }
}

// Export for initialization from expense-detail-init.ts
export { initializeExpenseDetailPage };

// For backward compatibility when loaded directly
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExpenseDetailPage);
} else {
    // DOM is already loaded
    initializeExpenseDetailPage();
}

async function loadExpenseDetails(expenseId: string): Promise<void> {
    showLoading();
    
    // Use real API to get expense details
    const expense = await ExpenseService.getExpense(expenseId);
    const user: User = { uid: authManager.getUserId()! } as User;

    // Fetch group data to get member information for ID-to-name mapping
    const groupResponse = await apiService.getGroup(expense.groupId);
    const group = groupResponse.data!;

    currentExpense = expense;
    currentUser = user;
    currentGroup = group;

    displayExpenseDetails(expense);
    setupPermissions(expense, user);
    await loadExpenseHistory(expenseId);
}


function displayExpenseDetails(expense: ExpenseData): void {
    const amountEl = document.getElementById('expense-amount') as HTMLElement;
    const descriptionEl = document.getElementById('expense-description') as HTMLElement;
    const dateEl = document.getElementById('expense-date') as HTMLElement;
    const categoryEl = document.getElementById('expense-category') as HTMLElement;
    const loadingEl = document.getElementById('loading') as HTMLElement;
    const containerEl = document.getElementById('expense-detail-container') as HTMLElement;

    // Update header elements
    const amountHeaderEl = document.getElementById('expense-amount-header') as HTMLElement;
    const descriptionHeaderEl = document.getElementById('expense-description-header') as HTMLElement;
    const dateHeaderEl = document.getElementById('expense-date-header') as HTMLElement;
    const categoryHeaderEl = document.getElementById('expense-category-header') as HTMLElement;
    const groupHeaderEl = document.getElementById('expense-group-header') as HTMLElement;

    // Set values for both old elements (if they exist) and new header elements
    if (amountEl) amountEl.textContent = expense.amount.toFixed(2);
    if (amountHeaderEl) amountHeaderEl.textContent = expense.amount.toFixed(2);
    
    if (descriptionEl) descriptionEl.textContent = expense.description;
    if (descriptionHeaderEl) descriptionHeaderEl.textContent = expense.description;
    
    const formattedDate = formatDate(expense.date || expense.createdAt);
    if (dateEl) dateEl.textContent = formattedDate;
    if (dateHeaderEl) dateHeaderEl.textContent = formattedDate;
    
    if (categoryEl) categoryEl.textContent = 'General';
    if (categoryHeaderEl) categoryHeaderEl.textContent = 'General';
    
    // Display group info in header
    const groupEl = document.getElementById('expense-group') as HTMLElement;
    if (groupEl && currentGroup) {
        groupEl.textContent = currentGroup.name;
    }
    if (groupHeaderEl && currentGroup) {
        groupHeaderEl.textContent = currentGroup.name;
    }

    displayPayerInfo(expense.paidBy);
    displaySplitBreakdown(expense.splits);
    
    // Receipt URL not available in ExpenseData type
    // if (expense.receiptUrl) {
    //     displayReceipt(expense.receiptUrl);
    // }

    loadingEl.style.display = 'none';
    containerEl.style.display = 'block';
}

function displayPayerInfo(paidBy: string): void {
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

function displaySplitBreakdown(splits: Array<{userId: string; amount: number}>): void {
    const splitBreakdown = document.getElementById('split-breakdown') as HTMLElement;
    clearElement(splitBreakdown);


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

function setupPermissions(expense: ExpenseData, user: User): void {
    const editBtn = document.getElementById('edit-expense-btn') as HTMLButtonElement;
    const deleteBtn = document.getElementById('delete-expense-btn') as HTMLButtonElement;
    
    if (!editBtn || !deleteBtn || !currentGroup) {
        logger.warn('Required elements not found for permission setup');
        return;
    }
    
    // Check if user can edit/delete the expense:
    // 1. User created the expense
    // 2. User is the group admin (created the group)
    const isExpenseCreator = expense.createdBy === user.uid;
    const isGroupAdmin = currentGroup.createdBy === user.uid;
    
    if (isExpenseCreator || isGroupAdmin) {
        editBtn.classList.remove('hidden');
        deleteBtn.classList.remove('hidden');
    } else {
        // Ensure buttons remain hidden if user doesn't have permission
        editBtn.classList.add('hidden');
        deleteBtn.classList.add('hidden');
    }
}

function setupEventListeners(): void {
    const editBtn = document.getElementById('edit-expense-btn') as HTMLButtonElement;
    const deleteBtn = document.getElementById('delete-expense-btn') as HTMLButtonElement;
    const confirmBtn = document.getElementById('confirm-delete-btn') as HTMLButtonElement;
    const backBtn = document.getElementById('backButton') as HTMLButtonElement;
    const toggleHistoryBtn = document.getElementById('toggle-history-btn') as HTMLButtonElement;
    
    if (editBtn) editBtn.addEventListener('click', editExpense);
    if (deleteBtn) deleteBtn.addEventListener('click', showDeleteModal);
    if (confirmBtn) confirmBtn.addEventListener('click', deleteExpense);
    
    // Toggle history button handler
    if (toggleHistoryBtn) {
        toggleHistoryBtn.addEventListener('click', toggleExpenseHistory);
    }
    
    // Back button handler
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('return');
            
            if (returnUrl) {
                window.location.href = returnUrl;
            } else if (currentExpense) {
                window.location.href = `${ROUTES.GROUP_DETAIL}?id=${currentExpense.groupId}`;
            } else {
                window.location.href = ROUTES.DASHBOARD;
            }
        });
    }
    
    // Retry button handler
    const retryButton = document.querySelector('.button.button--secondary') as HTMLButtonElement;
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
    
    const deleteBtn = document.getElementById('confirm-delete-btn') as HTMLButtonElement;
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    await ExpenseService.deleteExpense(currentExpense.id);
    
    closeDeleteModal();
    
    const urlParams = new URLSearchParams(window.location.search);
    const returnUrl = urlParams.get('return') ?? ROUTES.DASHBOARD;
    window.location.href = returnUrl;
}

function getUserDisplayName(userId: string): string {
    if (!currentGroup || !currentUser) return userId;
    
    const member = currentGroup.members.find((m: Member) => m.uid === userId);
    if (!member) return userId;
    
    // Show "You" for current user, otherwise show the member's name
    return member.uid === currentUser.uid ? 'You' : member.displayName;
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

async function loadExpenseHistory(expenseId: string): Promise<void> {
    try {
        const response = await apiService.getExpenseHistory(expenseId);
        displayExpenseHistory(response.history);
    } catch (error) {
        logger.error('Failed to load expense history', error);
        // Don't show error to user, just show no history
        displayExpenseHistory([]);
    }
}

function displayExpenseHistory(history: any[]): void {
    const historyList = document.getElementById('expense-history-list') as HTMLElement;
    const noHistory = document.getElementById('no-history') as HTMLElement;
    const historyLoading = document.getElementById('history-loading') as HTMLElement;
    
    if (historyLoading) historyLoading.style.display = 'none';
    
    if (!history || history.length === 0) {
        if (noHistory) noHistory.style.display = 'block';
        if (historyList) historyList.style.display = 'none';
        return;
    }
    
    if (noHistory) noHistory.style.display = 'none';
    if (historyList) {
        historyList.style.display = 'block';
        clearElement(historyList);
        
        history.forEach(entry => {
            const historyEntry = createHistoryEntry(entry);
            historyList.appendChild(historyEntry);
        });
    }
}

function createHistoryEntry(entry: any): HTMLElement {
    const entryEl = createElementSafe('div', { className: 'history-entry' });
    
    // Header with date and user
    const header = createElementSafe('div', { className: 'history-entry-header' });
    const date = createElementSafe('div', { 
        className: 'history-entry-date',
        textContent: formatDate(entry.modifiedAt)
    });
    const user = createElementSafe('div', { 
        className: 'history-entry-user',
        textContent: getUserDisplayName(entry.modifiedBy)
    });
    
    header.appendChild(date);
    header.appendChild(user);
    entryEl.appendChild(header);
    
    // Changes list
    if (entry.changes && entry.changes.length > 0) {
        const changesEl = createElementSafe('div', { className: 'history-entry-changes' });
        
        entry.changes.forEach((change: string) => {
            const badge = createElementSafe('div', { 
                className: 'history-change-badge',
                textContent: formatChangeLabel(change)
            });
            changesEl.appendChild(badge);
        });
        
        entryEl.appendChild(changesEl);
    }
    
    return entryEl;
}

function formatChangeLabel(change: string): string {
    const labels: Record<string, string> = {
        'amount': 'Amount',
        'description': 'Description',
        'date': 'Date',
        'category': 'Category',
        'participants': 'Participants',
        'splits': 'Split amounts',
        'splitType': 'Split method'
    };
    
    return labels[change] || change;
}

function toggleExpenseHistory(): void {
    const container = document.getElementById('expense-history-container') as HTMLElement;
    const toggleBtn = document.getElementById('toggle-history-btn') as HTMLButtonElement;
    
    if (!container || !toggleBtn) return;
    
    const isVisible = container.style.display !== 'none';
    container.style.display = isVisible ? 'none' : 'block';
    toggleBtn.classList.toggle('active', !isVisible);
}

(window as any).closeDeleteModal = closeDeleteModal;