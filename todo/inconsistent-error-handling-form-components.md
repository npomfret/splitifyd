# Inconsistent Error Handling in `FormComponents.showError` and `hideError`

## Problem
- **Location**: `webapp/js/components/form-components.js:90`, `webapp/js/components/form-components.js:97`
- **Description**: The `showError` and `hideError` methods in `FormComponents` directly manipulate the `style.display` property to show/hide error messages. While functional, this approach can lead to inconsistent styling if the CSS framework or custom styles use different display properties (e.g., `display: flex`, `display: grid`) or rely on CSS classes for visibility. It also mixes presentation logic directly into JavaScript, making it harder to manage styles centrally.
- **Current vs Expected**:
  - Current:
    ```javascript
    element.style.display = 'block';
    element.style.display = 'none';
    ```
  - Expected: Use CSS classes to toggle visibility (e.g., `element.classList.add('show-error')`, `element.classList.remove('show-error')`) or rely on a CSS framework's utility classes.

## Solution
- Refactor `showError` and `hideError` to toggle a CSS class (e.g., `is-visible`, `has-error`) on the error message element. Define the display properties (and other styling) for these classes in the CSS stylesheet.

## Impact
- **Type**: Code quality improvement, maintainability.
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Improves consistency in styling, separates concerns (JavaScript for behavior, CSS for presentation), and makes it easier to change error message appearance globally.

## Implementation Notes
- Define appropriate CSS classes (e.g., `.error-message.is-visible { display: block; }`) in `webapp/css/main.css` or a similar stylesheet.
- Ensure that the initial state of error messages in the HTML is `display: none` or hidden by default via CSS.
