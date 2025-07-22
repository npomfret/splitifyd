import { logger } from './utils/logger.js';
import { createElementSafe, clearElement, appendChildren } from './utils/safe-dom.js';
import { apiService } from './api.js';
import { ROUTES } from './routes.js';
import { createButton, createLoadingSpinner, createModal } from './ui-builders.js';
import type {
  Group,
  ClickHandler
} from './types/business-logic.js';
import type {
  GroupSummary,
  CreateGroupRequest
} from './types/api.js';

export class GroupsList {
  private container: HTMLElement;
  private groups: GroupSummary[] = [];
  private filteredGroups: GroupSummary[] = [];
  private isLoading: boolean = false;
  private headerComponent: any = null;

  constructor(containerId: string, headerComponent?: any) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Container element with ID '${containerId}' not found`);
    }
    this.container = element;
    this.headerComponent = headerComponent || null;
  }

  async loadGroups(): Promise<void> {
    this.setLoading(true);
    
    this.groups = await apiService.getGroups();
    this.filteredGroups = [...this.groups];
    this.render();
    this.setLoading(false);
  }

  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    
    if (loading) {
      clearElement(this.container);
      const loadingState = createLoadingSpinner({
        text: 'Loading your groups...'
      });
      this.container.appendChild(loadingState);
    }
  }

  private renderEmpty(): void {
    clearElement(this.container);
    
    const emptyState = createElementSafe('div', { className: 'empty-state' });
    const icon = createElementSafe('div', { className: 'empty-state__icon', textContent: '📝' });
    const title = createElementSafe('h3', { textContent: 'No groups yet' });
    const description = createElementSafe('p', { textContent: 'Create your first group to start splitting expenses with friends' });
    
    const createGroupBtn = createButton({
      text: 'Create Your First Group',
      variant: 'primary',
      onClick: () => this.openCreateGroupModal()
    });
    createGroupBtn.id = 'createGroupBtn';
    
    appendChildren(emptyState, [icon, title, description, createGroupBtn]);
    this.container.appendChild(emptyState);
    
    this.attachEventListeners();
  }

  private renderGroupCard(group: GroupSummary): HTMLElement {
    const yourBalance = group.balance.userBalance.netBalance;
    const balanceClass = yourBalance >= 0 ? 'balance--positive' : 'balance--negative';
    
    const groupCard = createElementSafe('div', {
      className: 'group-card',
      'data-group-id': group.id,
      'data-id': group.id
    });

    const header = createElementSafe('div', { className: 'group-card__header' });
    
    // Group name with expense count
    const nameElement = createElementSafe('h3', { className: 'group-card__name' });
    nameElement.textContent = group.name;
    
    if (group.expenseCount) {
      const expenseCountSpan = createElementSafe('span', { className: 'group-card__expense-count' });
      expenseCountSpan.textContent = ` • ${group.expenseCount} expense${group.expenseCount !== 1 ? 's' : ''}`;
      nameElement.appendChild(expenseCountSpan);
    }

    header.appendChild(nameElement);
    
    // Balance status badge
    if (yourBalance !== 0) {
      const balanceContainer = createElementSafe('div', { className: 'group-card__balance' });
      
      const balanceAmount = createElementSafe('span', {
        className: `group-card__balance-amount ${balanceClass}`,
        textContent: `$${Math.abs(yourBalance).toFixed(2)}`
      });
      
      const balanceLabel = createElementSafe('span', {
        className: 'group-card__balance-label',
        textContent: yourBalance > 0 ? 'you are owed' : 'you owe'
      });
      
      balanceContainer.appendChild(balanceLabel);
      balanceContainer.appendChild(balanceAmount);
      header.appendChild(balanceContainer);
    } else {
      const settledBadge = createElementSafe('div', {
        className: 'group-card__settled',
        textContent: 'settled up'
      });
      header.appendChild(settledBadge);
    }

    const membersSection = createElementSafe('div', { className: 'group-card__members' });
    const membersPreview = createElementSafe('div', { className: 'members-preview' });
    
    // Members preview is not available in GroupSummary, so we'll skip it
    // We could fetch full group details if needed

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
      
      lastExpenseSection.appendChild(description);
      groupCard.appendChild(lastExpenseSection);
    }

    const footer = createElementSafe('div', { className: 'group-card__footer' });
    
    // Show more meaningful activity text
    let activityText = group.lastActivity;
    if (activityText === 'Never' || !activityText) {
      activityText = 'No recent activity';
    }
    
    const activity = createElementSafe('span', {
      className: 'group-card__activity',
      textContent: activityText
    });

    footer.appendChild(activity);

    const addExpenseButton = createButton({
      text: '+ Add Expense',
      onClick: () => {} // Event listener added later in attachGroupCardEventListeners
    });
    addExpenseButton.className = 'group-card__add-expense';
    addExpenseButton.title = `Add expense to ${group.name}`;

    groupCard.appendChild(footer);
    groupCard.appendChild(addExpenseButton);

    return groupCard;
  }

  private render(): void {
    if (this.groups.length === 0) {
      this.renderEmpty();
      return;
    }

    const sortedGroups = this.filteredGroups.sort((a, b) => {
      const aTime = a.lastActivityRaw ? new Date(a.lastActivityRaw).getTime() : 0;
      const bTime = b.lastActivityRaw ? new Date(b.lastActivityRaw).getTime() : 0;
      return bTime - aTime;
    });
    
    const totalOwed = this.groups.reduce((sum, group) => sum + Math.max(0, group.balance.userBalance.netBalance), 0);
    const totalOwe = this.groups.reduce((sum, group) => sum + Math.max(0, -group.balance.userBalance.netBalance), 0);

    // Update header with balance information
    if (this.headerComponent) {
      this.headerComponent.updateBalances(totalOwed, totalOwe);
    }

    clearElement(this.container);
    
    // Add groups header
    const groupsHeader = createElementSafe('div', { className: 'groups-header' });
    const headerTitle = createElementSafe('h2', { className: 'groups-header__title', textContent: 'Your Groups' });
    const createGroupBtn = createButton({
      text: '+ Create Group',
      variant: 'primary',
      onClick: () => this.openCreateGroupModal()
    });
    createGroupBtn.id = 'createGroupBtn';
    
    groupsHeader.appendChild(createGroupBtn);
    appendChildren(groupsHeader, [headerTitle]);
    this.container.appendChild(groupsHeader);
    
    // Add groups grid
    const groupsGrid = createElementSafe('div', { className: 'groups-grid' });
    sortedGroups.forEach(group => {
      const groupCard = this.renderGroupCard(group);
      groupsGrid.appendChild(groupCard);
    });
    this.container.appendChild(groupsGrid);

    this.attachEventListeners();
  }

  private addGroupToList(newGroup: GroupSummary): void {
    const groupsGrid = this.container.querySelector('.groups-grid');
    if (!groupsGrid) {
      logger.error('Groups grid not found, falling back to full render');
      this.render();
      return;
    }
    
    const newGroupCard = this.renderGroupCard(newGroup);
    groupsGrid.prepend(newGroupCard);
    this.attachGroupCardEventListeners(newGroupCard);
  }

  private attachEventListeners(): void {
    // Note: createGroupBtn already has onClick handler from createButton()
    // No need to re-attach event listener
    
    document.querySelectorAll('.group-card').forEach(card => {
      this.attachGroupCardEventListeners(card as HTMLElement);
    });
  }

  private attachGroupCardEventListeners(card: HTMLElement): void {
    const clickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('group-card__add-expense')) {
        const groupId = card.dataset.groupId;
        if (groupId) {
          this.openGroupDetail(groupId);
        }
      }
    };

    const addExpenseBtn = card.querySelector('.group-card__add-expense');
    if (addExpenseBtn) {
      const addExpenseHandler = (e: Event) => {
        e.stopPropagation();
        const groupId = card.dataset.groupId;
        if (groupId) {
          this.openAddExpenseModal(groupId);
        }
      };
      addExpenseBtn.addEventListener('click', addExpenseHandler);
    }

    card.addEventListener('click', clickHandler);
  }

  private async openCreateGroupModal(): Promise<void> {
    // Create Body
    const form = createElementSafe('form', { id: 'createGroupForm' }) as HTMLFormElement;
    const groupNameGroup = createElementSafe('div', { className: 'form-group' });
    const groupNameLabel = createElementSafe('label', { htmlFor: 'groupName', textContent: 'Group Name' });
    const groupNameInput = createElementSafe('input', { type: 'text', id: 'groupName', name: 'groupName', required: true, placeholder: 'Enter group name', className: 'form-input' });
    groupNameGroup.appendChild(groupNameLabel);
    groupNameGroup.appendChild(groupNameInput);

    const descriptionGroup = createElementSafe('div', { className: 'form-group' });
    const descriptionLabel = createElementSafe('label', { htmlFor: 'groupDescription', textContent: 'Description (optional)' });
    const descriptionTextarea = createElementSafe('textarea', { id: 'groupDescription', name: 'groupDescription', placeholder: "What's this group for?", className: 'form-input form-textarea' });
    descriptionGroup.appendChild(descriptionLabel);
    descriptionGroup.appendChild(descriptionTextarea);

    form.appendChild(groupNameGroup);
    form.appendChild(descriptionGroup);

    // Create Footer
    const footerContainer = createElementSafe('div');
    // Declare modal element variable for access in button handlers
    let modalElement: HTMLDivElement;
    
    const cancelButton = createButton({
      text: 'Cancel',
      variant: 'secondary',
      onClick: () => {
        modalElement.style.display = 'none';
        document.body.classList.remove('modal-open');
        modalElement.remove();
      }
    });
    const createGroupButton = createButton({
      text: 'Create Group',
      variant: 'primary',
      onClick: async () => {
        const formData = new FormData(form);

        const groupData: CreateGroupRequest = {
            name: formData.get('groupName') as string,
            description: formData.get('groupDescription') as string,
            memberEmails: []
        };

        await apiService.createGroup(groupData);
        // Reload groups to get the new group with balance information
        await this.loadGroups();

        modalElement.style.display = 'none';
        document.body.classList.remove('modal-open');
        modalElement.remove();
      }
    });
    
    footerContainer.appendChild(cancelButton);
    footerContainer.appendChild(createGroupButton);

    // Create modal using UI builder
    modalElement = createModal({
      title: 'Create New Group',
      body: form,
      footer: footerContainer,
      onClose: () => {
        modalElement.remove();
      }
    });
    
    // Show modal
    document.body.appendChild(modalElement);
    // Override CSS defaults that hide the modal
    modalElement.style.display = 'flex';
    modalElement.style.alignItems = 'center';
    modalElement.style.justifyContent = 'center';
    modalElement.style.opacity = '1';
    modalElement.style.visibility = 'visible';
    modalElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    document.body.classList.add('modal-open');
  }

  private openGroupDetail(groupId: string): void {
    window.location.href = `${ROUTES.GROUP_DETAIL}?id=${groupId}`;
  }

  private async openAddExpenseModal(groupId: string): Promise<void> {
    // Navigate to add expense page instead of opening modal
    window.location.href = `add-expense.html?groupId=${groupId}`;
  }
}