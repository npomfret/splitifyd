import { logger } from './utils/logger.js';
import { authManager } from './auth.js';
import { clearErrors, showFieldError, showSuccess } from './utils/ui-messages.js';
import { HeaderComponent } from './components/header.js';

const headerContainer = document.getElementById('header-container');
if (headerContainer) {
    const header = new HeaderComponent({ title: 'Reset Password', showLogout: false });
    header.mount(headerContainer);
}


const resetForm = document.getElementById('resetForm') as HTMLFormElement;
const emailInput = document.getElementById('email') as HTMLInputElement;


import { validateEmail } from './utils/form-validation.js';

const validateForm = (): boolean => {
    clearErrors();
    return validateEmail(emailInput.value.trim(), 'email');
};

const handleResetPassword = async (e: Event): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    const email = emailInput.value.trim();

    try {
        await authManager.sendPasswordResetEmail(email);
        const submitButton = resetForm.querySelector('button[type="submit"]') as HTMLButtonElement;
        showSuccess('Reset link sent!', submitButton);
        emailInput.value = '';
    } catch (error: any) {
        logger.error('Password reset error:', error);
        
        switch (error.code) {
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
    }
};

resetForm.addEventListener('submit', handleResetPassword);