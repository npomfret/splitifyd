const AUTH_TOKEN_KEY = 'splitifyd_auth_token';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const localHost = window.location.hostname;
const LOCAL_FUNCTIONS_EMULATOR_PORT = 5001;

const API_BASE_URL = isLocal
    ? `http://${localHost}:${LOCAL_FUNCTIONS_EMULATOR_PORT}/splitifyd/us-central1`
    : `https://api-po437q3l5q-uc.a.run.app`;

const validateInput = {
    email: (value) => {
        if (!value) throw new Error('Email is required');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error('Invalid email format');
        }
        return value.toLowerCase().trim();
    },
    
    password: (value) => {
        if (!value) throw new Error('Password is required');
        if (value.length < 8) throw new Error('Password must be at least 8 characters');
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
            throw new Error('Password must contain uppercase, lowercase, and number');
        }
        return value;
    },
    
    displayName: (value) => {
        if (!value) throw new Error('Display name is required');
        if (value.trim().length < 1) throw new Error('Display name cannot be empty');
        return value.trim();
    }
};

const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(null, args), delay);
    };
};

class AuthManager {
    #token = null;
    #eventListeners = new Map();

    constructor() {
        this.#token = localStorage.getItem(AUTH_TOKEN_KEY);
        this.#initializeEventListeners();
    }

    #initializeEventListeners() {
        const elements = {
            loginForm: document.getElementById('loginForm'),
            registerForm: document.getElementById('registerForm'),
            forgotPassword: document.getElementById('forgotPassword'),
            signUpLink: document.getElementById('signUpLink'),
            signInLink: document.getElementById('signInLink')
        };

        if (elements.loginForm) {
            this.#addEventListenerWithCleanup(elements.loginForm, 'submit', this.#handleLogin.bind(this));
            this.#setupFormValidation(elements.loginForm);
        }

        if (elements.registerForm) {
            this.#addEventListenerWithCleanup(elements.registerForm, 'submit', this.#handleRegister.bind(this));
            this.#setupFormValidation(elements.registerForm);
        }

        if (elements.forgotPassword) {
            this.#addEventListenerWithCleanup(elements.forgotPassword, 'click', this.#handleForgotPassword.bind(this));
        }

        if (elements.signUpLink) {
            this.#addEventListenerWithCleanup(elements.signUpLink, 'click', this.#handleSignUp.bind(this));
        }

        if (elements.signInLink) {
            this.#addEventListenerWithCleanup(elements.signInLink, 'click', this.#handleSignIn.bind(this));
        }
    }

    #addEventListenerWithCleanup(element, event, handler) {
        element.addEventListener(event, handler);
        
        if (!this.#eventListeners.has(element)) {
            this.#eventListeners.set(element, []);
        }
        this.#eventListeners.get(element).push({ event, handler });
    }

    #setupFormValidation(form) {
        const inputs = form.querySelectorAll('.form-input');
        
        inputs.forEach(input => {
            const debouncedValidation = debounce(() => this.#validateField(input), 300);
            
            this.#addEventListenerWithCleanup(input, 'blur', () => this.#validateField(input));
            this.#addEventListenerWithCleanup(input, 'input', debouncedValidation);
        });
    }

    #validateField(input) {
        const errorElement = document.getElementById(`${input.id}-error`);
        if (!errorElement) return;

        try {
            const { name, value } = input;
            
            if (name === 'confirmPassword') {
                const passwordInput = document.getElementById('password');
                if (passwordInput && value !== passwordInput.value) {
                    throw new Error('Passwords do not match');
                }
            } else if (validateInput[name]) {
                validateInput[name](value);
            }
            
            this.#clearFieldError(input, errorElement);
        } catch (error) {
            this.#showFieldError(input, errorElement, error.message);
        }
    }

    #showFieldError(input, errorElement, message) {
        input.classList.add('form-input--error');
        errorElement.textContent = message;
        errorElement.setAttribute('aria-live', 'polite');
    }

    #clearFieldError(input, errorElement) {
        input.classList.remove('form-input--error');
        errorElement.textContent = '';
        errorElement.removeAttribute('aria-live');
    }

    async #handleLogin(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const credentials = {
            email: formData.get('email'),
            password: formData.get('password')
        };
        
        const button = event.target.querySelector('button[type="submit"]');
        
        try {
            this.#validateCredentials(credentials);
            await this.#submitLogin(credentials, button);
        } catch (error) {
            this.#showFormError(event.target, error.message);
        }
    }

    #validateCredentials(credentials) {
        validateInput.email(credentials.email);
        validateInput.password(credentials.password);
    }

    async #submitLogin(credentials, button) {
        const originalText = button.textContent;
        
        try {
            this.#setButtonLoading(button, 'Signing in...');
            
            const response = await this.#makeRequest('/login', credentials);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Login failed');
            }

            const data = await response.json();
            this.#setToken(data.token);
            
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            throw new Error(`Login failed: ${error.message}`);
        } finally {
            this.#resetButton(button, originalText);
        }
    }

    async #handleRegister(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const userData = {
            displayName: formData.get('displayName'),
            email: formData.get('email'),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword')
        };
        
        const button = event.target.querySelector('button[type="submit"]');
        
        try {
            this.#validateRegistrationData(userData);
            await this.#submitRegistration(userData, button);
        } catch (error) {
            this.#showFormError(event.target, error.message);
        }
    }

    #validateRegistrationData(userData) {
        validateInput.displayName(userData.displayName);
        validateInput.email(userData.email);
        validateInput.password(userData.password);
        
        if (userData.password !== userData.confirmPassword) {
            throw new Error('Passwords do not match');
        }
    }

    async #submitRegistration(userData, button) {
        const originalText = button.textContent;
        
        try {
            this.#setButtonLoading(button, 'Creating Account...');

            const { confirmPassword, ...registrationData } = userData;
            const response = await this.#makeRequest('/register', registrationData);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Registration failed');
            }

            const data = await response.json();
            this.#setToken(data.token);
            
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            throw new Error(`Registration failed: ${error.message}`);
        } finally {
            this.#resetButton(button, originalText);
        }
    }

    async #makeRequest(endpoint, data) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.#token && { 'Authorization': `Bearer ${this.#token}` })
            },
            body: JSON.stringify(data),
        });

        return response;
    }

    #setButtonLoading(button, text) {
        button.textContent = text;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
    }

    #resetButton(button, originalText) {
        button.textContent = originalText;
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }

    #showFormError(form, message) {
        let errorContainer = form.querySelector('.form-error--general');
        
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.className = 'form-error form-error--general';
            errorContainer.setAttribute('role', 'alert');
            form.insertBefore(errorContainer, form.querySelector('button'));
        }
        
        errorContainer.textContent = message;
        errorContainer.setAttribute('aria-live', 'assertive');
    }

    #handleForgotPassword(event) {
        event.preventDefault();
        // TODO: Implement forgot password flow
        alert('Forgot password functionality coming soon');
    }

    #handleSignUp(event) {
        event.preventDefault();
        window.location.href = 'register.html';
    }

    #handleSignIn(event) {
        event.preventDefault();
        window.location.href = 'index.html';
    }

    #setToken(token) {
        if (!token) throw new Error('Invalid token provided');
        
        this.#token = token;
        localStorage.setItem(AUTH_TOKEN_KEY, token);
    }

    getToken() {
        return this.#token;
    }

    clearToken() {
        this.#token = null;
        localStorage.removeItem(AUTH_TOKEN_KEY);
    }

    isAuthenticated() {
        return !!this.#token;
    }

    logout() {
        this.clearToken();
        window.location.href = 'index.html';
    }

    destroy() {
        this.#eventListeners.forEach((listeners, element) => {
            listeners.forEach(({ event, handler }) => {
                element.removeEventListener(event, handler);
            });
        });
        this.#eventListeners.clear();
    }
}

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        window.authManager?.destroy();
    });
});