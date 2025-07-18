import { BaseComponent } from './base-component.js';
import { logger } from '../utils/logger.js';
import { AppInit } from '../app-init.js';
import { apiService } from '../api.js';
import { showMessage } from '../utils/ui-messages.js';
import { ROUTES } from '../routes.js';

export class JoinGroupComponent extends BaseComponent<HTMLDivElement> {
    private linkId: string | null = null;

    constructor() {
        super();
    }

    protected render(): HTMLDivElement {
        const container = document.createElement('div');
        container.innerHTML = `
            <div id="warningBanner" class="warning-banner hidden"></div>
            <div class="main-content">
                <main class="auth-container">
                    <article class="auth-card">
                        <header class="auth-card__header">
                            <h1 class="auth-card__title">
                                <a href="/index.html" class="auth-card__title-link">Bill Splitter</a>
                            </h1>
                            <p class="auth-card__subtitle">Joining group...</p>
                        </header>
                        
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                        
                        <p class="auth-card__text">Please wait while we process your request.</p>
                    </article>
                </main>
            </div>
        `;
        return container;
    }

    protected setupEventListeners(): void {
        this.initializeJoinGroup();
    }

    private async initializeJoinGroup(): Promise<void> {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            this.linkId = urlParams.get('linkId');
            
            if (!this.linkId) {
                window.location.href = ROUTES.DASHBOARD;
                return;
            }
            
            // Store the linkId for after authentication
            sessionStorage.setItem('pendingJoinLinkId', this.linkId);
            
            await AppInit.initialize({
                requireAuth: true,
                onAuthStateChanged: async (user) => {
                    if (user) {
                        await this.processJoinGroup();
                    } else {
                        // User needs to log in first
                        window.location.href = `index.html?join=${this.linkId}`;
                    }
                }
            });
        } catch (error) {
            logger.error('Error initializing join group:', error);
            this.showErrorState('Failed to initialize. Please try again.');
        }
    }

    private async processJoinGroup(): Promise<void> {
        if (!this.linkId) return;

        try {
            this.updateLoadingState('Joining group...');
            
            const response = await apiService.joinGroupByLink(this.linkId);
            
            if (response.success && response.data) {
                sessionStorage.removeItem('pendingJoinLinkId');
                
                // Show success message
                showMessage(`Successfully joined ${response.data.groupName}!`, 'success');
                
                setTimeout(() => {
                    window.location.href = `${ROUTES.GROUP_DETAIL}?id=${response.data.groupId}`;
                }, 1500);
            }
        } catch (error) {
            logger.error('Error joining group:', error);
            
            const errorMessage = error instanceof Error ? error.message : '';
            if (errorMessage.includes('already a member')) {
                this.showErrorState('You are already a member of this group');
                setTimeout(() => {
                    window.location.href = ROUTES.DASHBOARD;
                }, 2000);
            } else if (errorMessage.includes('Invalid or expired')) {
                this.showErrorState('This invite link is invalid or has expired');
                setTimeout(() => {
                    window.location.href = ROUTES.DASHBOARD;
                }, 3000);
            } else {
                this.showErrorState('Failed to join group. Please try again.');
                setTimeout(() => {
                    window.location.href = ROUTES.DASHBOARD;
                }, 3000);
            }
        }
    }

    private updateLoadingState(message: string): void {
        const subtitleElement = this.element?.querySelector('.auth-card__subtitle');
        if (subtitleElement) {
            subtitleElement.textContent = message;
        }
    }

    private showErrorState(message: string): void {
        const cardElement = this.element?.querySelector('.auth-card');
        if (cardElement) {
            const formContent = cardElement.querySelector('.loading-spinner')?.parentElement;
            if (formContent) {
                formContent.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p class="auth-card__text">${message}</p>
                    </div>
                `;
            }
        }
    }
}