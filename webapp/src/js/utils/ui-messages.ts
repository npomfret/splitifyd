import { logger } from './logger.js';

export function showMessage(message: string, type: 'info' | 'success' | 'error' = 'info', duration: number = 3000): void {
    logger.log(`showMessage called: ${message}, type: ${type}, duration: ${duration}`);
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
    logger.log(`showError called: ${message}, duration: ${duration}`);
    showMessage(message, 'error', duration);
}

export function hideError(): void {
    logger.log('hideError called');
    const bannerElement = document.getElementById('warningBanner');
    if (bannerElement) {
        bannerElement.classList.add('hidden');
    }
}

export function showWarning(message: string): void {
    logger.log(`showWarning called: ${message}`);
    const bannerElement = document.getElementById('warningBanner');
    if (bannerElement) {
        bannerElement.textContent = message;
        bannerElement.classList.remove('hidden');
        bannerElement.style.display = 'block'; // Force display for debugging
    }
}

export function hideWarning(): void {
    logger.log('hideWarning called');
    const bannerElement = document.getElementById('warningBanner');
    if (bannerElement) {
        bannerElement.classList.add('hidden');
    }
}

export function showFieldError(fieldName: string, message: string): void {
    logger.log(`showFieldError called for ${fieldName}: ${message}`);
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
    logger.log('clearFieldErrors called');
    formElement.querySelectorAll('.form-error').forEach(error => {
        error.textContent = '';
    });
    formElement.querySelectorAll('.form-input--error').forEach(input => {
        input.classList.remove('form-input--error');
    });
}

export function showFormError(form: HTMLFormElement, message: string): void {
    logger.log(`showFormError called: ${message}`);
    let errorContainer = form.querySelector<HTMLDivElement>('.form-error--general');
    
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.className = 'form-error form-error--general';
        errorContainer.setAttribute('role', 'alert');
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            form.insertBefore(errorContainer, submitButton);
        }
    }

    errorContainer.textContent = message;
    errorContainer.setAttribute('aria-live', 'assertive');
}

export function showSuccessMessage(form: HTMLFormElement, message: string): void {
    logger.log(`showSuccessMessage called: ${message}`);
    let successContainer = form.querySelector<HTMLDivElement>('.form-success--general');
    
    if (!successContainer) {
        successContainer = document.createElement('div');
        successContainer.className = 'form-success form-success--general';
        successContainer.setAttribute('role', 'alert');
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            form.insertBefore(successContainer, submitButton);
        }
    }

    successContainer.textContent = message;
    successContainer.setAttribute('aria-live', 'polite');

    setTimeout(() => {
        successContainer?.remove();
    }, 3000);
}

export function clearErrors(): void {
    logger.log('clearErrors called');
    document.querySelectorAll('.form-error').forEach(error => {
        error.textContent = '';
    });
}

export function showSuccess(message: string, targetElement?: HTMLElement): void {
    logger.log(`showSuccess called: ${message}`);
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
    logger.log(`showFieldErrorWithInput called for input: ${input.id}, message: ${message}`);
    input.classList.add('form-input--error');
    errorElement.textContent = message;
    errorElement.setAttribute('aria-live', 'polite');
}

export function clearFieldErrorWithInput(input: HTMLInputElement, errorElement: HTMLElement): void {
    logger.log(`clearFieldErrorWithInput called for input: ${input.id}`);
    input.classList.remove('form-input--error');
    errorElement.textContent = '';
    errorElement.removeAttribute('aria-live');
}