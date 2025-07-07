import { TemplateEngine } from './templates/template-engine.js';
import { baseLayout } from './templates/base-layout.js';
import { AuthCardComponent } from './components/auth-card.js';

const renderRegister = () => {
    const formContent = `
        <form class="auth-form" id="registerForm" novalidate>
            <div class="form-group">
                <label for="displayName" class="form-label">
                    Display Name
                    <span class="form-label__required" aria-label="required">*</span>
                </label>
                <input 
                    type="text" 
                    id="displayName" 
                    name="displayName" 
                    class="form-input"
                    required
                    autocomplete="name"
                    aria-describedby="displayName-error"
                    minlength="2"
                    maxlength="50"
                >
                <div id="displayName-error" class="form-error" role="alert"></div>
            </div>
            
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
                    minlength="8"
                    autocomplete="new-password"
                    aria-describedby="password-error password-help"
                    maxlength="100"
                >
                <div id="password-help" class="form-help">
                    At least 8 characters with uppercase, lowercase, number, and special character
                </div>
                <div id="password-error" class="form-error" role="alert"></div>
            </div>
            
            <div class="form-group">
                <label for="confirmPassword" class="form-label">
                    Confirm Password
                    <span class="form-label__required" aria-label="required">*</span>
                </label>
                <input 
                    type="password" 
                    id="confirmPassword" 
                    name="confirmPassword" 
                    class="form-input"
                    required
                    autocomplete="new-password"
                    aria-describedby="confirmPassword-error"
                >
                <div id="confirmPassword-error" class="form-error" role="alert"></div>
            </div>
            
            <button type="submit" class="button button--primary button--large" aria-describedby="submit-help">
                Create Account
            </button>
            <div id="submit-help" class="sr-only">
                This will create your new Splitifyd account
            </div>
        </form>
    `;

    const footerContent = `
        <nav class="auth-nav" aria-label="Authentication navigation">
            <p>Already have an account? <a href="index.html" id="signInLink" class="auth-link auth-link--primary">Sign in</a></p>
        </nav>
    `;

    const bodyContent = AuthCardComponent.render({
        formContent,
        footerContent,
        cardClass: 'auth-card--register'
    });

    const additionalStyles = `
        <link rel="preload" href="css/main.css" as="style">
        <link rel="stylesheet" href="css/main.css">
        <link rel="stylesheet" href="css/utility.css">
        <link rel="dns-prefetch" href="//api.splitifyd.com">
    `;

    const additionalScripts = `
        <script src="js/config.js"></script>
        <script src="js/auth.js"></script>
    `;

    TemplateEngine.loadAndRenderPage({
        layout: baseLayout,
        data: {
            title: 'Splitifyd - Register',
            bodyContent,
            additionalStyles,
            additionalScripts
        }
    });
};

renderRegister();