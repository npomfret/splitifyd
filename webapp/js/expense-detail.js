
let currentExpense = null;
let currentUser = null;
let currentGroup = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for authManager to be initialized
    setTimeout(async () => {
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            window.location.href = 'index.html';
            return;
        }
        
        // Ensure we have a userId for development
        if (!localStorage.getItem('userId')) {
            localStorage.setItem('userId', 'user1');
        }

        const urlParams = new URLSearchParams(window.location.search);
        const expenseId = urlParams.get('id');
        
        if (!expenseId) {
            showError('No expense ID provided');
            return;
        }

        await loadExpenseDetails(expenseId);
        setupEventListeners();
    }, 100);
});

async function loadExpenseDetails(expenseId) {
    try {
        showLoading();
        
        // Use real API to get expense details
        const expense = await ExpenseService.getExpense(expenseId);
        const user = { uid: localStorage.getItem('userId') || 'user1' };

        // Fetch group data to get member information for ID-to-name mapping
        const groupResponse = await window.api.getGroup(expense.groupId);
        const group = groupResponse.data;

        currentExpense = expense;
        currentUser = user;
        currentGroup = group;

        displayExpenseDetails(expense);
        setupPermissions(expense, user);
        
    } catch (error) {
        console.error('Error loading expense details:', error);
        showError('Failed to load expense details');
    }
}


function displayExpenseDetails(expense) {
    document.getElementById('expense-amount').textContent = expense.amount.toFixed(2);
    document.getElementById('expense-description').textContent = expense.description;
    document.getElementById('expense-date').textContent = formatDate(expense.date);
    document.getElementById('expense-category').textContent = expense.category;

    displayPayerInfo(expense.paidBy, expense.splits);
    displaySplitBreakdown(expense.splits, expense.amount);
    displayGroupInfo(expense.groupId);
    
    if (expense.receiptUrl) {
        displayReceipt(expense.receiptUrl);
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('expense-detail-container').style.display = 'block';
}

function displayPayerInfo(paidBy, splits) {
    const payerName = getUserDisplayName(paidBy);
    const initials = getInitials(payerName);
    document.getElementById('payer-initials').textContent = initials;
    document.getElementById('payer-name').textContent = payerName;
    document.getElementById('payer-email').textContent = '';
    document.getElementById('payer-email').style.display = 'none';
}

function displaySplitBreakdown(splits, totalAmount) {
    const splitBreakdown = document.getElementById('split-breakdown');
    splitBreakdown.innerHTML = '';

    if (!splits || typeof splits !== 'object') {
        console.warn('Splits is not an object:', splits);
        return;
    }

    Object.entries(splits).forEach(([userId, amount]) => {
        const participantRow = document.createElement('div');
        participantRow.className = 'participant-row';
        
        const userName = getUserDisplayName(userId);
        const splitAmount = parseFloat(amount);

        participantRow.innerHTML = `
            <div class="participant-info">
                <div class="user-avatar">
                    <span>${getInitials(userName)}</span>
                </div>
                <span class="participant-name">${userName}</span>
            </div>
            <div class="participant-amount">
                $${splitAmount.toFixed(2)}
            </div>
        `;
        
        splitBreakdown.appendChild(participantRow);
    });
}

function displayGroupInfo(groupId) {
    const groupInfo = document.getElementById('group-info');
    const groupName = currentGroup ? currentGroup.name : `Group ${groupId}`;
    const memberCount = currentGroup ? currentGroup.members.length : 0;
    
    groupInfo.innerHTML = `
        <span class="group-name">${groupName}</span>
        <span class="group-members">${memberCount} members</span>
    `;
}

function displayReceipt(receiptUrl) {
    const receiptSection = document.getElementById('receipt-section');
    const receiptImage = document.getElementById('receipt-image');
    
    receiptImage.src = receiptUrl;
    receiptSection.style.display = 'block';
}

function setupPermissions(expense, user) {
    const isCreator = expense.createdBy === user.uid;
    
    if (isCreator) {
        document.getElementById('edit-expense-btn').style.display = 'block';
        document.getElementById('delete-expense-btn').style.display = 'block';
    }
}

function setupEventListeners() {
    document.getElementById('edit-expense-btn').addEventListener('click', editExpense);
    document.getElementById('delete-expense-btn').addEventListener('click', showDeleteModal);
    document.getElementById('confirm-delete-btn').addEventListener('click', deleteExpense);
}

function editExpense() {
    const urlParams = new URLSearchParams({
        id: currentExpense.id,
        edit: 'true'
    });
    window.location.href = `add-expense.html?${urlParams.toString()}`;
}

function showDeleteModal() {
    document.getElementById('delete-expense-description').textContent = currentExpense.description;
    document.getElementById('delete-expense-amount').textContent = `$${currentExpense.amount.toFixed(2)}`;
    document.getElementById('delete-confirmation-modal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('delete-confirmation-modal').style.display = 'none';
}

async function deleteExpense() {
    try {
        const deleteBtn = document.getElementById('confirm-delete-btn');
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Deleting...';

        await ExpenseService.deleteExpense(currentExpense.id);
        
        closeDeleteModal();
        
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('return') || 'dashboard.html';
        window.location.href = returnUrl;
        
    } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Failed to delete expense. Please try again.');
        
        const deleteBtn = document.getElementById('confirm-delete-btn');
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete Expense';
    }
}

function getUserDisplayName(userId) {
    const member = currentGroup.members.find(m => m.uid === userId);
    
    // Show "You" for current user, otherwise show the member's name
    return member.uid === currentUser.uid ? 'You' : member.name;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getInitials(name) {
    return name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('expense-detail-container').style.display = 'none';
    document.getElementById('error-message').style.display = 'none';
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('expense-detail-container').style.display = 'none';
    document.getElementById('error-message').style.display = 'block';
    document.getElementById('error-message').querySelector('p').textContent = message;
}

window.closeDeleteModal = closeDeleteModal;