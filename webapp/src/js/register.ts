import { logger } from './utils/logger.js';
import { firebaseConfigManager } from './firebase-config.js';
import { config } from './config.js';

const registerForm = document.getElementById('registerForm') as HTMLFormElement;
const displayNameInput = document.getElementById('displayName') as HTMLInputElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;

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

const validateForm = (): boolean => {
    clearErrors();
    let isValid = true;

    const displayName = displayNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!displayName) {
        showError('displayName', 'Display name is required');
        isValid = false;
    } else if (displayName.length < 2) {
        showError('displayName', 'Display name must be at least 2 characters');
        isValid = false;
    } else if (displayName.length > 50) {
        showError('displayName', 'Display name must be 50 characters or less');
        isValid = false;
    }

    if (!email) {
        showError('email', 'Email is required');
        isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('email', 'Please enter a valid email address');
        isValid = false;
    }

    if (!password) {
        showError('password', 'Password is required');
        isValid = false;
    } else if (password.length < 8) {
        showError('password', 'Password must be at least 8 characters');
        isValid = false;
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) {
        showError('password', 'Password must contain uppercase, lowercase, number, and special character');
        isValid = false;
    }

    if (!confirmPassword) {
        showError('confirmPassword', 'Please confirm your password');
        isValid = false;
    } else if (password !== confirmPassword) {
        showError('confirmPassword', 'Passwords do not match');
        isValid = false;
    }

    return isValid;
};

const handleRegister = async (e: Event): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    const displayName = displayNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    try {
        const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
        await window.firebaseAuth.updateProfile(userCredential.user, { displayName });
        
        window.location.href = 'dashboard.html';
    } catch (error: any) {
        logger.error('Registration error:', error);
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                showError('email', 'This email is already registered');
                break;
            case 'auth/weak-password':
                showError('password', 'Password is too weak');
                break;
            case 'auth/invalid-email':
                showError('email', 'Invalid email address');
                break;
            default:
                showError('email', 'Registration failed. Please try again.');
        }
    }
};

registerForm.addEventListener('submit', handleRegister);