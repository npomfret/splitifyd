class GroupService {
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
        return group.members || [];
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

class GroupsList {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container element with ID '${containerId}' not found`);
        }
        this.groups = [];
        this.filteredGroups = [];
        this.searchTerm = '';
        this.isLoading = false;
    }

    async loadGroups() {
        this.setLoading(true);
        
        try {
            this.groups = await apiService.getGroups();
            this.filterGroups();
            this.render();
        } catch (error) {
            this.renderError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    filterGroups() {
        if (!this.searchTerm.trim()) {
            this.filteredGroups = [...this.groups];
        } else {
            const term = this.searchTerm.toLowerCase();
            this.filteredGroups = this.groups.filter(group => 
                group.name.toLowerCase().includes(term) ||
                group.members.some(member => member.name.toLowerCase().includes(term))
            );
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        
        if (loading) {
            this.container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading your groups...</p>
                </div>
            `;
        }
    }

    renderError(message) {
        this.container.innerHTML = `
            <div class="error-state">
                <h3>Unable to load groups</h3>
                <p>${message}</p>
                <button type="button" class="button button--secondary" onclick="groupsList.loadGroups()">
                    Try Again
                </button>
            </div>
        `;
    }

    renderEmpty() {
        this.container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon">📝</div>
                <h3>No groups yet</h3>
                <p>Create your first group to start splitting expenses with friends</p>
                <button type="button" class="button button--primary" id="createGroupBtn">
                    Create Your First Group
                </button>
            </div>
        `;
        
        document.getElementById('createGroupBtn')?.addEventListener('click', () => {
            this.openCreateGroupModal();
        });
    }

    renderGroupCard(group) {
        const balanceClass = group.yourBalance >= 0 ? 'balance--positive' : 'balance--negative';
        const balanceText = group.yourBalance >= 0 ? 'you are owed' : 'you owe';
        const membersPreview = group.members.slice(0, 4).map(member => 
            `<div class="member-avatar" title="${member.name}">${member.initials}</div>`
        ).join('');
        const extraMembers = group.memberCount > 4 ? `<div class="member-avatar member-avatar--extra">+${group.memberCount - 4}</div>` : '';

        const lastExpenseTime = group.lastExpenseTime ? this._formatLastActivity(group.lastExpenseTime) : null;

        return `
            <div class="group-card" data-group-id="${group.id}">
                <div class="group-card__header">
                    <h4 class="group-card__name">${group.name}${group.expenseCount ? ` <span class="expense-count">(${group.expenseCount})</span>` : ''}</h4>
                    <div class="group-card__balance ${balanceClass}">
                        $${Math.abs(group.yourBalance).toFixed(2)}
                    </div>
                </div>
                
                <div class="group-card__members">
                    <div class="members-preview">
                        ${membersPreview}${extraMembers}
                    </div>
                    <span class="member-count">${group.memberCount} member${group.memberCount !== 1 ? 's' : ''}</span>
                </div>
                
                
                ${group.lastExpense ? `
                    <div class="group-card__last-expense">
                        <span class="last-expense__description">${group.lastExpense.description}</span>
                        <span class="last-expense__amount">$${group.lastExpense.amount.toFixed(2)}</span>
                    </div>
                ` : ''}
                
                <div class="group-card__footer">
                    <span class="group-card__activity">${group.lastActivity}</span>
                    <div class="group-card__balance-text ${balanceClass}">
                        ${balanceText}
                    </div>
                </div>
                
                <button type="button" class="group-card__add-expense" title="Add expense to ${group.name}">
                    + Add Expense
                </button>
            </div>
        `;
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
            <div class="groups-controls">
                <div class="search-container">
                    <input type="text" 
                           id="groupSearch" 
                           class="form-input search-input" 
                           placeholder="Search groups..."
                           aria-label="Search groups">
                </div>
            </div>
        `;

        const groupsHtml = sortedGroups.length > 0 ? 
            sortedGroups.map(group => this.renderGroupCard(group)).join('') :
            `<div class="empty-search-state">
                <p>No groups found matching "${this.searchTerm}"</p>
            </div>`;

        this.container.innerHTML = `
            ${headerHtml}
            <div class="groups-grid">
                ${groupsHtml}
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        document.getElementById('createGroupBtn')?.addEventListener('click', () => {
            this.openCreateGroupModal();
        });

        const searchInput = document.getElementById('groupSearch');
        if (searchInput) {
            searchInput.value = this.searchTerm;
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.filterGroups();
                this.render();
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

    openCreateGroupModal() {
        const modal = new CreateGroupModal();
        modal.onSubmit = async (groupData) => {
            try {
                const newGroup = await apiService.createGroup(groupData);
                this.groups.unshift(newGroup);
                this.filterGroups();
                this.render();
            } catch (error) {
                throw error;
            }
        };
        modal.open();
    }

    openGroupDetail(groupId) {
        console.log(`Open group detail for ${groupId} - not implemented yet`);
    }

    async openAddExpenseModal(groupId) {
        const modal = new AddExpenseModal(groupId);
        modal.onSubmit = async (expenseData) => {
            try {
                const newExpense = await ExpenseService.createExpense(expenseData);
                
                // Reload groups to reflect new expense and balance changes
                await this.loadGroups();
                
                // Show success message (optional)
                const successMessage = document.createElement('div');
                successMessage.className = 'toast toast--success';
                successMessage.textContent = 'Expense added successfully!';
                document.body.appendChild(successMessage);
                
                setTimeout(() => {
                    successMessage.remove();
                }, 3000);
                
                return newExpense;
            } catch (error) {
                throw error;
            }
        };
        modal.open();
    }
}