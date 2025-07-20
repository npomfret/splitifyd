# CSS Cleanup: Unused Styles in main.css

## Task Status: PARTIALLY COMPLETE ✅

### Phase 1 Completed (2025-07-20)
- ✅ **Test-specific classes**: REMOVED - all 4 classes deleted from main.css
- ✅ **auth-card--reset**: REMOVED - variant deleted from main.css
- ✅ **Build verification**: All builds pass successfully
- ✅ **Lines removed**: 30+ lines of dead CSS code

### Remaining Work
- **Form/button components**: Still require individual verification (Phase 2)

## Test-specific classes - REMOVED ✅

These classes were not used anywhere in the application and have been successfully removed.

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

## Unused Auth Card Variants - CLEANUP COMPLETE ✅

```css
.auth-card--login,     /* IN USE - kept */
.auth-card--register { /* IN USE - kept */
    /* Variant styles can be added here */
}
/* .auth-card--reset removed - was unused */
```

**Final Status:** 
- ✅ auth-card--login: IN USE - kept in code
- ✅ auth-card--register: IN USE - kept in code
- ✅ auth-card--reset: UNUSED - successfully removed

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

## Implementation Plan

### Phase 1: Remove Confirmed Unused Classes ✅ COMPLETED
**Removed successfully:**
1. ✅ All test-specific classes (.test-container, .test-section, .test-title, .test-result)
2. ✅ .auth-card--reset variant

**Steps completed:**
1. ✅ Removed the entire `/* ===== TEST-SPECIFIC CLASSES ===== */` section from main.css
2. ✅ Removed `.auth-card--reset` from the auth card variants  
3. ✅ Verified build passes with no errors
4. ✅ Changes staged and ready for commit

### Phase 2: Audit Form and Button Components
**Classes requiring individual verification:**
- .form-select
- .form-textarea
- .form-control
- .input-group and .input-group-text
- .radio-group, .radio-label, .radio-custom
- .button--danger, .button--large, .button--logout, .button--icon, .button--small
- .auth-card__footer
- .auth-nav, .auth-link, .auth-link--primary

**Verification method:**
1. Search for each class in HTML files
2. Search for each class in TypeScript files (both string literals and DOM manipulation)
3. Check if classes are used in ui-builders.ts or other component builders
4. Document findings for each class

### Phase 3: Progressive Removal
1. Remove only confirmed unused classes
2. Test thoroughly after each removal
3. Run build and check for any issues
4. Commit in small batches

### Success Criteria
- Reduce CSS file size by removing dead code
- No visual or functional regressions
- All builds pass
- Improved maintainability

### Risk Mitigation
- Make small, incremental changes
- Test each change thoroughly
- Keep detailed notes of what was removed
- Be prepared to revert if issues arise