import { logger } from './utils/logger.js';
import { firebaseAuthInstance, isFirebaseInitialized, firebaseInitializer } from './firebase-init.js';
import { firebaseConfigManager } from './firebase-config-manager.js';
import { showFormError, showSuccessMessage, showFieldErrorWithInput, clearFieldErrorWithInput } from './utils/ui-messages.js';
import { debounce } from './utils/event-utils.js';
import { validateInput } from './utils/safe-dom.js';
import { AUTH_TOKEN_KEY, USER_ID_KEY } from './constants.js';
import type { FirebaseUser, FirebaseError } from './types/global.js';
import type { 
    LoginCredentials, 
    RegistrationData, 
    ValidatorMap, 
    EventListenerInfo,
    UserCredential,
    DebouncedFunction 
} from './types/auth.js';

const authValidators: ValidatorMap = {
    email: (value: string): string => {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const result = validateInput(value, { 
            required: true, 
            allowedPattern: emailPattern,
            maxLength: 254 
        });
        
        if (!result.valid) {
            throw new Error(result.error || 'Invalid email');
        }
        
        return result.value!.toLowerCase();
    },
    
    password: (value: string): string => {
        const passwordPattern = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_-])/;
        const result = validateInput(value, { 
            required: true, 
            minLength: 8,
            maxLength: 128,
            allowedPattern: passwordPattern
        });
        
        if (!result.valid) {
            const errorMsg = result.error === 'Invalid format' 
                ? 'Password must contain uppercase, lowercase, number, and special character'
                : result.error || 'Invalid password';
            throw new Error(errorMsg);
        }
        
        return result.value!;
    },
    
    displayName: (value: string): string => {
        const result = validateInput(value, { 
            required: true, 
            minLength: 2,
            maxLength: 50
        });
        
        if (!result.valid) {
            throw new Error(result.error || 'Invalid display name');
        }
        
        return result.value!;
    }
};


class AuthManager {
    private token: string | null = null;
    private eventListeners: Map<Element, EventListenerInfo[]> = new Map();

    constructor() {
        this.token = localStorage.getItem(AUTH_TOKEN_KEY);
        this.initializeAsync();
    }

    private async initializeAsync(): Promise<void> {
        // Ensure Firebase is initialized before setting up event listeners
        await firebaseConfigManager.getConfig();
        
        // Initialize Firebase if not already initialized
        if (!isFirebaseInitialized()) {
            await firebaseInitializer.initialize();
        }
        
        this.initializeEventListeners();
    }

    private initializeEventListeners(): void {
        const elements = {
            loginForm: document.getElementById('loginForm') as HTMLFormElement,
            registerForm: document.getElementById('registerForm') as HTMLFormElement,
            resetForm: document.getElementById('resetForm') as HTMLFormElement,
            forgotPassword: document.getElementById('forgotPassword'),
            signUpLink: document.getElementById('signUpLink'),
            signInLink: document.getElementById('signInLink'),
            logoutButton: document.getElementById('logoutButton')
        };

        if (elements.loginForm) {
            this.addEventListenerWithCleanup(elements.loginForm, 'submit', this.handleLogin.bind(this));
            this.setupFormValidation(elements.loginForm);
            this.setDevelopmentDefaults(elements.loginForm);
        }

        if (elements.registerForm) {
            this.addEventListenerWithCleanup(elements.registerForm, 'submit', this.handleRegister.bind(this));
            this.setupFormValidation(elements.registerForm);
            this.setDevelopmentDefaults(elements.registerForm);
        }

        if (elements.resetForm) {
            this.addEventListenerWithCleanup(elements.resetForm, 'submit', this.handlePasswordReset.bind(this));
            this.setupFormValidation(elements.resetForm);
        }

        if (elements.forgotPassword) {
            this.addEventListenerWithCleanup(elements.forgotPassword, 'click', this.handleForgotPassword.bind(this));
        }

        if (elements.signUpLink) {
            this.addEventListenerWithCleanup(elements.signUpLink, 'click', this.handleSignUp.bind(this));
        }

        if (elements.signInLink) {
            this.addEventListenerWithCleanup(elements.signInLink, 'click', this.handleSignIn.bind(this));
        }
        
        if (elements.logoutButton) {
            this.addEventListenerWithCleanup(elements.logoutButton, 'click', this.handleLogout.bind(this));
        }
    }

    private addEventListenerWithCleanup(element: Element, event: string, handler: EventListener): void {
        element.addEventListener(event, handler);
        
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, []);
        }
        this.eventListeners.get(element)!.push({ event, handler });
    }

    private setupFormValidation(form: HTMLFormElement): void {
        const inputs = form.querySelectorAll<HTMLInputElement>('.form-input');
        
        inputs.forEach(input => {
            const debouncedValidation = debounce(() => this.validateField(input), 300);
            
            this.addEventListenerWithCleanup(input, 'blur', () => this.validateField(input));
            this.addEventListenerWithCleanup(input, 'input', debouncedValidation as EventListener);
        });
    }

    private async setDevelopmentDefaults(form: HTMLFormElement): Promise<void> {
        try {
            await firebaseConfigManager.getConfig();
            const formDefaults = await firebaseConfigManager.getFormDefaults();

            const defaults = form.id === 'registerForm' 
                ? {
                    displayName: formDefaults.displayName,
                    email: formDefaults.email,
                    password: formDefaults.password,
                    confirmPassword: formDefaults.password
                  }
                : {
                    email: formDefaults.email,
                    password: formDefaults.password
                  };

            Object.entries(defaults).forEach(([fieldName, defaultValue]) => {
                const input = form.querySelector<HTMLInputElement>(`[name="${fieldName}"]`);
                if (input && !input.value && defaultValue !== undefined) {
                    input.value = defaultValue;
                }
            });
        } catch (error) {
            throw error;
        }
    }

    private validateField(input: HTMLInputElement): void {
        const errorElement = document.getElementById(`${input.id}-error`);
        if (!errorElement) return;

        try {
            const { name, value } = input;
            
            if (name === 'confirmPassword') {
                const passwordInput = document.getElementById('password') as HTMLInputElement;
                if (passwordInput && value !== passwordInput.value) {
                    throw new Error('Passwords do not match');
                }
            } else if (name in authValidators) {
                authValidators[name as keyof ValidatorMap](value);
            }
            
            this.clearFieldError(input, errorElement);
        } catch (error) {
            this.showFieldError(input, errorElement, (error as Error).message);
        }
    }

    private showFieldError(input: HTMLInputElement, errorElement: HTMLElement, message: string): void {
        showFieldErrorWithInput(input, errorElement, message);
    }

    private clearFieldError(input: HTMLInputElement, errorElement: HTMLElement): void {
        clearFieldErrorWithInput(input, errorElement);
    }

    private async handleLogin(event: Event): Promise<void> {
        event.preventDefault();
        
        const formData = new FormData(event.target as HTMLFormElement);
        const credentials: LoginCredentials = {
            email: formData.get('email') as string,
            password: formData.get('password') as string
        };
        
        const button = (event.target as HTMLFormElement).querySelector<HTMLButtonElement>('button[type="submit"]');
        
        try {
            this.validateCredentials(credentials);
            await this.submitLogin(credentials, button!);
        } catch (error) {
            this.showFormError(event.target as HTMLFormElement, (error as Error).message);
        }
    }

    private validateCredentials(credentials: LoginCredentials): void {
        authValidators.email(credentials.email);
        authValidators.password(credentials.password);
    }

    private async submitLogin(credentials: LoginCredentials, button: HTMLButtonElement): Promise<void> {
        const originalText = button.textContent!;
        
        try {
            this.setButtonLoading(button, 'Signing in...');
            
            // Use Firebase Auth directly for login
            if (!firebaseAuthInstance) {
                throw new Error('Firebase not initialized');
            }
            const userCredential = await firebaseAuthInstance.signInWithEmailAndPassword(credentials.email, credentials.password) as UserCredential;
            
            // Get ID token for API authentication
            const idToken = await userCredential.user.getIdToken();
            this.setToken(idToken);
            
            // Store user ID for client-side operations
            this.setUserId(userCredential.user.uid);
            
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            const firebaseError = error as FirebaseError;
            let errorMessage = 'Login failed';
            if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/user-not-found') {
                errorMessage = 'Invalid email or password';
            } else if (firebaseError.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email format';
            } else if (firebaseError.code === 'auth/user-disabled') {
                errorMessage = 'Account has been disabled';
            } else if (firebaseError.code === 'auth/too-many-requests') {
                errorMessage = 'Too many failed attempts. Try again later';
            }
            throw new Error(errorMessage);
        } finally {
            this.resetButton(button, originalText);
        }
    }

    private async handleRegister(event: Event): Promise<void> {
        event.preventDefault();
        
        const formData = new FormData(event.target as HTMLFormElement);
        const userData: RegistrationData = {
            displayName: formData.get('displayName') as string,
            email: formData.get('email') as string,
            password: formData.get('password') as string,
            confirmPassword: formData.get('confirmPassword') as string
        };
        
        const button = (event.target as HTMLFormElement).querySelector<HTMLButtonElement>('button[type="submit"]');
        
        try {
            this.validateRegistrationData(userData);
            await this.submitRegistration(userData, button!);
        } catch (error) {
            this.showFormError(event.target as HTMLFormElement, (error as Error).message);
        }
    }

    private validateRegistrationData(userData: RegistrationData): void {
        authValidators.displayName(userData.displayName);
        authValidators.email(userData.email);
        authValidators.password(userData.password);
        
        if (userData.password !== userData.confirmPassword) {
            throw new Error('Passwords do not match');
        }
    }

    private async submitRegistration(userData: RegistrationData, button: HTMLButtonElement): Promise<void> {
        const originalText = button.textContent!;
        
        try {
            this.setButtonLoading(button, 'Creating Account...');

            // Use Firebase Auth directly for registration
            if (!firebaseAuthInstance) {
                throw new Error('Firebase not initialized');
            }
            const userCredential = await firebaseAuthInstance.createUserWithEmailAndPassword(userData.email, userData.password) as UserCredential;
            
            // Update display name using Firebase Auth updateProfile
            await firebaseAuthInstance.updateProfile(userCredential.user, {
                displayName: userData.displayName
            });
            
            // Get ID token for API authentication
            const idToken = await userCredential.user.getIdToken();
            this.setToken(idToken);
            
            // Store user ID for client-side operations
            this.setUserId(userCredential.user.uid);
            
            // Skip user document creation for now - can be done on first dashboard load
            logger.log('Registration successful, redirecting to dashboard');
            
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            const firebaseError = error as FirebaseError;
            logger.error('Registration error:', error);
            let errorMessage = 'Registration failed';
            if (firebaseError.code === 'auth/email-already-in-use') {
                errorMessage = 'An account with this email already exists';
            } else if (firebaseError.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email format';
            } else if (firebaseError.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak';
            } else if (firebaseError.code === 'auth/operation-not-allowed') {
                errorMessage = 'Registration is currently disabled';
            } else {
                errorMessage = `Registration failed: ${firebaseError.message}`;
            }
            throw new Error(errorMessage);
        } finally {
            this.resetButton(button, originalText);
        }
    }


    private setButtonLoading(button: HTMLButtonElement, text: string): void {
        button.textContent = text;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
    }

    private resetButton(button: HTMLButtonElement, originalText: string): void {
        button.textContent = originalText;
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }

    private showFormError(form: HTMLFormElement, message: string): void {
        showFormError(form, message);
    }

    private showSuccessMessage(form: HTMLFormElement, message: string): void {
        showSuccessMessage(form, message);
    }

    private handleForgotPassword(event: Event): void {
        event.preventDefault();
        window.location.href = 'reset-password.html';
    }

    private async handlePasswordReset(event: Event): Promise<void> {
        event.preventDefault();
        
        const formData = new FormData(event.target as HTMLFormElement);
        const email = formData.get('email') as string;
        
        const button = (event.target as HTMLFormElement).querySelector<HTMLButtonElement>('button[type="submit"]');
        
        try {
            authValidators.email(email);
            await this.submitPasswordReset(email, button!);
        } catch (error) {
            this.showFormError(event.target as HTMLFormElement, (error as Error).message);
        }
    }

    private async submitPasswordReset(email: string, button: HTMLButtonElement): Promise<void> {
        const originalText = button.textContent!;
        
        try {
            this.setButtonLoading(button, 'Sending...');
            
            if (!firebaseAuthInstance) {
                throw new Error('Firebase not initialized');
            }
            
            await firebaseAuthInstance.sendPasswordResetEmail(email);
            
            this.showSuccessMessage(button.closest('form')!, 'Password reset email sent! Check your inbox.');
            
        } catch (error) {
            const firebaseError = error as FirebaseError;
            let errorMessage = 'Failed to send reset email';
            if (firebaseError.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address';
            } else if (firebaseError.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email format';
            } else if (firebaseError.code === 'auth/too-many-requests') {
                errorMessage = 'Too many requests. Please try again later';
            }
            throw new Error(errorMessage);
        } finally {
            this.resetButton(button, originalText);
        }
    }

    private handleSignUp(event: Event): void {
        event.preventDefault();
        window.location.href = 'register.html';
    }

    private handleSignIn(event: Event): void {
        event.preventDefault();
        window.location.href = 'index.html';
    }
    
    private handleLogout(event: Event): void {
        event.preventDefault();
        this.logout();
    }

    private setToken(token: string): void {
        if (!token) throw new Error('Invalid token provided');
        
        this.token = token;
        localStorage.setItem(AUTH_TOKEN_KEY, token);
    }

    getToken(): string | null {
        return this.token;
    }

    getUserId(): string | null {
        return localStorage.getItem(USER_ID_KEY);
    }

    setUserId(userId: string): void {
        localStorage.setItem(USER_ID_KEY, userId);
    }

    clearUserId(): void {
        localStorage.removeItem(USER_ID_KEY);
    }

    clearToken(): void {
        this.token = null;
        localStorage.removeItem(AUTH_TOKEN_KEY);
        this.clearUserId();
    }

    isAuthenticated(): boolean {
        return !!this.token;
    }

    logout(): void {
        this.clearToken();
        window.location.href = 'index.html';
    }

    async sendPasswordResetEmail(email: string): Promise<void> {
        if (!firebaseAuthInstance) {
            throw new Error('Firebase not initialized');
        }
        
        // Validate email before sending
        authValidators.email(email);
        
        await firebaseAuthInstance.sendPasswordResetEmail(email);
    }

    destroy(): void {
        this.eventListeners.forEach((listeners, element) => {
            listeners.forEach(({ event, handler }) => {
                element.removeEventListener(event, handler);
            });
        });
        this.eventListeners.clear();
    }
}

export const authManager = new AuthManager();

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        authManager?.destroy();
    });
});