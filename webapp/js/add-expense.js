let currentGroup = null;
let currentGroupId = null;
let selectedMembers = new Set();
let lastExpenseData = null;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            window.location.href = 'index.html';
            return;
        }
        
        if (!localStorage.getItem('userId')) {
            localStorage.setItem('userId', 'user1');
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        currentGroupId = urlParams.get('groupId');
        
        if (!currentGroupId) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        await loadGroupData();
        await loadUserPreferences();
        initializeEventListeners();
    }, 100);
});

async function loadGroupData() {
    try {
        const response = await api.getGroup(currentGroupId);
        currentGroup = response.data;
        
        populatePaidByOptions();
        populateMembers();
    } catch (error) {
        console.error('Error loading group data:', error);
        showMessage('Failed to load group data', 'error');
    }
}

async function loadUserPreferences() {
    try {
        const currentUserId = localStorage.getItem('userId');
        const response = await api.getGroupExpenses(currentGroupId, 1, 0);
        
        if (response.data && response.data.length > 0) {
            const lastExpense = response.data.find(expense => expense.paidBy === currentUserId);
            if (lastExpense) {
                lastExpenseData = lastExpense;
                document.getElementById('category').value = lastExpense.category || 'other';
                document.getElementById('description').value = lastExpense.description || '';
            }
        }
    } catch (error) {
        console.error('Error loading user preferences:', error);
    }
}

function populatePaidByOptions() {
    const paidBySelect = document.getElementById('paidBy');
    const currentUserId = localStorage.getItem('userId');
    
    paidBySelect.innerHTML = '<option value="">Select who paid</option>';
    
    currentGroup.members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.userId;
        option.textContent = member.userId === currentUserId ? 'You' : member.name;
        if (member.userId === currentUserId) {
            option.selected = true;
        }
        paidBySelect.appendChild(option);
    });
}

function populateMembers() {
    const membersList = document.getElementById('membersList');
    const currentUserId = localStorage.getItem('userId');
    
    membersList.innerHTML = '';
    
    currentGroup.members.forEach(member => {
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `member-${member.userId}`;
        checkbox.value = member.userId;
        checkbox.checked = true;
        checkbox.addEventListener('change', handleMemberToggle);
        
        const label = document.createElement('label');
        label.htmlFor = `member-${member.userId}`;
        label.className = 'member-label';
        
        const memberAvatar = document.createElement('div');
        memberAvatar.className = 'member-avatar';
        memberAvatar.textContent = member.name.charAt(0).toUpperCase();
        
        const memberName = document.createElement('span');
        memberName.className = 'member-name';
        memberName.textContent = member.userId === currentUserId ? 'You' : member.name;
        
        label.appendChild(memberAvatar);
        label.appendChild(memberName);
        
        memberItem.appendChild(checkbox);
        memberItem.appendChild(label);
        
        membersList.appendChild(memberItem);
        
        selectedMembers.add(member.userId);
    });
}

function initializeEventListeners() {
    document.getElementById('backButton').addEventListener('click', () => {
        window.location.href = `group-detail.html?id=${currentGroupId}`;
    });
    
    document.getElementById('cancelButton').addEventListener('click', () => {
        window.location.href = `group-detail.html?id=${currentGroupId}`;
    });
    
    document.getElementById('expenseForm').addEventListener('submit', handleSubmit);
    
    document.querySelectorAll('input[name="splitMethod"]').forEach(radio => {
        radio.addEventListener('change', handleSplitMethodChange);
    });
    
    document.getElementById('amount').addEventListener('input', updateCustomSplitInputs);
}

function handleMemberToggle(event) {
    const memberId = event.target.value;
    
    if (event.target.checked) {
        selectedMembers.add(memberId);
    } else {
        selectedMembers.delete(memberId);
    }
    
    updateCustomSplitInputs();
}

function handleSplitMethodChange(event) {
    const customSection = document.getElementById('customSplitSection');
    
    if (event.target.value === 'custom') {
        customSection.style.display = 'block';
        updateCustomSplitInputs();
    } else {
        customSection.style.display = 'none';
    }
}

function updateCustomSplitInputs() {
    const splitMethod = document.querySelector('input[name="splitMethod"]:checked').value;
    
    if (splitMethod !== 'custom') return;
    
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const customInputs = document.getElementById('customSplitInputs');
    const splitTotal = document.getElementById('splitTotal');
    
    customInputs.innerHTML = '';
    
    const equalSplit = selectedMembers.size > 0 ? amount / selectedMembers.size : 0;
    const currentUserId = localStorage.getItem('userId');
    
    selectedMembers.forEach(memberId => {
        const member = currentGroup.members.find(m => m.userId === memberId);
        if (!member) return;
        
        const inputGroup = document.createElement('div');
        inputGroup.className = 'custom-split-input';
        
        const label = document.createElement('label');
        label.textContent = member.userId === currentUserId ? 'You' : member.name;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.min = '0';
        input.value = equalSplit.toFixed(2);
        input.dataset.memberId = memberId;
        input.addEventListener('input', updateSplitTotal);
        
        inputGroup.appendChild(label);
        inputGroup.appendChild(input);
        customInputs.appendChild(inputGroup);
    });
    
    updateSplitTotal();
}

function updateSplitTotal() {
    const customInputs = document.querySelectorAll('#customSplitInputs input');
    const splitTotal = document.getElementById('splitTotal');
    
    let total = 0;
    customInputs.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    
    splitTotal.textContent = total.toFixed(2);
}

async function handleSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const description = formData.get('description').trim();
    const amount = parseFloat(formData.get('amount'));
    const category = formData.get('category');
    const paidBy = formData.get('paidBy');
    const splitMethod = formData.get('splitMethod');
    
    if (!validateForm(description, amount, paidBy)) {
        return;
    }
    
    const splits = calculateSplits(amount, splitMethod);
    
    const expenseData = {
        description,
        amount,
        category,
        paidBy,
        groupId: currentGroupId,
        splits,
        date: new Date().toISOString()
    };
    
    try {
        const submitButton = document.getElementById('submitButton');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        
        await api.createExpense(expenseData);
        
        showMessage('Expense added successfully!', 'success');
        
        setTimeout(() => {
            window.location.href = `group-detail.html?id=${currentGroupId}`;
        }, 1000);
        
    } catch (error) {
        console.error('Error creating expense:', error);
        showMessage('Failed to add expense', 'error');
        
        const submitButton = document.getElementById('submitButton');
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-plus"></i> Add Expense';
    }
}

function validateForm(description, amount, paidBy) {
    let isValid = true;
    
    if (!description) {
        showFieldError('description', 'Description is required');
        isValid = false;
    }
    
    if (!amount || amount <= 0) {
        showFieldError('amount', 'Amount must be greater than 0');
        isValid = false;
    }
    
    if (!paidBy) {
        showFieldError('paidBy', 'Please select who paid');
        isValid = false;
    }
    
    if (selectedMembers.size === 0) {
        showFieldError('members', 'Please select at least one member');
        isValid = false;
    }
    
    const splitMethod = document.querySelector('input[name="splitMethod"]:checked').value;
    if (splitMethod === 'custom') {
        const customInputs = document.querySelectorAll('#customSplitInputs input');
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

function calculateSplits(amount, splitMethod) {
    const splits = {};
    
    if (splitMethod === 'equal') {
        const splitAmount = amount / selectedMembers.size;
        selectedMembers.forEach(memberId => {
            splits[memberId] = Math.round(splitAmount * 100) / 100;
        });
    } else {
        const customInputs = document.querySelectorAll('#customSplitInputs input');
        customInputs.forEach(input => {
            const memberId = input.dataset.memberId;
            const memberAmount = parseFloat(input.value) || 0;
            splits[memberId] = memberAmount;
        });
    }
    
    return splits;
}

function showFieldError(fieldName, message) {
    const errorElement = document.getElementById(`${fieldName}-error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
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