import { logger } from './utils/logger.js';
import { createElementSafe, clearElement, appendChildren } from './utils/safe-dom.js';
import { apiService, apiCall } from './api.js';
import { ROUTES } from './routes.js';
import type {
  Group,
  CreateGroupRequest as CreateGroupRequestBL,
  UpdateGroupRequest,
  ClickHandler
} from './types/business-logic.js';
import type {
  TransformedGroup,
  CreateGroupRequest,
  Member
} from './types/api.js';

export class GroupService {
  static async getUserGroups(): Promise<TransformedGroup[]> {
    // Using existing getGroups from apiService for now
    return apiService.getGroups();
  }

  static async getGroup(groupId: string): Promise<TransformedGroup> {
    // For now, get from the cached groups list
    const groups = await this.getUserGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    return group;
  }

  static async getGroupMembers(groupId: string): Promise<Member[]> {
    // For now, get members from the group data
    const group = await this.getGroup(groupId);
    return group.members;
  }

  static async createGroup(groupData: CreateGroupRequest | CreateGroupRequestBL): Promise<TransformedGroup> {
    return apiService.createGroup(groupData);
  }

  static async updateGroup(groupId: string, updateData: UpdateGroupRequest): Promise<Group> {
    return apiCall<Group>(`/updateDocument?id=${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ data: updateData })
    });
  }

  static async deleteGroup(groupId: string): Promise<{ success: boolean }> {
    return apiCall<{ success: boolean }>(`/deleteDocument?id=${groupId}`, {
      method: 'DELETE'
    });
  }
}

export class GroupsList {
  private container: HTMLElement;
  private groups: TransformedGroup[] = [];
  private filteredGroups: TransformedGroup[] = [];
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
      const loadingState = createElementSafe('div', { className: 'loading-state' });
      const spinner = createElementSafe('div', { className: 'loading-spinner' });
      const loadingText = createElementSafe('p', { textContent: 'Loading your groups...' });
      
      appendChildren(loadingState, [spinner, loadingText]);
      this.container.appendChild(loadingState);
    }
  }

  private renderError(message: string): void {
    clearElement(this.container);
    
    const errorState = createElementSafe('div', { className: 'error-state' });
    const title = createElementSafe('h3', { textContent: 'Unable to load groups' });
    const actions = createElementSafe('div', { className: 'error-state__actions' });
    
    // TODO: Replace with simple button
    const tryAgainBtn = document.createElement('button');
    tryAgainBtn.className = 'button button--secondary';
    tryAgainBtn.textContent = 'Try Again';
    tryAgainBtn.onclick = () => this.loadGroups();
    
    // TODO: Replace with simple button
    const createGroupBtn = document.createElement('button');
    createGroupBtn.className = 'button button--primary';
    createGroupBtn.id = 'createGroupBtn';
    createGroupBtn.textContent = 'Create Group';
    createGroupBtn.onclick = () => this.openCreateGroupModal();
    
    actions.appendChild(tryAgainBtn);
    actions.appendChild(createGroupBtn);
    appendChildren(errorState, [title, actions]);
    this.container.appendChild(errorState);
  }

  private renderEmpty(): void {
    clearElement(this.container);
    
    const emptyState = createElementSafe('div', { className: 'empty-state' });
    const icon = createElementSafe('div', { className: 'empty-state__icon', textContent: '📝' });
    const title = createElementSafe('h3', { textContent: 'No groups yet' });
    const description = createElementSafe('p', { textContent: 'Create your first group to start splitting expenses with friends' });
    
    // TODO: Replace with simple button
    const createGroupBtn = document.createElement('button');
    createGroupBtn.className = 'button button--primary';
    createGroupBtn.id = 'createGroupBtn';
    createGroupBtn.textContent = 'Create Your First Group';
    createGroupBtn.onclick = () => this.openCreateGroupModal();
    
    emptyState.appendChild(createGroupBtn);
    appendChildren(emptyState, [icon, title, description]);
    this.container.appendChild(emptyState);
  }

  private renderGroupCard(group: TransformedGroup): HTMLElement {
    const balanceClass = group.yourBalance >= 0 ? 'balance--positive' : 'balance--negative';
    
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
    if (group.yourBalance !== 0) {
      const balanceContainer = createElementSafe('div', { className: 'group-card__balance' });
      
      const balanceAmount = createElementSafe('span', {
        className: `group-card__balance-amount ${balanceClass}`,
        textContent: `$${Math.abs(group.yourBalance).toFixed(2)}`
      });
      
      const balanceLabel = createElementSafe('span', {
        className: 'group-card__balance-label',
        textContent: group.yourBalance > 0 ? 'you are owed' : 'you owe'
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
        textContent: group.lastExpense
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

    const addExpenseButton = createElementSafe('button', {
      className: 'group-card__add-expense',
      title: `Add expense to ${group.name}`,
      textContent: '+ Add Expense'
    }) as HTMLButtonElement;
    addExpenseButton.type = 'button';

    groupCard.appendChild(footer);
    groupCard.appendChild(addExpenseButton);

    return groupCard;
  }

  private _formatLastActivity(timestamp?: string): string {
    if (!timestamp) return 'Recently';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
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
    
    const totalOwed = this.groups.reduce((sum, group) => sum + Math.max(0, group.yourBalance), 0);
    const totalOwe = this.groups.reduce((sum, group) => sum + Math.max(0, -group.yourBalance), 0);

    // Update header with balance information
    if (this.headerComponent) {
      this.headerComponent.updateBalances(totalOwed, totalOwe);
    }

    clearElement(this.container);
    
    // Add groups header
    const groupsHeader = createElementSafe('div', { className: 'groups-header' });
    const headerTitle = createElementSafe('h2', { className: 'groups-header__title', textContent: 'Your Groups' });
    // TODO: Replace with simple button
    const createGroupBtn = document.createElement('button');
    createGroupBtn.className = 'button button--primary';
    createGroupBtn.id = 'createGroupBtn';
    createGroupBtn.textContent = '+ Create Group';
    createGroupBtn.onclick = () => this.openCreateGroupModal();
    
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

  private addGroupToList(newGroup: TransformedGroup): void {
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

  private updateGroupInList(updatedGroup: TransformedGroup): void {
    const existingCard = this.container.querySelector(`[data-id="${updatedGroup.id}"]`);
    if (!existingCard) {
      logger.error(`Group card with id ${updatedGroup.id} not found for update`);
      return;
    }
    
    const newGroupCard = this.renderGroupCard(updatedGroup);
    existingCard.replaceWith(newGroupCard);
    this.attachGroupCardEventListeners(newGroupCard);
  }

  private removeGroupFromList(groupId: string): void {
    const existingCard = this.container.querySelector(`[data-id="${groupId}"]`);
    if (!existingCard) {
      logger.error(`Group card with id ${groupId} not found for removal`);
      return;
    }
    
    existingCard.remove();
  }

  private attachEventListeners(): void {
    const createGroupBtn = document.getElementById('createGroupBtn');
    if (createGroupBtn) {
      createGroupBtn.addEventListener('click', () => {
        this.openCreateGroupModal();
      });
    }

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
    const modalId = 'createGroupModal';

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

    const membersGroup = createElementSafe('div', { className: 'form-group' });
    const membersLabel = createElementSafe('label', { textContent: 'Initial Members (Optional)' });
    const membersContainer = createElementSafe('div', { className: 'members-input-container', id: 'membersContainer' });
    // TODO: Replace with simple button
    const addMemberButton = document.createElement('button');
    addMemberButton.className = 'button button--small';
    addMemberButton.id = 'addMemberBtn';
    addMemberButton.textContent = '+ Add Another Member';
    addMemberButton.onclick = () => {
      membersContainer.appendChild(createMemberInputRow());
      const removeButtons = membersContainer.querySelectorAll('.button--icon') as NodeListOf<HTMLButtonElement>;
      removeButtons.forEach(btn => btn.disabled = removeButtons.length <= 1);
    };

    const createMemberInputRow = () => {
        const row = createElementSafe('div', { className: 'member-input-row' });
        const emailInput = createElementSafe('input', { type: 'email', placeholder: 'Enter email address', className: 'form-input member-email', name: 'memberEmail[]' });
        // TODO: Replace with simple button
        const removeButton = document.createElement('button');
        removeButton.className = 'btn btn-icon';
        removeButton.textContent = '×';
        removeButton.setAttribute('aria-label', 'Remove member');
        removeButton.onclick = () => {
          row.remove();
          const remainingButtons = membersContainer.querySelectorAll('.button--icon') as NodeListOf<HTMLButtonElement>;
          remainingButtons.forEach(btn => btn.disabled = remainingButtons.length <= 1);
        };
        row.appendChild(emailInput);
        row.appendChild(removeButton);
        return row;
    };

    membersContainer.appendChild(createMemberInputRow());

    membersGroup.appendChild(membersLabel);
    membersGroup.appendChild(membersContainer);
    membersGroup.appendChild(addMemberButton);

    form.appendChild(groupNameGroup);
    form.appendChild(descriptionGroup);
    form.appendChild(membersGroup);

    // Create Footer
    const footerContainer = createElementSafe('div');
    // TODO: Replace with simple buttons
    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn btn-secondary';
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = () => {
      modal.hide();
      modal.unmount();
    };
    const createButton = document.createElement('button');
    createButton.className = 'button button--primary';
    createButton.textContent = 'Create Group';
    createButton.onclick = async () => {
        const formData = new FormData(form);
        const memberEmails = Array.from(form.querySelectorAll('.member-email') as NodeListOf<HTMLInputElement>)
            .map(input => input.value.trim())
            .filter(email => email.length > 0);

        const groupData: CreateGroupRequest = {
            name: formData.get('groupName') as string,
            description: formData.get('groupDescription') as string,
            memberEmails: memberEmails
        };

        const newGroup = await apiService.createGroup(groupData);
        this.groups.unshift(newGroup);
        this.filteredGroups = [...this.groups];
        
        // Use granular DOM update instead of full re-render
        if (this.groups.length === 1) {
            // First group - need to replace empty state with full render
            this.render();
        } else {
            // Add to existing list
            this.addGroupToList(newGroup);
        }

        modal.hide();
        modal.unmount();
      };
    
    footerContainer.appendChild(cancelButton);
    footerContainer.appendChild(createButton);

    // TODO: Replace with simple modal
    const modal = {
      element: null as HTMLElement | null,
      show: () => {
        if (modal.element) {
          modal.element.style.display = 'block';
          document.body.style.overflow = 'hidden';
        }
      },
      hide: () => {
        if (modal.element) {
          modal.element.style.display = 'none';
          document.body.style.overflow = 'auto';
        }
      },
      unmount: () => {
        if (modal.element) {
          modal.element.remove();
          modal.element = null;
        }
      }
    };
    
    const modalElement = document.createElement('div');
    modalElement.className = 'modal';
    modalElement.style.display = 'none';
    modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Create New Group</h2>
        </div>
        <div class="modal-body"></div>
        <div class="modal-footer"></div>
      </div>
    `;
    
    const modalBody = modalElement.querySelector('.modal-body');
    const modalFooter = modalElement.querySelector('.modal-footer');
    
    if (modalBody) modalBody.appendChild(form);
    if (modalFooter) modalFooter.appendChild(footerContainer);
    
    modal.element = modalElement;
    document.body.appendChild(modalElement);
    modal.show();
  }

  private openGroupDetail(groupId: string): void {
    window.location.href = `${ROUTES.GROUP_DETAIL}?id=${groupId}`;
  }

  private async openAddExpenseModal(groupId: string): Promise<void> {
    // Navigate to add expense page instead of opening modal
    window.location.href = `add-expense.html?groupId=${groupId}`;
  }
}