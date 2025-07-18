import { BaseComponent } from './base-component.js';
import { PageLayoutComponent } from './page-layout.js';
import { AuthCardComponent } from './auth-card.js';
import { FormComponents } from './form-components.js';
import { ButtonComponent, ButtonConfig } from './button.js';
import { authManager } from '../auth.js';
import { clearErrors } from '../utils/ui-messages.js';
import { logger } from '../utils/logger.js';

export class RegisterComponent extends BaseComponent<HTMLDivElement> {
    private displayNameInput: HTMLInputElement | null = null;
    private emailInput: HTMLInputElement | null = null;
    private passwordInput: HTMLInputElement | null = null;
    private confirmPasswordInput: HTMLInputElement | null = null;
    private submitButton: ButtonComponent | null = null;
    private form: HTMLFormElement | null = null;

    protected render(): HTMLDivElement {
        const container = document.createElement('div');
        
        // Create the page layout
        const pageLayout = new PageLayoutComponent({});
        
        // Create the main content
        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';
        
        const authContainer = document.createElement('main');
        authContainer.className = 'auth-container';
        
        // Create form content
        const formContent = `
            <form class="auth-form" id="registerForm" novalidate>
                ${FormComponents.formGroup({
                    label: 'Display Name',
                    id: 'displayName',
                    type: 'text',
                    required: true,
                    placeholder: '',
                    errorId: 'displayName-error',
                    autocomplete: 'name',
                    minLength: 2,
                    maxLength: 50
                })}
                ${FormComponents.formGroup({
                    label: 'Email Address',
                    id: 'email',
                    type: 'email',
                    required: true,
                    placeholder: '',
                    errorId: 'email-error',
                    autocomplete: 'email'
                })}
                ${FormComponents.formGroup({
                    label: 'Password',
                    id: 'password',
                    type: 'password',
                    required: true,
                    placeholder: '',
                    errorId: 'password-error',
                    autocomplete: 'new-password',
                    minLength: 8
                })}
                ${FormComponents.formGroup({
                    label: 'Confirm Password',
                    id: 'confirmPassword',
                    type: 'password',
                    required: true,
                    placeholder: '',
                    errorId: 'confirmPassword-error',
                    autocomplete: 'new-password',
                    minLength: 8
                })}
                <div id="submit-button-container"></div>
                <div id="submit-help" class="sr-only">
                    This will create your account
                </div>
            </form>
        `;

        // Create footer content
        const footerContent = `
            <nav class="auth-nav" aria-label="Authentication navigation">
                <p>Already have an account? <a href="login.html" id="signInLink" class="auth-link auth-link--primary">Sign in</a></p>
            </nav>
        `;

        // Create auth card
        const authCardHtml = AuthCardComponent.render({
            title: 'Bill Splitter',
            subtitle: 'Create your account',
            content: formContent,
            formContent,
            footerContent,
            cardClass: 'auth-card--register'
        });

        authContainer.innerHTML = authCardHtml;
        mainContent.appendChild(authContainer);
        
        // Mount page layout
        pageLayout.mount(container);
        
        // Add main content to the page layout's content area
        const contentArea = container.querySelector('.page-content');
        if (contentArea) {
            contentArea.appendChild(mainContent);
        }

        return container;
    }

    protected setupEventListeners(): void {
        if (!this.element) return;

        this.form = this.element.querySelector('#registerForm') as HTMLFormElement;
        this.displayNameInput = this.element.querySelector('#displayName') as HTMLInputElement;
        this.emailInput = this.element.querySelector('#email') as HTMLInputElement;
        this.passwordInput = this.element.querySelector('#password') as HTMLInputElement;
        this.confirmPasswordInput = this.element.querySelector('#confirmPassword') as HTMLInputElement;
        
        if (!this.form || !this.displayNameInput || !this.emailInput || !this.passwordInput || !this.confirmPasswordInput) {
            logger.error('Required form elements not found');
            return;
        }

        // Mount submit button
        const submitButtonContainer = this.element.querySelector('#submit-button-container');
        if (submitButtonContainer) {
            const buttonConfig: ButtonConfig = {
                text: 'Create Account',
                type: 'submit',
                variant: 'primary',
                size: 'large',
                ariaDescribedBy: 'submit-help'
            };
            this.submitButton = new ButtonComponent(buttonConfig);
            this.submitButton.mount(submitButtonContainer as HTMLElement);
        }

        // Add form submit listener
        this.form.addEventListener('submit', async (event: Event) => {
            event.preventDefault();
            await this.handleRegister();
        });

        // Add input listeners for clearing errors
        const inputs = [this.displayNameInput, this.emailInput, this.passwordInput, this.confirmPasswordInput];
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                clearErrors();
            });
        });

        // Set development defaults if in development mode
        this.setDevelopmentDefaults();
    }

    private async handleRegister(): Promise<void> {
        if (!this.form) return;

        // Let authManager handle the actual registration
        const mockEvent = new Event('submit');
        Object.defineProperty(mockEvent, 'target', { value: this.form });
        
        // The authManager.handleRegister method expects the form to be the event target
        await authManager['handleRegister'](mockEvent);
    }

    private async setDevelopmentDefaults(): Promise<void> {
        // Only set defaults in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            try {
                // Import firebase config manager dynamically
                const { firebaseConfigManager } = await import('../firebase-config-manager.js');
                await firebaseConfigManager.getConfig();
                const formDefaults = await firebaseConfigManager.getFormDefaults();
                
                if (this.displayNameInput && !this.displayNameInput.value) {
                    this.displayNameInput.value = formDefaults.displayName || 'John Doe';
                }
                if (this.emailInput && !this.emailInput.value) {
                    this.emailInput.value = formDefaults.email || 'john.doe@example.com';
                }
                if (this.passwordInput && !this.passwordInput.value) {
                    this.passwordInput.value = formDefaults.password || 'TestPass123!';
                }
                if (this.confirmPasswordInput && !this.confirmPasswordInput.value) {
                    this.confirmPasswordInput.value = formDefaults.password || 'TestPass123!';
                }
            } catch (error) {
                // Fallback defaults if config is not available
                if (this.displayNameInput && !this.displayNameInput.value) {
                    this.displayNameInput.value = 'John Doe';
                }
                if (this.emailInput && !this.emailInput.value) {
                    this.emailInput.value = 'john.doe@example.com';
                }
                if (this.passwordInput && !this.passwordInput.value) {
                    this.passwordInput.value = 'TestPass123!';
                }
                if (this.confirmPasswordInput && !this.confirmPasswordInput.value) {
                    this.confirmPasswordInput.value = 'TestPass123!';
                }
            }
        }
    }

    protected cleanup(): void {
        if (this.submitButton) {
            this.submitButton.unmount();
            this.submitButton = null;
        }
        super.cleanup();
    }
}