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

        return `
            <div class="group-card" data-group-id="${group.id}">
                <div class="group-card__header">
                    <h4 class="group-card__name">${group.name}</h4>
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

    openAddExpenseModal(groupId) {
        console.log(`Add expense modal for group ${groupId} - not implemented yet`);
    }
}