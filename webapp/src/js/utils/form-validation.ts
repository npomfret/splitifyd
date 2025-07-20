import { showFieldError } from './ui-messages.js';

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
