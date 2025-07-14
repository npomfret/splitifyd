# Style Guide

*A modern, functional, and sexy approach to web development*

## 🎯 Core Philosophy

**Fail Fast, Build Smart, Stay Lean**

- **Fail fast**: Validate early, crash hard when things are wrong
- **Less is more**: Clean, minimal code over clever complexity  
- **Type safety**: Embrace TypeScript's power
- **Modern everything**: Latest APIs, patterns, and best practices
- **Security first**: Never compromise on security fundamentals

---

## 📁 Project Structure

```
webapp/
├── css/
│   ├── components/     # Component-specific styles
│   ├── utilities/      # Utility classes
│   └── main.css       # Global styles & imports
├── js/
│   ├── components/    # Reusable components
│   ├── services/      # API & business logic
│   └── utils/         # Helper functions
└── assets/
    ├── icons/         # SVG icons
    └── images/        # Optimized images
```

---

## 🚀 JavaScript/TypeScript Standards

### Modern Syntax Only

```javascript
// ✅ Use modern destructuring
const { email, password } = formData;
const [...items] = collection;

// ✅ Use optional chaining
const value = user?.profile?.settings?.theme;

// ✅ Use nullish coalescing
const port = process.env.PORT ?? 3000;

// ✅ Use async/await
async handleSubmit() {
    const result = await this.api.post('/login', data);
    return result.data;
}
```

### Class-Based Components

```javascript
// ✅ Clean class structure
class AuthManager {
    #token = null;  // Private fields
    
    constructor(config) {
        this.config = config;
        this.#initializeEventListeners();
    }
    
    async login(credentials) {
        this.#validateCredentials(credentials);
        const response = await this.#makeRequest('/login', credentials);
        
        if (!response.ok) {
            throw new Error(`Login failed: ${response.status}`);
        }
        
        this.#setToken(response.token);
        return response.user;
    }
    
    #validateCredentials(credentials) {
        if (!credentials.email || !credentials.password) {
            throw new Error('Missing required credentials');
        }
    }
}
```

### Error Handling

*For comprehensive error handling strategy and implementation details, see [TECHNICAL_CONFIG.md](../TECHNICAL_CONFIG.md)*

```javascript
// ✅ Fail fast with meaningful errors
validateUser(user) {
    if (!user.email) throw new Error('Email is required');
    if (!user.password) throw new Error('Password is required');
    if (user.password.length < 8) throw new Error('Password must be at least 8 characters');
}

// ✅ Let errors bubble up
async fetchUserData(id) {
    const response = await fetch(`/api/users/${id}`);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.status}`);
    }
    
    return response.json();
}
```

### Function Naming

```javascript
// ✅ Clear, descriptive names
async validateAndSubmitForm(formData) { }
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ✅ Prefix async functions with action verbs
async fetchUserProfile() { }
async createNewDocument() { }
async updateUserSettings() { }

// ✅ Boolean functions start with is/has/can/should
const isAuthenticated = () => !!this.token;
const hasPermission = (permission) => this.permissions.includes(permission);
```

---

## 🎨 CSS Standards

### Modern CSS Architecture

```css
/* ✅ Use CSS custom properties */
:root {
    --color-primary: #667eea;
    --color-primary-dark: #5a67d8;
    --color-surface: #ffffff;
    --color-text: #1a202c;
    --color-text-muted: #718096;
    
    --space-xs: 0.25rem;
    --space-sm: 0.5rem;
    --space-md: 1rem;
    --space-lg: 1.5rem;
    --space-xl: 2rem;
    
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
    
    --transition-fast: 0.15s ease;
    --transition-base: 0.2s ease;
    --transition-slow: 0.3s ease;
}

/* ✅ Use modern layout systems */
.container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-lg);
}

.card {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: transform var(--transition-base);
}

.card:hover {
    transform: translateY(-2px);
}
```

### Component-Based Styling

```css
/* ✅ Block Element Modifier (BEM) methodology */
.button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-base);
}

.button--primary {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
    color: white;
}

.button--primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.button--large {
    padding: var(--space-md) var(--space-lg);
    font-size: 1.125rem;
}

.button__icon {
    margin-right: var(--space-xs);
}
```

### Responsive Design

```css
/* ✅ Mobile-first approach */
.grid {
    display: grid;
    gap: var(--space-md);
    grid-template-columns: 1fr;
}

/* ✅ Use logical breakpoints */
@media (min-width: 768px) {
    .grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 1024px) {
    .grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

/* ✅ Use container queries when supported */
@container (min-width: 400px) {
    .card {
        padding: var(--space-xl);
    }
}
```

---

## 🏗️ HTML Best Practices

### Semantic Structure

```html
<!-- ✅ Use semantic HTML5 elements -->
<article class="post">
    <header class="post__header">
        <h1 class="post__title">Article Title</h1>
        <time class="post__date" datetime="2024-01-01">January 1, 2024</time>
    </header>
    
    <main class="post__content">
        <p>Article content...</p>
    </main>
    
    <footer class="post__footer">
        <nav class="post__nav" aria-label="Article navigation">
            <a href="#prev" rel="prev">Previous</a>
            <a href="#next" rel="next">Next</a>
        </nav>
    </footer>
</article>
```

### Accessibility Standards

```html
<!-- ✅ Always include proper ARIA labels -->
<button class="button button--primary" aria-describedby="submit-help">
    Submit Form
</button>
<div id="submit-help" class="sr-only">
    This will submit your form data
</div>

<!-- ✅ Proper form labeling -->
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
        aria-describedby="email-error"
    >
    <div id="email-error" class="form-error" role="alert"></div>
</div>
```

### Performance Optimizations

```html
<!-- ✅ Optimize images -->
<img 
    src="hero-400.webp" 
    srcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
    alt="Hero image description"
    loading="lazy"
    decoding="async"
>

<!-- ✅ Preload critical resources -->
<link rel="preload" href="fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="css/critical.css" as="style">

<!-- ✅ Use resource hints -->
<link rel="dns-prefetch" href="//api.example.com">
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
```

---

## 🔒 Security Guidelines

*For comprehensive security implementation including input validation, XSS prevention, and secure headers, see [TECHNICAL_CONFIG.md](../TECHNICAL_CONFIG.md)*

---

## ⚡ Performance Standards

### Loading Strategies

```javascript
// ✅ Lazy load modules
const lazyLoadComponent = async (componentName) => {
    const { default: Component } = await import(`./components/${componentName}.js`);
    return Component;
};

// ✅ Debounce expensive operations
const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(null, args), delay);
    };
};

const handleSearch = debounce(async (query) => {
    const results = await searchAPI(query);
    renderResults(results);
}, 300);
```

*For detailed memory management and performance optimization guidelines, see [TECHNICAL_CONFIG.md](../TECHNICAL_CONFIG.md)*

```javascript
// ✅ Clean up event listeners
class Component {
    constructor() {
        this.handleClick = this.handleClick.bind(this);
    }
    
    mount() {
        document.addEventListener('click', this.handleClick);
    }
    
    unmount() {
        document.removeEventListener('click', this.handleClick);
    }
}
```

---

## 📏 Naming Conventions

### Files & Directories

```
✅ kebab-case for files
auth-manager.js
user-profile.css
forgot-password.html

✅ PascalCase for classes/components
AuthManager.js
UserProfile.js
ForgotPassword.js

✅ lowercase for directories
components/
services/
utils/
```

### Variables & Functions

```javascript
// ✅ camelCase for variables and functions
const userProfile = {};
const isAuthenticated = false;
const getCurrentUser = () => {};

// ✅ SCREAMING_SNAKE_CASE for constants
const API_BASE_URL = 'https://api.example.com';
const AUTH_TOKEN_KEY = 'auth_token';
const MAX_RETRY_ATTEMPTS = 3;

// ✅ PascalCase for classes
class AuthManager {}
class UserService {}
class ApiClient {}
```

---

## 🧪 Testing Philosophy

*For comprehensive testing configuration and procedures, see [TECHNICAL_CONFIG.md](../TECHNICAL_CONFIG.md)*

### Unit Tests

```javascript
// ✅ Test behavior, not implementation
describe('AuthManager', () => {
    test('should throw error for invalid credentials', () => {
        const auth = new AuthManager();
        
        expect(() => {
            auth.validateCredentials({ email: '', password: '' });
        }).toThrow('Email is required');
    });
});
```

---

## 🚀 Build & Deployment

### Modern Build Tools

```javascript
// ✅ Use ES modules
import { AuthManager } from './auth-manager.js';
import { debounce } from './utils/debounce.js';

// ✅ Dynamic imports for code splitting
const loadDashboard = () => import('./dashboard.js');

// ✅ Tree-shake unused code
export { AuthManager, ApiClient };
```

### Environment Configuration

```javascript
// ✅ Environment-specific configuration
const config = {
    development: {
        apiUrl: 'http://localhost:5001',
        debug: true
    },
    production: {
        apiUrl: 'https://api.example.com',
        debug: false
    }
};

export default config[process.env.NODE_ENV || 'development'];
```

---

## 🎯 Quick Reference

### Do's
- ✅ Use modern JavaScript features (ES2024+)
- ✅ Validate inputs early and fail fast
- ✅ Write self-documenting code
- ✅ Use TypeScript for type safety
- ✅ Optimize for performance from day one
- ✅ Follow accessibility standards
- ✅ Keep components small and focused
- ✅ Use CSS custom properties
- ✅ Implement proper error handling

### Don'ts
- ❌ Don't use outdated JavaScript patterns
- ❌ Don't catch and log errors without handling
- ❌ Don't create "kitchen sink" components
- ❌ Don't ignore accessibility
- ❌ Don't hardcode values
- ❌ Don't use `var` or `function` declarations
- ❌ Don't nest CSS more than 3 levels deep
- ❌ Don't use `!important` unless absolutely necessary
- ❌ Don't commit secrets or sensitive data

---

*"The best code is the code you don't have to write, but when you do write it, make it count."*

**Last Updated**: January 2024  
**Version**: 1.0.0