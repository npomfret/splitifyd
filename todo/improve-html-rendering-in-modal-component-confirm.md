
# Improve HTML Rendering in ModalComponent.confirm

**Problem**: The `ModalComponent.confirm` method in `webapp/js/components/modal.js` directly appends HTML to `document.body` using `tempDiv.innerHTML = modalHtml`. The `modalHtml` is generated using string concatenation from potentially untrusted `config` parameters (e.g., `title`, `message`). This approach is highly susceptible to Cross-Site Scripting (XSS) vulnerabilities if these parameters are not meticulously sanitized before being inserted into the HTML string.

**File**: `webapp/js/components/modal.js`

**Suggested Solution**:
1. **Use DOM Manipulation**: Instead of setting `innerHTML`, construct the modal elements using `document.createElement()` and append them using `appendChild()`. Set text content using `textContent` for dynamic data to automatically escape HTML entities, preventing XSS.
2. **Centralize HTML Sanitization (as a fallback)**: If string concatenation *must* be used, ensure that all dynamic data passed into `ModalComponent.render` (which is then used by `ModalComponent.confirm`) is passed through a robust HTML sanitization function (e.g., `DOMPurify` for client-side sanitization) before being inserted into the HTML string. This should be a last resort.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality and visual output should remain identical, but the underlying HTML rendering mechanism will be more secure and maintainable.

**Risk**: Medium. This change requires careful implementation to ensure that no XSS vulnerabilities are introduced or that existing functionality is not broken. Thorough testing of the rendered output with various data inputs (including malicious ones) is crucial.

**Complexity**: Medium. This change involves rewriting the HTML rendering logic within the `ModalComponent.confirm` method.

**Benefit**: High. This change will significantly improve the security of the application by mitigating XSS risks in modal rendering.
