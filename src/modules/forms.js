import { supportedCurrencies, currencySymbols } from '../utils/currency.js';

// Form population helpers
export function populateExpenseForm(currentProject, currentUserId) {
    const paidBySelect = document.getElementById('expensePaidBy');
    const splitContainer = document.getElementById('splitBetweenContainer');
    const currencySelect = document.getElementById('expenseCurrency');
    
    // Populate currency options
    currencySelect.innerHTML = supportedCurrencies.map(currency => 
        `<option value="${currency}">${currencySymbols[currency]} ${currency}</option>`
    ).join('');
    
    // Set to most recently used currency or USD
    const lastCurrency = currentProject.expenses.length > 0 ? 
        currentProject.expenses[0].currency : 'USD';
    currencySelect.value = lastCurrency;
    
    // Populate paid by options
    paidBySelect.innerHTML = currentProject.members.map(member => 
        `<option value="${member.id}">${member.name}</option>`
    ).join('');
    paidBySelect.value = currentUserId;
    
    // Populate split between checkboxes
    splitContainer.innerHTML = currentProject.members.map(member => `
        <label class="checkbox-item">
            <input type="checkbox" name="splitBetween" value="${member.id}" checked>
            <span>${member.name}</span>
        </label>
    `).join('');
}

export function populateSettlementForm(currentProject, currentUserId) {
    const fromSelect = document.getElementById('settlementFrom');
    const toSelect = document.getElementById('settlementTo');
    const currencySelect = document.getElementById('settlementCurrency');
    
    // Populate currency options
    currencySelect.innerHTML = supportedCurrencies.map(currency => 
        `<option value="${currency}">${currencySymbols[currency]} ${currency}</option>`
    ).join('');
    
    // Set to most recently used currency or USD
    const lastCurrency = currentProject.expenses.length > 0 ? 
        currentProject.expenses[0].currency : 'USD';
    currencySelect.value = lastCurrency;
    
    // Populate member options
    const memberOptions = currentProject.members.map(member => 
        `<option value="${member.id}">${member.name}</option>`
    ).join('');
    
    fromSelect.innerHTML = memberOptions;
    toSelect.innerHTML = memberOptions;
    
    // Set default values
    fromSelect.value = currentUserId;
    const otherMember = currentProject.members.find(m => m.id !== currentUserId);
    if (otherMember) {
        toSelect.value = otherMember.id;
    }
}