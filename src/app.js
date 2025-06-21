import { StorageService, LocalStorage } from './services/storage.js';
import { ProjectService } from './services/project.js';
import { ExpenseService } from './services/expense.js';
import { formatCurrency, currencySymbols, supportedCurrencies } from './utils/currency.js';
import { generateId, formatDate } from './utils/helpers.js';
import { showToast, initToastContainer } from './ui/toast.js';
import { showModal, closeModal, initModals } from './ui/modal.js';
import { updateSyncIndicator } from './ui/sync.js';

// Global state
let currentProject = null;
let currentUserId = null;
let syncInterval = null;
let isSyncing = false;

// Project cache for faster loading
const projectCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Service instances
const storage = new StorageService();
const projectService = new ProjectService();
const expenseService = new ExpenseService();

// Helper function to fetch project with caching and timeout
async function fetchProjectWithCache(storageId, timeoutMs = 8000) {
    // Check cache first
    const cached = projectCache.get(storageId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    
    // Fetch with timeout
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );
    
    try {
        const projectData = await Promise.race([
            storage.getProject(storageId),
            timeoutPromise
        ]);
        
        // Cache the result
        projectCache.set(storageId, {
            data: projectData,
            timestamp: Date.now()
        });
        
        return projectData;
    } catch (error) {
        // Return cached data if available, even if expired
        if (cached) {
            return cached.data;
        }
        throw error;
    }
}

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
            console.log('URL project param:', projectIdParam);
            
            // Try to load the project first to see what members exist
            try {
                const projectData = await storage.getProject(projectIdParam);
                console.log('Project data:', projectData);
                console.log('Project members:', projectData.members);
                
                // Check new storage format first
                let userId = LocalStorage.getUserIdForProject(projectIdParam);
                console.log('Found userId in new storage:', userId);
                
                // If not found or invalid, check old storage format
                if (!userId || !projectData.members.find(m => m.id === userId)) {
                    const { userId: oldUserId } = LocalStorage.getProjectInfo();
                    console.log('Checking old storage userId:', oldUserId);
                    if (oldUserId && projectData.members.find(m => m.id === oldUserId)) {
                        userId = oldUserId;
                        console.log('Using old storage userId:', userId);
                        // Migrate to new format
                        LocalStorage.addProject(projectIdParam, userId);
                    }
                }
                
                if (userId && projectData.members.find(m => m.id === userId)) {
                    console.log('User is a member, loading project directly');
                    currentProject = projectData;
                    currentProject.storageId = projectIdParam;
                    currentUserId = userId;
                    LocalStorage.setActiveProject(projectIdParam);
                    showApp();
                    return;
                } else {
                    console.log('User not found as member, cleaning up invalid storage');
                    console.log('Stored userId:', userId);
                    console.log('Available member IDs:', projectData.members.map(m => m.id));
                    
                    // Remove the project from local storage since we're not a member
                    LocalStorage.removeProject(projectIdParam);
                }
            } catch (error) {
                console.error('Failed to load project directly:', error);
            }
            
            // Fall back to join flow
            console.log('Falling back to join flow');
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
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('headerNewProject').style.display = 'block';
    document.getElementById('headerSwitchProject').style.display = 'block';
    renderApp();
    startSync();
}

function showLanding() {
    document.getElementById('landingPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('headerNewProject').style.display = 'none';
    document.getElementById('headerSwitchProject').style.display = 'none';
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
        
        // Save to both old and new storage format
        LocalStorage.saveProjectInfo(projectData.id, projectData.userId);
        LocalStorage.saveStorageId(projectData.id, storageId);
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
            console.log('Added new member:', newMember);
            console.log('Project version before save:', projectData.version);
            const saved = await saveProject(projectData);
            console.log('Save successful:', saved);
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
        
        // Save to both old and new storage format
        LocalStorage.saveProjectInfo(projectData.id, currentUserId);
        LocalStorage.saveStorageId(projectData.id, storageId);
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
        projectData.version++;
        projectData.lastUpdated = Date.now();
        
        console.log('Saving project:', {
            storageId: projectData.storageId,
            version: projectData.version,
            members: projectData.members.length
        });
        
        await storage.updateProject(projectData.storageId, projectData);
        
        // Invalidate cache for this project
        projectCache.delete(projectData.storageId);
        
        console.log('Project saved successfully');
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
            console.log('Sync: Remote version:', remoteProject.version, 'Local version:', currentProject.version);
            console.log('Sync: Using remote project, members:', remoteProject.members.length);
            const storageId = currentProject.storageId; // Preserve storage ID
            currentProject = mergedProject;
            currentProject.storageId = storageId;
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
    const settlementsByCurrency = expenseService.calculateSettlements(currentProject);
    
    // Check if there are any settlements
    const hasSettlements = Object.values(settlementsByCurrency).some(settlements => settlements.length > 0);
    
    if (!hasSettlements) {
        settlementsList.style.display = 'none';
        settlementsEmpty.style.display = 'block';
        return;
    }
    
    settlementsList.style.display = 'flex';
    settlementsEmpty.style.display = 'none';
    settlementsList.innerHTML = '';
    
    // Group settlements by currency
    Object.entries(settlementsByCurrency).forEach(([currency, settlements]) => {
        if (settlements.length > 0) {
            // Add currency header
            const currencyHeader = document.createElement('div');
            currencyHeader.className = 'settlements-currency-header';
            currencyHeader.style.cssText = 'font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: var(--gray-700);';
            currencyHeader.textContent = `${currencySymbols[currency]} ${currency}`;
            settlementsList.appendChild(currencyHeader);
            
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
                
                settlementsList.appendChild(item);
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
                const projectData = await fetchProjectWithCache(project.storageId);
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
                // Only log in development, silently clean up invalid projects
                if (location.hostname === 'localhost') {
                    console.warn(`Failed to load project ${project.storageId}:`, error.message);
                }
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
            const projectData = await fetchProjectWithCache(project.storageId);
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
            // Only log in development, silently clean up invalid projects
            if (location.hostname === 'localhost') {
                console.warn(`Failed to load project ${project.storageId}:`, error.message);
            }
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

// Form population helpers
function populateExpenseForm() {
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

function populateSettlementForm() {
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}