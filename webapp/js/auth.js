const AUTH_TOKEN_KEY = 'splitifyd_auth_token';

// Dynamic API configuration to avoid CORS issues
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const localHost = window.location.hostname;
const LOCAL_FUNCTIONS_EMULATOR_PORT = 5001;

const API_BASE_URL = isLocal
    ? `http://${localHost}:${LOCAL_FUNCTIONS_EMULATOR_PORT}/splitifyd/us-central1`
    : `https://api-po437q3l5q-uc.a.run.app`;

class Auth {
    constructor() {
        this.token = localStorage.getItem(AUTH_TOKEN_KEY);
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const forgotPasswordLink = document.getElementById('forgotPassword');
        const signUpLink = document.getElementById('signUpLink');
        const signInLink = document.getElementById('signInLink');

        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        if (registerForm) {
            registerForm.addEventListener('submit', this.handleRegister.bind(this));
        }

        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', this.handleForgotPassword.bind(this));
        }

        if (signUpLink) {
            signUpLink.addEventListener('click', this.handleSignUp.bind(this));
        }

        if (signInLink) {
            signInLink.addEventListener('click', this.handleSignIn.bind(this));
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        const button = event.target.querySelector('button[type="submit"]');
        const originalText = button.textContent;
        
        try {
            button.textContent = 'Signing in...';
            button.disabled = true;

            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data = await response.json();
            this.setToken(data.token);
            
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please check your credentials.');
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    handleForgotPassword(event) {
        event.preventDefault();
        // TODO: Implement forgot password flow
        alert('Forgot password functionality coming soon');
    }

    handleSignUp(event) {
        event.preventDefault();
        window.location.href = 'register.html';
    }

    handleSignIn(event) {
        event.preventDefault();
        window.location.href = 'index.html';
    }

    async handleRegister(event) {
        event.preventDefault();
        
        const displayName = document.getElementById('displayName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }
        
        const button = event.target.querySelector('button[type="submit"]');
        const originalText = button.textContent;
        
        try {
            button.textContent = 'Creating Account...';
            button.disabled = true;

            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ displayName, email, password }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Registration failed');
            }

            const data = await response.json();
            this.setToken(data.token);
            
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            console.error('Registration error:', error);
            alert(`Registration failed: ${error.message}`);
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem(AUTH_TOKEN_KEY, token);
    }

    getToken() {
        return this.token;
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem(AUTH_TOKEN_KEY);
    }

    isAuthenticated() {
        return !!this.token;
    }

    logout() {
        this.clearToken();
        window.location.href = 'index.html';
    }
}

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.auth = new Auth();
});