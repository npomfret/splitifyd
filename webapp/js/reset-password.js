import { TemplateEngine } from './templates/template-engine.js';
import { baseLayout } from './templates/base-layout.js';
import { AuthCardComponent } from './components/auth-card.js';

const renderResetPassword = () => {
    const formContent = `
        <form class="auth-form" id="resetForm" novalidate>
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
            
            <button type="submit" class="button button--primary button--large" aria-describedby="submit-help">
                Send Reset Link
            </button>
            <div id="submit-help" class="sr-only">
                This will send a password reset link to your email
            </div>
        </form>
    `;

    const footerContent = `
        <nav class="auth-nav" aria-label="Authentication navigation">
            <p><a href="index.html" class="auth-link">Back to Sign In</a></p>
            <p>Don't have an account? <a href="register.html" class="auth-link auth-link--primary">Sign up</a></p>
        </nav>
    `;

    const bodyContent = AuthCardComponent.render({
        subtitleTitle: 'Reset Password',
        subtitle: 'Enter your email to receive reset instructions',
        formContent,
        footerContent,
        cardClass: 'auth-card--reset'
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
            title: 'Splitifyd - Reset Password',
            bodyContent,
            additionalStyles,
            additionalScripts
        }
    });
};

renderResetPassword();