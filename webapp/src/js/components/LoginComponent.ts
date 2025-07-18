import { BaseComponent } from './base-component.js';
import { PageLayoutComponent } from './page-layout.js';
import { AuthCardComponent } from './auth-card.js';
import { FormComponents } from './form-components.js';
import { ButtonComponent, ButtonConfig } from './button.js';
import { authManager } from '../auth.js';
import { clearErrors } from '../utils/ui-messages.js';
import { logger } from '../utils/logger.js';

export class LoginComponent extends BaseComponent<HTMLDivElement> {
    private emailInput: HTMLInputElement | null = null;
    private passwordInput: HTMLInputElement | null = null;
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
            <form class="auth-form" id="loginForm" novalidate>
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
                    autocomplete: 'current-password'
                })}
                <div id="submit-button-container"></div>
                <div id="submit-help" class="sr-only">
                    This will sign you into your account
                </div>
            </form>
        `;

        // Create footer content
        const footerContent = `
            <nav class="auth-nav" aria-label="Authentication navigation">
                <p><a href="reset-password.html" id="forgotPassword" class="auth-link">Forgot password?</a></p>
                <p>Don't have an account? <a href="register.html" id="signUpLink" class="auth-link auth-link--primary">Sign up</a></p>
            </nav>
        `;

        // Create auth card
        const authCardHtml = AuthCardComponent.render({
            title: 'Bill Splitter',
            subtitle: 'Split bills with friends',
            content: formContent,
            formContent,
            footerContent,
            cardClass: 'auth-card--login'
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

        this.form = this.element.querySelector('#loginForm') as HTMLFormElement;
        this.emailInput = this.element.querySelector('#email') as HTMLInputElement;
        this.passwordInput = this.element.querySelector('#password') as HTMLInputElement;
        
        if (!this.form || !this.emailInput || !this.passwordInput) {
            logger.error('Required form elements not found');
            return;
        }

        // Mount submit button
        const submitButtonContainer = this.element.querySelector('#submit-button-container');
        if (submitButtonContainer) {
            const buttonConfig: ButtonConfig = {
                text: 'Sign In',
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
            await this.handleLogin();
        });

        // Add input listeners for clearing errors
        this.emailInput.addEventListener('input', () => {
            clearErrors();
        });

        this.passwordInput.addEventListener('input', () => {
            clearErrors();
        });

        // Set development defaults if in development mode
        this.setDevelopmentDefaults();
    }

    private async handleLogin(): Promise<void> {
        if (!this.form || !this.emailInput || !this.passwordInput) return;

        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;

        // Let authManager handle the actual login
        const formData = new FormData(this.form);
        const mockEvent = new Event('submit');
        Object.defineProperty(mockEvent, 'target', { value: this.form });
        
        // The authManager.handleLogin method expects the form to be the event target
        await authManager['handleLogin'](mockEvent);
    }

    private setDevelopmentDefaults(): void {
        // Only set defaults in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if (this.emailInput && !this.emailInput.value) {
                this.emailInput.value = 'john.doe@example.com';
            }
            if (this.passwordInput && !this.passwordInput.value) {
                this.passwordInput.value = 'TestPass123!';
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