import { logger } from './utils/logger.js';
import { firebaseConfigManager, firebaseAuthInstance } from './firebase-config.js';
import { clearErrors, showFieldError, showSuccess } from './utils/ui-messages.js';
import { HeaderComponent } from './components/header.js';

const headerContainer = document.getElementById('header-container');
if (headerContainer) {
    const header = new HeaderComponent({ title: 'Reset Password', showLogout: false });
    header.mount(headerContainer);
}


const resetForm = document.getElementById('resetForm') as HTMLFormElement;
const emailInput = document.getElementById('email') as HTMLInputElement;


const validateForm = (): boolean => {
    clearErrors();
    let isValid = true;

    const email = emailInput.value.trim();

    if (!email) {
        showFieldError('email', 'Email is required');
        isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError('email', 'Please enter a valid email address');
        isValid = false;
    }

    return isValid;
};

const handleResetPassword = async (e: Event): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    const email = emailInput.value.trim();

    try {
        if (!firebaseAuthInstance) {
            throw new Error('Firebase not initialized');
        }
        await firebaseAuthInstance.sendPasswordResetEmail(email);
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