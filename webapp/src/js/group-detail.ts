import { logger } from './utils/logger.js';
import { createElementSafe, clearElement } from './utils/safe-dom.js';
import { authManager } from './auth.js';
import { apiService } from './api.js';
import { showMessage } from './utils/ui-messages.js';
import { waitForAuthManager } from './utils/auth-utils.js';
import { ROUTES } from './routes.js';
import type { GroupDetail, Member, ExpenseData, GroupBalances } from './types/api';
import type { GroupDetailState } from './types/pages';

let currentGroup: GroupDetail | null = null;
let currentGroupId: string | null = null;
let expensesCursor: string | null = null;
const expensesLimit: number = 20;
let isLoadingExpenses: boolean = false;
let hasMoreExpenses: boolean = true;
const expenseItemCleanups = new Map<HTMLElement, () => void>();

async function initializeGroupDetailPage(): Promise<void> {
    await waitForAuthManager();
    
    if (!authManager.getUserId()) {
        authManager.setUserId('user1');
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    currentGroupId = urlParams.get('id');
    
    if (!currentGroupId) {
        window.location.href = ROUTES.DASHBOARD;
        return;
    }
    
    await loadGroupDetails();
    initializeEventListeners();

    // TODO: Implement header without component
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
        headerContainer.innerHTML = '<h1>Group Details</h1>';
    }
}

// Export for initialization from group-detail-init.ts
export { initializeGroupDetailPage };

// For backward compatibility when loaded directly
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGroupDetailPage);
} else {
    // DOM is already loaded
    initializeGroupDetailPage();
}

function initializeEventListeners(): void {
    document.querySelectorAll<HTMLButtonElement>('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const target = (e.target as HTMLElement).closest('.tab-button') as HTMLElement;
            switchTab(target.dataset.tab!);
        });
    });
    
    const addExpenseBtn = document.getElementById('addExpenseBtn') as HTMLButtonElement;
    const inviteMembersBtn = document.getElementById('inviteMembersBtn') as HTMLButtonElement;
    const groupSettingsBtn = document.getElementById('groupSettingsBtn') as HTMLButtonElement;
    const saveGroupSettingsBtn = document.getElementById('saveGroupSettingsBtn') as HTMLButtonElement;
    const deleteGroupBtn = document.getElementById('deleteGroupBtn') as HTMLButtonElement;
    const sendInviteBtn = document.getElementById('sendInviteBtn') as HTMLButtonElement;
    const loadMoreBtn = document.getElementById('loadMoreBtn') as HTMLButtonElement;
    
    addExpenseBtn.addEventListener('click', () => {
        window.location.href = `add-expense.html?groupId=${currentGroupId}`;
    });
    
    inviteMembersBtn.addEventListener('click', async () => {
        await showShareGroupModal();
    });
    
    groupSettingsBtn.addEventListener('click', () => {
        openGroupSettingsModal();
    });
    
    saveGroupSettingsBtn.addEventListener('click', saveGroupSettings);
    deleteGroupBtn.addEventListener('click', deleteGroup);
    sendInviteBtn.addEventListener('click', sendInvite);
    loadMoreBtn.addEventListener('click', loadMoreExpenses);
}

function switchTab(tabName: string): void {
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`) as HTMLElement;
    const tabPane = document.getElementById(`${tabName}Tab`) as HTMLElement;
    
    tabBtn.classList.add('active');
    tabPane.classList.add('active');
    
    const expensesList = document.getElementById('expensesList') as HTMLElement;
    
    if (tabName === 'expenses' && expensesList.children.length === 1) {
        expensesCursor = null;
        loadGroupExpenses();
    }
}

async function loadGroupDetails(): Promise<void> {
    const response = await apiService.getGroup(currentGroupId!);
    currentGroup = response.data!;
    
    updateGroupHeader();
    loadBalances();
}

function updateGroupHeader(): void {
    if (!currentGroup) return;
    
    const groupNameEl = document.getElementById('groupName') as HTMLElement;
    groupNameEl.classList.remove('skeleton-title');
    groupNameEl.textContent = currentGroup.name;
    
    const membersList = document.getElementById('membersList') as HTMLElement;
    const membersCount = document.getElementById('membersCount') as HTMLElement;
    membersCount.classList.remove('skeleton-subtitle');
    
    clearElement(membersList);
    const maxVisibleMembers = 4;
    
    currentGroup.members.slice(0, maxVisibleMembers).forEach((member: Member, index: number) => {
        const avatar = document.createElement('div');
        avatar.className = 'member-avatar';
        avatar.style.zIndex = String(maxVisibleMembers - index);
        avatar.textContent = member.name.charAt(0).toUpperCase();
        avatar.title = member.name;
        membersList.appendChild(avatar);
    });
    
    const totalMembers = currentGroup.members.length;
    if (totalMembers > maxVisibleMembers) {
        membersCount.textContent = `+${totalMembers - maxVisibleMembers} more`;
    } else {
        membersCount.textContent = `${totalMembers} members`;
    }
}

async function loadBalances(): Promise<void> {
    const balanceSummary = document.getElementById('balanceSummary') as HTMLElement;
    const simplifiedDebts = document.getElementById('simplifiedDebts') as HTMLElement;
    
    const response = await apiService.getGroupBalances(currentGroupId!);
    const balances = response.data!;
    const userBalances = (balances as any).userBalances;
    const serverSimplifiedDebts = (balances as any).simplifiedDebts;
    
    clearElement(balanceSummary);
    
    if (!userBalances || Object.keys(userBalances).length === 0) {
        clearElement(balanceSummary);
        const settledMsg = createElementSafe('p', { className: 'no-data', textContent: 'All settled up!' });
        balanceSummary.appendChild(settledMsg);
        
        clearElement(simplifiedDebts);
        const noDebtsMsg = createElementSafe('p', { className: 'no-data', textContent: 'No outstanding debts' });
        simplifiedDebts.appendChild(noDebtsMsg);
        return;
    }
    
    displayUserBalances(userBalances, balanceSummary);
    displaySimplifiedDebts(serverSimplifiedDebts, simplifiedDebts);
}



function displayUserBalances(balances: any, container: HTMLElement): void {
    const currentUserId = authManager.getUserId();
    
    Object.values(balances).forEach((userBalance: any) => {
        const balanceCard = document.createElement('div');
        balanceCard.className = 'balance-card';
        
        const isCurrentUser = userBalance.userId === currentUserId;
        const balanceClass = userBalance.netBalance > 0 ? 'positive' : userBalance.netBalance < 0 ? 'negative' : 'neutral';
        
        const displayName = isCurrentUser ? 'You' : userBalance.name;
        
        // Create elements safely without innerHTML
        const balanceUser = document.createElement('div');
        balanceUser.className = 'balance-user';
        
        const memberAvatar = document.createElement('div');
        memberAvatar.className = 'member-avatar';
        memberAvatar.textContent = userBalance.name.charAt(0).toUpperCase();
        
        const userName = document.createElement('span');
        userName.className = 'user-name';
        userName.textContent = displayName;
        
        const balanceAmount = document.createElement('div');
        balanceAmount.className = `balance-amount ${balanceClass}`;
        balanceAmount.textContent = `${userBalance.netBalance >= 0 ? '+' : ''}$${Math.abs(userBalance.netBalance).toFixed(2)}`;
        
        balanceUser.appendChild(memberAvatar);
        balanceUser.appendChild(userName);
        balanceCard.appendChild(balanceUser);
        balanceCard.appendChild(balanceAmount);
        
        container.appendChild(balanceCard);
    });
}


function displaySimplifiedDebts(simplified: any[], container: HTMLElement): void {
    clearElement(container);
    
    if (simplified.length === 0) {
        clearElement(container);
        const settledMsg = createElementSafe('p', { className: 'no-data', textContent: 'All settled up!' });
        container.appendChild(settledMsg);
        return;
    }
    
    const currentUserId = authManager.getUserId();
    
    simplified.forEach(debt => {
        const debtItem = document.createElement('div');
        debtItem.className = 'debt-item';
        
        const fromName = debt.from.userId === currentUserId ? 'You' : debt.from.name;
        const toName = debt.to.userId === currentUserId ? 'you' : debt.to.name;
        
        // Create elements safely without innerHTML
        const debtDescription = document.createElement('div');
        debtDescription.className = 'debt-description';
        
        const debtFrom = document.createElement('span');
        debtFrom.className = 'debt-from';
        debtFrom.textContent = fromName;
        
        const arrow = document.createElement('i');
        arrow.className = 'fas fa-arrow-right';
        
        const debtTo = document.createElement('span');
        debtTo.className = 'debt-to';
        debtTo.textContent = toName;
        
        const debtAmount = document.createElement('div');
        debtAmount.className = 'debt-amount';
        debtAmount.textContent = `$${debt.amount.toFixed(2)}`;
        
        debtDescription.appendChild(debtFrom);
        debtDescription.appendChild(arrow);
        debtDescription.appendChild(debtTo);
        debtItem.appendChild(debtDescription);
        debtItem.appendChild(debtAmount);
        
        container.appendChild(debtItem);
    });
}

async function loadGroupExpenses(): Promise<void> {
    if (isLoadingExpenses) return;
    
    const expensesList = document.getElementById('expensesList');
    if (!expensesList) {
        logger.error('expensesList element not found');
        return;
    }
    
    if (expensesCursor === null) {
        // Clean up existing expense items before clearing
        Array.from(expensesList.children).forEach(child => {
            const cleanupFn = expenseItemCleanups.get(child as HTMLElement);
            if (cleanupFn) {
                cleanupFn();
                expenseItemCleanups.delete(child as HTMLElement);
            }
        });
        clearElement(expensesList);
        const spinner = createElementSafe('div', { className: 'loading-spinner' });
        const icon = createElementSafe('i', { className: 'fas fa-spinner fa-spin' });
        spinner.appendChild(icon);
        expensesList.appendChild(spinner);
    }
    
    isLoadingExpenses = true;
    
    if (!currentGroupId) {
        logger.error('currentGroupId is null');
        isLoadingExpenses = false;
        return;
    }
    const response = await apiService.getGroupExpenses(currentGroupId, expensesLimit, expensesCursor);
    const expenses = response.expenses;
    
    if (expensesCursor === null) {
        clearElement(expensesList);
    }
    
    if (expenses.length === 0 && expensesCursor === null) {
        const noDataMsg = createElementSafe('p', { 
            className: 'no-data',
            textContent: 'No expenses yet'
        });
        expensesList.appendChild(noDataMsg);
    } else {
        // Use granular DOM updates to add each expense
        expenses.forEach(expense => {
            addExpenseToList(expense);
        });
    }
    
    hasMoreExpenses = response.hasMore;
    expensesCursor = response.cursor || null;
    
    
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (loadMoreContainer) {
        if (hasMoreExpenses) {
            loadMoreContainer.classList.remove('hidden');
        } else {
            loadMoreContainer.classList.add('hidden');
        }
    } else {
    }
    
    isLoadingExpenses = false;
}

function createExpenseItem(expense: ExpenseData): { element: HTMLElement, cleanup: () => void } {
    const expenseItem = document.createElement('div');
    expenseItem.className = 'expense-item';
    expenseItem.setAttribute('data-id', expense.id);
    
    const currentUserId = authManager.getUserId();
    const paidByYou = expense.paidBy === currentUserId;
    const yourSplit = expense.splits ? expense.splits.find(s => s.userId === currentUserId) : null;
    const yourShare = yourSplit ? yourSplit.amount : 0;
    const payer = currentGroup?.members?.find(m => m.uid === expense.paidBy) || null;
    
    const date = new Date(expense.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    
    // Create elements safely without innerHTML
    const expenseIcon = document.createElement('div');
    expenseIcon.className = 'expense-icon';
    const icon = document.createElement('i');
    icon.className = `fas fa-${getCategoryIcon(expense.category || 'other')}`;
    expenseIcon.appendChild(icon);
    
    const expenseDetails = document.createElement('div');
    expenseDetails.className = 'expense-details';
    
    const expenseDescription = document.createElement('div');
    expenseDescription.className = 'expense-description';
    expenseDescription.textContent = expense.description || 'No description';
    
    const expenseMeta = document.createElement('div');
    expenseMeta.className = 'expense-meta';
    
    const expensePayer = document.createElement('span');
    expensePayer.className = 'expense-payer';
    expensePayer.textContent = `${paidByYou ? 'You' : (payer ? payer.name : 'Unknown')} paid`;
    
    const expenseDate = document.createElement('span');
    expenseDate.className = 'expense-date';
    expenseDate.textContent = formattedDate;
    
    expenseMeta.appendChild(expensePayer);
    expenseMeta.appendChild(expenseDate);
    expenseDetails.appendChild(expenseDescription);
    expenseDetails.appendChild(expenseMeta);
    
    const expenseAmounts = document.createElement('div');
    expenseAmounts.className = 'expense-amounts';
    
    const expenseTotal = document.createElement('div');
    expenseTotal.className = 'expense-total';
    expenseTotal.textContent = `$${expense.amount ? expense.amount.toFixed(2) : '0.00'}`;
    
    const expenseYourShare = document.createElement('div');
    expenseYourShare.className = `expense-your-share ${paidByYou ? 'positive' : 'negative'}`;
    expenseYourShare.textContent = `${paidByYou ? '+' : '-'}$${yourShare ? yourShare.toFixed(2) : '0.00'}`;
    
    expenseAmounts.appendChild(expenseTotal);
    expenseAmounts.appendChild(expenseYourShare);
    
    expenseItem.appendChild(expenseIcon);
    expenseItem.appendChild(expenseDetails);
    expenseItem.appendChild(expenseAmounts);
    
    const clickHandler = () => {
        showExpenseDetails(expense);
    };
    expenseItem.addEventListener('click', clickHandler);
    
    const cleanup = () => {
        expenseItem.removeEventListener('click', clickHandler);
    };
    
    return { element: expenseItem, cleanup };
}

function addExpenseToList(expense: ExpenseData): void {
    const expensesList = document.getElementById('expensesList');
    if (!expensesList) {
        logger.error('expensesList element not found');
        return;
    }

    const { element, cleanup } = createExpenseItem(expense);
    expensesList.appendChild(element);
    expenseItemCleanups.set(element, cleanup);
}


function getCategoryIcon(category: string): string {
    const icons = {
        food: 'utensils',
        transport: 'car',
        utilities: 'bolt',
        entertainment: 'gamepad',
        shopping: 'shopping-bag',
        other: 'ellipsis-h'
    };
    return (icons as any)[category] || icons.other;
}

function loadMoreExpenses(): void {
    void loadGroupExpenses();
}


function openGroupSettingsModal(): void {
    const modal = document.getElementById('groupSettingsModal');
    if (!modal) {
        logger.error('groupSettingsModal element not found');
        return;
    }
    
    const editGroupNameEl = document.getElementById('editGroupName') as HTMLInputElement;
    if (!editGroupNameEl) {
        logger.error('editGroupName element not found');
        return;
    }
    
    if (!currentGroup) {
        logger.error('currentGroup is null');
        return;
    }
    
    editGroupNameEl.value = currentGroup.name;
    
    const membersList = document.getElementById('groupMembersList');
    if (!membersList) {
        logger.error('groupMembersList element not found');
        return;
    }
    clearElement(membersList);
    
    if (!currentGroup) {
        logger.error('currentGroup is null');
        return;
    }
    
    currentGroup.members.forEach(member => {
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        
        // Create elements safely without innerHTML
        const memberInfo = document.createElement('div');
        memberInfo.className = 'member-info';
        
        const memberAvatar = document.createElement('div');
        memberAvatar.className = 'member-avatar';
        memberAvatar.textContent = member.name.charAt(0).toUpperCase();
        
        const memberName = document.createElement('span');
        memberName.className = 'member-name';
        memberName.textContent = member.name;
        
        // Create remove button without component
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'remove-button-container';
        
        const removeButton = document.createElement('button');
        removeButton.className = 'button button--danger button--icon';
        removeButton.innerHTML = '<i class="fas fa-times"></i>';
        removeButton.setAttribute('aria-label', 'Remove member');
        removeButton.disabled = member.uid === currentGroup?.createdBy;
        removeButton.onclick = () => removeMember();
        
        buttonContainer.appendChild(removeButton);
        if (removeButton) {
            removeButton.className = 'button--icon button--danger';
        }
        
        memberInfo.appendChild(memberAvatar);
        memberInfo.appendChild(memberName);
        memberItem.appendChild(memberInfo);
        memberItem.appendChild(buttonContainer);
        
        membersList.appendChild(memberItem);
    });
    
    modal.classList.add('show');
}


async function saveGroupSettings(): Promise<void> {
    const editGroupNameEl = document.getElementById('editGroupName') as HTMLInputElement;
    if (!editGroupNameEl) {
        logger.error('editGroupName element not found');
        return;
    }
    
    const newName = editGroupNameEl.value.trim();
    
    if (!newName) {
        showMessage('Group name cannot be empty', 'error');
        return;
    }
    
    if (!currentGroupId) {
        logger.error('currentGroupId is null');
        return;
    }
    
    if (!currentGroup) {
        logger.error('currentGroup is null');
        return;
    }
    
    await apiService.updateGroup(currentGroupId, { name: newName });
    currentGroup.name = newName;
    updateGroupHeader();
    const modal = document.getElementById('groupSettingsModal');
    if (modal) {
        modal.classList.remove('show');
    }
    showMessage('Group settings updated successfully', 'success');
}

async function deleteGroup(): Promise<void> {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
        return;
    }
    
    if (!currentGroupId) {
        logger.error('currentGroupId is null');
        return;
    }
    
    await apiService.deleteGroup(currentGroupId);
    window.location.href = 'dashboard.html';
}

async function sendInvite(): Promise<void> {
    const email = (document.getElementById('inviteEmail') as HTMLInputElement).value.trim();
    const errorDiv = document.getElementById('inviteError');
    const successDiv = document.getElementById('inviteSuccess');
    
    if (!errorDiv || !successDiv) {
        logger.error('Invite error/success divs not found');
        return;
    }
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    if (!email) {
        errorDiv.textContent = 'Please enter an email address';
        errorDiv.style.display = 'block';
        return;
    }
    
    // API doesn't have inviteToGroup method
    // await apiService.inviteToGroup(currentGroupId, email);
    showMessage('Invite functionality not implemented', 'error');
    return;
}

async function removeMember(): Promise<void> {
    if (!confirm('Are you sure you want to remove this member?')) {
        return;
    }
    
    showMessage('Remove member functionality not implemented', 'error');
}

function showExpenseDetails(expense: ExpenseData): void {
    logger.log('Show expense details:', expense);
    window.location.href = `expense-detail.html?id=${expense.id}&return=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}


async function showShareGroupModal(): Promise<void> {
    if (!currentGroupId) {
        logger.error('currentGroupId is null');
        return;
    }

    const response = await apiService.generateShareableLink(currentGroupId);
    const shareUrl = response.data!.shareableUrl;


        // Create Body
        const bodyContainer = createElementSafe('div');
        const p1 = createElementSafe('p', { textContent: 'Share this link with others to invite them to join the group:' });
        const shareLinkContainer = createElementSafe('div', { className: 'share-link-container' });
        const input = createElementSafe('input', { type: 'text', id: 'shareLink', className: 'form-control', value: shareUrl, readOnly: 'true' }) as HTMLInputElement;
        // Create copy button without component
        const copyButtonContainer = document.createElement('div');
        copyButtonContainer.className = 'copy-button-container';
        
        const copyButton = document.createElement('button');
        copyButton.className = 'button button--primary';
        copyButton.innerHTML = '<i class="fas fa-copy"></i> Copy';
        copyButton.onclick = async () => {
            await copyShareLink(input);
        };
        
        copyButtonContainer.appendChild(copyButton);
        const copyButtonContainerRef = copyButtonContainer;
        shareLinkContainer.appendChild(input);
        shareLinkContainer.appendChild(copyButtonContainerRef);
        const p2 = createElementSafe('p', { className: 'share-info', textContent: 'Anyone with this link can join the group after logging in.' });
        bodyContainer.appendChild(p1);
        bodyContainer.appendChild(shareLinkContainer);
        bodyContainer.appendChild(p2);

        // Create Footer
        const footerContainer = createElementSafe('div');
        // Create close button without component
        const closeButtonContainer = document.createElement('div');
        closeButtonContainer.className = 'close-button-container';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'button button--secondary';
        closeButton.textContent = 'Close';
        
        closeButtonContainer.appendChild(closeButton);
        footerContainer.appendChild(closeButtonContainer);

        // Create modal without component - use simple modal implementation
        const modal = {
            element: null as HTMLElement | null,
            show: () => {
                if (modal.element) {
                    modal.element.style.display = 'block';
                    document.body.style.overflow = 'hidden';
                }
            },
            hide: () => {
                if (modal.element) {
                    modal.element.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            },
            unmount: () => {
                if (modal.element) {
                    modal.element.remove();
                    modal.element = null;
                }
            }
        };
        
        // Create modal element
        const modalElement = document.createElement('div');
        modalElement.className = 'modal';
        modalElement.style.display = 'none';
        modalElement.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Share Group</h2>
                </div>
                <div class="modal-body"></div>
                <div class="modal-footer"></div>
            </div>
        `;
        
        const modalBody = modalElement.querySelector('.modal-body');
        const modalFooter = modalElement.querySelector('.modal-footer');
        
        if (modalBody) modalBody.appendChild(bodyContainer);
        if (modalFooter) modalFooter.appendChild(footerContainer);
        
        modal.element = modalElement;
        document.body.appendChild(modalElement);
        
        // Update close button to work with simple modal
        closeButton.onclick = () => {
            modal.hide();
            modal.unmount();
        };

        modal.show();

        input.select();

}


async function copyShareLink(inputElement: HTMLInputElement): Promise<void> {
    const shareLink = inputElement.value;
    
    try {
        await navigator.clipboard.writeText(shareLink);
        showMessage('Link copied to clipboard!', 'success');
    } catch (err) {
        logger.error('Clipboard API write failed:', err);
        showMessage('Failed to copy link', 'error');
    }
}