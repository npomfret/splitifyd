import type {
  TransformedGroup,
  ExpenseData,
  ExpenseSplit,
  GroupMember,
  GroupBalance,
  EmptyStateConfig,
  PaginationConfig
} from '../types/business-logic.js';

export class ListComponents {
  static renderGroupCard(group: TransformedGroup): string {
    return `
      <a href="/group-detail.html?id=${group.id}" class="group-card">
        <div class="group-header">
          <h3 class="group-name">${group.name}</h3>
          <span class="member-count">${group.members?.length || 0} members</span>
        </div>
        <div class="group-info">
          <span class="group-balance ${group.yourBalance >= 0 ? 'positive' : 'negative'}">
            ${group.yourBalance >= 0 ? 'You are owed' : 'You owe'} 
            $${Math.abs(group.yourBalance).toFixed(2)}
          </span>
        </div>
      </a>
    `;
  }

  static renderExpenseItem(expense: ExpenseData, currentUserId: string): string {
    const isCurrentUserPayer = expense.paidBy === currentUserId;
    const userShare = expense.splits?.find((s: ExpenseSplit) => s.userId === currentUserId)?.amount || 0;
    
    return `
      <div class="expense-item" data-expense-id="${expense.id}">
        <div class="expense-header">
          <span class="expense-description">${expense.description}</span>
          <span class="expense-amount">$${expense.amount.toFixed(2)}</span>
        </div>
        <div class="expense-details">
          <span class="expense-payer">
            ${isCurrentUserPayer ? 'You paid' : `${expense.paidByName || 'Someone'} paid`}
          </span>
          <span class="expense-date">${new Date(expense.date).toLocaleDateString()}</span>
          ${expense.category ? `<span class="expense-category">${expense.category}</span>` : ''}
        </div>
        ${userShare > 0 ? `
          <div class="expense-split">
            <span class="split-info">
              ${isCurrentUserPayer ? 
                `You lent $${(expense.amount - userShare).toFixed(2)}` : 
                `You owe $${userShare.toFixed(2)}`
              }
            </span>
          </div>
        ` : ''}
      </div>
    `;
  }

  static renderMemberItem(member: GroupMember | { displayName?: string; email?: string }, balance: number | null = null): string {
    return `
      <div class="member-item">
        <div class="member-info">
          <div class="member-avatar">
            ${member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}
          </div>
          <div class="member-details">
            <span class="member-name">${member.displayName || member.email || 'Unknown'}</span>
            ${member.email ? `<span class="member-email">${member.email}</span>` : ''}
          </div>
        </div>
        ${balance !== null ? `
          <div class="member-balance ${balance >= 0 ? 'positive' : 'negative'}">
            ${balance >= 0 ? '+' : ''}$${Math.abs(balance).toFixed(2)}
          </div>
        ` : ''}
      </div>
    `;
  }

  static renderBalanceItem(balance: GroupBalance): string {
    const isOwed = balance.balance >= 0;
    return `
      <div class="balance-item">
        <div class="balance-user">
          <div class="member-avatar">
            ${balance.userName ? balance.userName.charAt(0).toUpperCase() : '?'}
          </div>
          <span class="member-name">${balance.userName || 'Unknown'}</span>
        </div>
        <div class="balance-amount ${isOwed ? 'positive' : 'negative'}">
          ${isOwed ? 'owes you' : 'you owe'}
          <strong>$${Math.abs(balance.balance).toFixed(2)}</strong>
        </div>
      </div>
    `;
  }

  static renderEmptyState(config: EmptyStateConfig): string {
    const { icon, title, message, actionButton = null } = config;
    
    return `
      <div class="empty-state">
        ${icon ? `<i class="${icon}"></i>` : ''}
        <h3>${title}</h3>
        ${message ? `<p>${message}</p>` : ''}
        ${actionButton ? actionButton : ''}
      </div>
    `;
  }

  static renderLoadingState(message: string = 'Loading...'): string {
    return `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  }

  static renderErrorState(message: string = 'An error occurred', retryButton: string | null = null): string {
    return `
      <div class="error-state">
        <i class="fas fa-exclamation-circle"></i>
        <p>${message}</p>
        ${retryButton ? retryButton : ''}
      </div>
    `;
  }

  static renderPaginationControls(config: PaginationConfig): string {
    const { currentPage, totalPages } = config;
    
    if (totalPages <= 1) return '';
    
    return `
      <div class="pagination">
        <button class="button button--secondary" ${currentPage === 1 ? 'disabled' : ''} 
                data-page="${currentPage - 1}">
          <i class="fas fa-chevron-left"></i> Previous
        </button>
        <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
        <button class="button button--secondary" ${currentPage === totalPages ? 'disabled' : ''} 
                data-page="${currentPage + 1}">
          Next <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    `;
  }

  static attachPaginationListeners(containerId: string, onPageChange: (page: number) => void): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('.pagination button[data-page]').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const page = parseInt(target.dataset.page || '1');
        if (onPageChange) onPageChange(page);
      });
    });
  }
}