import { simplifyDebts } from './utils/debt-simplifier.js';

let currentGroup = null;
let currentGroupId = null;
let expensesOffset = 0;
const expensesLimit = 20;
let isLoadingExpenses = false;
let hasMoreExpenses = true;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for authManager to be initialized
    setTimeout(async () => {
        // Check authentication before loading page
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            window.location.href = 'index.html';
            return;
        }
        
        // Ensure we have a userId for development
        if (!localStorage.getItem('userId')) {
            localStorage.setItem('userId', 'user1');
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        currentGroupId = urlParams.get('id');
        
        if (!currentGroupId) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        await loadGroupDetails();
        initializeEventListeners();
    }, 100);
});

function initializeEventListeners() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            switchTab(e.target.closest('.tab-button').dataset.tab);
        });
    });
    
    document.getElementById('addExpenseBtn').addEventListener('click', () => {
        window.location.href = `add-expense.html?groupId=${currentGroupId}`;
    });
    
    document.getElementById('settleUpBtn').addEventListener('click', () => {
        showMessage('Settlement feature coming soon!', 'info');
    });
    
    document.getElementById('inviteMembersBtn').addEventListener('click', () => {
        document.getElementById('inviteMembersModal').classList.add('show');
    });
    
    document.getElementById('groupSettingsBtn').addEventListener('click', () => {
        openGroupSettingsModal();
    });
    
    document.getElementById('saveGroupSettingsBtn').addEventListener('click', saveGroupSettings);
    document.getElementById('deleteGroupBtn').addEventListener('click', deleteGroup);
    document.getElementById('sendInviteBtn').addEventListener('click', sendInvite);
    document.getElementById('loadMoreBtn').addEventListener('click', loadMoreExpenses);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    if (tabName === 'expenses' && document.getElementById('expensesList').children.length === 1) {
        loadGroupExpenses();
    } else if (tabName === 'activity' && document.getElementById('activityTimeline').children.length === 1) {
        loadGroupActivity();
    }
}

async function loadGroupDetails() {
    try {
        const response = await api.getGroup(currentGroupId);
        currentGroup = response.data;
        
        updateGroupHeader();
        loadBalances();
    } catch (error) {
        console.error('Error loading group details:', error);
        showMessage('Failed to load group details', 'error');
    }
}

function updateGroupHeader() {
    document.getElementById('groupName').textContent = currentGroup.name;
    
    const membersList = document.getElementById('membersList');
    const membersCount = document.getElementById('membersCount');
    
    membersList.innerHTML = '';
    const maxVisibleMembers = 4;
    
    currentGroup.members.slice(0, maxVisibleMembers).forEach((member, index) => {
        const avatar = document.createElement('div');
        avatar.className = 'member-avatar';
        avatar.style.zIndex = maxVisibleMembers - index;
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

async function loadBalances() {
    const balanceSummary = document.getElementById('balanceSummary');
    const simplifiedDebts = document.getElementById('simplifiedDebts');
    
    try {
        const response = await api.getGroupBalances(currentGroupId);
        const balances = response.data;
        
        balanceSummary.innerHTML = '';
        
        if (balances.length === 0) {
            balanceSummary.innerHTML = '<p class="no-data">All settled up!</p>';
            simplifiedDebts.innerHTML = '<p class="no-data">No outstanding debts</p>';
            return;
        }
        
        const userBalances = calculateUserBalances(balances);
        displayUserBalances(userBalances, balanceSummary);
        
        const simplified = simplifyDebts(userBalances);
        displaySimplifiedDebts(simplified, simplifiedDebts);
        
    } catch (error) {
        console.error('Error loading balances:', error);
        balanceSummary.innerHTML = '<p class="error">Failed to load balances</p>';
    }
}

function calculateUserBalances(expenses) {
    const balances = {};
    const currentUserId = localStorage.getItem('userId');
    
    currentGroup.members.forEach(member => {
        balances[member.uid] = {
            userId: member.uid,
            name: member.name,
            balance: 0,
            owes: {},
            owedBy: {}
        };
    });
    
    expenses.forEach(expense => {
        const payerId = expense.paidBy;
        const splits = expense.splits;
        
        
        splits.forEach(split => {
            const uid = split.userId;
            const amount = split.amount;
            
            if (uid !== payerId && balances[uid] && balances[payerId]) {
                balances[uid].balance -= amount;
                balances[payerId].balance += amount;
                
                balances[uid].owes[payerId] += amount;
                balances[payerId].owedBy[uid] += amount;
            }
        });
    });
    
    return balances;
}

function displayUserBalances(balances, container) {
    const currentUserId = localStorage.getItem('userId');
    
    Object.values(balances).forEach(userBalance => {
        const balanceCard = document.createElement('div');
        balanceCard.className = 'balance-card';
        
        const isCurrentUser = userBalance.uid === currentUserId;
        const balanceClass = userBalance.balance > 0 ? 'positive' : userBalance.balance < 0 ? 'negative' : 'neutral';
        
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
        balanceAmount.textContent = `${userBalance.balance >= 0 ? '+' : ''}$${Math.abs(userBalance.balance).toFixed(2)}`;
        
        balanceUser.appendChild(memberAvatar);
        balanceUser.appendChild(userName);
        balanceCard.appendChild(balanceUser);
        balanceCard.appendChild(balanceAmount);
        
        container.appendChild(balanceCard);
    });
}


function displaySimplifiedDebts(simplified, container) {
    container.innerHTML = '';
    
    if (simplified.length === 0) {
        container.innerHTML = '<p class="no-data">All settled up!</p>';
        return;
    }
    
    const currentUserId = localStorage.getItem('userId');
    
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

async function loadGroupExpenses() {
    if (isLoadingExpenses) return;
    
    const expensesList = document.getElementById('expensesList');
    
    if (expensesOffset === 0) {
        expensesList.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    }
    
    isLoadingExpenses = true;
    
    try {
        const response = await api.getGroupExpenses(currentGroupId, expensesLimit, expensesOffset);
        const expenses = response.data;
        
        if (expensesOffset === 0) {
            expensesList.innerHTML = '';
        }
        
        if (expenses.length === 0 && expensesOffset === 0) {
            expensesList.innerHTML = '<p class="no-data">No expenses yet</p>';
        } else {
            expenses.forEach(expense => {
                expensesList.appendChild(createExpenseItem(expense));
            });
        }
        
        hasMoreExpenses = expenses.length === expensesLimit;
        document.getElementById('loadMoreContainer').style.display = hasMoreExpenses ? 'block' : 'none';
        
        expensesOffset += expenses.length;
    } catch (error) {
        console.error('Error loading expenses:', error);
        expensesList.innerHTML = '<p class="error">Failed to load expenses</p>';
    } finally {
        isLoadingExpenses = false;
    }
}

function createExpenseItem(expense) {
    const expenseItem = document.createElement('div');
    expenseItem.className = 'expense-item';
    
    const currentUserId = localStorage.getItem('userId');
    const paidByYou = expense.paidBy === currentUserId;
    const yourShare = expense.splits.find(s => s.userId === currentUserId).amount;
    const payer = currentGroup.members.find(m => m.uid === expense.paidBy);
    
    const date = new Date(expense.date);
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    
    // Create elements safely without innerHTML
    const expenseIcon = document.createElement('div');
    expenseIcon.className = 'expense-icon';
    const icon = document.createElement('i');
    icon.className = `fas fa-${getCategoryIcon(expense.category)}`;
    expenseIcon.appendChild(icon);
    
    const expenseDetails = document.createElement('div');
    expenseDetails.className = 'expense-details';
    
    const expenseDescription = document.createElement('div');
    expenseDescription.className = 'expense-description';
    expenseDescription.textContent = expense.description;
    
    const expenseMeta = document.createElement('div');
    expenseMeta.className = 'expense-meta';
    
    const expensePayer = document.createElement('span');
    expensePayer.className = 'expense-payer';
    expensePayer.textContent = `${paidByYou ? 'You' : payer.name} paid`;
    
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
    expenseTotal.textContent = `$${expense.amount.toFixed(2)}`;
    
    const expenseYourShare = document.createElement('div');
    expenseYourShare.className = `expense-your-share ${paidByYou ? 'positive' : 'negative'}`;
    expenseYourShare.textContent = `${paidByYou ? '+' : '-'}$${yourShare.toFixed(2)}`;
    
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

function getCategoryIcon(category) {
    const icons = {
        food: 'utensils',
        transport: 'car',
        utilities: 'bolt',
        entertainment: 'gamepad',
        shopping: 'shopping-bag',
        other: 'ellipsis-h'
    };
    return icons[category] || icons.other;
}

function loadMoreExpenses() {
    loadGroupExpenses();
}

async function loadGroupActivity() {
    const activityTimeline = document.getElementById('activityTimeline');
    activityTimeline.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    
    throw new Error('Activity timeline not implemented');
}

function openGroupSettingsModal() {
    const modal = document.getElementById('groupSettingsModal');
    document.getElementById('editGroupName').value = currentGroup.name;
    
    const membersList = document.getElementById('groupMembersList');
    membersList.innerHTML = '';
    
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
        removeButton.disabled = member.uid === currentGroup.createdBy;
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

function closeGroupSettingsModal() {
    document.getElementById('groupSettingsModal').classList.remove('show');
}

function closeInviteMembersModal() {
    document.getElementById('inviteMembersModal').classList.remove('show');
    document.getElementById('inviteEmail').value = '';
    document.getElementById('inviteError').style.display = 'none';
    document.getElementById('inviteSuccess').style.display = 'none';
}

async function saveGroupSettings() {
    const newName = document.getElementById('editGroupName').value.trim();
    
    if (!newName) {
        showMessage('Group name cannot be empty', 'error');
        return;
    }
    
    try {
        await api.updateGroup(currentGroupId, { name: newName });
        currentGroup.name = newName;
        updateGroupHeader();
        closeGroupSettingsModal();
        showMessage('Group settings updated successfully', 'success');
    } catch (error) {
        console.error('Error updating group:', error);
        showMessage('Failed to update group settings', 'error');
    }
}

async function deleteGroup() {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
        return;
    }
    
    try {
        await api.deleteGroup(currentGroupId);
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error('Error deleting group:', error);
        showMessage('Failed to delete group', 'error');
    }
}

async function sendInvite() {
    const email = document.getElementById('inviteEmail').value.trim();
    const errorDiv = document.getElementById('inviteError');
    const successDiv = document.getElementById('inviteSuccess');
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    if (!email) {
        errorDiv.textContent = 'Please enter an email address';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        await api.inviteToGroup(currentGroupId, email);
        successDiv.textContent = `Invitation sent to ${email}`;
        successDiv.style.display = 'block';
        document.getElementById('inviteEmail').value = '';
        setTimeout(() => {
            closeInviteMembersModal();
        }, 2000);
    } catch (error) {
        console.error('Error sending invite:', error);
        errorDiv.textContent = error.response?.data?.error || 'Failed to send invitation';
        errorDiv.style.display = 'block';
    }
}

async function removeMember(userId) {
    if (!confirm('Are you sure you want to remove this member?')) {
        return;
    }
    
    try {
        await api.removeGroupMember(currentGroupId, userId);
        await loadGroupDetails();
        openGroupSettingsModal();
        showMessage('Member removed successfully', 'success');
    } catch (error) {
        console.error('Error removing member:', error);
        showMessage('Failed to remove member', 'error');
    }
}

function showExpenseDetails(expense) {
    console.log('Show expense details:', expense);
    window.location.href = `expense-detail.html?id=${expense.id}&return=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => {
            messageDiv.remove();
        }, 300);
    }, 3000);
}