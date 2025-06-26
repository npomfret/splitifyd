// Project page controller
let projectId = null;

document.addEventListener('DOMContentLoaded', async () => {
    Utils.log('Project page loaded');
    
    // Initialize app
    App.init();
    
    // Get project ID from URL
    projectId = Utils.getProjectIdFromUrl();
    
    if (!projectId) {
        Utils.showError('No project ID provided');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Load project
    try {
        await App.loadProject(projectId);
        initializePage();
    } catch (error) {
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
});

function initializePage() {
    // Set project name
    document.getElementById('project-name').textContent = App.currentProject.name;
    
    // Set up event listeners
    setupEventListeners();
    
    // Load UI
    updateMembersUI();
    updateExpensesUI();
    updateBalancesUI();
    
    // Check if user is a member
    if (App.isCurrentUserMember()) {
        showMemberUI();
    } else {
        showJoinUI();
    }
}

function setupEventListeners() {
    // Sync button
    document.getElementById('sync-btn').addEventListener('click', async () => {
        await Sync.syncProject(projectId, true);
        await App.loadProject(projectId);
        updateMembersUI();
        updateExpensesUI();
        updateBalancesUI();
    });
    
    // Join project
    document.getElementById('join-project-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('member-name');
        const name = nameInput.value.trim();
        
        if (!name) {
            Utils.showError('Please enter your name');
            return;
        }
        
        App.addMember(name);
        showMemberUI();
        updateMembersUI();
        updateBalancesUI();
    });
    
    // Add expense form
    document.getElementById('expense-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const expense = {
            description: document.getElementById('expense-description').value,
            amount: parseFloat(document.getElementById('expense-amount').value),
            currency: document.getElementById('expense-currency').value,
            paidBy: document.getElementById('expense-payer').value,
            splitBetween: Array.from(document.querySelectorAll('#expense-split-members input:checked'))
                .map(cb => cb.value)
        };
        
        if (expense.splitBetween.length === 0) {
            Utils.showError('Please select at least one person to split with');
            return;
        }
        
        App.addExpense(expense);
        
        // Clear form
        e.target.reset();
        document.getElementById('expense-currency').value = App.currentUser.lastCurrency;
        
        // Update UI
        updateExpensesUI();
        updateBalancesUI();
    });
    
    // Record settlement
    document.getElementById('record-settlement-btn').addEventListener('click', () => {
        showSettlementModal();
    });
    
    // Settlement form
    document.getElementById('settlement-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const settlement = {
            from: document.getElementById('settlement-from').value,
            to: document.getElementById('settlement-to').value,
            amount: parseFloat(document.getElementById('settlement-amount').value),
            currency: document.getElementById('settlement-currency').value
        };
        
        App.addSettlement(settlement);
        hideSettlementModal();
        
        // Update UI
        updateBalancesUI();
    });
    
    // Cancel settlement
    document.getElementById('cancel-settlement').addEventListener('click', () => {
        hideSettlementModal();
    });
    
    // Leave project
    document.getElementById('leave-project-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to leave this project?')) {
            App.leaveProject(projectId);
            window.location.href = 'index.html';
        }
    });
}

function showMemberUI() {
    document.querySelector('.member-add').classList.add('hidden');
    document.getElementById('add-expense-section').classList.remove('hidden');
    document.getElementById('expenses-section').classList.remove('hidden');
    document.getElementById('balances-section').classList.remove('hidden');
    document.getElementById('leave-section').classList.remove('hidden');
    
    // Set default currency
    document.getElementById('expense-currency').value = App.currentUser.lastCurrency;
    document.getElementById('settlement-currency').value = App.currentUser.lastCurrency;
}

function showJoinUI() {
    document.querySelector('.member-add').classList.remove('hidden');
    document.getElementById('add-expense-section').classList.add('hidden');
    document.getElementById('expenses-section').classList.add('hidden');
    document.getElementById('balances-section').classList.add('hidden');
    document.getElementById('leave-section').classList.add('hidden');
}

function updateMembersUI() {
    const membersList = document.getElementById('members-list');
    const expensePayer = document.getElementById('expense-payer');
    const expenseSplit = document.getElementById('expense-split-members');
    const settlementFrom = document.getElementById('settlement-from');
    const settlementTo = document.getElementById('settlement-to');
    
    membersList.innerHTML = '';
    expensePayer.innerHTML = '';
    expenseSplit.innerHTML = '';
    settlementFrom.innerHTML = '';
    settlementTo.innerHTML = '';
    
    const currentMemberId = App.getCurrentMemberId();
    
    Object.entries(App.currentProject.members).forEach(([memberId, member]) => {
        if (member.active === false) return;
        
        // Members list
        const chip = document.createElement('div');
        chip.className = 'member-chip';
        if (memberId === currentMemberId) {
            chip.classList.add('current-user');
        }
        chip.textContent = member.name;
        membersList.appendChild(chip);
        
        // Expense payer dropdown
        const payerOption = document.createElement('option');
        payerOption.value = memberId;
        payerOption.textContent = member.name;
        if (memberId === currentMemberId) {
            payerOption.selected = true;
        }
        expensePayer.appendChild(payerOption);
        
        // Expense split checkboxes
        const splitLabel = document.createElement('label');
        splitLabel.innerHTML = `
            <input type="checkbox" value="${memberId}" checked>
            ${member.name}
        `;
        expenseSplit.appendChild(splitLabel);
        
        // Settlement dropdowns
        const fromOption = document.createElement('option');
        fromOption.value = memberId;
        fromOption.textContent = member.name;
        settlementFrom.appendChild(fromOption.cloneNode(true));
        settlementTo.appendChild(fromOption);
    });
}

function updateExpensesUI() {
    const expensesList = document.getElementById('expenses-list');
    expensesList.innerHTML = '';
    
    const expenses = Object.entries(App.currentProject.expenses)
        .filter(([_, expense]) => expense.active !== false)
        .sort((a, b) => new Date(b[1].created) - new Date(a[1].created));
    
    if (expenses.length === 0) {
        expensesList.innerHTML = '<p class="empty-state">No expenses yet</p>';
        return;
    }
    
    expenses.forEach(([expenseId, expense]) => {
        const expenseEl = createExpenseElement(expenseId, expense);
        expensesList.appendChild(expenseEl);
    });
}

function createExpenseElement(expenseId, expense) {
    const div = document.createElement('div');
    div.className = 'expense-item';
    
    const payer = App.currentProject.members[expense.paidBy];
    const payerName = payer ? payer.name : 'Unknown';
    
    const splitNames = expense.splitBetween
        .map(id => App.currentProject.members[id]?.name || 'Unknown')
        .join(', ');
    
    div.innerHTML = `
        <div class="expense-header">
            <div>
                <div class="expense-description">${expense.description}</div>
                <div class="expense-details">
                    Paid by ${payerName} • Split between ${splitNames}
                </div>
            </div>
            <div class="expense-amount">${Utils.formatCurrency(expense.amount, expense.currency)}</div>
        </div>
    `;
    
    // Add delete button if created by current user
    if (expense.createdBy === App.currentUser.id) {
        const actions = document.createElement('div');
        actions.className = 'expense-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            if (confirm('Delete this expense?')) {
                App.deleteExpense(expenseId);
                updateExpensesUI();
                updateBalancesUI();
            }
        });
        
        actions.appendChild(deleteBtn);
        div.appendChild(actions);
    }
    
    return div;
}

function updateBalancesUI() {
    const balances = Balance.calculateBalances(App.currentProject);
    const balancesList = document.getElementById('balances-list');
    const suggestedPayments = document.getElementById('suggested-payments');
    
    balancesList.innerHTML = '';
    suggestedPayments.innerHTML = '';
    
    // Show individual balances
    Object.entries(App.currentProject.members).forEach(([memberId, member]) => {
        if (member.active === false) return;
        
        const memberBalances = Balance.getMemberTotalBalance(memberId, balances);
        
        if (memberBalances.length > 0) {
            const balanceEl = document.createElement('div');
            balanceEl.className = 'balance-item';
            
            const balanceTexts = memberBalances.map(b => b.formatted).join(', ');
            
            balanceEl.innerHTML = `
                <span>${member.name}</span>
                <span>${balanceTexts}</span>
            `;
            
            balancesList.appendChild(balanceEl);
        }
    });
    
    // Show suggested payments
    const suggestions = Balance.calculateSuggestedPayments(balances, App.currentProject.members);
    
    Object.entries(suggestions).forEach(([currency, payments]) => {
        payments.forEach(payment => {
            const paymentEl = document.createElement('div');
            paymentEl.className = 'payment-suggestion';
            paymentEl.textContent = `${payment.from.name} pays ${payment.to.name} ${Utils.formatCurrency(payment.amount, currency)}`;
            suggestedPayments.appendChild(paymentEl);
        });
    });
    
    if (suggestedPayments.children.length === 0) {
        suggestedPayments.innerHTML = '<p class="empty-state">All settled up!</p>';
    }
}

function showSettlementModal() {
    document.getElementById('settlement-modal').classList.remove('hidden');
}

function hideSettlementModal() {
    document.getElementById('settlement-modal').classList.add('hidden');
    document.getElementById('settlement-form').reset();
}