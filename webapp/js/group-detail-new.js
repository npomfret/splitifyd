import { PageBuilder } from './templates/page-builder.js';
import { NavigationComponent } from './components/navigation.js';
import { ListComponents } from './components/list-components.js';
import { ModalComponent } from './components/modal.js';
import { FormComponents } from './components/form-components.js';
import { api } from './api.js';

const groupId = new URLSearchParams(window.location.search).get('id');
if (!groupId) {
    window.location.href = '/dashboard.html';
}

function calculateBalances(expenses, currentUserId) {
    const balances = {};
    
    expenses.forEach(expense => {
        if (expense.paidBy === currentUserId) {
            expense.splits?.forEach(split => {
                if (split.userId !== currentUserId) {
                    balances[split.userId] = (balances[split.userId] || 0) + split.amount;
                }
            });
        } else {
            const userSplit = expense.splits?.find(s => s.userId === currentUserId);
            if (userSplit) {
                balances[expense.paidBy] = (balances[expense.paidBy] || 0) - userSplit.amount;
            }
        }
    });

    return Object.entries(balances)
        .filter(([_, amount]) => Math.abs(amount) > 0.01)
        .map(([userId, amount]) => ({
            userId,
            userName: findUserName(userId, expenses),
            amount
        }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

function findUserName(userId, expenses) {
    for (const expense of expenses) {
        if (expense.paidBy === userId && expense.paidByName) {
            return expense.paidByName;
        }
        const split = expense.splits?.find(s => s.userId === userId);
        if (split && split.userName) {
            return split.userName;
        }
    }
    return 'Unknown';
}

function calculateTotalExpenses(expenses) {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

window.showGroupSettingsModal = async (groupId) => {
    const group = await api.groups.getGroup(groupId);
    const members = group.memberDetails || [];

    const modalHtml = ModalComponent.render({
        id: 'groupSettingsModal',
        title: 'Group Settings',
        body: `
            <div class="group-settings">
                <h4>Group Name</h4>
                <p>${group.name}</p>
                
                <h4>Members</h4>
                <div class="members-list">
                    ${members.map(member => `
                        <div class="member-item">
                            <span>${member.displayName || member.email}</span>
                            ${member.role === 'admin' ? '<span class="badge">Admin</span>' : ''}
                        </div>
                    `).join('')}
                </div>
                
                <button class="button button--primary" onclick="showInviteMemberModal('${groupId}')">
                    <i class="fas fa-user-plus"></i> Invite Member
                </button>
            </div>
        `,
        footer: `
            <button class="button button--secondary" onclick="ModalComponent.hide('groupSettingsModal')">Close</button>
            <button class="button button--danger" onclick="confirmDeleteGroup('${groupId}')">Delete Group</button>
        `
    });

    document.getElementById('modalsContainer').innerHTML = modalHtml;
    ModalComponent.show('groupSettingsModal');
};

window.confirmDeleteGroup = async (groupId) => {
    const confirmed = await PageBuilder.showConfirmDialog({
        title: 'Delete Group',
        message: 'Are you sure you want to delete this group? This action cannot be undone.',
        confirmText: 'Delete',
        confirmClass: 'button--danger'
    });

    if (confirmed) {
        try {
            await api.groups.deleteGroup(groupId);
            window.location.href = '/dashboard.html';
        } catch (error) {
            console.error('Failed to delete group:', error);
            alert('Failed to delete group. Please try again.');
        }
    }
};

PageBuilder.buildAuthenticatedPage({
    title: 'Group Details',
    pageId: 'groupDetail',
    renderContent: async (user) => {
        const group = await api.groups.getGroup(groupId);
        const expenses = await api.expenses.listGroupExpenses(groupId);
        const balances = calculateBalances(expenses, user.uid);
        
        const navigationActions = [
            {
                type: 'button',
                id: 'settingsBtn',
                icon: 'fas fa-cog',
                text: 'Settings',
                class: 'button--secondary'
            },
            {
                type: 'link',
                href: `/add-expense.html?groupId=${groupId}`,
                icon: 'fas fa-plus',
                text: 'Add Expense',
                class: 'button--primary'
            }
        ];

        const balancesList = balances.length > 0 
            ? PageBuilder.renderList({
                items: balances,
                renderItem: (balance) => ListComponents.renderBalanceItem(balance),
                containerId: 'balancesList',
                containerClass: 'balances-list'
              })
            : ListComponents.renderEmptyState({
                icon: 'fas fa-balance-scale',
                title: 'All settled up!',
                message: 'No outstanding balances in this group'
              });

        const expensesList = expenses.length > 0
            ? PageBuilder.renderList({
                items: expenses.slice(0, 10),
                renderItem: (expense) => ListComponents.renderExpenseItem(expense, user.uid),
                containerId: 'expensesList',
                containerClass: 'expenses-list'
              })
            : ListComponents.renderEmptyState({
                icon: 'fas fa-receipt',
                title: 'No expenses yet',
                message: 'Add your first expense to get started'
              });

        return PageBuilder.renderPageWithNavigation({
            navigationTitle: group.name,
            backUrl: '/dashboard.html',
            actions: navigationActions,
            content: `
                <div class="group-stats">
                    <div class="stat-card">
                        <h3>Total Expenses</h3>
                        <p class="stat-value">$${calculateTotalExpenses(expenses).toFixed(2)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Your Balance</h3>
                        <p class="stat-value ${group.userBalance >= 0 ? 'positive' : 'negative'}">
                            ${group.userBalance >= 0 ? '+' : ''}$${Math.abs(group.userBalance).toFixed(2)}
                        </p>
                    </div>
                    <div class="stat-card">
                        <h3>Members</h3>
                        <p class="stat-value">${group.memberDetails?.length || 0}</p>
                    </div>
                </div>

                <section class="balances-section">
                    <h3>Balances</h3>
                    ${balancesList}
                </section>

                <section class="expenses-section">
                    <h3>Recent Expenses</h3>
                    ${expensesList}
                    ${expenses.length > 10 ? `
                        <div class="view-all">
                            <a href="/expenses.html?groupId=${groupId}" class="button button--secondary">
                                View All Expenses
                            </a>
                        </div>
                    ` : ''}
                </section>

                <div id="modalsContainer"></div>
            `
        });
    },
    onReady: (user) => {
        NavigationComponent.attachEventListeners([
            {
                type: 'button',
                id: 'settingsBtn',
                handler: () => showGroupSettingsModal(groupId)
            }
        ]);
    }
});