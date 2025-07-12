import { showFieldError } from './ui-messages.js';

export function validateEmail(email: string, fieldId: string): boolean {
    if (!email) {
        showFieldError(fieldId, 'Email is required');
        return false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError(fieldId, 'Please enter a valid email address');
        return false;
    }
    return true;
}

export function validateRequired(value: string | number, fieldId: string, message: string): boolean {
    if (typeof value === 'string' && !value.trim()) {
        showFieldError(fieldId, message);
        return false;
    }
    if (typeof value === 'number' && (isNaN(value) || value <= 0)) {
        showFieldError(fieldId, message);
        return false;
    }
    return true;
}
