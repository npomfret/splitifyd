import { logger } from './logger.js';

export function showMessage(message: string, type: 'info' | 'success' | 'error' = 'info', duration: number = 3000): void {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.classList.add('show');
    }, 10);

    if (duration > 0) {
        setTimeout(() => {
            messageDiv.classList.remove('show');
            setTimeout(() => {
                messageDiv.remove();
            }, 300);
        }, duration);
    }
}

export function showError(message: string, duration: number = 5000): void {
    showMessage(message, 'error', duration);
}

export function showWarning(message: string): void {
    const bannerElement = document.getElementById('warningBanner');
    if (bannerElement) {
        bannerElement.textContent = message;
        bannerElement.classList.remove('hidden');
        bannerElement.style.display = 'block'; // Force display for debugging
    }
}

export function showFieldError(fieldName: string, message: string): void {
    const errorElement = document.getElementById(`${fieldName}-error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';

        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
}

export function clearFieldErrors(formElement: HTMLFormElement): void {
    formElement.querySelectorAll('.form-error').forEach(error => {
        error.textContent = '';
    });
    formElement.querySelectorAll('.form-input--error').forEach(input => {
        input.classList.remove('form-input--error');
    });
}
export function clearErrors(): void {
    document.querySelectorAll('.form-error').forEach(error => {
        error.textContent = '';
    });
}

export function showSuccess(message: string, targetElement?: HTMLElement): void {
    if (targetElement) {
        const originalText = targetElement.textContent || '';
        targetElement.textContent = message;
        if (targetElement instanceof HTMLButtonElement) {
            targetElement.disabled = true;
        }
        
        setTimeout(() => {
            targetElement.textContent = originalText;
            if (targetElement instanceof HTMLButtonElement) {
                targetElement.disabled = false;
            }
        }, 3000);
    } else {
        showMessage(message, 'success');
    }
}

export function showFieldErrorWithInput(input: HTMLInputElement, errorElement: HTMLElement, message: string): void {
    input.classList.add('form-input--error');
    errorElement.textContent = message;
    errorElement.setAttribute('aria-live', 'polite');
}

export function clearFieldErrorWithInput(input: HTMLInputElement, errorElement: HTMLElement): void {
    input.classList.remove('form-input--error');
    errorElement.textContent = '';
    errorElement.removeAttribute('aria-live');
}