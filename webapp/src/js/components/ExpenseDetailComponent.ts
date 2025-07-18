import { BaseComponent } from './base-component.js';
import { PageLayoutComponent } from './page-layout.js';
import { HeaderComponent } from './header.js';
import { NavigationComponent } from './navigation.js';
import { ModalComponent } from './modal.js';
import { ButtonComponent } from './button.js';
import { authManager } from '../auth.js';
import { apiService } from '../api.js';
import { ExpenseService } from '../expenses.js';
import { logger } from '../utils/logger.js';
import { waitForAuthManager } from '../utils/auth-utils.js';
import { showMessage } from '../utils/ui-messages.js';
import { createElementSafe, clearElement, appendChildren } from '../utils/safe-dom.js';
import { ROUTES } from '../routes.js';
import type { User } from '../types/global';
import type { Member, GroupDetail } from '../types/api';
import type { ExpenseData } from '../types/business-logic';

export class ExpenseDetailComponent extends BaseComponent<HTMLDivElement> {
    private pageLayout: PageLayoutComponent | null = null;
    private currentExpense: ExpenseData | null = null;
    private currentUser: User | null = null;
    private currentGroup: GroupDetail | null = null;
    private deleteModal: ModalComponent | null = null;
    private isLoading = false;
    private expenseId: string | null = null;

    protected render(): HTMLDivElement {
        this.initialize();

        const container = document.createElement('div');
        
        this.pageLayout = new PageLayoutComponent({
            type: 'dashboard',
            header: false,
            footer: false
        });
        
        this.pageLayout.mount(container);

        const header = new HeaderComponent({
            title: 'Expense Details',
            showLogout: true
        });
        const mainContent = this.pageLayout.getContentContainer();
        if (mainContent) {
            header.mount(mainContent);
            
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'dashboard-container';
            contentWrapper.innerHTML = this.renderContent();
            mainContent.appendChild(contentWrapper);
        }

        return container;
    }

    private async initialize(): Promise<void> {
        try {
            await waitForAuthManager();
            
            if (!authManager.getUserId()) {
                authManager.setUserId('user1');
            }

            const urlParams = new URLSearchParams(window.location.search);
            this.expenseId = urlParams.get('id');
            
            if (!this.expenseId) {
                this.showError('No expense ID provided');
                return;
            }

            await this.loadExpenseDetails(this.expenseId);
        } catch (error) {
            logger.error('Failed to initialize expense detail page:', error);
            this.showError('Failed to initialize expense details page');
        }
    }

    private renderContent(): string {
        return `
            <div class="expense-detail-container">
                <nav class="nav-header" id="nav-header">
                    <button class="button button--secondary back-button" id="backButton">
                        <i class="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                    <h1 class="page-title">Expense Details</h1>
                    <div class="header-actions">
                        <button id="edit-expense-btn" class="button button--secondary button--icon hidden">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button id="delete-expense-btn" class="button button--danger button--icon hidden">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </nav>
                
                <div class="loading" id="loading">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <p>Loading expense details...</p>
                </div>

                <div class="expense-detail-content" id="expense-detail-container" style="display: none;">
                    <div class="expense-header">
                        <div class="expense-amount">
                            <span class="currency-symbol">$</span>
                            <span id="expense-amount">0.00</span>
                        </div>
                        <div class="expense-info">
                            <h2 id="expense-description">Loading...</h2>
                            <div class="expense-meta">
                                <span class="expense-date" id="expense-date">Loading...</span>
                                <span class="expense-category" id="expense-category">Loading...</span>
                                <span class="expense-group" id="expense-group">Loading...</span>
                            </div>
                        </div>
                    </div>

                    <div class="expense-details-section">
                        <div class="detail-card">
                            <h3>Paid By</h3>
                            <div class="payer-info" id="payer-info">
                                <div class="loading-text">Loading payer info...</div>
                            </div>
                        </div>

                        <div class="detail-card">
                            <h3>Split Breakdown</h3>
                            <div class="split-breakdown" id="split-breakdown">
                                <div class="loading-text">Loading split details...</div>
                            </div>
                        </div>

                        <div class="detail-card" id="receipt-section" style="display: none;">
                            <h3>Receipt</h3>
                            <div class="receipt-container">
                                <img id="receipt-image" alt="Receipt" class="receipt-image">
                            </div>
                        </div>
                    </div>

                    <div class="error-message" id="error-message" style="display: none;">
                        <p>Failed to load expense details. Please try again.</p>
                        <button class="button button--secondary" id="retry-button">Retry</button>
                    </div>
                </div>
            </div>
        `;
    }

    protected setupEventListeners(): void {
        const editBtn = this.element?.querySelector('#edit-expense-btn') as HTMLButtonElement;
        const deleteBtn = this.element?.querySelector('#delete-expense-btn') as HTMLButtonElement;
        const retryBtn = this.element?.querySelector('#retry-button') as HTMLButtonElement;
        
        if (editBtn) {
            editBtn.addEventListener('click', () => this.editExpense());
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.showDeleteModal());
        }
        
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryLoad());
        }
    }

    private async loadExpenseDetails(expenseId: string): Promise<void> {
        try {
            this.showLoading();
            
            // Use real API to get expense details
            const expense = await ExpenseService.getExpense(expenseId);
            const user: User = { uid: authManager.getUserId()! } as User;

            // Fetch group data to get member information for ID-to-name mapping
            const groupResponse = await apiService.getGroup(expense.groupId);
            const group = groupResponse.data!;

            this.currentExpense = expense;
            this.currentUser = user;
            this.currentGroup = group;

            this.displayExpenseDetails(expense);
            this.setupPermissions(expense, user);
            this.setupNavigation(expense);
            
        } catch (error: any) {
            logger.error('Error loading expense details:', error);
            this.showError(`Failed to load expense details: ${error.message}`);
        }
    }

    private displayExpenseDetails(expense: ExpenseData): void {
        const amountEl = this.element?.querySelector('#expense-amount') as HTMLElement;
        const descriptionEl = this.element?.querySelector('#expense-description') as HTMLElement;
        const dateEl = this.element?.querySelector('#expense-date') as HTMLElement;
        const categoryEl = this.element?.querySelector('#expense-category') as HTMLElement;
        const groupEl = this.element?.querySelector('#expense-group') as HTMLElement;
        const loadingEl = this.element?.querySelector('#loading') as HTMLElement;
        const containerEl = this.element?.querySelector('#expense-detail-container') as HTMLElement;

        if (amountEl) amountEl.textContent = expense.amount.toFixed(2);
        if (descriptionEl) descriptionEl.textContent = expense.description;
        if (dateEl) dateEl.textContent = this.formatDate(expense.date || expense.createdAt);
        if (categoryEl) categoryEl.textContent = 'General';
        
        // Display group info in header
        if (groupEl && this.currentGroup) {
            groupEl.textContent = this.currentGroup.name;
        }

        this.displayPayerInfo(expense.paidBy, expense.splits);
        this.displaySplitBreakdown(expense.splits, expense.amount);
        
        // Receipt URL not available in ExpenseData type
        // if (expense.receiptUrl) {
        //     this.displayReceipt(expense.receiptUrl);
        // }

        if (loadingEl) loadingEl.style.display = 'none';
        if (containerEl) containerEl.style.display = 'block';
    }

    private displayPayerInfo(paidBy: string, splits: Array<{userId: string; amount: number}>): void {
        const payerInfoContainer = this.element?.querySelector('#payer-info') as HTMLElement;
        if (!payerInfoContainer) return;

        const payerName = this.getUserDisplayName(paidBy);
        const initials = this.getInitials(payerName);
        
        clearElement(payerInfoContainer);
        
        const userAvatar = createElementSafe('div', { className: 'user-avatar' });
        const avatarSpan = createElementSafe('span', { textContent: initials });
        userAvatar.appendChild(avatarSpan);
        
        const userDetails = createElementSafe('div', { className: 'user-details' });
        const userName = createElementSafe('span', { className: 'user-name', textContent: payerName });
        userDetails.appendChild(userName);
        
        payerInfoContainer.appendChild(userAvatar);
        payerInfoContainer.appendChild(userDetails);
    }

    private displaySplitBreakdown(splits: Array<{userId: string; amount: number}>, totalAmount: number): void {
        const splitBreakdown = this.element?.querySelector('#split-breakdown') as HTMLElement;
        if (!splitBreakdown) return;

        clearElement(splitBreakdown);

        splits.forEach(split => {
            const userId = split.userId;
            const amount = split.amount;
            const participantRow = document.createElement('div');
            participantRow.className = 'participant-row';
            
            const userName = this.getUserDisplayName(userId);
            const splitAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
            
            const participantInfo = createElementSafe('div', { className: 'participant-info' });
            const userAvatar = createElementSafe('div', { className: 'user-avatar' });
            const avatarSpan = createElementSafe('span', { textContent: this.getInitials(userName) });
            const participantName = createElementSafe('span', { className: 'participant-name', textContent: userName });
            
            userAvatar.appendChild(avatarSpan);
            participantInfo.appendChild(userAvatar);
            participantInfo.appendChild(participantName);
            
            const participantAmount = createElementSafe('div', { 
                className: 'participant-amount', 
                textContent: `$${splitAmount.toFixed(2)}`
            });
            
            appendChildren(participantRow, [participantInfo, participantAmount]);
            
            splitBreakdown.appendChild(participantRow);
        });
    }

    private displayReceipt(receiptUrl: string): void {
        const receiptSection = this.element?.querySelector('#receipt-section') as HTMLElement;
        const receiptImage = this.element?.querySelector('#receipt-image') as HTMLImageElement;
        
        if (receiptImage) receiptImage.src = receiptUrl;
        if (receiptSection) receiptSection.style.display = 'block';
    }

    private setupPermissions(expense: ExpenseData, user: User): void {
        // ExpenseData from business-logic doesn't have createdBy, assume paidBy is creator
        const isCreator = expense.paidBy === user.uid;
        const editBtn = this.element?.querySelector('#edit-expense-btn') as HTMLButtonElement;
        const deleteBtn = this.element?.querySelector('#delete-expense-btn') as HTMLButtonElement;
        
        if (isCreator) {
            if (editBtn) editBtn.classList.remove('hidden');
            if (deleteBtn) deleteBtn.classList.remove('hidden');
        }
    }

    private setupNavigation(expense: ExpenseData): void {
        const navContainer = this.element?.querySelector('#nav-header') as HTMLElement;
        if (navContainer) {
            const groupId = expense.groupId;
            const navigation = new NavigationComponent({
                title: 'Expense Details',
                backUrl: `${ROUTES.GROUP_DETAIL}?id=${groupId}`
            });
            const tempContainer = document.createElement('div');
            navigation.mount(tempContainer);
            const navElement = tempContainer.firstChild as HTMLElement;
            navContainer.replaceWith(navElement);
        }
    }

    private editExpense(): void {
        if (!this.currentExpense) return;
        
        const urlParams = new URLSearchParams({
            id: this.currentExpense.id,
            edit: 'true'
        });
        window.location.href = `add-expense.html?${urlParams.toString()}`;
    }

    private showDeleteModal(): void {
        if (!this.currentExpense) return;
        
        const bodyContent = document.createElement('div');
        bodyContent.innerHTML = `
            <p>Are you sure you want to delete this expense? This action cannot be undone.</p>
            <div class="expense-preview">
                <strong>${this.currentExpense.description}</strong>
                <span>$${this.currentExpense.amount.toFixed(2)}</span>
            </div>
        `;
        
        const footerContent = document.createElement('div');
        footerContent.className = 'modal-actions';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'button button--secondary';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => this.deleteModal?.hide());
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'button button--danger';
        deleteButton.textContent = 'Delete Expense';
        deleteButton.addEventListener('click', () => this.deleteExpense());
        
        footerContent.appendChild(cancelButton);
        footerContent.appendChild(deleteButton);
        
        this.deleteModal = new ModalComponent({
            title: 'Delete Expense',
            body: bodyContent,
            footer: footerContent
        });
        
        // Mount modal to document body
        this.deleteModal.mount(document.body);
        this.deleteModal.show();
    }

    private async deleteExpense(): Promise<void> {
        if (!this.currentExpense) return;
        
        try {
            await ExpenseService.deleteExpense(this.currentExpense.id);
            
            if (this.deleteModal) {
                this.deleteModal.hide();
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('return') ?? ROUTES.DASHBOARD;
            window.location.href = returnUrl;
            
        } catch (error: any) {
            logger.error('Error deleting expense:', error);
            showMessage('Failed to delete expense. Please try again.', 'error');
        }
    }

    private retryLoad(): void {
        if (this.expenseId) {
            this.loadExpenseDetails(this.expenseId);
        }
    }

    private getUserDisplayName(userId: string): string {
        if (!this.currentGroup || !this.currentUser) return userId;
        
        const member = this.currentGroup.members.find((m: Member) => m.uid === userId);
        if (!member) return userId;
        
        // Show "You" for current user, otherwise show the member's name
        return member.uid === this.currentUser.uid ? 'You' : member.name;
    }

    private formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    private getInitials(name: string): string {
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    private showLoading(): void {
        const loadingEl = this.element?.querySelector('#loading') as HTMLElement;
        const containerEl = this.element?.querySelector('#expense-detail-container') as HTMLElement;
        const errorEl = this.element?.querySelector('#error-message') as HTMLElement;
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (containerEl) containerEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
        
        this.isLoading = true;
    }

    private showError(message: string): void {
        const loadingEl = this.element?.querySelector('#loading') as HTMLElement;
        const containerEl = this.element?.querySelector('#expense-detail-container') as HTMLElement;
        const errorEl = this.element?.querySelector('#error-message') as HTMLElement;
        const errorTextEl = errorEl?.querySelector('p') as HTMLParagraphElement;
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (containerEl) containerEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'block';
        if (errorTextEl) errorTextEl.textContent = message;
        
        this.isLoading = false;
    }

    protected cleanup(): void {
        if (this.deleteModal) {
            this.deleteModal.hide();
            this.deleteModal.unmount();
            this.deleteModal = null;
        }
        
        this.currentExpense = null;
        this.currentUser = null;
        this.currentGroup = null;
        this.pageLayout = null;
    }
}