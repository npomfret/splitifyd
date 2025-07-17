import { BaseComponent } from './base-component.js';
import { AuthCardComponent } from './auth-card.js';
import { FormComponents } from './form-components.js';
import { ButtonComponent, ButtonConfig } from './button.js';
import { authManager } from '../auth.js';
import { clearErrors, showFieldError, showSuccess } from '../utils/ui-messages.js';
import { validateEmail } from '../utils/form-validation.js';
import { logger } from '../utils/logger.js';

export class ResetPasswordComponent extends BaseComponent<HTMLDivElement> {
    private emailInput: HTMLInputElement | null = null;
    private submitButton: ButtonComponent | null = null;
    private form: HTMLFormElement | null = null;

    protected render(): HTMLDivElement {
        const container = document.createElement('div');
        container.innerHTML = '<div id="warningBanner" class="warning-banner hidden"></div>';

        const formContent = `
            <form class="auth-form" id="resetForm" novalidate>
                ${FormComponents.formGroup({
                    label: 'Email Address',
                    id: 'email',
                    type: 'email',
                    required: true,
                    placeholder: '',
                    errorId: 'email-error'
                })}
                <div id="submit-button-container"></div>
                <div id="submit-help" class="sr-only">
                    This will send a password reset link to your email
                </div>
            </form>
        `;

        const footerContent = `
            <nav class="auth-nav" aria-label="Authentication navigation">
                <p><a href="index.html" class="auth-link">Back to Sign In</a></p>
                <p>Don't have an account? <a href="register.html" class="auth-link auth-link--primary">Sign up</a></p>
            </nav>
        `;

        const authCardHtml = AuthCardComponent.render({
            title: 'Split App',
            subtitleTitle: 'Reset Password',
            subtitle: 'Enter your email to receive reset instructions',
            content: formContent,
            formContent,
            footerContent,
            cardClass: 'auth-card--reset'
        });

        container.innerHTML += authCardHtml;

        return container;
    }

    protected setupEventListeners(): void {
        if (!this.element) return;

        this.form = this.element.querySelector('#resetForm') as HTMLFormElement;
        this.emailInput = this.element.querySelector('#email') as HTMLInputElement;
        
        if (!this.form || !this.emailInput) {
            logger.error('Required form elements not found');
            return;
        }

        const submitButtonContainer = this.element.querySelector('#submit-button-container');
        if (submitButtonContainer) {
            const buttonConfig: ButtonConfig = {
                text: 'Send Reset Link',
                type: 'submit',
                variant: 'primary',
                size: 'large',
                ariaDescribedBy: 'submit-help'
            };
            this.submitButton = new ButtonComponent(buttonConfig);
            this.submitButton.mount(submitButtonContainer as HTMLElement);
        }

        this.form.addEventListener('submit', this.handleResetPassword.bind(this));
    }

    private validateForm(): boolean {
        clearErrors();
        if (!this.emailInput) return false;
        return validateEmail(this.emailInput.value.trim(), 'email');
    }

    private async handleResetPassword(e: Event): Promise<void> {
        e.preventDefault();
        
        if (!this.validateForm() || !this.emailInput || !this.submitButton) {
            return;
        }

        const email = this.emailInput.value.trim();

        try {
            this.submitButton.setLoading(true);
            await authManager.sendPasswordResetEmail(email);
            showSuccess('Reset link sent!', this.submitButton.getElement()!);
            this.emailInput.value = '';
        } catch (error) {
            logger.error('Password reset error:', error);
            
            const errorCode = error instanceof Error && 'code' in error ? (error as any).code : '';
            switch (errorCode) {
                case 'auth/user-not-found':
                    showFieldError('email', 'No account found with this email address');
                    break;
                case 'auth/invalid-email':
                    showFieldError('email', 'Invalid email address');
                    break;
                case 'auth/too-many-requests':
                    showFieldError('email', 'Too many requests. Please try again later.');
                    break;
                default:
                    showFieldError('email', 'Failed to send reset email. Please try again.');
            }
        } finally {
            this.submitButton.setLoading(false);
        }
    }

    protected cleanup(): void {
        if (this.form) {
            this.form.removeEventListener('submit', this.handleResetPassword.bind(this));
        }
        if (this.submitButton) {
            this.submitButton.unmount();
        }
    }
}