import { logger } from './utils/logger.js';
import { firebaseConfigManager } from './firebase-config.js';

const resetForm = document.getElementById('resetForm') as HTMLFormElement;
const emailInput = document.getElementById('email') as HTMLInputElement;

const clearErrors = (): void => {
    document.querySelectorAll('.form-error').forEach(error => {
        error.textContent = '';
    });
};

const showError = (fieldName: string, message: string): void => {
    const errorElement = document.getElementById(`${fieldName}-error`);
    if (errorElement) {
        errorElement.textContent = message;
    }
};

const showSuccess = (message: string): void => {
    const submitButton = resetForm.querySelector('button[type="submit"]') as HTMLButtonElement;
    const originalText = submitButton.textContent || '';
    
    submitButton.textContent = message;
    submitButton.disabled = true;
    
    setTimeout(() => {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }, 3000);
};

const validateForm = (): boolean => {
    clearErrors();
    let isValid = true;

    const email = emailInput.value.trim();

    if (!email) {
        showError('email', 'Email is required');
        isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('email', 'Please enter a valid email address');
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
        await window.firebaseAuth.sendPasswordResetEmail(email);
        showSuccess('Reset link sent!');
        emailInput.value = '';
    } catch (error: any) {
        logger.error('Password reset error:', error);
        
        switch (error.code) {
            case 'auth/user-not-found':
                showError('email', 'No account found with this email address');
                break;
            case 'auth/invalid-email':
                showError('email', 'Invalid email address');
                break;
            case 'auth/too-many-requests':
                showError('email', 'Too many requests. Please try again later.');
                break;
            default:
                showError('email', 'Failed to send reset email. Please try again.');
        }
    }
};

resetForm.addEventListener('submit', handleResetPassword);