import { logger } from './utils/logger.js';
import { ModalComponent } from './components/modal.js';
import { createElementSafe, clearElement } from './utils/safe-dom.js';
import { authManager } from './auth.js';
import { apiService } from './api.js';
import { showMessage } from './utils/ui-messages.js';
import { waitForAuthManager } from './utils/auth-utils.js';
import { HeaderComponent } from './components/header.js';
import type { GroupDetail, Member, ExpenseData, GroupBalances } from './types/api';
import type { GroupDetailState } from './types/pages';

let currentGroup: GroupDetail | null = null;
let currentGroupId: string | null = null;
let expensesOffset: number = 0;
const expensesLimit: number = 20;
let isLoadingExpenses: boolean = false;
let hasMoreExpenses: boolean = true;

async function initializeGroupDetailPage(): Promise<void> {
    try {
        await waitForAuthManager();
        
        if (!authManager.getUserId()) {
            authManager.setUserId('user1');
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        currentGroupId = urlParams.get('id');
        
        if (!currentGroupId) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        await loadGroupDetails();
        initializeEventListeners();

        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new HeaderComponent({ title: 'Group Details', showLogout: true });
            header.mount(headerContainer);
        }
    } catch (error) {
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', initializeGroupDetailPage);

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
        loadGroupExpenses();
    }
}

async function loadGroupDetails(): Promise<void> {
    try {
        const response = await apiService.getGroup(currentGroupId!);
        currentGroup = response.data!;
        
        updateGroupHeader();
        loadBalances();
    } catch (error) {
        logger.error('Error loading group details:', error);
        showMessage('Failed to load group details', 'error');
    }
}

function updateGroupHeader(): void {
    if (!currentGroup) return;
    
    const groupNameEl = document.getElementById('groupName') as HTMLElement;
    groupNameEl.textContent = currentGroup.name;
    
    const membersList = document.getElementById('membersList') as HTMLElement;
    const membersCount = document.getElementById('membersCount') as HTMLElement;
    
    membersList.innerHTML = '';
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
    
    try {
        const response = await apiService.getGroupBalances(currentGroupId!);
        const balances = response.data!;
        const userBalances = (balances as any).userBalances;
        const serverSimplifiedDebts = (balances as any).simplifiedDebts;
        
        balanceSummary.innerHTML = '';
        
        if (!userBalances || Object.keys(userBalances).length === 0) {
            balanceSummary.innerHTML = '<p class="no-data">All settled up!</p>';
            simplifiedDebts.innerHTML = '<p class="no-data">No outstanding debts</p>';
            return;
        }
        
        displayUserBalances(userBalances, balanceSummary);
        displaySimplifiedDebts(serverSimplifiedDebts, simplifiedDebts);
        
    } catch (error) {
        logger.error('Error loading balances:', error);
        balanceSummary.innerHTML = '<p class="error">Failed to load balances</p>';
    }
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
    container.innerHTML = '';
    
    if (simplified.length === 0) {
        container.innerHTML = '<p class="no-data">All settled up!</p>';
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
    
    if (expensesOffset === 0) {
        clearElement(expensesList);
        const spinner = createElementSafe('div', { className: 'loading-spinner' });
        const icon = createElementSafe('i', { className: 'fas fa-spinner fa-spin' });
        spinner.appendChild(icon);
        expensesList.appendChild(spinner);
    }
    
    isLoadingExpenses = true;
    
    try {
        if (!currentGroupId) {
            logger.error('currentGroupId is null');
            return;
        }
        const response = await apiService.getGroupExpenses(currentGroupId, expensesLimit, expensesOffset);
        const expenses = response.data;
        
        if (expensesOffset === 0) {
            clearElement(expensesList);
        }
        
        if (expenses.length === 0 && expensesOffset === 0) {
            const noDataMsg = createElementSafe('p', { 
                className: 'no-data',
                textContent: 'No expenses yet'
            });
            expensesList.appendChild(noDataMsg);
        } else {
            expenses.forEach(expense => {
                expensesList.appendChild(createExpenseItem(expense));
            });
        }
        
        hasMoreExpenses = expenses.length === expensesLimit;
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = hasMoreExpenses ? 'block' : 'none';
        }
        
        expensesOffset += expenses.length;
    } catch (error) {
        logger.error('Error loading expenses:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        clearElement(expensesList);
        const errorMsg = createElementSafe('p', { 
            className: 'error',
            textContent: `Failed to load expenses: ${errorMessage}`
        });
        expensesList.appendChild(errorMsg);
    } finally {
        isLoadingExpenses = false;
    }
}

function createExpenseItem(expense: ExpenseData): HTMLElement {
    logger.log('Creating expense item for:', expense);
    
    const expenseItem = document.createElement('div');
    expenseItem.className = 'expense-item';
    
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
    
    expenseItem.addEventListener('click', () => {
        showExpenseDetails(expense);
    });
    
    return expenseItem;
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
    loadGroupExpenses();
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
    membersList.innerHTML = '';
    
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
        
        const removeButton = document.createElement('button');
        removeButton.className = 'button--icon button--danger';
        removeButton.disabled = member.uid === currentGroup?.createdBy;
        removeButton.onclick = () => removeMember(member.uid);
        
        const removeIcon = document.createElement('i');
        removeIcon.className = 'fas fa-times';
        removeButton.appendChild(removeIcon);
        
        memberInfo.appendChild(memberAvatar);
        memberInfo.appendChild(memberName);
        memberItem.appendChild(memberInfo);
        memberItem.appendChild(removeButton);
        
        membersList.appendChild(memberItem);
    });
    
    modal.classList.add('show');
}

function closeGroupSettingsModal(): void {
    const modal = document.getElementById('groupSettingsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function closeInviteMembersModal(): void {
    const modal = document.getElementById('inviteMembersModal');
    if (modal) {
        modal.classList.remove('show');
    }
    
    const inviteEmail = document.getElementById('inviteEmail') as HTMLInputElement;
    if (inviteEmail) {
        inviteEmail.value = '';
    }
    
    const inviteError = document.getElementById('inviteError');
    if (inviteError) {
        inviteError.style.display = 'none';
    }
    
    const inviteSuccess = document.getElementById('inviteSuccess');
    if (inviteSuccess) {
        inviteSuccess.style.display = 'none';
    }
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
    
    try {
        await apiService.updateGroup(currentGroupId, { name: newName });
        currentGroup.name = newName;
        updateGroupHeader();
        closeGroupSettingsModal();
        showMessage('Group settings updated successfully', 'success');
    } catch (error) {
        logger.error('Error updating group:', error);
        showMessage('Failed to update group settings', 'error');
    }
}

async function deleteGroup(): Promise<void> {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
        return;
    }
    
    if (!currentGroupId) {
        logger.error('currentGroupId is null');
        return;
    }
    
    try {
        await apiService.deleteGroup(currentGroupId);
        window.location.href = 'dashboard.html';
    } catch (error) {
        logger.error('Error deleting group:', error);
        showMessage('Failed to delete group', 'error');
    }
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
    
    try {
        // API doesn't have inviteToGroup method
        // await apiService.inviteToGroup(currentGroupId, email);
        showMessage('Invite functionality not implemented', 'error');
        return;
        
        // TODO: Uncomment when API is available
        // successDiv.textContent = `Invitation sent to ${email}`;
        // successDiv.style.display = 'block';
        // (document.getElementById('inviteEmail') as HTMLInputElement).value = '';
        // setTimeout(() => {
        //     closeInviteMembersModal();
        // }, 2000);
    } catch (error) {
        logger.error('Error sending invite:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to send invitation';
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
    }
}

async function removeMember(userId: string): Promise<void> {
    if (!confirm('Are you sure you want to remove this member?')) {
        return;
    }
    
    try {
        // API doesn't have removeGroupMember method
        // await apiService.removeGroupMember(currentGroupId, userId);
        showMessage('Remove member functionality not implemented', 'error');
        return;
        await loadGroupDetails();
        openGroupSettingsModal();
        showMessage('Member removed successfully', 'success');
    } catch (error) {
        logger.error('Error removing member:', error);
        showMessage('Failed to remove member', 'error');
    }
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

    try {
        const response = await apiService.generateShareableLink(currentGroupId);
        const shareUrl = response.data!.url;

        const modalId = 'shareGroupModal';

        // Create Body
        const bodyContainer = createElementSafe('div');
        const p1 = createElementSafe('p', { textContent: 'Share this link with others to invite them to join the group:' });
        const shareLinkContainer = createElementSafe('div', { className: 'share-link-container' });
        const input = createElementSafe('input', { type: 'text', id: 'shareLink', className: 'form-control', value: shareUrl, readOnly: 'true' }) as HTMLInputElement;
        const copyButton = createElementSafe('button', { className: 'button button--primary' });
        const copyIcon = createElementSafe('i', { className: 'fas fa-copy' });
        copyButton.appendChild(copyIcon);
        copyButton.innerHTML += ' Copy';
        shareLinkContainer.appendChild(input);
        shareLinkContainer.appendChild(copyButton);
        const p2 = createElementSafe('p', { className: 'share-info', textContent: 'Anyone with this link can join the group after logging in.' });
        bodyContainer.appendChild(p1);
        bodyContainer.appendChild(shareLinkContainer);
        bodyContainer.appendChild(p2);

        // Create Footer
        const footerContainer = createElementSafe('div');
        const closeButton = createElementSafe('button', { className: 'button button--secondary', textContent: 'Close' });
        footerContainer.appendChild(closeButton);

        const modal = new ModalComponent({
            id: modalId,
            title: 'Share Group',
            body: bodyContainer,
            footer: footerContainer
        });

        modal.mount(document.body);
        modal.show();

        copyButton.addEventListener('click', () => copyShareLink(input));
        closeButton.addEventListener('click', () => {
            modal.hide();
            modal.unmount();
        });

        input.select();

    } catch (error) {
        logger.error('Error generating share link:', error);
        showMessage('Failed to generate share link', 'error');
    }
}


function copyShareLink(inputElement: HTMLInputElement): void {
    inputElement.select();
    inputElement.setSelectionRange(0, 99999);

    try {
        document.execCommand('copy');
        showMessage('Link copied to clipboard!', 'success');
    } catch (err) {
        showMessage('Failed to copy link', 'error');
    }
}