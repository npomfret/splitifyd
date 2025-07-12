import { logger } from './utils/logger.js';
import { createElementSafe, clearElement, appendChildren } from './utils/safe-dom.js';
import { apiService, apiCall } from './api.js';
import { ModalComponent } from './components/modal.js';
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

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Container element with ID '${containerId}' not found`);
    }
    this.container = element;
  }

  async loadGroups(): Promise<void> {
    this.setLoading(true);
    
    try {
      this.groups = await apiService.getGroups();
      this.filteredGroups = [...this.groups];
      this.render();
    } catch (error) {
      logger.error('Error loading groups:', error);
      this.renderError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.setLoading(false);
    }
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
    // Log error details to console
    logger.error('Failed to load groups:', message);
    
    clearElement(this.container);
    
    const errorState = createElementSafe('div', { className: 'error-state' });
    const title = createElementSafe('h3', { textContent: 'Unable to load groups' });
    const actions = createElementSafe('div', { className: 'error-state__actions' });
    
    const tryAgainBtn = createElementSafe('button', {
      className: 'button button--secondary',
      textContent: 'Try Again'
    }) as HTMLButtonElement;
    tryAgainBtn.type = 'button';
    tryAgainBtn.addEventListener('click', () => this.loadGroups());
    
    const createGroupBtn = createElementSafe('button', {
      id: 'createGroupBtn',
      className: 'button button--primary',
      textContent: 'Create Group'
    }) as HTMLButtonElement;
    createGroupBtn.type = 'button';
    createGroupBtn.addEventListener('click', () => this.openCreateGroupModal());
    
    appendChildren(actions, [tryAgainBtn, createGroupBtn]);
    appendChildren(errorState, [title, actions]);
    this.container.appendChild(errorState);
  }

  private renderEmpty(): void {
    clearElement(this.container);
    
    const emptyState = createElementSafe('div', { className: 'empty-state' });
    const icon = createElementSafe('div', { className: 'empty-state__icon', textContent: '📝' });
    const title = createElementSafe('h3', { textContent: 'No groups yet' });
    const description = createElementSafe('p', { textContent: 'Create your first group to start splitting expenses with friends' });
    
    const createGroupBtn = createElementSafe('button', {
      id: 'createGroupBtn',
      className: 'button button--primary',
      textContent: 'Create Your First Group'
    }) as HTMLButtonElement;
    createGroupBtn.type = 'button';
    createGroupBtn.addEventListener('click', () => this.openCreateGroupModal());
    
    appendChildren(emptyState, [icon, title, description, createGroupBtn]);
    this.container.appendChild(emptyState);
  }

  private renderGroupCard(group: TransformedGroup): HTMLElement {
    const balanceClass = group.yourBalance >= 0 ? 'balance--positive' : 'balance--negative';
    const balanceText = group.yourBalance >= 0 ? 'you are owed' : 'you owe';
    
    const groupCard = createElementSafe('div', {
      className: 'group-card',
      'data-group-id': group.id,
      'data-id': group.id
    });

    const header = createElementSafe('div', { className: 'group-card__header' });
    const nameElement = createElementSafe('h4', { className: 'group-card__name' });
    nameElement.textContent = group.name;
    
    if (group.expenseCount) {
      const expenseCountSpan = createElementSafe('span', { className: 'expense-count' });
      expenseCountSpan.textContent = ` (${group.expenseCount})`;
      nameElement.appendChild(expenseCountSpan);
    }

    header.appendChild(nameElement);
    
    // Only show balance element if it's not zero
    if (group.yourBalance !== 0) {
      const balanceElement = createElementSafe('div', { 
        className: `group-card__balance ${balanceClass}`,
        textContent: `$${Math.abs(group.yourBalance).toFixed(2)}`
      });
      header.appendChild(balanceElement);
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

    // TODO: Fix lastExpense type mismatch - api.d.ts has it as string | null
    // if (group.lastExpense) {
    //   const lastExpenseSection = createElementSafe('div', { className: 'group-card__last-expense' });
    //   const description = createElementSafe('span', {
    //     className: 'last-expense__description',
    //     textContent: group.lastExpense.description
    //   });
    //   const amount = createElementSafe('span', {
    //     className: 'last-expense__amount',
    //     textContent: `$${group.lastExpense.amount.toFixed(2)}`
    //   });
    //   
    //   lastExpenseSection.appendChild(description);
    //   lastExpenseSection.appendChild(amount);
    //   groupCard.appendChild(lastExpenseSection);
    // }

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
    
    // Show balance status with amount
    let balanceDisplayText = '';
    if (group.yourBalance === 0) {
      balanceDisplayText = 'settled up';
    } else if (group.yourBalance > 0) {
      balanceDisplayText = `you are owed $${Math.abs(group.yourBalance).toFixed(2)}`;
    } else {
      balanceDisplayText = `you owe $${Math.abs(group.yourBalance).toFixed(2)}`;
    }
    
    const balanceTextElement = createElementSafe('div', {
      className: `group-card__balance-text ${balanceClass}`,
      textContent: balanceDisplayText
    });

    footer.appendChild(activity);
    footer.appendChild(balanceTextElement);

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

    clearElement(this.container);
    
    // Add summary box
    const dashboardSummary = createElementSafe('div', { className: 'dashboard-summary' });
    const balancesContainer = createElementSafe('div', { className: 'dashboard-summary__balances' });
    
    const positiveBalance = createElementSafe('div', { className: 'balance-summary balance-summary--positive' });
    const positiveLabel = createElementSafe('span', { className: 'balance-summary__label', textContent: 'You are owed' });
    const positiveAmount = createElementSafe('span', { className: 'balance-summary__amount', textContent: `$${totalOwed.toFixed(2)}` });
    appendChildren(positiveBalance, [positiveLabel, positiveAmount]);
    
    const negativeBalance = createElementSafe('div', { className: 'balance-summary balance-summary--negative' });
    const negativeLabel = createElementSafe('span', { className: 'balance-summary__label', textContent: 'You owe' });
    const negativeAmount = createElementSafe('span', { className: 'balance-summary__amount', textContent: `$${totalOwe.toFixed(2)}` });
    appendChildren(negativeBalance, [negativeLabel, negativeAmount]);
    
    appendChildren(balancesContainer, [positiveBalance, negativeBalance]);
    dashboardSummary.appendChild(balancesContainer);
    this.container.appendChild(dashboardSummary);
    
    // Add groups header
    const groupsHeader = createElementSafe('div', { className: 'groups-header' });
    const headerTitle = createElementSafe('h2', { className: 'groups-header__title', textContent: 'Your Groups' });
    const createGroupBtn = createElementSafe('button', {
      type: 'button',
      className: 'button button--primary',
      id: 'createGroupBtn',
      textContent: '+ Create Group'
    });
    appendChildren(groupsHeader, [headerTitle, createGroupBtn]);
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
    const addMemberButton = createElementSafe('button', { type: 'button', className: 'button button--small', id: 'addMemberBtn', textContent: '+ Add Another Member' });

    const createMemberInputRow = () => {
        const row = createElementSafe('div', { className: 'member-input-row' });
        const emailInput = createElementSafe('input', { type: 'email', placeholder: 'Enter email address', className: 'form-input member-email', name: 'memberEmail[]' });
        const removeButton = createElementSafe('button', { type: 'button', className: 'button--icon', textContent: '×' }) as HTMLButtonElement;
        removeButton.addEventListener('click', () => {
            row.remove();
            const remainingButtons = membersContainer.querySelectorAll('.button--icon') as NodeListOf<HTMLButtonElement>;
            remainingButtons.forEach(btn => btn.disabled = remainingButtons.length <= 1);
        });
        row.appendChild(emailInput);
        row.appendChild(removeButton);
        return row;
    };

    membersContainer.appendChild(createMemberInputRow());

    addMemberButton.addEventListener('click', () => {
        membersContainer.appendChild(createMemberInputRow());
        const removeButtons = membersContainer.querySelectorAll('.button--icon') as NodeListOf<HTMLButtonElement>;
        removeButtons.forEach(btn => btn.disabled = removeButtons.length <= 1);
    });

    membersGroup.appendChild(membersLabel);
    membersGroup.appendChild(membersContainer);
    membersGroup.appendChild(addMemberButton);

    form.appendChild(groupNameGroup);
    form.appendChild(descriptionGroup);
    form.appendChild(membersGroup);

    // Create Footer
    const footerContainer = createElementSafe('div');
    const cancelButton = createElementSafe('button', { className: 'button button--secondary', textContent: 'Cancel' });
    const createButton = createElementSafe('button', { className: 'button button--primary', textContent: 'Create Group' });
    footerContainer.appendChild(cancelButton);
    footerContainer.appendChild(createButton);

    const modal = new ModalComponent({
        id: modalId,
        title: 'Create New Group',
        body: form,
        footer: footerContainer
    });

    modal.mount(document.body);
    modal.show();

    cancelButton.addEventListener('click', () => {
        modal.hide();
        modal.unmount();
    });

    createButton.addEventListener('click', async () => {
        const formData = new FormData(form);
        const memberEmails = Array.from(form.querySelectorAll('.member-email') as NodeListOf<HTMLInputElement>)
            .map(input => input.value.trim())
            .filter(email => email.length > 0);

        try {
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
        } catch (error) {
            logger.error('Failed to create group:', error);
            alert('Failed to create group. Please try again.');
        }
    });
  }

  private openGroupDetail(groupId: string): void {
    window.location.href = `group-detail.html?id=${groupId}`;
  }

  private async openAddExpenseModal(groupId: string): Promise<void> {
    // Navigate to add expense page instead of opening modal
    window.location.href = `add-expense.html?groupId=${groupId}`;
  }
}