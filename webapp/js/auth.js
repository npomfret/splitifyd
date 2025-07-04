const AUTH_TOKEN_KEY = 'splitifyd_auth_token';

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
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_-])/.test(value)) {
            throw new Error('Password must contain uppercase, lowercase, number, and special character');
        }
        return value;
    },
    
    displayName: (value) => {
        if (!value) throw new Error('Display name is required');
        const trimmed = value.trim();
        if (trimmed.length < 2) throw new Error('Display name must be at least 2 characters');
        if (trimmed.length > 50) throw new Error('Display name must be less than 50 characters');
        return trimmed;
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
        this.#initializeAsync();
    }

    async #initializeAsync() {
        try {
            // Ensure Firebase is initialized before setting up event listeners
            await config.getConfig();
            this.#initializeEventListeners();
        } catch (error) {
            console.error('Failed to initialize AuthManager:', error);
        }
    }

    #initializeEventListeners() {
        const elements = {
            loginForm: document.getElementById('loginForm'),
            registerForm: document.getElementById('registerForm'),
            resetForm: document.getElementById('resetForm'),
            forgotPassword: document.getElementById('forgotPassword'),
            signUpLink: document.getElementById('signUpLink'),
            signInLink: document.getElementById('signInLink'),
            logoutButton: document.getElementById('logoutButton')
        };

        if (elements.loginForm) {
            this.#addEventListenerWithCleanup(elements.loginForm, 'submit', this.#handleLogin.bind(this));
            this.#setupFormValidation(elements.loginForm);
            this.#setDevelopmentDefaults(elements.loginForm);
        }

        if (elements.registerForm) {
            this.#addEventListenerWithCleanup(elements.registerForm, 'submit', this.#handleRegister.bind(this));
            this.#setupFormValidation(elements.registerForm);
            this.#setDevelopmentDefaults(elements.registerForm);
        }

        if (elements.resetForm) {
            this.#addEventListenerWithCleanup(elements.resetForm, 'submit', this.#handlePasswordReset.bind(this));
            this.#setupFormValidation(elements.resetForm);
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
        
        if (elements.logoutButton) {
            this.#addEventListenerWithCleanup(elements.logoutButton, 'click', this.#handleLogout.bind(this));
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

    async #setDevelopmentDefaults(form) {
        try {
            await config.getConfig();
            const formDefaults = window.firebaseConfigManager.getFormDefaults();
            
            if (!formDefaults || Object.keys(formDefaults).length === 0) {
                return;
            }

            const registerDefaults = {
                displayName: formDefaults.displayName,
                email: formDefaults.email,
                password: formDefaults.password,
                confirmPassword: formDefaults.password
            };

            const loginDefaults = {
                email: formDefaults.email,
                password: formDefaults.password
            };

            const defaults = form.id === 'registerForm' ? registerDefaults : loginDefaults;

            Object.entries(defaults).forEach(([fieldName, defaultValue]) => {
                const input = form.querySelector(`[name="${fieldName}"]`);
                if (input && !input.value && defaultValue) {
                    input.value = defaultValue;
                }
            });
        } catch (error) {
            console.warn('Failed to load form defaults:', error);
        }
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
            
            // Use Firebase Auth directly for login
            if (!window.firebaseAuth) {
                throw new Error('Firebase not initialized');
            }
            const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(credentials.email, credentials.password);
            
            // Get ID token for API authentication
            const idToken = await userCredential.user.getIdToken();
            this.#setToken(idToken);
            
            // Store user ID for client-side operations
            localStorage.setItem('userId', userCredential.user.uid);
            
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            let errorMessage = 'Login failed';
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                errorMessage = 'Invalid email or password';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email format';
            } else if (error.code === 'auth/user-disabled') {
                errorMessage = 'Account has been disabled';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many failed attempts. Try again later';
            }
            throw new Error(errorMessage);
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

            // Use Firebase Auth directly for registration
            if (!window.firebaseAuth) {
                throw new Error('Firebase not initialized');
            }
            const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(userData.email, userData.password);
            
            // Update display name using Firebase Auth updateProfile
            await window.firebaseAuth.updateProfile(userCredential.user, {
                displayName: userData.displayName
            });
            
            // Get ID token for API authentication
            const idToken = await userCredential.user.getIdToken();
            this.#setToken(idToken);
            
            // Store user ID for client-side operations
            localStorage.setItem('userId', userCredential.user.uid);
            
            // Skip user document creation for now - can be done on first dashboard load
            console.log('Registration successful, redirecting to dashboard');
            
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            console.error('Registration error:', error);
            let errorMessage = 'Registration failed';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'An account with this email already exists';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email format';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak';
            } else if (error.code === 'auth/operation-not-allowed') {
                errorMessage = 'Registration is currently disabled';
            } else {
                errorMessage = `Registration failed: ${error.message}`;
            }
            throw new Error(errorMessage);
        } finally {
            this.#resetButton(button, originalText);
        }
    }

    async #makeRequest(endpoint, data) {
        const apiUrl = await config.getApiUrl();
        const response = await fetch(`${apiUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.#token && { 'Authorization': `Bearer ${this.#token}` })
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

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

    #showSuccessMessage(form, message) {
        let successContainer = form.querySelector('.form-success--general');
        
        if (!successContainer) {
            successContainer = document.createElement('div');
            successContainer.className = 'form-success form-success--general';
            successContainer.setAttribute('role', 'alert');
            form.insertBefore(successContainer, form.querySelector('button'));
        }
        
        successContainer.textContent = message;
        successContainer.setAttribute('aria-live', 'polite');
    }

    #handleForgotPassword(event) {
        event.preventDefault();
        window.location.href = 'reset-password.html';
    }

    async #handlePasswordReset(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const email = formData.get('email');
        
        const button = event.target.querySelector('button[type="submit"]');
        
        try {
            validateInput.email(email);
            await this.#submitPasswordReset(email, button);
        } catch (error) {
            this.#showFormError(event.target, error.message);
        }
    }

    async #submitPasswordReset(email, button) {
        const originalText = button.textContent;
        
        try {
            this.#setButtonLoading(button, 'Sending...');
            
            if (!window.firebaseAuth) {
                throw new Error('Firebase not initialized');
            }
            
            await window.firebaseAuth.sendPasswordResetEmail(email);
            
            this.#showSuccessMessage(button.closest('form'), 'Password reset email sent! Check your inbox.');
            
        } catch (error) {
            let errorMessage = 'Failed to send reset email';
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email format';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many requests. Please try again later';
            }
            throw new Error(errorMessage);
        } finally {
            this.#resetButton(button, originalText);
        }
    }

    #handleSignUp(event) {
        event.preventDefault();
        window.location.href = 'register.html';
    }

    #handleSignIn(event) {
        event.preventDefault();
        window.location.href = 'index.html';
    }
    
    #handleLogout(event) {
        event.preventDefault();
        this.logout();
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
        localStorage.removeItem('userId');
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