import { BaseComponent } from './base-component.js';
import { PageLayoutComponent } from './page-layout.js';
import { HeaderComponent } from './header.js';
import { LoadingSpinnerComponent } from './loading-spinner.js';
import { logger } from '../utils/logger.js';
import { showError } from '../utils/ui-messages.js';
import { apiCall } from '../api.js';
import { firebaseAuthInstance } from '../firebase-init.js';
import { AUTH_TOKEN_KEY } from '../constants.js';
import { ROUTES } from '../routes.js';

export class DashboardComponent extends BaseComponent<HTMLDivElement> {
    private headerComponent: HeaderComponent | null = null;
    private loadingSpinner: LoadingSpinnerComponent | null = null;
    private groupsList: any | null = null;

    protected render(): HTMLDivElement {
        const container = document.createElement('div');
        
        // Create the page layout
        const pageLayout = new PageLayoutComponent({});
        
        // Create main content structure
        const mainContent = document.createElement('main');
        mainContent.className = 'dashboard-main';
        
        const dashboardContainer = document.createElement('div');
        dashboardContainer.className = 'dashboard-container';
        
        const dashboardContent = document.createElement('section');
        dashboardContent.className = 'dashboard-content';
        
        const groupsContainer = document.createElement('div');
        groupsContainer.id = 'groupsContainer';
        groupsContainer.className = 'groups-container';
        
        // Create loading spinner container
        const spinnerContainer = document.createElement('div');
        spinnerContainer.id = 'loading-spinner-container';
        groupsContainer.appendChild(spinnerContainer);
        
        dashboardContent.appendChild(groupsContainer);
        dashboardContainer.appendChild(dashboardContent);
        mainContent.appendChild(dashboardContainer);
        
        // Mount page layout
        pageLayout.mount(container);
        
        // Get the header container from page layout
        const headerContainer = container.querySelector('#header-container');
        if (headerContainer) {
            // Create and mount header component with balance display
            this.headerComponent = new HeaderComponent({ 
                title: 'Dashboard', 
                showLogout: true,
                showBalances: true,
                totalOwed: 0,
                totalOwe: 0
            });
            this.headerComponent.mount(headerContainer as HTMLElement);
        }
        
        // Add main content to the page layout's content area
        const contentArea = container.querySelector('.page-content');
        if (contentArea) {
            contentArea.appendChild(mainContent);
        }
        
        return container;
    }

    protected async setupEventListeners(): Promise<void> {
        if (!this.element) return;

        try {
            // Check authentication first
            const token = localStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) {
                window.location.href = ROUTES.LOGIN;
                return;
            }

            // Show loading spinner
            const spinnerContainer = this.element.querySelector('#loading-spinner-container');
            if (spinnerContainer) {
                this.loadingSpinner = new LoadingSpinnerComponent({
                    message: 'Loading your groups...',
                    variant: 'default',
                    size: 'medium'
                });
                this.loadingSpinner.mount(spinnerContainer as HTMLElement);
                this.loadingSpinner.show();
            }

            // Ensure user document exists before proceeding
            await this.ensureUserDocumentExists();

            // Dynamically import GroupsList when needed
            const { GroupsList } = await import('../groups.js');
            
            // Initialize groups list using existing DOM structure
            const groupsContainer = this.element.querySelector('#groupsContainer');
            if (groupsContainer && this.headerComponent) {
                this.groupsList = new GroupsList('groupsContainer', this.headerComponent);
                await this.groupsList.loadGroups();
            }

            // Hide loading spinner after groups are loaded
            if (this.loadingSpinner) {
                this.loadingSpinner.hide();
            }

        } catch (error: any) {
            logger.error('Failed to load dashboard:', error);
            
            // Hide loading spinner on error
            if (this.loadingSpinner) {
                this.loadingSpinner.hide();
            }
            
            // Try to show error message using UI utilities if possible
            try {
                showError('Failed to load dashboard. Please refresh the page or try again later.');
            } catch {
                // Fallback: show error in the groups container
                const groupsContainer = this.element.querySelector('#groupsContainer');
                if (groupsContainer) {
                    groupsContainer.innerHTML = `
                        <div style="padding: 20px; text-align: center; margin-top: 50px;">
                            <h2>Unable to load dashboard</h2>
                            <p>Please refresh the page or try again later.</p>
                            <button class="btn btn-primary" style="margin-top: 20px;">
                                Refresh Page
                            </button>
                        </div>
                    `;
                    
                    // Add event listener to refresh button
                    const refreshButton = groupsContainer.querySelector('button');
                    if (refreshButton) {
                        refreshButton.addEventListener('click', () => {
                            window.location.reload();
                        });
                    }
                }
            }
        }
    }

    private async ensureUserDocumentExists(): Promise<void> {
        try {
            // Try a simple groups list call to see if user document exists
            await apiCall('/listDocuments', { method: 'GET' });
        } catch (error: any) {
            // If we get a 401, that's an auth issue, not a missing user document
            if (error.message?.includes('401')) {
                throw error;
            }
            
            // For other errors (likely missing user document), try to create it
            logger.log('User document may not exist, attempting to create it');
            try {
                await this.createUserDocument();
                logger.log('User document created, retrying original request');
            } catch (createError: any) {
                logger.error('Failed to create user document:', createError);
                throw error;
            }
        }
    }

    private async createUserDocument(): Promise<void> {
        if (!firebaseAuthInstance) {
            throw new Error('Firebase not initialized');
        }

        const user = await firebaseAuthInstance.getCurrentUser();
        if (!user) {
            throw new Error('No authenticated user');
        }

        // Get fresh ID token
        const idToken = await user.getIdToken(true);
        
        // Call the server to create user document
        await apiCall('/createUserDocument', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email?.split('@')[0] || 'User'
            })
        });
    }

    protected cleanup(): void {
        if (this.headerComponent) {
            this.headerComponent.unmount();
            this.headerComponent = null;
        }
        if (this.loadingSpinner) {
            this.loadingSpinner.unmount();
            this.loadingSpinner = null;
        }
        if (this.groupsList) {
            this.groupsList = null;
        }
        super.cleanup();
    }
}