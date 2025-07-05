
let currentExpense = null;
let currentUser = null;

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
        
        // Use mock data for now since API endpoints don't exist yet
        const expense = getMockExpense(expenseId);
        const user = { uid: localStorage.getItem('userId') || 'user1' };

        currentExpense = expense;
        currentUser = user;

        displayExpenseDetails(expense);
        setupPermissions(expense, user);
        
    } catch (error) {
        console.error('Error loading expense details:', error);
        showError('Failed to load expense details');
    }
}

function getMockExpense(expenseId) {
    // Generate mock expense data that matches the API structure
    const userNames = {
        'user1': 'You',
        'user2': 'Alice', 
        'user3': 'Bob',
        'user4': 'Carol'
    };
    
    const categories = ['food', 'transport', 'utilities', 'entertainment'];
    const descriptions = ['Groceries', 'Uber ride', 'Electricity bill', 'Movie tickets', 'Restaurant'];
    
    // Parse expense ID to get a number for consistent data generation
    const expenseNum = parseInt(expenseId.replace('exp', '')) || 1;
    const amount = Math.floor(Math.random() * 200) + 10;
    const splitAmount = Math.round((amount / 4) * 100) / 100;
    const paidBy = `user${(expenseNum % 4) + 1}`;
    
    // Create participants array with split breakdown
    const participants = [];
    const splits = {};
    
    Object.keys(userNames).forEach(userId => {
        const owesAmount = userId === paidBy ? -(amount - splitAmount) : splitAmount;
        participants.push({
            userId: userId,
            name: userNames[userId],
            owes: owesAmount
        });
        splits[userId] = splitAmount;
    });
    
    return {
        id: expenseId,
        description: descriptions[expenseNum % descriptions.length] + ` ${expenseNum}`,
        amount: amount,
        date: new Date(Date.now() - expenseNum * 86400000).toISOString(),
        category: categories[expenseNum % categories.length],
        paidBy: paidBy,
        groupId: 'group1',
        splits: splits,
        participants: participants,
        payer: { 
            uid: paidBy, 
            name: userNames[paidBy], 
            email: `${userNames[paidBy].toLowerCase()}@example.com` 
        },
        group: { name: 'House Expenses', memberCount: 4 },
        createdBy: paidBy
    };
}

function displayExpenseDetails(expense) {
    document.getElementById('expense-amount').textContent = expense.amount.toFixed(2);
    document.getElementById('expense-description').textContent = expense.description;
    document.getElementById('expense-date').textContent = formatDate(expense.date);
    document.getElementById('expense-category').textContent = expense.category || 'Uncategorized';

    displayPayerInfo(expense.payer);
    displaySplitBreakdown(expense.participants, expense.amount);
    displayGroupInfo(expense.group);
    
    if (expense.receiptUrl) {
        displayReceipt(expense.receiptUrl);
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('expense-detail-container').style.display = 'block';
}

function displayPayerInfo(payer) {
    const initials = getInitials(payer.name);
    document.getElementById('payer-initials').textContent = initials;
    document.getElementById('payer-name').textContent = payer.name;
    document.getElementById('payer-email').textContent = payer.email || '';
}

function displaySplitBreakdown(participants, totalAmount) {
    const splitBreakdown = document.getElementById('split-breakdown');
    splitBreakdown.innerHTML = '';

    participants.forEach(participant => {
        const participantRow = document.createElement('div');
        participantRow.className = 'participant-row';
        
        const owesAmount = participant.owes || 0;
        const isOwed = owesAmount < 0;
        const displayAmount = Math.abs(owesAmount);

        participantRow.innerHTML = `
            <div class="participant-info">
                <div class="user-avatar">
                    <span>${getInitials(participant.name)}</span>
                </div>
                <span class="participant-name">${participant.name}</span>
            </div>
            <div class="participant-amount ${isOwed ? 'amount-owed' : 'amount-owes'}">
                ${isOwed ? 'is owed' : 'owes'} $${displayAmount.toFixed(2)}
            </div>
        `;
        
        splitBreakdown.appendChild(participantRow);
    });
}

function displayGroupInfo(group) {
    const groupInfo = document.getElementById('group-info');
    groupInfo.innerHTML = `
        <span class="group-name">${group.name}</span>
        <span class="group-members">${group.memberCount} members</span>
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

        await apiCall(`/expenses/${currentExpense.id}`, 'DELETE');
        
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