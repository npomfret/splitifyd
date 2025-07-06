export class ListComponents {
  static renderGroupCard(group) {
    return `
      <a href="/group-detail.html?id=${group.id}" class="group-card">
        <div class="group-header">
          <h3 class="group-name">${group.name}</h3>
          <span class="member-count">${group.memberDetails?.length || 0} members</span>
        </div>
        <div class="group-info">
          <span class="group-balance ${group.userBalance >= 0 ? 'positive' : 'negative'}">
            ${group.userBalance >= 0 ? 'You are owed' : 'You owe'} 
            $${Math.abs(group.userBalance).toFixed(2)}
          </span>
        </div>
      </a>
    `;
  }

  static renderExpenseItem(expense, currentUserId) {
    const isCurrentUserPayer = expense.paidBy === currentUserId;
    const userShare = expense.splits?.find(s => s.userId === currentUserId)?.amount || 0;
    
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

  static renderMemberItem(member, balance = null) {
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

  static renderBalanceItem(balance) {
    const isOwed = balance.amount >= 0;
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
          <strong>$${Math.abs(balance.amount).toFixed(2)}</strong>
        </div>
      </div>
    `;
  }

  static renderEmptyState(config) {
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

  static renderLoadingState(message = 'Loading...') {
    return `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  }

  static renderErrorState(message = 'An error occurred', retryButton = null) {
    return `
      <div class="error-state">
        <i class="fas fa-exclamation-circle"></i>
        <p>${message}</p>
        ${retryButton ? retryButton : ''}
      </div>
    `;
  }

  static renderPaginationControls(config) {
    const { currentPage, totalPages, onPageChange } = config;
    
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

  static attachPaginationListeners(containerId, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('.pagination button[data-page]').forEach(button => {
      button.addEventListener('click', (e) => {
        const page = parseInt(e.currentTarget.dataset.page);
        if (onPageChange) onPageChange(page);
      });
    });
  }
}