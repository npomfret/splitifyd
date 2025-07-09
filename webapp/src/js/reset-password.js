import { logger } from './utils/logger.js';
import { auth, sendPasswordResetEmail } from './firebase-config.js';

const resetForm = document.getElementById('resetForm');
const emailInput = document.getElementById('email');

const clearErrors = () => {
    document.querySelectorAll('.form-error').forEach(error => {
        error.textContent = '';
    });
};

const showError = (fieldName, message) => {
    const errorElement = document.getElementById(`${fieldName}-error`);
    if (errorElement) {
        errorElement.textContent = message;
    }
};

const showSuccess = (message) => {
    const submitButton = resetForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    submitButton.textContent = message;
    submitButton.disabled = true;
    
    setTimeout(() => {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }, 3000);
};

const validateForm = () => {
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

const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    const email = emailInput.value.trim();

    try {
        await sendPasswordResetEmail(auth, email);
        showSuccess('Reset link sent!');
        emailInput.value = '';
    } catch (error) {
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
