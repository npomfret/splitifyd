import { StorageService, LocalStorage } from './services/storage.js';
import { ProjectService } from './services/project.js';
import { ExpenseService } from './services/expense.js';
import { formatCurrency, currencySymbols, currencyRates } from './utils/currency.js';
import { generateId, formatDate } from './utils/helpers.js';
import { showToast, initToastContainer } from './ui/toast.js';
import { showModal, closeModal, initModals } from './ui/modal.js';
import { updateSyncIndicator } from './ui/sync.js';

// Global state
let currentProject = null;
let currentUserId = null;
let syncInterval = null;
let isSyncing = false;

// Service instances
const storage = new StorageService();
const projectService = new ProjectService();
const expenseService = new ExpenseService();

// Initialize the app
export async function init() {
    initToastContainer();
    initModals();
    initEventListeners();
    
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdParam = urlParams.get('project');
    
    if (projectIdParam) {
        try {
            await joinProject(projectIdParam, null);
        } catch (error) {
            console.error('Failed to join project from URL:', error);
            showLanding();
        }
    } else {
        // Check local storage
        const { projectId, userId } = LocalStorage.getProjectInfo();
        if (projectId && userId) {
            try {
                const storageId = LocalStorage.getStorageId(projectId);
                if (storageId) {
                    const projectData = await storage.getProject(storageId);
                    if (projectData && projectData.members.find(m => m.id === userId)) {
                        currentProject = projectData;
                        currentProject.storageId = storageId;
                        currentUserId = userId;
                        showApp();
                        return;
                    }
                }
            } catch (error) {
                console.error('Failed to load project from storage:', error);
            }
        }
        showLanding();
    }
}

// App navigation
function showApp() {
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    renderApp();
    startSync();
}

function showLanding() {
    document.getElementById('landingPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    stopSync();
}

// Project management
async function createProject(name, userName) {
    try {
        const projectData = projectService.createProject(name, userName);
        const { storageId } = await storage.createProject(projectData);
        
        projectData.storageId = storageId;
        currentProject = projectData;
        currentUserId = projectData.userId;
        
        LocalStorage.saveProjectInfo(projectData.id, projectData.userId);
        LocalStorage.saveStorageId(projectData.id, storageId);
        
        showApp();
        showToast('Project created successfully!', 'success');
        
        return projectData;
    } catch (error) {
        showToast('Failed to create project. Please try again.', 'error');
        throw error;
    }
}

async function joinProject(projectId, userName) {
    try {
        let storageId = projectId;
        let projectData;
        
        // Try to get from localStorage first
        const storedStorageId = LocalStorage.getStorageId(projectId);
        if (storedStorageId) {
            storageId = storedStorageId;
        }
        
        projectData = await storage.getProject(storageId);
        projectService.validateProject(projectData);
        
        // If userName provided, add as new member
        if (userName) {
            const newMember = projectService.addMember(projectData, userName);
            currentUserId = newMember.id;
            await saveProject(projectData);
        } else {
            // Try to find existing user
            const { userId } = LocalStorage.getProjectInfo();
            if (userId && projectData.members.find(m => m.id === userId)) {
                currentUserId = userId;
            } else {
                // Need to prompt for name
                showJoinModal();
                return;
            }
        }
        
        currentProject = projectData;
        currentProject.storageId = storageId;
        
        LocalStorage.saveProjectInfo(projectData.id, currentUserId);
        LocalStorage.saveStorageId(projectData.id, storageId);
        
        showApp();
        showToast('Joined project successfully!', 'success');
        
    } catch (error) {
        showToast('Failed to join project. Invalid project ID.', 'error');
        throw error;
    }
}

async function saveProject(projectData = currentProject) {
    if (!projectData || !projectData.storageId) return;
    
    try {
        projectData.version++;
        projectData.lastUpdated = Date.now();
        
        await storage.updateProject(projectData.storageId, projectData);
        return true;
    } catch (error) {
        showToast('Failed to save changes', 'error');
        console.error('Save error:', error);
        return false;
    }
}

// Sync functionality
async function syncProject() {
    if (!currentProject || !currentProject.storageId || isSyncing) return;
    
    isSyncing = true;
    updateSyncIndicator('syncing');
    
    try {
        const remoteProject = await storage.getProject(currentProject.storageId);
        const mergedProject = projectService.mergeProjects(currentProject, remoteProject);
        
        if (mergedProject !== currentProject) {
            currentProject = mergedProject;
            currentProject.storageId = currentProject.storageId;
            renderApp();
        }
        
        updateSyncIndicator('success');
    } catch (error) {
        updateSyncIndicator('error');
        console.error('Sync error:', error);
    } finally {
        isSyncing = false;
    }
}

function startSync() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(syncProject, 5000);
}

function stopSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

// Rendering functions
function renderApp() {
    if (!currentProject) return;
    
    document.getElementById('projectTitle').textContent = currentProject.name;
    document.getElementById('defaultCurrency').value = currentProject.defaultCurrency;
    
    renderMembers();
    renderExpenses();
    renderSettlements();
}

function renderMembers() {
    const membersList = document.getElementById('membersList');
    const memberCount = document.getElementById('memberCount');
    const balances = expenseService.calculateBalances(currentProject);
    
    memberCount.textContent = currentProject.members.length;
    membersList.innerHTML = '';
    
    currentProject.members.forEach(member => {
        const balance = balances[member.id] || 0;
        const item = document.createElement('div');
        item.className = 'member-item';
        
        const balanceClass = balance > 0.01 ? 'positive' : balance < -0.01 ? 'negative' : '';
        const balanceText = balance > 0.01 
            ? `Gets back ${formatCurrency(balance, currentProject.defaultCurrency)}`
            : balance < -0.01 
            ? `Owes ${formatCurrency(Math.abs(balance), currentProject.defaultCurrency)}`
            : 'Settled up';
        
        item.innerHTML = `
            <span class="member-name">${member.name}${member.id === currentUserId ? ' (You)' : ''}</span>
            <span class="member-balance ${balanceClass}">${balanceText}</span>
        `;
        
        membersList.appendChild(item);
    });
}

function renderExpenses() {
    const expensesList = document.getElementById('expensesList');
    const expensesEmpty = document.getElementById('expensesEmpty');
    
    if (currentProject.expenses.length === 0) {
        expensesList.style.display = 'none';
        expensesEmpty.style.display = 'block';
        return;
    }
    
    expensesList.style.display = 'flex';
    expensesEmpty.style.display = 'none';
    expensesList.innerHTML = '';
    
    currentProject.expenses.forEach(expense => {
        const item = document.createElement('div');
        item.className = 'expense-item';
        
        const payer = currentProject.members.find(m => m.id === expense.paidBy);
        const splitMembers = expense.splitBetween
            .map(id => currentProject.members.find(m => m.id === id))
            .filter(Boolean)
            .map(m => m.name);
        
        const dateStr = formatDate(expense.timestamp);
        
        item.innerHTML = `
            <div class="expense-header">
                <div>
                    <div class="expense-description">${expense.description}</div>
                    <div class="expense-details">
                        ${payer?.name || 'Unknown'} paid ${formatCurrency(expense.amount, expense.currency)}
                    </div>
                    <div class="expense-details">
                        Split between: ${splitMembers.join(', ')}
                    </div>
                </div>
                <div class="expense-amount">${formatCurrency(expense.amount, expense.currency)}</div>
            </div>
            <div class="expense-meta">
                <span>${dateStr}</span>
                <span>Added by ${currentProject.members.find(m => m.id === expense.addedBy)?.name || 'Unknown'}</span>
            </div>
        `;
        
        expensesList.appendChild(item);
    });
}

function renderSettlements() {
    const settlementsList = document.getElementById('settlementsList');
    const settlementsEmpty = document.getElementById('settlementsEmpty');
    const settlements = expenseService.calculateSettlements(currentProject);
    
    if (settlements.length === 0) {
        settlementsList.style.display = 'none';
        settlementsEmpty.style.display = 'block';
        return;
    }
    
    settlementsList.style.display = 'flex';
    settlementsEmpty.style.display = 'none';
    settlementsList.innerHTML = '';
    
    settlements.forEach(settlement => {
        const item = document.createElement('div');
        item.className = 'settlement-item';
        
        const fromMember = currentProject.members.find(m => m.id === settlement.from);
        const toMember = currentProject.members.find(m => m.id === settlement.to);
        
        item.innerHTML = `
            <span class="settlement-text">
                ${fromMember?.name || 'Unknown'} → ${toMember?.name || 'Unknown'}
            </span>
            <span class="settlement-amount">
                ${formatCurrency(settlement.amount, currentProject.defaultCurrency)}
            </span>
            <button class="btn btn-success btn-sm" onclick="recordSettlement('${settlement.from}', '${settlement.to}', ${settlement.amount})">
                Settle Up
            </button>
        `;
        
        settlementsList.appendChild(item);
    });
}

// Event listeners and handlers
function initEventListeners() {
    // Create project form
    document.getElementById('createProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('projectName').value;
        const userName = document.getElementById('yourName').value;
        await createProject(name, userName);
        e.target.reset();
    });
    
    // Join project form
    document.getElementById('joinProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const projectId = document.getElementById('joinProjectId').value;
        const userName = document.getElementById('joinYourName').value;
        await joinProject(projectId, userName);
        closeModal('joinModal');
        e.target.reset();
    });
    
    // Add member form
    document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const memberName = document.getElementById('newMemberName').value;
        projectService.addMember(currentProject, memberName);
        await saveProject();
        renderApp();
        showToast('Member added successfully!', 'success');
        e.target.reset();
    });
    
    // Add expense form
    document.getElementById('addExpenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const description = document.getElementById('expenseDescription').value;
        const amount = document.getElementById('expenseAmount').value;
        const currency = document.getElementById('expenseCurrency').value;
        const paidBy = document.getElementById('expensePaidBy').value;
        const splitBetween = Array.from(document.querySelectorAll('input[name="splitBetween"]:checked'))
            .map(cb => cb.value);
        
        try {
            const expense = expenseService.createExpense(
                description, amount, currency, paidBy, splitBetween, currentUserId
            );
            
            expenseService.validateExpense(expense, currentProject);
            
            currentProject.expenses.unshift(expense);
            await saveProject();
            closeModal('addExpenseModal');
            renderApp();
            showToast('Expense added successfully!', 'success');
            e.target.reset();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
    
    // Settlement form
    document.getElementById('settlementForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const from = document.getElementById('settlementFrom').value;
        const to = document.getElementById('settlementTo').value;
        const amount = document.getElementById('settlementAmount').value;
        const currency = document.getElementById('settlementCurrency').value;
        
        const settlement = expenseService.createSettlement(from, to, amount, currency, currentUserId);
        
        currentProject.expenses.unshift(settlement);
        await saveProject();
        closeModal('settlementModal');
        renderApp();
        showToast('Payment recorded!', 'success');
        e.target.reset();
    });
    
    // Default currency change
    document.getElementById('defaultCurrency')?.addEventListener('change', async (e) => {
        currentProject.defaultCurrency = e.target.value;
        await saveProject();
        renderApp();
        showToast('Default currency updated', 'success');
    });
}

// Modal helpers
window.showJoinModal = () => showModal('joinModal');
window.showShareModal = () => {
    const url = `${window.location.origin}${window.location.pathname}?project=${currentProject.storageId}`;
    document.getElementById('shareUrl').value = url;
    document.getElementById('shareProjectId').textContent = `${currentProject.id} (Storage: ${currentProject.storageId})`;
    showModal('shareModal');
};
window.showAddExpenseModal = () => {
    populateExpenseForm();
    showModal('addExpenseModal');
};
window.showSettlementModal = () => {
    populateSettlementForm();
    showModal('settlementModal');
};

window.copyShareUrl = () => {
    const input = document.getElementById('shareUrl');
    input.select();
    document.execCommand('copy');
    showToast('Link copied to clipboard!', 'success');
};

window.recordSettlement = (from, to, amount) => {
    document.getElementById('settlementFrom').value = from;
    document.getElementById('settlementTo').value = to;
    document.getElementById('settlementAmount').value = amount.toFixed(2);
    document.getElementById('settlementCurrency').value = currentProject.defaultCurrency;
    showModal('settlementModal');
};

// Form population helpers
function populateExpenseForm() {
    const paidBySelect = document.getElementById('expensePaidBy');
    const splitContainer = document.getElementById('splitBetweenContainer');
    const currencySelect = document.getElementById('expenseCurrency');
    
    // Populate currency options
    currencySelect.innerHTML = Object.keys(currencyRates).map(currency => 
        `<option value="${currency}">${currencySymbols[currency]} ${currency}</option>`
    ).join('');
    currencySelect.value = currentProject.defaultCurrency;
    
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

function populateSettlementForm() {
    const fromSelect = document.getElementById('settlementFrom');
    const toSelect = document.getElementById('settlementTo');
    const currencySelect = document.getElementById('settlementCurrency');
    
    // Populate currency options
    currencySelect.innerHTML = Object.keys(currencyRates).map(currency => 
        `<option value="${currency}">${currencySymbols[currency]} ${currency}</option>`
    ).join('');
    currencySelect.value = currentProject.defaultCurrency;
    
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}