# CSS Cleanup: Unused Styles in main.css

## Test-specific classes

These classes seem to be related to testing and are not used in the application.

```css
/* ===== TEST-SPECIFIC CLASSES ===== */
.test-container {
    max-width: 800px;
    margin: 0 auto;
    padding: var(--space-lg);
}

.test-section {
    margin-bottom: var(--space-xl);
    padding: var(--space-lg);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
}

.test-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    margin-bottom: var(--space-md);
}

.test-result {
    padding: var(--space-md);
    border-radius: var(--radius-md);
    margin-top: var(--space-md);
    font-family: 'Courier New', monospace;
    background: var(--color-background);
}
```

## Unused Auth Card Variants - ANALYSIS NEEDED

Some of these variant classes for auth cards may still be in use after component standardization.

```css
.auth-card--login,
.auth-card--register,
.auth-card--reset {
    /* Variant styles can be added here */
}
```

**Status:** auth-card--login and auth-card--register are currently in use in login.html and register.html. auth-card--reset needs verification.

## Unused Form and Button Components - ANALYSIS NEEDED

The following form and button components may or may not be used in the application after component architecture changes.

```css
.form-select {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--font-size-base);
    font-family: var(--font-family-base);
    cursor: pointer;
    transition: border-color var(--transition-fast);
}

.form-select:focus {
    outline: none;
    border-color: var(--color-border-focus);
}

.form-textarea {
    resize: vertical;
    min-height: 80px;
}

.form-control {
    width: 100%;
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    transition: 150ms ease;
}

.form-control:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-group {
    display: flex;
    align-items: stretch;
}

.input-group-text {
    display: flex;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-right: none;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
}

.input-group .form-input {
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    border-left: none;
}

.radio-group {
    display: flex;
    gap: var(--space-lg);
    flex-wrap: wrap;
}

.radio-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    cursor: pointer;
    color: var(--color-text);
    font-weight: var(--font-weight-medium);
}

.radio-label input[type="radio"] {
    display: none;
}

.radio-custom {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-border);
    border-radius: 50%;
    position: relative;
    transition: all var(--transition-fast);
}

.radio-label input[type="radio"]:checked + .radio-custom {
    border-color: var(--color-primary);
    background: var(--color-primary);
}

.radio-label input[type="radio"]:checked + .radio-custom::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
    transform: translate(-50%, -50%);
}

.button--danger {
    background: var(--color-error);
    color: white;
}

.button--danger:hover:not(:disabled) {
    background: #dc2626;
    transform: translateY(-1px);
}

.button--danger:active:not(:disabled) {
    transform: translateY(0);
}

.button--large {
    padding: var(--space-md) var(--space-lg);
    font-size: var(--font-size-lg);
    width: 100%;
}

.button--logout {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-size: var(--font-size-sm);
    padding: var(--space-sm) var(--space-md);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    font-weight: 500;
    transition: all 0.2s ease;
}

.button--logout:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.button--icon {
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: var(--transition-fast);
}

.button--icon:hover:not(:disabled) {
    background: var(--color-surface);
    color: var(--color-text);
    border-color: var(--color-text-muted);
}

.button--icon.button--danger:hover:not(:disabled) {
    background: var(--color-error);
    color: white;
    border-color: var(--color-error);
}

.button--icon:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.button--small {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-sm);
}

.auth-card__footer {
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
}

.auth-nav p {
    margin-bottom: var(--space-sm);
}

.auth-nav p:last-child {
    margin-bottom: 0;
}

.auth-link {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: var(--font-weight-medium);
    transition: color var(--transition-fast);
}

.auth-link:hover {
    color: var(--color-primary-dark);
    text-decoration: underline;
}

.auth-link--primary {
    font-weight: var(--font-weight-semibold);
}
```

## Implementation Notes

**Before proceeding with cleanup:**

1. **Verify test classes:** Confirm .test-container, .test-section, .test-title, .test-result are not used anywhere
2. **Auth card analysis:** Complete analysis of auth card variants after component standardization 
3. **Form component audit:** Check which form and button classes are actually unused
4. **Component scan:** Search entire codebase for class usage, not just HTML files

**Safe to remove (confirmed unused):**
- Test-specific classes (.test-*)

**Requires verification:**
- Auth card variants (some confirmed in use)
- Form and button components 
- All the massive component and layout styles section

This task should be approached incrementally, removing only confirmed unused styles to avoid breaking functionality.