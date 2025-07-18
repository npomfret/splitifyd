import { BaseComponent } from './base-component.js';
import { PageLayoutComponent } from './page-layout.js';
import { HeaderComponent } from './header.js';
import { ButtonComponent } from './button.js';
import { ModalComponent } from './modal.js';
import { createElementSafe, clearElement } from '../utils/safe-dom.js';
import { authManager } from '../auth.js';
import { apiService } from '../api.js';
import { showMessage } from '../utils/ui-messages.js';
import { waitForAuthManager } from '../utils/auth-utils.js';
import { ROUTES } from '../routes.js';
import { logger } from '../utils/logger.js';
import type { GroupDetail, Member, ExpenseData, GroupBalances } from '../types/api';

interface GroupDetailComponentState {
  groupId: string | null;
  group: GroupDetail | null;
  currentUser: any;
  activeTab: 'balances' | 'expenses';
  expenses: ExpenseData[];
  expensesCursor: string | null;
  isLoadingExpenses: boolean;
  hasMoreExpenses: boolean;
  expensesLimit: number;
}

export class GroupDetailComponent extends BaseComponent<HTMLDivElement> {
  private pageLayout: PageLayoutComponent | null = null;
  private state: GroupDetailComponentState = {
    groupId: null,
    group: null,
    currentUser: null,
    activeTab: 'balances',
    expenses: [],
    expensesCursor: null,
    isLoadingExpenses: false,
    hasMoreExpenses: true,
    expensesLimit: 20
  };
  private expenseItemCleanups = new Map<HTMLElement, () => void>();
  private settingsModal: ModalComponent | null = null;
  private inviteModal: ModalComponent | null = null;

  async mount(container: HTMLElement): Promise<void> {
    try {
      await waitForAuthManager();
      
      if (!authManager.getUserId()) {
        authManager.setUserId('user1');
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      this.state.groupId = urlParams.get('id');
      
      if (!this.state.groupId) {
        window.location.href = ROUTES.DASHBOARD;
        return;
      }
      
      this.state.currentUser = null;
      await this.loadGroupDetails();
      
      super.mount(container);
    } catch (error) {
      logger.error('Failed to mount GroupDetailComponent:', error);
      throw error;
    }
  }

  protected render(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'app-container';

    const pageLayoutConfig = {
      type: 'dashboard' as const,
      children: [this.renderGroupDetail()]
    };

    this.pageLayout = new PageLayoutComponent(pageLayoutConfig);
    const layoutElement = document.createElement('div');
    this.pageLayout.mount(layoutElement);
    container.appendChild(layoutElement);
    
    return container;
  }

  private renderGroupDetail(): HTMLElement {
    const container = createElementSafe('div', {
      className: 'group-detail-container'
    });

    container.appendChild(this.renderGroupHeader());
    container.appendChild(this.renderTabNavigation());
    container.appendChild(this.renderTabContent());

    return container;
  }

  private renderGroupHeader(): HTMLElement {
    const header = createElementSafe('div', {
      className: 'group-header'
    });

    const headerTop = createElementSafe('div', {
      className: 'group-header-top'
    });

    const backButton = new ButtonComponent({
      text: 'Back',
      icon: 'fas fa-arrow-left',
      variant: 'secondary',
      onClick: () => window.location.href = ROUTES.DASHBOARD
    });

    const settingsButton = new ButtonComponent({
      icon: 'fas fa-cog',
      variant: 'secondary',
      onClick: () => this.openGroupSettingsModal()
    });

    const backButtonContainer = createElementSafe('div', { className: 'back-button' });
    backButton.mount(backButtonContainer);
    headerTop.appendChild(backButtonContainer);
    
    const settingsButtonContainer = createElementSafe('div', { className: 'settings-button' });
    settingsButton.mount(settingsButtonContainer);
    headerTop.appendChild(settingsButtonContainer);
    
    header.appendChild(headerTop);

    const groupInfo = createElementSafe('div', {
      className: 'group-info'
    });

    const groupInfoLeft = createElementSafe('div', {
      className: 'group-info-left'
    });

    const groupIcon = createElementSafe('div', {
      className: 'group-icon-large'
    });
    const icon = createElementSafe('i', {
      className: 'fas fa-users'
    });
    groupIcon.appendChild(icon);

    const groupDetails = createElementSafe('div', {
      className: 'group-details'
    });

    const groupName = createElementSafe('h2', {
      className: 'group-name',
      textContent: this.state.group?.name || 'Loading...'
    });

    const membersPreview = createElementSafe('div', {
      className: 'group-members-preview'
    });

    const membersAvatars = createElementSafe('div', {
      className: 'members-avatars'
    });

    if (this.state.group) {
      const maxVisibleMembers = 4;
      this.state.group.members.slice(0, maxVisibleMembers).forEach((member, index) => {
        const avatar = createElementSafe('div', {
          className: 'member-avatar',
          textContent: member.name.charAt(0).toUpperCase(),
          title: member.name
        });
        avatar.style.zIndex = String(maxVisibleMembers - index);
        membersAvatars.appendChild(avatar);
      });
    }

    const membersCount = createElementSafe('span', {
      className: 'members-count',
      textContent: this.state.group ? `${this.state.group.members.length} members` : ''
    });

    membersPreview.appendChild(membersAvatars);
    membersPreview.appendChild(membersCount);
    groupDetails.appendChild(groupName);
    groupDetails.appendChild(membersPreview);
    groupInfoLeft.appendChild(groupIcon);
    groupInfoLeft.appendChild(groupDetails);

    const quickActions = createElementSafe('div', {
      className: 'quick-actions'
    });

    const addExpenseBtn = new ButtonComponent({
      text: 'Add Expense',
      icon: 'fas fa-plus',
      variant: 'primary',
      onClick: () => window.location.href = `add-expense.html?groupId=${this.state.groupId}`
    });

    const inviteBtn = new ButtonComponent({
      text: 'Invite',
      icon: 'fas fa-user-plus',
      variant: 'secondary',
      onClick: () => this.showInviteMembersModal()
    });

    const addExpenseBtnContainer = createElementSafe('div');
    addExpenseBtn.mount(addExpenseBtnContainer);
    quickActions.appendChild(addExpenseBtnContainer);
    
    const inviteBtnContainer = createElementSafe('div');
    inviteBtn.mount(inviteBtnContainer);
    quickActions.appendChild(inviteBtnContainer);

    groupInfo.appendChild(groupInfoLeft);
    groupInfo.appendChild(quickActions);
    header.appendChild(groupInfo);

    return header;
  }

  private renderTabNavigation(): HTMLElement {
    const nav = createElementSafe('div', {
      className: 'tab-navigation'
    });

    const balancesTab = createElementSafe('button', {
      className: `tab-button ${this.state.activeTab === 'balances' ? 'active' : ''}`,
      innerHTML: '<i class="fas fa-balance-scale"></i> Balances'
    });
    balancesTab.addEventListener('click', () => this.switchTab('balances'));

    const expensesTab = createElementSafe('button', {
      className: `tab-button ${this.state.activeTab === 'expenses' ? 'active' : ''}`,
      innerHTML: '<i class="fas fa-receipt"></i> Expenses'
    });
    expensesTab.addEventListener('click', () => this.switchTab('expenses'));

    nav.appendChild(balancesTab);
    nav.appendChild(expensesTab);

    return nav;
  }

  private renderTabContent(): HTMLElement {
    const content = createElementSafe('div', {
      className: 'tab-content'
    });

    if (this.state.activeTab === 'balances') {
      content.appendChild(this.renderBalancesTab());
    } else {
      content.appendChild(this.renderExpensesTab());
    }

    return content;
  }

  private renderBalancesTab(): HTMLElement {
    const tab = createElementSafe('div', {
      className: 'tab-pane active'
    });

    const section = createElementSafe('div', {
      className: 'balance-summary-section'
    });

    const title = createElementSafe('h3', {
      textContent: 'Group Balances'
    });

    const balanceSummary = createElementSafe('div', {
      className: 'balance-summary',
      id: 'balanceSummary'
    });

    const simplifiedSection = createElementSafe('div', {
      className: 'simplified-debts-section'
    });

    const simplifiedTitle = createElementSafe('h4', {
      textContent: 'Simplified Debts'
    });

    const simplifiedDebts = createElementSafe('div', {
      className: 'simplified-debts',
      id: 'simplifiedDebts'
    });

    section.appendChild(title);
    section.appendChild(balanceSummary);
    simplifiedSection.appendChild(simplifiedTitle);
    simplifiedSection.appendChild(simplifiedDebts);
    section.appendChild(simplifiedSection);
    tab.appendChild(section);

    this.loadBalances();

    return tab;
  }

  private renderExpensesTab(): HTMLElement {
    const tab = createElementSafe('div', {
      className: 'tab-pane active'
    });

    const header = createElementSafe('div', {
      className: 'expenses-header'
    });

    const title = createElementSafe('h3', {
      textContent: 'Group Expenses'
    });

    const expensesList = createElementSafe('div', {
      className: 'expenses-list',
      id: 'expensesList'
    });

    const loadMoreContainer = createElementSafe('div', {
      className: 'load-more-container hidden',
      id: 'loadMoreContainer'
    });

    const loadMoreBtn = new ButtonComponent({
      text: 'Load More',
      variant: 'secondary',
      onClick: () => this.loadMoreExpenses()
    });

    const loadMoreBtnContainer = createElementSafe('div');
    loadMoreBtn.mount(loadMoreBtnContainer);
    loadMoreContainer.appendChild(loadMoreBtnContainer);

    header.appendChild(title);
    tab.appendChild(header);
    tab.appendChild(expensesList);
    tab.appendChild(loadMoreContainer);

    if (this.state.expenses.length === 0 && !this.state.isLoadingExpenses) {
      this.loadGroupExpenses();
    }

    return tab;
  }

  private async switchTab(tab: 'balances' | 'expenses'): Promise<void> {
    this.state.activeTab = tab;
    
    const tabContent = this.element?.querySelector('.tab-content');
    if (tabContent) {
      clearElement(tabContent as HTMLElement);
      if (tab === 'balances') {
        tabContent.appendChild(this.renderBalancesTab());
      } else {
        tabContent.appendChild(this.renderExpensesTab());
      }
    }

    const tabButtons = this.element?.querySelectorAll('.tab-button');
    tabButtons?.forEach(btn => {
      btn.classList.remove('active');
      if (btn.textContent?.toLowerCase().includes(tab)) {
        btn.classList.add('active');
      }
    });
  }

  private async loadGroupDetails(): Promise<void> {
    try {
      const response = await apiService.getGroup(this.state.groupId!);
      this.state.group = response.data!;
      
      if (this.element) {
        this.updateGroupHeader();
      }
    } catch (error) {
      logger.error('Error loading group details:', error);
      showMessage('Failed to load group details', 'error');
    }
  }

  private updateGroupHeader(): void {
    if (!this.state.group || !this.element) return;

    const groupName = this.element.querySelector('.group-name');
    if (groupName) {
      groupName.textContent = this.state.group.name;
    }

    const membersCount = this.element.querySelector('.members-count');
    if (membersCount) {
      membersCount.textContent = `${this.state.group.members.length} members`;
    }
  }

  private async loadBalances(): Promise<void> {
    const balanceSummary = document.getElementById('balanceSummary');
    const simplifiedDebts = document.getElementById('simplifiedDebts');
    
    if (!balanceSummary || !simplifiedDebts) return;

    try {
      const response = await apiService.getGroupBalances(this.state.groupId!);
      const balances = response.data!;
      const userBalances = (balances as any).userBalances;
      const serverSimplifiedDebts = (balances as any).simplifiedDebts;
      
      clearElement(balanceSummary);
      clearElement(simplifiedDebts);
      
      if (!userBalances || Object.keys(userBalances).length === 0) {
        const settledMsg = createElementSafe('p', { 
          className: 'no-data', 
          textContent: 'All settled up!' 
        });
        balanceSummary.appendChild(settledMsg);
        
        const noDebtsMsg = createElementSafe('p', { 
          className: 'no-data', 
          textContent: 'No outstanding debts' 
        });
        simplifiedDebts.appendChild(noDebtsMsg);
        return;
      }
      
      this.displayUserBalances(userBalances, balanceSummary);
      this.displaySimplifiedDebts(serverSimplifiedDebts, simplifiedDebts);
      
    } catch (error) {
      logger.error('Error loading balances:', error);
      clearElement(balanceSummary);
      const errorMsg = createElementSafe('p', { 
        className: 'error', 
        textContent: 'Failed to load balances' 
      });
      balanceSummary.appendChild(errorMsg);
    }
  }

  private displayUserBalances(balances: any, container: HTMLElement): void {
    const currentUserId = authManager.getUserId();
    
    Object.values(balances).forEach((userBalance: any) => {
      const balanceCard = createElementSafe('div', {
        className: 'balance-card'
      });
      
      const isCurrentUser = userBalance.userId === currentUserId;
      const balanceClass = userBalance.netBalance > 0 ? 'positive' : 
                          userBalance.netBalance < 0 ? 'negative' : 'neutral';
      
      const displayName = isCurrentUser ? 'You' : userBalance.name;
      
      const balanceUser = createElementSafe('div', {
        className: 'balance-user'
      });
      
      const memberAvatar = createElementSafe('div', {
        className: 'member-avatar',
        textContent: userBalance.name.charAt(0).toUpperCase()
      });
      
      const userName = createElementSafe('span', {
        className: 'user-name',
        textContent: displayName
      });
      
      const balanceAmount = createElementSafe('div', {
        className: `balance-amount ${balanceClass}`,
        textContent: `${userBalance.netBalance >= 0 ? '+' : ''}$${Math.abs(userBalance.netBalance).toFixed(2)}`
      });
      
      balanceUser.appendChild(memberAvatar);
      balanceUser.appendChild(userName);
      balanceCard.appendChild(balanceUser);
      balanceCard.appendChild(balanceAmount);
      
      container.appendChild(balanceCard);
    });
  }

  private displaySimplifiedDebts(simplified: any[], container: HTMLElement): void {
    clearElement(container);
    
    if (simplified.length === 0) {
      const settledMsg = createElementSafe('p', { 
        className: 'no-data', 
        textContent: 'All settled up!' 
      });
      container.appendChild(settledMsg);
      return;
    }
    
    const currentUserId = authManager.getUserId();
    
    simplified.forEach(debt => {
      const debtItem = createElementSafe('div', {
        className: 'debt-item'
      });
      
      const fromName = debt.from.userId === currentUserId ? 'You' : debt.from.name;
      const toName = debt.to.userId === currentUserId ? 'you' : debt.to.name;
      
      const debtDescription = createElementSafe('div', {
        className: 'debt-description'
      });
      
      const debtFrom = createElementSafe('span', {
        className: 'debt-from',
        textContent: fromName
      });
      
      const arrow = createElementSafe('i', {
        className: 'fas fa-arrow-right'
      });
      
      const debtTo = createElementSafe('span', {
        className: 'debt-to',
        textContent: toName
      });
      
      const debtAmount = createElementSafe('div', {
        className: 'debt-amount',
        textContent: `$${debt.amount.toFixed(2)}`
      });
      
      debtDescription.appendChild(debtFrom);
      debtDescription.appendChild(arrow);
      debtDescription.appendChild(debtTo);
      debtItem.appendChild(debtDescription);
      debtItem.appendChild(debtAmount);
      
      container.appendChild(debtItem);
    });
  }

  private async loadGroupExpenses(): Promise<void> {
    if (this.state.isLoadingExpenses) return;
    
    const expensesList = document.getElementById('expensesList');
    if (!expensesList) return;
    
    this.state.isLoadingExpenses = true;
    
    if (this.state.expensesCursor === null) {
      Array.from(expensesList.children).forEach(child => {
        const cleanupFn = this.expenseItemCleanups.get(child as HTMLElement);
        if (cleanupFn) {
          cleanupFn();
          this.expenseItemCleanups.delete(child as HTMLElement);
        }
      });
      clearElement(expensesList);
      this.showLoadingSpinner(expensesList);
    }
    
    try {
      const response = await apiService.getGroupExpenses(
        this.state.groupId!,
        this.state.expensesLimit,
        this.state.expensesCursor || undefined
      );
      
      if (this.state.expensesCursor === null) {
        clearElement(expensesList);
      }
      
      const expenses = response.expenses || [];
      this.state.expenses.push(...expenses);
      
      if (expenses.length === 0 && this.state.expensesCursor === null) {
        const noExpenses = createElementSafe('p', {
          className: 'no-data',
          textContent: 'No expenses yet'
        });
        expensesList.appendChild(noExpenses);
      } else {
        expenses.forEach((expense: ExpenseData) => {
          const expenseItem = this.createExpenseItem(expense);
          expensesList.appendChild(expenseItem);
        });
      }
      
      this.state.expensesCursor = response.cursor || null;
      this.state.hasMoreExpenses = !!response.cursor;
      
      const loadMoreContainer = document.getElementById('loadMoreContainer');
      if (loadMoreContainer) {
        if (this.state.hasMoreExpenses) {
          loadMoreContainer.classList.remove('hidden');
        } else {
          loadMoreContainer.classList.add('hidden');
        }
      }
      
    } catch (error) {
      logger.error('Error loading expenses:', error);
      if (this.state.expensesCursor === null) {
        clearElement(expensesList);
        const errorMsg = createElementSafe('p', {
          className: 'error',
          textContent: 'Failed to load expenses'
        });
        expensesList.appendChild(errorMsg);
      }
    } finally {
      this.state.isLoadingExpenses = false;
    }
  }

  private async loadMoreExpenses(): Promise<void> {
    await this.loadGroupExpenses();
  }

  private createExpenseItem(expense: ExpenseData): HTMLElement {
    const expenseItem = createElementSafe('div', {
      className: 'expense-item'
    });

    const expenseInfo = createElementSafe('div', {
      className: 'expense-info'
    });

    const expenseHeader = createElementSafe('div', {
      className: 'expense-header'
    });

    const expenseTitle = createElementSafe('h4', {
      className: 'expense-title',
      textContent: expense.description
    });

    const expenseAmount = createElementSafe('span', {
      className: 'expense-amount',
      textContent: `$${expense.amount.toFixed(2)}`
    });

    const expenseDetails = createElementSafe('div', {
      className: 'expense-details'
    });

    const paidBy = createElementSafe('span', {
      className: 'paid-by',
      textContent: `Paid by ${expense.paidBy === authManager.getUserId() ? 'You' : 
        this.state.group?.members.find(m => (m as any).userId === expense.paidBy)?.name || 'Unknown'}`
    });

    const expenseDate = createElementSafe('span', {
      className: 'expense-date',
      textContent: new Date(expense.createdAt).toLocaleDateString()
    });

    expenseHeader.appendChild(expenseTitle);
    expenseHeader.appendChild(expenseAmount);
    expenseDetails.appendChild(paidBy);
    expenseDetails.appendChild(expenseDate);
    expenseInfo.appendChild(expenseHeader);
    expenseInfo.appendChild(expenseDetails);
    expenseItem.appendChild(expenseInfo);

    const clickHandler = () => {
      window.location.href = `expense-detail.html?id=${expense.id}`;
    };

    expenseItem.addEventListener('click', clickHandler);
    expenseItem.style.cursor = 'pointer';

    this.expenseItemCleanups.set(expenseItem, () => {
      expenseItem.removeEventListener('click', clickHandler);
    });

    return expenseItem;
  }

  private showLoadingSpinner(container: HTMLElement): void {
    const spinner = createElementSafe('div', {
      className: 'loading-spinner',
      innerHTML: '<i class="fas fa-spinner fa-spin"></i>'
    });
    container.appendChild(spinner);
  }

  private openGroupSettingsModal(): void {
    if (!this.state.group) return;

    const modalBody = createElementSafe('div');
    
    const nameGroup = createElementSafe('div', {
      className: 'form-group'
    });
    
    const nameLabel = createElementSafe('label', {
      textContent: 'Group Name',
      htmlFor: 'editGroupName'
    });
    
    const nameInput = createElementSafe('input', {
      type: 'text',
      className: 'form-control',
      id: 'editGroupName'
    }) as HTMLInputElement;
    nameInput.value = this.state.group.name;
    nameInput.required = true;
    
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    modalBody.appendChild(nameGroup);

    const membersGroup = createElementSafe('div', {
      className: 'form-group'
    });
    
    const membersLabel = createElementSafe('label', {
      textContent: 'Members'
    });
    
    const membersList = createElementSafe('div', {
      className: 'members-management-list'
    });
    
    this.state.group.members.forEach(member => {
      const memberItem = createElementSafe('div', {
        className: 'member-item'
      });
      
      const memberInfo = createElementSafe('div', {
        className: 'member-info'
      });
      
      const avatar = createElementSafe('div', {
        className: 'member-avatar',
        textContent: member.name.charAt(0).toUpperCase()
      });
      
      const name = createElementSafe('span', {
        className: 'member-name',
        textContent: member.name
      });
      
      memberInfo.appendChild(avatar);
      memberInfo.appendChild(name);
      memberItem.appendChild(memberInfo);
      
      if ((member as any).userId !== authManager.getUserId() && this.state.group?.createdBy === authManager.getUserId()) {
        const removeBtn = new ButtonComponent({
          text: 'Remove',
          variant: 'secondary',
          size: 'small',
          onClick: () => this.removeMember((member as any).userId)
        });
        const removeBtnContainer = createElementSafe('div');
        removeBtn.mount(removeBtnContainer);
        memberItem.appendChild(removeBtnContainer);
      }
      
      membersList.appendChild(memberItem);
    });
    
    membersGroup.appendChild(membersLabel);
    membersGroup.appendChild(membersList);
    modalBody.appendChild(membersGroup);

    const dangerZone = createElementSafe('div', {
      className: 'danger-zone'
    });
    
    const dangerTitle = createElementSafe('h4', {
      textContent: 'Danger Zone'
    });
    
    const deleteBtn = new ButtonComponent({
      text: 'Delete Group',
      icon: 'fas fa-trash',
      variant: 'danger',
      onClick: () => this.deleteGroup()
    });
    
    const deleteBtnContainer = createElementSafe('div');
    deleteBtn.mount(deleteBtnContainer);
    
    dangerZone.appendChild(dangerTitle);
    dangerZone.appendChild(deleteBtnContainer);
    modalBody.appendChild(dangerZone);

    const modalFooter = createElementSafe('div', {
      className: 'modal-footer'
    });
    
    const cancelBtn = new ButtonComponent({
      text: 'Cancel',
      variant: 'secondary',
      onClick: () => this.settingsModal?.hide()
    });
    
    const saveBtn = new ButtonComponent({
      text: 'Save Changes',
      variant: 'primary',
      onClick: () => this.saveGroupSettings(nameInput)
    });
    
    const cancelBtnContainer = createElementSafe('div');
    cancelBtn.mount(cancelBtnContainer);
    modalFooter.appendChild(cancelBtnContainer);
    
    const saveBtnContainer = createElementSafe('div');
    saveBtn.mount(saveBtnContainer);
    modalFooter.appendChild(saveBtnContainer);

    this.settingsModal = new ModalComponent({
      id: 'groupSettingsModal',
      title: 'Group Settings',
      body: modalBody,
      footer: modalFooter,
      closeButton: true
    });

    this.settingsModal.mount(document.body);
    this.settingsModal.show();
  }

  private async saveGroupSettings(nameInput: HTMLInputElement): Promise<void> {
    const newName = nameInput.value.trim();
    
    if (!newName) {
      showMessage('Group name is required', 'error');
      return;
    }
    
    try {
      await apiService.updateGroup(this.state.groupId!, { name: newName });
      this.state.group!.name = newName;
      this.updateGroupHeader();
      this.settingsModal?.hide();
      showMessage('Group settings updated', 'success');
    } catch (error) {
      logger.error('Failed to update group:', error);
      showMessage('Failed to update group settings', 'error');
    }
  }

  private async removeMember(userId: string): Promise<void> {
    try {
      // TODO: Add removeGroupMember to apiService
      // await apiService.removeGroupMember(this.state.groupId!, userId);
      await this.loadGroupDetails();
      this.settingsModal?.hide();
      this.openGroupSettingsModal();
      showMessage('Member removal not yet implemented', 'info');
    } catch (error) {
      logger.error('Failed to remove member:', error);
      showMessage('Failed to remove member', 'error');
    }
  }

  private async deleteGroup(): Promise<void> {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }
    
    try {
      await apiService.deleteGroup(this.state.groupId!);
      window.location.href = ROUTES.DASHBOARD;
    } catch (error) {
      logger.error('Failed to delete group:', error);
      showMessage('Failed to delete group', 'error');
    }
  }

  private showInviteMembersModal(): void {
    const modalBody = createElementSafe('div');
    
    const emailGroup = createElementSafe('div', {
      className: 'form-group'
    });
    
    const emailLabel = createElementSafe('label', {
      textContent: 'Email Address',
      htmlFor: 'inviteEmail'
    });
    
    const emailInput = createElementSafe('input', {
      type: 'email',
      className: 'form-control',
      id: 'inviteEmail',
      placeholder: 'friend@example.com'
    }) as HTMLInputElement;
    emailInput.required = true;
    
    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(emailInput);
    modalBody.appendChild(emailGroup);
    
    const errorDiv = createElementSafe('div', {
      className: 'error-message hidden',
      id: 'inviteError'
    });
    
    const successDiv = createElementSafe('div', {
      className: 'success-message hidden',
      id: 'inviteSuccess'
    });
    
    modalBody.appendChild(errorDiv);
    modalBody.appendChild(successDiv);

    const modalFooter = createElementSafe('div', {
      className: 'modal-footer'
    });
    
    const cancelBtn = new ButtonComponent({
      text: 'Cancel',
      variant: 'secondary',
      onClick: () => this.inviteModal?.hide()
    });
    
    const sendBtn = new ButtonComponent({
      text: 'Send Invite',
      variant: 'primary',
      onClick: () => this.sendInvite(emailInput, errorDiv, successDiv)
    });
    
    const cancelBtnContainer = createElementSafe('div');
    cancelBtn.mount(cancelBtnContainer);
    modalFooter.appendChild(cancelBtnContainer);
    
    const sendBtnContainer = createElementSafe('div');
    sendBtn.mount(sendBtnContainer);
    modalFooter.appendChild(sendBtnContainer);

    this.inviteModal = new ModalComponent({
      id: 'inviteMembersModal',
      title: 'Invite Members',
      body: modalBody,
      footer: modalFooter,
      closeButton: true
    });

    this.inviteModal.mount(document.body);
    this.inviteModal.show();
  }

  private async sendInvite(emailInput: HTMLInputElement, errorDiv: HTMLElement, successDiv: HTMLElement): Promise<void> {
    const email = emailInput.value.trim();
    
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    if (!email) {
      errorDiv.textContent = 'Please enter an email address';
      errorDiv.classList.remove('hidden');
      return;
    }
    
    try {
      // TODO: Add inviteToGroup to apiService
      // await apiService.inviteToGroup(this.state.groupId!, email);
      successDiv.textContent = 'Invite functionality not yet implemented';
      successDiv.classList.remove('hidden');
      emailInput.value = '';
      
      setTimeout(() => {
        this.inviteModal?.hide();
      }, 2000);
    } catch (error) {
      logger.error('Failed to send invite:', error);
      errorDiv.textContent = 'Failed to send invitation';
      errorDiv.classList.remove('hidden');
    }
  }

  protected cleanup(): void {
    this.expenseItemCleanups.forEach(cleanup => cleanup());
    this.expenseItemCleanups.clear();
    
    if (this.settingsModal) {
      this.settingsModal.unmount();
      this.settingsModal = null;
    }
    
    if (this.inviteModal) {
      this.inviteModal.unmount();
      this.inviteModal = null;
    }
    
    if (this.pageLayout) {
      this.pageLayout.unmount();
      this.pageLayout = null;
    }
    
    super.cleanup();
  }
}