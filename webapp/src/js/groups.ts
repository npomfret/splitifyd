import { logger } from './utils/logger.js';
import { createElementSafe, clearElement, appendChildren } from './utils/safe-dom.js';
import { apiService, apiCall } from './api.js';
import type { ModalComponent as ModalComponentType } from './components/modal.js';
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

// Dynamic import of ModalComponent when needed
let ModalComponent: any = null;

async function ensureModalComponent(): Promise<typeof ModalComponentType> {
  if (!ModalComponent && !window.ModalComponent) {
    const module = await import('./components/modal.js');
    ModalComponent = module.ModalComponent;
    window.ModalComponent = ModalComponent;
  }
  return window.ModalComponent || ModalComponent!;
}

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

  private renderGroupCard(group: TransformedGroup): string {
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
    const activity = createElementSafe('span', {
      className: 'group-card__activity',
      textContent: group.lastActivity
    });
    const balanceTextElement = createElementSafe('div', {
      className: `group-card__balance-text ${balanceClass}`,
      textContent: balanceText
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

    return groupCard.outerHTML;
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
    this.container.appendChild(tempDiv.firstElementChild!);
    
    const groupsGrid = createElementSafe('div', { className: 'groups-grid' });
    const tempGroupsDiv = document.createElement('div');
    tempGroupsDiv.innerHTML = groupsHtml;
    
    while (tempGroupsDiv.firstChild) {
      groupsGrid.appendChild(tempGroupsDiv.firstChild);
    }
    
    this.container.appendChild(groupsGrid);

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const createGroupBtn = document.getElementById('createGroupBtn');
    if (createGroupBtn) {
      createGroupBtn.addEventListener('click', () => {
        this.openCreateGroupModal();
      });
    }

    document.querySelectorAll('.group-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('group-card__add-expense')) {
          const groupCard = card as HTMLElement;
          const groupId = groupCard.dataset.groupId;
          if (groupId) {
            this.openGroupDetail(groupId);
          }
        }
      });
    });

    document.querySelectorAll('.group-card__add-expense').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupCard = (e.target as HTMLElement).closest('.group-card') as HTMLElement;
        const groupId = groupCard?.dataset.groupId;
        if (groupId) {
          this.openAddExpenseModal(groupId);
        }
      });
    });
  }

  private async openCreateGroupModal(): Promise<void> {
    await ensureModalComponent();
    
    if (!window.ModalComponent) {
      logger.error('ModalComponent not available');
      return;
    }

    const modalHtml = (window.ModalComponent as any).render({
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
        (window.ModalComponent as any).hide('createGroupModal');
      });
    }

    // Add event listeners to initial member row remove button
    const initialRemoveButton = document.querySelector('#membersContainer .button--icon') as HTMLButtonElement;
    if (initialRemoveButton) {
      initialRemoveButton.addEventListener('click', () => {
        const memberRow = initialRemoveButton.parentElement;
        memberRow?.remove();
        // Update remove button states after removal
        const container = document.getElementById('membersContainer');
        const remainingButtons = container?.querySelectorAll('.button--icon') as NodeListOf<HTMLButtonElement>;
        remainingButtons.forEach(btn => btn.disabled = remainingButtons.length <= 1);
      });
    }

    // Add member functionality
    const addMemberBtn = document.getElementById('addMemberBtn');
    if (addMemberBtn) {
      addMemberBtn.addEventListener('click', () => {
        const container = document.getElementById('membersContainer');
        if (!container) return;
        
        const newRow = document.createElement('div');
        newRow.className = 'member-input-row';
        newRow.innerHTML = `
          <input type="email" placeholder="Enter email address" class="form-input member-email" name="memberEmail[]">
          <button type="button" class="button--icon">×</button>
        `;
        container.appendChild(newRow);
        
        // Add event listener to the remove button
        const removeButton = newRow.querySelector('.button--icon') as HTMLButtonElement;
        removeButton.addEventListener('click', () => {
          newRow.remove();
          // Update remove button states after removal
          const remainingButtons = container.querySelectorAll('.button--icon') as NodeListOf<HTMLButtonElement>;
          remainingButtons.forEach(btn => btn.disabled = remainingButtons.length <= 1);
        });
        
        // Enable remove buttons when there are multiple rows
        const removeButtons = container.querySelectorAll('.button--icon') as NodeListOf<HTMLButtonElement>;
        removeButtons.forEach(btn => btn.disabled = removeButtons.length <= 1);
      });
    }

    const createGroupSubmit = document.getElementById('createGroupSubmit');
    if (createGroupSubmit) {
      createGroupSubmit.addEventListener('click', async () => {
        const form = document.getElementById('createGroupForm') as HTMLFormElement;
        if (!form) return;
        
        const formData = new FormData(form);
        
        // Collect member emails
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
          this.render();
          
          (window.ModalComponent as any).hide('createGroupModal');
          const modal = document.getElementById('createGroupModal');
          modal?.remove();
        } catch (error) {
          logger.error('Failed to create group:', error);
          alert('Failed to create group. Please try again.');
        }
      });
    }
  }

  private openGroupDetail(groupId: string): void {
    window.location.href = `group-detail.html?id=${groupId}`;
  }

  private async openAddExpenseModal(groupId: string): Promise<void> {
    // Navigate to add expense page instead of opening modal
    window.location.href = `add-expense.html?groupId=${groupId}`;
  }
}