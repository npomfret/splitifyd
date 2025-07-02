const AUTH_TOKEN_KEY = 'splitifyd_auth_token';
const API_BASE_URL = 'http://localhost:5001/splitifyd-66e07/us-central1';

class Auth {
    constructor() {
        this.token = localStorage.getItem(AUTH_TOKEN_KEY);
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const forgotPasswordLink = document.getElementById('forgotPassword');
        const signUpLink = document.getElementById('signUpLink');

        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', this.handleForgotPassword.bind(this));
        }

        if (signUpLink) {
            signUpLink.addEventListener('click', this.handleSignUp.bind(this));
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
        // TODO: Navigate to registration page
        alert('Registration page coming soon');
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