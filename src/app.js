import { StorageService, LocalStorage } from './services/storage.js';
import { ProjectService } from './services/project.js';
import { ExpenseService } from './services/expense.js';
import { formatCurrency, currencySymbols } from './utils/currency.js';
import { formatDate } from './utils/helpers.js';
import { showToast, initToastContainer } from './ui/toast.js';
import { showModal, closeModal, initModals } from './ui/modal.js';
import { updateSyncIndicator } from './ui/sync.js';
import { populateExpenseForm, populateSettlementForm } from './modules/forms.js';
import { ProjectCache, fetchProjectWithCache } from './modules/project-cache.js';
import { APP_CONFIG } from './config/constants.js';
import { getElements, showElement, hideElement } from './modules/dom-helpers.js';

// Global state
let currentProject = null;
let currentUserId = null;
let syncInterval = null;
let isSyncing = false;

// Service instances
const storage = new StorageService();
const projectService = new ProjectService();
const expenseService = new ExpenseService();
const projectCache = new ProjectCache();

// Cached DOM elements
let elements;


// Initialize the app
export async function init() {
    // Cache DOM elements
    elements = getElements();
    
    initToastContainer();
    initModals();
    initEventListeners();
    
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdParam = urlParams.get('project');
    
    if (projectIdParam) {
        try {
            // Try to load the project first to see what members exist
            try {
                const projectData = await storage.getProject(projectIdParam);
                
                // Check new storage format first
                let userId = LocalStorage.getUserIdForProject(projectIdParam);
                
                // If not found or invalid, check old storage format
                if (!userId || !projectData.members.find(m => m.id === userId)) {
                    const { userId: oldUserId } = LocalStorage.getProjectInfo();
                    if (oldUserId && projectData.members.find(m => m.id === oldUserId)) {
                        userId = oldUserId;
                        // Migrate to new format
                        LocalStorage.addProject(projectIdParam, userId);
                    }
                }
                
                if (userId && projectData.members.find(m => m.id === userId)) {
                    currentProject = projectData;
                    currentProject.storageId = projectIdParam;
                    currentUserId = userId;
                    LocalStorage.setActiveProject(projectIdParam);
                    showApp();
                    return;
                } else {
                    // Remove the project from local storage since we're not a member
                    LocalStorage.removeProject(projectIdParam);
                }
            } catch (error) {
                console.error('Failed to load project from URL:', error);
            }
            
            // Fall back to join flow
            // Prefill the project ID in the join modal
            document.getElementById('joinProjectId').value = projectIdParam;
            await joinProject(projectIdParam, null);
        } catch (error) {
            console.error('Failed to join project from URL:', error);
            showLanding();
        }
    } else {
        // Try to load active project from new storage format first
        const activeStorageId = LocalStorage.getActiveProject();
        if (activeStorageId) {
            const userId = LocalStorage.getUserIdForProject(activeStorageId);
            if (userId) {
                try {
                    const projectData = await storage.getProject(activeStorageId);
                    if (projectData && projectData.members.find(m => m.id === userId)) {
                        currentProject = projectData;
                        currentProject.storageId = activeStorageId;
                        currentUserId = userId;
                        showApp();
                        return;
                    }
                } catch (error) {
                    console.error('Failed to load active project:', error);
                    LocalStorage.removeProject(activeStorageId);
                }
            }
        }
        
        // Fall back to old storage format
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
                        // Migrate to new format
                        LocalStorage.addProject(storageId, userId);
                        LocalStorage.setActiveProject(storageId);
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
    hideElement(elements.landingPage);
    showElement(elements.mainApp);
    showElement(elements.headerNewProject);
    showElement(elements.headerSwitchProject);
    renderApp();
    startSync();
}

function showLanding() {
    elements.landingPage.style.display = 'flex';
    hideElement(elements.mainApp);
    hideElement(elements.headerNewProject);
    hideElement(elements.headerSwitchProject);
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
        
        // Save to new storage format
        LocalStorage.addProject(storageId, projectData.userId);
        LocalStorage.setActiveProject(storageId);
        
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
        
        // Add storageId to projectData
        projectData.storageId = storageId;
        
        // If userName provided, add as new member
        if (userName) {
            const newMember = projectService.addMember(projectData, userName);
            currentUserId = newMember.id;
            await saveProject(projectData);
        } else {
            // Try to find existing user - check new storage format first
            let userId = LocalStorage.getUserIdForProject(storageId);
            if (!userId) {
                // Fall back to old storage format
                const projectInfo = LocalStorage.getProjectInfo();
                userId = projectInfo.userId;
            }
            
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
        
        // Save to new storage format
        LocalStorage.addProject(storageId, currentUserId);
        LocalStorage.setActiveProject(storageId);
        
        showApp();
        showToast('Joined project successfully!', 'success');
        
        // Trigger immediate sync so others see the new member
        setTimeout(() => syncProject(), 100);
        
    } catch (error) {
        showToast('Failed to join project. Invalid project ID.', 'error');
        throw error;
    }
}

async function saveProject(projectData = currentProject) {
    if (!projectData || !projectData.storageId) {
        console.error('Cannot save: missing project data or storage ID');
        return false;
    }
    
    try {
        // First, fetch the latest remote version to check for conflicts
        const remoteProject = await storage.getProject(projectData.storageId);
        
        // If remote has been updated since we last synced, merge expenses
        if (remoteProject.version > projectData.version) {
            // Merge expenses to prevent data loss
            const mergedExpenses = projectService.mergeExpenses(
                projectData.expenses,
                remoteProject.expenses
            );
            
            // Use remote version as base but keep our merged expenses
            projectData = { ...remoteProject };
            projectData.expenses = mergedExpenses;
            currentProject = projectData;
        }
        
        // Now increment version and save
        projectData.version++;
        projectData.lastUpdated = Date.now();
        
        await storage.updateProject(projectData.storageId, projectData);
        
        // Invalidate cache for this project
        projectCache.delete(projectData.storageId);
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
        
        // Check if we need to merge
        if (remoteProject.version > currentProject.version || 
            (remoteProject.version === currentProject.version && 
             remoteProject.lastUpdated > currentProject.lastUpdated)) {
            
            // Remote is newer, but we need to preserve any local expenses
            const localExpenses = currentProject.expenses;
            const remoteExpenses = remoteProject.expenses;
            
            // Use remote as base
            currentProject = { ...remoteProject };
            
            // Merge expenses to prevent data loss
            currentProject.expenses = projectService.mergeExpenses(localExpenses, remoteExpenses);
            
            // Preserve storage ID
            currentProject.storageId = remoteProject.storageId;
            
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
    syncInterval = setInterval(syncProject, APP_CONFIG.SYNC_INTERVAL);
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
    
    elements.projectTitle.textContent = currentProject.name;
    
    renderMembers();
    renderExpenses();
    renderSettlements();
}

function renderMembers() {
    const balances = expenseService.calculateBalances(currentProject);
    
    elements.memberCount.textContent = currentProject.members.length;
    elements.membersList.innerHTML = '';
    
    currentProject.members.forEach(member => {
        const memberBalances = balances[member.id] || {};
        const item = document.createElement('div');
        item.className = 'member-item';
        
        // Create balance summary for all currencies
        const balanceTexts = [];
        let hasAnyBalance = false;
        
        Object.entries(memberBalances).forEach(([currency, amount]) => {
            if (Math.abs(amount) > 0.01) {
                hasAnyBalance = true;
                if (amount > 0.01) {
                    balanceTexts.push(`+${formatCurrency(amount, currency)}`);
                } else {
                    balanceTexts.push(`-${formatCurrency(Math.abs(amount), currency)}`);
                }
            }
        });
        
        const balanceText = hasAnyBalance ? balanceTexts.join(', ') : 'Settled up';
        const balanceClass = balanceTexts.some(t => t.startsWith('+')) ? 'positive' : 
                           balanceTexts.some(t => t.startsWith('-')) ? 'negative' : '';
        
        const isCurrentUser = member.id === currentUserId;
        const canRemove = !isCurrentUser && currentProject.members.length > 1;
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="member-name">${member.name}${isCurrentUser ? ' (You)' : ''}</span>
                ${canRemove ? `<button class="btn btn-danger btn-sm" style="padding: 0.125rem 0.375rem; font-size: 0.75rem;" onclick="removeMember('${member.id}', '${member.name.replace(/'/g, "\\'")}')">×</button>` : ''}
            </div>
            <span class="member-balance ${balanceClass}">${balanceText}</span>
        `;
        
        elements.membersList.appendChild(item);
    });
}

function renderExpenses() {
    if (currentProject.expenses.length === 0) {
        hideElement(elements.expensesList);
        showElement(elements.expensesEmpty);
        return;
    }
    
    elements.expensesList.style.display = 'flex';
    hideElement(elements.expensesEmpty);
    elements.expensesList.innerHTML = '';
    
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
        
        elements.expensesList.appendChild(item);
    });
}

function renderSettlements() {
    const settlementsByCurrency = expenseService.calculateSettlements(currentProject);
    
    // Check if there are any settlements
    const hasSettlements = Object.values(settlementsByCurrency).some(settlements => settlements.length > 0);
    
    if (!hasSettlements) {
        hideElement(elements.settlementsList);
        showElement(elements.settlementsEmpty);
        return;
    }
    
    elements.settlementsList.style.display = 'flex';
    hideElement(elements.settlementsEmpty);
    elements.settlementsList.innerHTML = '';
    
    // Group settlements by currency
    Object.entries(settlementsByCurrency).forEach(([currency, settlements]) => {
        if (settlements.length > 0) {
            // Add currency header
            const currencyHeader = document.createElement('div');
            currencyHeader.className = 'settlements-currency-header';
            currencyHeader.style.cssText = 'font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: var(--gray-700);';
            currencyHeader.textContent = `${currencySymbols[currency]} ${currency}`;
            elements.settlementsList.appendChild(currencyHeader);
            
            // Add settlements for this currency
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
                        ${formatCurrency(settlement.amount, currency)}
                    </span>
                    <button class="btn btn-success btn-sm" onclick="recordSettlement('${settlement.from}', '${settlement.to}', ${settlement.amount}, '${currency}')">
                        Settle Up
                    </button>
                `;
                
                elements.settlementsList.appendChild(item);
            });
        }
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
        let projectId = document.getElementById('joinProjectId').value.trim();
        const userName = document.getElementById('joinYourName').value;
        
        // Extract storage ID from URL if a full URL was pasted
        if (projectId.includes('?project=')) {
            const urlParams = new URLSearchParams(projectId.split('?')[1]);
            projectId = urlParams.get('project');
        } else if (projectId.includes('http')) {
            // If it's a URL but doesn't have the project param, show error
            showToast('Invalid share link. Please use the link from the share dialog.', 'error');
            return;
        }
        
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
    
    // New project form (from modal)
    document.getElementById('newProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('newProjectName').value;
        const userName = document.getElementById('newProjectYourName').value;
        await createProject(name, userName);
        closeModal('newProjectModal');
        e.target.reset();
    });
    
    // Join project form (from switcher modal)
    document.getElementById('switcherJoinForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        let projectId = document.getElementById('switcherJoinId').value.trim();
        const userName = document.getElementById('switcherJoinName').value;
        
        // Extract storage ID from URL if a full URL was pasted
        if (projectId.includes('?project=')) {
            const urlParams = new URLSearchParams(projectId.split('?')[1]);
            projectId = urlParams.get('project');
        } else if (projectId.includes('http')) {
            showToast('Invalid share link. Please use the link from the share dialog.', 'error');
            return;
        }
        
        await joinProject(projectId, userName);
        closeModal('projectSwitcherModal');
        e.target.reset();
    });
}

// Modal helpers
window.showJoinModal = () => showModal('joinModal');
window.showShareModal = () => {
    const url = `${window.location.origin}${window.location.pathname}?project=${currentProject.storageId}`;
    document.getElementById('shareUrl').value = url;
    document.getElementById('shareStorageId').value = currentProject.storageId;
    showModal('shareModal');
};
window.showAddExpenseModal = () => {
    populateExpenseForm(currentProject, currentUserId);
    showModal('addExpenseModal');
};
window.showSettlementModal = () => {
    populateSettlementForm(currentProject, currentUserId);
    showModal('settlementModal');
};

window.copyShareUrl = () => {
    const input = document.getElementById('shareUrl');
    input.select();
    document.execCommand('copy');
    showToast('Link copied to clipboard!', 'success');
};

window.copyStorageId = () => {
    const input = document.getElementById('shareStorageId');
    input.select();
    document.execCommand('copy');
    showToast('Storage ID copied to clipboard!', 'success');
};

window.recordSettlement = (from, to, amount, currency) => {
    document.getElementById('settlementFrom').value = from;
    document.getElementById('settlementTo').value = to;
    document.getElementById('settlementAmount').value = amount.toFixed(2);
    document.getElementById('settlementCurrency').value = currency || 'USD';
    showModal('settlementModal');
};

window.createNewProject = async () => {
    const existingList = document.getElementById('newProjectExistingList');
    
    // Load existing projects
    const projects = LocalStorage.getProjects();
    if (projects.length > 0) {
        existingList.innerHTML = '<div class="loading"><span class="spinner"></span> Loading your projects...</div>';
        
        // Fetch all projects concurrently
        const projectPromises = projects.map(async (project) => {
            try {
                const projectData = await fetchProjectWithCache(storage, projectCache, project.storageId);
                const member = projectData.members.find(m => m.id === project.userId);
                
                if (projectData && member) {
                    const isCurrentProject = project.storageId === currentProject?.storageId;
                    return {
                        storageId: project.storageId,
                        name: projectData.name,
                        memberName: member.name,
                        isCurrentProject
                    };
                }
                return null;
            } catch (error) {
                // Silently clean up invalid projects
                LocalStorage.removeProject(project.storageId);
                return null;
            }
        });
        
        // Wait for all projects to load
        const results = await Promise.all(projectPromises);
        
        // Build HTML from successful results
        const projectsHtml = results
            .filter(result => result !== null)
            .map(project => `
                <div class="project-switcher-item ${project.isCurrentProject ? 'current-project' : ''}">
                    <div>
                        <div class="project-name">${project.name}${project.isCurrentProject ? ' (current)' : ''}</div>
                        <div class="project-meta">You are: ${project.memberName}</div>
                    </div>
                    ${!project.isCurrentProject ? `<button class="btn btn-primary btn-sm" onclick="switchToProjectFromModal('${project.storageId}')">Switch</button>` : ''}
                </div>
            `);
        
        existingList.innerHTML = projectsHtml.length > 0 ? 
            projectsHtml.join('') : 
            '<p class="text-muted text-center">No existing projects</p>';
    } else {
        existingList.innerHTML = '<p class="text-muted text-center">No existing projects</p>';
    }
    
    showModal('newProjectModal');
};

window.removeMember = async (memberId, memberName) => {
    // Check if member has any expenses
    const hasExpenses = currentProject.expenses.some(expense => 
        expense.paidBy === memberId || expense.splitBetween.includes(memberId)
    );
    
    let confirmMessage = `Remove ${memberName} from the project?`;
    if (hasExpenses) {
        confirmMessage += '\n\nWarning: This member is part of existing expenses. Removing them will affect balance calculations.';
    }
    
    if (confirm(confirmMessage)) {
        try {
            // Remove member from project
            currentProject.members = currentProject.members.filter(m => m.id !== memberId);
            
            // Remove member from all expense splits (but keep them as payer if they paid)
            currentProject.expenses.forEach(expense => {
                expense.splitBetween = expense.splitBetween.filter(id => id !== memberId);
                // If no one is left in the split, remove the expense entirely
                if (expense.splitBetween.length === 0) {
                    expense.splitBetween = [expense.paidBy]; // Default to payer only
                }
            });
            
            await saveProject();
            renderApp();
            showToast(`${memberName} has been removed from the project`, 'success');
        } catch (error) {
            showToast('Failed to remove member', 'error');
            console.error('Remove member error:', error);
        }
    }
};

// Show project switcher modal
window.showProjectSwitcher = async () => {
    const projects = LocalStorage.getProjects();
    const projectList = document.getElementById('projectSwitcherList');
    
    if (projects.length <= 1) {
        showToast('No other projects to switch to', 'info');
        return;
    }
    
    projectList.innerHTML = '<div class="loading"><span class="spinner"></span> Loading projects...</div>';
    showModal('projectSwitcherModal');
    
    // Filter out current project
    const otherProjects = projects.filter(p => p.storageId !== currentProject?.storageId);
    
    // Fetch all projects concurrently
    const projectPromises = otherProjects.map(async (project) => {
        try {
            const projectData = await fetchProjectWithCache(storage, projectCache, project.storageId);
            const member = projectData.members.find(m => m.id === project.userId);
            
            if (projectData && member) {
                return {
                    storageId: project.storageId,
                    name: projectData.name,
                    memberName: member.name,
                    success: true
                };
            }
            return null;
        } catch (error) {
            // Silently clean up invalid projects
            LocalStorage.removeProject(project.storageId);
            return null;
        }
    });
    
    // Wait for all projects to load (or timeout)
    const results = await Promise.all(projectPromises);
    
    // Build HTML from successful results
    const projectsHtml = results
        .filter(result => result !== null)
        .map(project => `
            <div class="project-switcher-item">
                <div>
                    <div class="project-name">${project.name}</div>
                    <div class="project-meta">You are: ${project.memberName}</div>
                </div>
                <div class="project-actions">
                    <button class="btn btn-primary btn-sm" onclick="loadProject('${project.storageId}')">Switch</button>
                    <button class="btn btn-danger btn-sm" onclick="removeProjectFromList('${project.storageId}')">Remove</button>
                </div>
            </div>
        `);
    
    projectList.innerHTML = projectsHtml.length > 0 ? 
        projectsHtml.join('') : 
        '<p class="text-muted text-center">No other projects available</p>';
};

// Load a project
window.loadProject = async (storageId) => {
    try {
        const userId = LocalStorage.getUserIdForProject(storageId);
        if (!userId) {
            showToast('User information not found for this project', 'error');
            return;
        }
        
        const projectData = await storage.getProject(storageId);
        if (!projectData.members.find(m => m.id === userId)) {
            showToast('You are no longer a member of this project', 'error');
            LocalStorage.removeProject(storageId);
            return;
        }
        
        currentProject = projectData;
        currentProject.storageId = storageId;
        currentUserId = userId;
        
        LocalStorage.setActiveProject(storageId);
        closeModal('projectSwitcherModal');
        showApp();
    } catch (error) {
        showToast('Failed to load project', 'error');
        console.error('Load project error:', error);
    }
};

// Remove project from local list
window.removeProjectFromList = (storageId) => {
    LocalStorage.removeProject(storageId);
    showProjectSwitcher(); // Refresh the list
    showToast('Project removed from your list', 'success');
};

// Switch to project from new project modal
window.switchToProjectFromModal = async (storageId) => {
    closeModal('newProjectModal');
    await loadProject(storageId);
};


// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}