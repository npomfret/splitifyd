import { logger } from './utils/logger.js';
import { createElementSafe, clearElement, appendChildren } from './utils/safe-dom.js';

// Dynamic import of ModalComponent when needed
let ModalComponent = null;

async function ensureModalComponent() {
    if (!ModalComponent && !window.ModalComponent) {
        const module = await import('./components/modal.js');
        ModalComponent = module.ModalComponent;
        window.ModalComponent = ModalComponent;
    }
    return window.ModalComponent || ModalComponent;
}

export class GroupService {
    static async getUserGroups() {
        // Using existing getGroups from apiService for now
        return apiService.getGroups();
    }

    static async getGroup(groupId) {
        // For now, get from the cached groups list
        const groups = await this.getUserGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        return group;
    }

    static async getGroupMembers(groupId) {
        // For now, get members from the group data
        const group = await this.getGroup(groupId);
        return group.members;
    }

    static async createGroup(groupData) {
        return apiService.createGroup(groupData);
    }

    static async updateGroup(groupId, updateData) {
        return apiCall(`/updateDocument?id=${groupId}`, {
            method: 'PUT',
            body: JSON.stringify({ data: updateData })
        });
    }

    static async deleteGroup(groupId) {
        return apiCall(`/deleteDocument?id=${groupId}`, {
            method: 'DELETE'
        });
    }
}

export class GroupsList {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container element with ID '${containerId}' not found`);
        }
        this.groups = [];
        this.filteredGroups = [];
        this.isLoading = false;
    }

    async loadGroups() {
        this.setLoading(true);
        
        try {
            this.groups = await apiService.getGroups();
            this.filteredGroups = [...this.groups];
            this.render();
        } catch (error) {
            logger.error('Error loading groups:', error);
            this.renderError(error.message);
        } finally {
            this.setLoading(false);
        }
    }


    setLoading(loading) {
        this.isLoading = loading;
        
        if (loading) {
            clearElement(this.container);
            const loadingState = createElementSafe('div', { className: 'loading-state' });
            const spinner = createElementSafe('div', { className: 'loading-spinner' });
            const loadingText = createElementSafe('p', { textContent: 'Loading your groups...' });
            
            appendChildren(loadingState, [spinner, loadingText]);
            this.container.appendChild(loadingState);
        }
    }

    renderError(message) {
        // Log error details to console
        logger.error('Failed to load groups:', message);
        
        clearElement(this.container);
        
        const errorState = createElementSafe('div', { className: 'error-state' });
        const title = createElementSafe('h3', { textContent: 'Unable to load groups' });
        const actions = createElementSafe('div', { className: 'error-state__actions' });
        
        const tryAgainBtn = createElementSafe('button', {
            className: 'button button--secondary',
            textContent: 'Try Again'
        });
        tryAgainBtn.type = 'button';
        tryAgainBtn.addEventListener('click', () => this.loadGroups());
        
        const createGroupBtn = createElementSafe('button', {
            id: 'createGroupBtn',
            className: 'button button--primary',
            textContent: 'Create Group'
        });
        createGroupBtn.type = 'button';
        createGroupBtn.addEventListener('click', () => this.openCreateGroupModal());
        
        appendChildren(actions, [tryAgainBtn, createGroupBtn]);
        appendChildren(errorState, [title, actions]);
        this.container.appendChild(errorState);
    }

    renderEmpty() {
        clearElement(this.container);
        
        const emptyState = createElementSafe('div', { className: 'empty-state' });
        const icon = createElementSafe('div', { className: 'empty-state__icon', textContent: '📝' });
        const title = createElementSafe('h3', { textContent: 'No groups yet' });
        const description = createElementSafe('p', { textContent: 'Create your first group to start splitting expenses with friends' });
        
        const createGroupBtn = createElementSafe('button', {
            id: 'createGroupBtn',
            className: 'button button--primary',
            textContent: 'Create Your First Group'
        });
        createGroupBtn.type = 'button';
        createGroupBtn.addEventListener('click', () => this.openCreateGroupModal());
        
        appendChildren(emptyState, [icon, title, description, createGroupBtn]);
        this.container.appendChild(emptyState);
    }

    renderGroupCard(group) {
        const balanceClass = group.yourBalance >= 0 ? 'balance--positive' : 'balance--negative';
        const balanceText = group.yourBalance >= 0 ? 'you are owed' : 'you owe';
        
        const groupCard = createElementSafe('div', {
            className: 'group-card',
            'data-group-id': group.id
        });

        const header = createElementSafe('div', { className: 'group-card__header' });
        const nameElement = createElementSafe('h4', { className: 'group-card__name' });
        nameElement.textContent = group.name;
        
        if (group.expenseCount) {
            const expenseCountSpan = createElementSafe('span', { className: 'expense-count' });
            expenseCountSpan.textContent = ` (${group.expenseCount})`;
            nameElement.appendChild(expenseCountSpan);
        }

        const balanceElement = createElementSafe('div', { 
            className: `group-card__balance ${balanceClass}`,
            textContent: `$${Math.abs(group.yourBalance).toFixed(2)}`
        });

        header.appendChild(nameElement);
        header.appendChild(balanceElement);

        const membersSection = createElementSafe('div', { className: 'group-card__members' });
        const membersPreview = createElementSafe('div', { className: 'members-preview' });
        
        group.members.slice(0, 4).forEach(member => {
            const memberAvatar = createElementSafe('div', {
                className: 'member-avatar',
                title: member.name,
                textContent: member.initials
            });
            membersPreview.appendChild(memberAvatar);
        });

        if (group.memberCount > 4) {
            const extraMembers = createElementSafe('div', {
                className: 'member-avatar member-avatar--extra',
                textContent: `+${group.memberCount - 4}`
            });
            membersPreview.appendChild(extraMembers);
        }

        const memberCount = createElementSafe('span', {
            className: 'member-count',
            textContent: `${group.memberCount} member${group.memberCount !== 1 ? 's' : ''}`
        });

        membersSection.appendChild(membersPreview);
        membersSection.appendChild(memberCount);

        groupCard.appendChild(header);
        groupCard.appendChild(membersSection);

        if (group.lastExpense) {
            const lastExpenseSection = createElementSafe('div', { className: 'group-card__last-expense' });
            const description = createElementSafe('span', {
                className: 'last-expense__description',
                textContent: group.lastExpense.description
            });
            const amount = createElementSafe('span', {
                className: 'last-expense__amount',
                textContent: `$${group.lastExpense.amount.toFixed(2)}`
            });
            
            lastExpenseSection.appendChild(description);
            lastExpenseSection.appendChild(amount);
            groupCard.appendChild(lastExpenseSection);
        }

        const footer = createElementSafe('div', { className: 'group-card__footer' });
        const activity = createElementSafe('span', {
            className: 'group-card__activity',
            textContent: group.lastActivity
        });
        const balanceText = createElementSafe('div', {
            className: `group-card__balance-text ${balanceClass}`,
            textContent: balanceText
        });

        footer.appendChild(activity);
        footer.appendChild(balanceText);

        const addExpenseButton = createElementSafe('button', {
            className: 'group-card__add-expense',
            title: `Add expense to ${group.name}`,
            textContent: '+ Add Expense'
        });
        addExpenseButton.type = 'button';

        groupCard.appendChild(footer);
        groupCard.appendChild(addExpenseButton);

        return groupCard.outerHTML;
    }

    _formatLastActivity(timestamp) {
        if (!timestamp) return 'Recently';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffMinutes < 1) return 'just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return `${Math.floor(diffDays / 30)}mo ago`;
    }

    render() {
        if (this.groups.length === 0) {
            this.renderEmpty();
            return;
        }

        const sortedGroups = this.filteredGroups.sort((a, b) => {
            const aTime = a.lastActivityRaw ? new Date(a.lastActivityRaw).getTime() : 0;
            const bTime = b.lastActivityRaw ? new Date(b.lastActivityRaw).getTime() : 0;
            return bTime - aTime;
        });
        
        const totalOwed = this.groups.reduce((sum, group) => sum + Math.max(0, group.yourBalance), 0);
        const totalOwe = this.groups.reduce((sum, group) => sum + Math.max(0, -group.yourBalance), 0);

        const headerHtml = `
            <div class="dashboard-summary">
                <h2 class="dashboard-summary__title">Your Groups</h2>
                <div class="dashboard-summary__balances">
                    <div class="balance-summary balance-summary--positive">
                        <span class="balance-summary__label">You are owed</span>
                        <span class="balance-summary__amount">$${totalOwed.toFixed(2)}</span>
                    </div>
                    <div class="balance-summary balance-summary--negative">
                        <span class="balance-summary__label">You owe</span>
                        <span class="balance-summary__amount">$${totalOwe.toFixed(2)}</span>
                    </div>
                </div>
                <button type="button" class="button button--primary" id="createGroupBtn">
                    + Create Group
                </button>
            </div>
        `;

        const groupsHtml = sortedGroups.map(group => this.renderGroupCard(group)).join('');

        clearElement(this.container);
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = headerHtml;
        this.container.appendChild(tempDiv.firstElementChild);
        
        const groupsGrid = createElementSafe('div', { className: 'groups-grid' });
        const tempGroupsDiv = document.createElement('div');
        tempGroupsDiv.innerHTML = groupsHtml;
        
        while (tempGroupsDiv.firstChild) {
            groupsGrid.appendChild(tempGroupsDiv.firstChild);
        }
        
        this.container.appendChild(groupsGrid);

        this.attachEventListeners();
    }

    attachEventListeners() {
        const createGroupBtn = document.getElementById('createGroupBtn');
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', () => {
                this.openCreateGroupModal();
            });
        }

        document.querySelectorAll('.group-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('group-card__add-expense')) {
                    const groupId = card.dataset.groupId;
                    this.openGroupDetail(groupId);
                }
            });
        });

        document.querySelectorAll('.group-card__add-expense').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupId = e.target.closest('.group-card').dataset.groupId;
                this.openAddExpenseModal(groupId);
            });
        });
    }

    async openCreateGroupModal() {
        await ensureModalComponent();
        
        if (!window.ModalComponent) {
            logger.error('ModalComponent not available');
            return;
        }

        const modalHtml = window.ModalComponent.render({
            id: 'createGroupModal',
            title: 'Create New Group',
            body: `
                <form id="createGroupForm">
                    <div class="form-group">
                        <label for="groupName">Group Name</label>
                        <input type="text" id="groupName" name="groupName" required 
                               placeholder="Enter group name" class="form-input">
                    </div>
                    <div class="form-group">
                        <label for="groupDescription">Description (optional)</label>
                        <textarea id="groupDescription" name="groupDescription" 
                                  placeholder="What's this group for?" class="form-input form-textarea"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Initial Members (Optional)</label>
                        <div class="members-input-container" id="membersContainer">
                            <div class="member-input-row">
                                <input type="email" placeholder="Enter email address" class="form-input member-email" name="memberEmail[]">
                                <button type="button" class="button--icon" disabled>×</button>
                            </div>
                        </div>
                        <button type="button" class="button button--small" id="addMemberBtn">+ Add Another Member</button>
                    </div>
                </form>
            `,
            footer: `
                <button class="button button--secondary" id="cancelCreateGroupButton">Cancel</button>
                <button class="button button--primary" id="createGroupSubmit">Create Group</button>
            `
        });

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        window.ModalComponent.show('createGroupModal');

        // Attach event listener to the cancel button
        const cancelCreateGroupButton = document.getElementById('cancelCreateGroupButton');
        if (cancelCreateGroupButton) {
            cancelCreateGroupButton.addEventListener('click', () => {
                window.ModalComponent.hide('createGroupModal');
            });
        }

        // Add event listeners to initial member row remove button
        const initialRemoveButton = document.querySelector('#membersContainer .button--icon');
        if (initialRemoveButton) {
            initialRemoveButton.addEventListener('click', () => {
                const memberRow = initialRemoveButton.parentElement;
                memberRow.remove();
                // Update remove button states after removal
                const container = document.getElementById('membersContainer');
                const remainingButtons = container.querySelectorAll('.button--icon');
                remainingButtons.forEach(btn => btn.disabled = remainingButtons.length <= 1);
            });
        }

        // Add member functionality
        document.getElementById('addMemberBtn').addEventListener('click', () => {
            const container = document.getElementById('membersContainer');
            const newRow = document.createElement('div');
            newRow.className = 'member-input-row';
            newRow.innerHTML = `
                <input type="email" placeholder="Enter email address" class="form-input member-email" name="memberEmail[]">
                <button type="button" class="button--icon">×</button>
            `;
            container.appendChild(newRow);
            
            // Add event listener to the remove button
            const removeButton = newRow.querySelector('.button--icon');
            removeButton.addEventListener('click', () => {
                newRow.remove();
                // Update remove button states after removal
                const remainingButtons = container.querySelectorAll('.button--icon');
                remainingButtons.forEach(btn => btn.disabled = remainingButtons.length <= 1);
            });
            
            // Enable remove buttons when there are multiple rows
            const removeButtons = container.querySelectorAll('.button--icon');
            removeButtons.forEach(btn => btn.disabled = removeButtons.length <= 1);
        });

        document.getElementById('createGroupSubmit').addEventListener('click', async () => {
            const form = document.getElementById('createGroupForm');
            const formData = new FormData(form);
            
            // Collect member emails
            const memberEmails = Array.from(form.querySelectorAll('.member-email'))
                .map(input => input.value.trim())
                .filter(email => email.length > 0);
            
            try {
                const groupData = {
                    name: formData.get('groupName'),
                    description: formData.get('groupDescription'),
                    memberEmails: memberEmails
                };
                
                const newGroup = await apiService.createGroup(groupData);
                this.groups.unshift(newGroup);
                this.filteredGroups = [...this.groups];
                this.render();
                
                window.ModalComponent.hide('createGroupModal');
                document.getElementById('createGroupModal').remove();
            } catch (error) {
                logger.error('Failed to create group:', error);
                alert('Failed to create group. Please try again.');
            }
        });
    }

    openGroupDetail(groupId) {
        window.location.href = `group-detail.html?id=${groupId}`;
    }

    async openAddExpenseModal(groupId) {
        // Navigate to add expense page instead of opening modal
        window.location.href = `add-expense.html?groupId=${groupId}`;
    }
}