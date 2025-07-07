import { createElementSafe, clearElement } from './utils/safe-dom.js';

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Add CSS to head safely
        const head = document.head;
        clearElement(head);
        
        const metaElements = [
            { tag: 'meta', attrs: { charset: 'UTF-8' } },
            { tag: 'meta', attrs: { name: 'viewport', content: 'width=device-width, initial-scale=1.0' } },
            { tag: 'meta', attrs: { 'http-equiv': 'Cache-Control', content: 'no-cache, no-store, must-revalidate' } },
            { tag: 'meta', attrs: { 'http-equiv': 'Pragma', content: 'no-cache' } },
            { tag: 'meta', attrs: { 'http-equiv': 'Expires', content: '0' } },
            { tag: 'title', attrs: { textContent: 'Splitifyd - Login' } },
            { tag: 'link', attrs: { rel: 'stylesheet', href: `/css/main.css?v=${Date.now()}` } },
            { tag: 'link', attrs: { rel: 'stylesheet', href: `/css/utility.css?v=${Date.now()}` } },
            { tag: 'link', attrs: { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap', rel: 'stylesheet' } },
            { tag: 'link', attrs: { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' } }
        ];
        
        metaElements.forEach(({ tag, attrs }) => {
            const element = document.createElement(tag);
            Object.entries(attrs).forEach(([key, value]) => {
                if (key === 'textContent') {
                    element.textContent = value;
                } else {
                    element.setAttribute(key, value);
                }
            });
            head.appendChild(element);
        });

        // Render body content safely
        clearElement(document.body);
        
        const bodyContent = `
            <div id="warningBanner" class="warning-banner" style="display: none;">
                <div class="warning-content">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span id="warningMessage"></span>
                </div>
            </div>
            
            <div class="main-content">
                <main class="auth-container">
                    <article class="auth-card auth-card--login">
                        <header class="auth-card__header">
                            <h1 class="auth-card__title">
                                <a href="/index.html" class="auth-card__title-link">Splitifyd</a>
                            </h1>
                            <p class="auth-card__subtitle">Split bills with friends</p>
                        </header>
                        
                        <form class="auth-form" id="loginForm" novalidate>
                            <div class="form-group">
                                <label for="email" class="form-label">
                                    Email Address
                                    <span class="form-label__required" aria-label="required">*</span>
                                </label>
                                <input 
                                    type="email" 
                                    id="email" 
                                    name="email" 
                                    class="form-input"
                                    required
                                    autocomplete="email"
                                    aria-describedby="email-error"
                                    value=""
                                >
                                <div id="email-error" class="form-error" role="alert"></div>
                            </div>
                            
                            <div class="form-group">
                                <label for="password" class="form-label">
                                    Password
                                    <span class="form-label__required" aria-label="required">*</span>
                                </label>
                                <input 
                                    type="password" 
                                    id="password" 
                                    name="password" 
                                    class="form-input"
                                    required
                                    autocomplete="current-password"
                                    aria-describedby="password-error"
                                    value=""
                                >
                                <div id="password-error" class="form-error" role="alert"></div>
                            </div>
                            
                            <button type="submit" class="button button--primary button--large" aria-describedby="submit-help">
                                Sign In
                            </button>
                            <div id="submit-help" class="sr-only">
                                This will sign you into your Splitifyd account
                            </div>
                        </form>
                        
                        <footer class="auth-card__footer">
                            <nav class="auth-nav" aria-label="Authentication navigation">
                                <p><a href="reset-password.html" id="forgotPassword" class="auth-link">Forgot password?</a></p>
                                <p>Don't have an account? <a href="register.html" id="signUpLink" class="auth-link auth-link--primary">Sign up</a></p>
                            </nav>
                        </footer>
                    </article>
                </main>
            </div>
        `;
        
        // Create body content safely
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = bodyContent;
        while (tempDiv.firstChild) {
            document.body.appendChild(tempDiv.firstChild);
        }

        // Load additional scripts
        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src + '?v=' + Date.now();
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
        };

        // Load scripts
        Promise.all([
            loadScript('/js/firebase-config.js'),
            loadScript('/js/warning-banner.js'),
            loadScript('/js/config.js'),
            loadScript('/js/auth.js'),
            loadScript('/js/auth-redirect.js')
        ]).then(() => {
            // Scripts loaded successfully
        }).catch(error => {
            // Handle script loading errors
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'padding: 20px; color: red; background: white;';
            errorDiv.textContent = 'Error loading scripts: ' + error.message;
            document.body.appendChild(errorDiv);
        });

    } catch (error) {
        // Handle page rendering errors
        clearElement(document.body);
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'padding: 20px; color: red; background: white;';
        
        const title = document.createElement('h1');
        title.textContent = 'Error loading login page';
        errorDiv.appendChild(title);
        
        const message = document.createElement('pre');
        message.textContent = error.message;
        errorDiv.appendChild(message);
        
        document.body.appendChild(errorDiv);
    }
});