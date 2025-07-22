import { updatePageTitle } from './utils/page-title.js';
import { 
  createButton, 
  createFormField, 
  createAuthHeader, 
  createAuthFooter, 
  createAuthCard,
  createWarningBanner 
} from './ui-builders.js';

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
    
    // Update page title from configuration
    await updatePageTitle('Reset Password');
    
    // Get the app root container
    const appRoot = document.getElementById('app-root');
    if (!appRoot) return;
    
    // Initialize warning banner from config first
    const { firebaseConfigManager } = await import('./firebase-config-manager.js');
    const warningBannerConfig = await firebaseConfigManager.getWarningBanner();
    
    // Create warning banner if message exists
    if (warningBannerConfig?.message) {
        const warningBanner = createWarningBanner({
            message: warningBannerConfig.message,
            isVisible: true
        });
        appRoot.appendChild(warningBanner);
    }
    
    // Create main content container
    const mainContent = document.createElement('div');
    mainContent.className = 'main-content';
    
    const authContainer = document.createElement('main');
    authContainer.className = 'auth-container';
    
    // Create the reset password form
    const resetPasswordForm = document.createElement('form');
    resetPasswordForm.id = 'resetPasswordForm';
    resetPasswordForm.className = 'auth-form';
    resetPasswordForm.setAttribute('novalidate', '');
    
    // Create email field
    const emailField = createFormField({
        label: 'Email Address',
        type: 'email',
        id: 'email',
        name: 'email',
        placeholder: 'Enter your email',
        required: true
    });
    
    // Add autocomplete attribute manually
    const emailInput = emailField.querySelector('input');
    if (emailInput) emailInput.setAttribute('autocomplete', 'email');
    
    // Create submit button container
    const submitButtonContainer = document.createElement('div');
    submitButtonContainer.id = 'submit-button-container';
    
    // Create submit button
    const submitButton = createButton({
        type: 'submit',
        text: 'Send Reset Email',
        variant: 'primary',
        size: 'large'
    });
    
    submitButtonContainer.appendChild(submitButton);
    
    // Add fields to form
    // Add a title and description to the form
    const formTitle = document.createElement('h1');
    formTitle.className = 'auth-form__title';
    formTitle.textContent = 'Reset Password';
    
    const formDescription = document.createElement('p');
    formDescription.className = 'auth-form__description';
    formDescription.textContent = 'Enter your email address and we\'ll send you a link to reset your password.';
    
    resetPasswordForm.appendChild(formTitle);
    resetPasswordForm.appendChild(formDescription);
    resetPasswordForm.appendChild(emailField);
    resetPasswordForm.appendChild(submitButtonContainer);
    
    // Create auth card with header and footer
    const authCard = createAuthCard({
        variant: 'login', // Using 'login' variant for reset password
        header: createAuthHeader({
            subtitle: 'Get back to splitting bills'
        }),
        form: resetPasswordForm,
        footer: createAuthFooter({
            links: [
                {
                    link: {
                        href: 'login.html',
                        text: 'Back to Login',
                        id: 'backToLogin'
                    }
                }
            ]
        })
    });
    
    authContainer.appendChild(authCard);
    mainContent.appendChild(authContainer);
    appRoot.appendChild(mainContent);
    
    // Load auth module and initialize
    const { authManager } = await import('./auth.js');
    
    // Handle form submission
    resetPasswordForm.addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        
        const formData = new FormData(resetPasswordForm);
        const email = formData.get('email') as string;
        
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
        
        try {
            await authManager.sendPasswordResetEmail(email);
            
            // Show success message
            const successMessage = document.createElement('div');
            successMessage.className = 'success-message';
            successMessage.textContent = 'Password reset email sent! Check your inbox.';
            resetPasswordForm.insertBefore(successMessage, resetPasswordForm.firstChild);
            
            // Clear the form
            resetPasswordForm.reset();
            
            // Remove success message after 5 seconds
            setTimeout(() => {
                successMessage.remove();
            }, 5000);
            
        } catch (error: any) {
            // Show error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = error.message || 'Failed to send reset email. Please try again.';
            resetPasswordForm.insertBefore(errorMessage, resetPasswordForm.firstChild);
            
            // Remove error message after 5 seconds
            setTimeout(() => {
                errorMessage.remove();
            }, 5000);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Send Reset Email';
        }
    });
});