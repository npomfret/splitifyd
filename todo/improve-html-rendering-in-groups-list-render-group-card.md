# Improve HTML Rendering in GroupsList.renderGroupCard

**Problem**: The `GroupsList.renderGroupCard` method in `webapp/js/groups.js` constructs HTML using extensive string concatenation. This approach is highly susceptible to Cross-Site Scripting (XSS) vulnerabilities if any dynamic data (e.g., `group.name`, `group.lastExpense.description`, `member.name`) is not meticulously sanitized before being inserted into the HTML string. Even with basic sanitization, complex XSS payloads can bypass simple regexes. Additionally, building complex UI elements with string concatenation makes the code difficult to read, maintain, and debug, especially as the UI grows.

**File**: `webapp/js/groups.js`

**Suggested Solution**:
1. **Use DOM Manipulation**: The most secure and robust approach for dynamic HTML generation in vanilla JavaScript is to use DOM manipulation methods (`document.createElement()`, `appendChild()`, `textContent`). By setting `textContent` instead of `innerHTML` for dynamic data, you automatically escape HTML entities, preventing XSS.
2. **Adopt a Templating Library**: For more complex UI components, consider adopting a lightweight templating library (e.g., Lit, Handlebars.js, or even simple template literals with proper escaping functions). These libraries often provide built-in XSS protection and improve readability by separating structure from data.
3. **Centralize HTML Sanitization (as a fallback)**: If, for performance or other reasons, string concatenation *must* be used, ensure that all dynamic data is passed through a robust HTML sanitization function (e.g., `DOMPurify` for client-side sanitization) before being inserted into the HTML string. This should be a last resort, as it's harder to guarantee complete XSS protection with this method.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality and visual output should remain identical, but the underlying HTML rendering mechanism will be more secure and maintainable.

**Risk**: Medium. This change requires careful implementation to ensure that no XSS vulnerabilities are introduced (if not using DOM manipulation) or that existing functionality is not broken. Thorough testing of the rendered output with various data inputs (including malicious ones) is crucial.

**Complexity**: Medium. This change involves rewriting the HTML rendering logic within the `renderGroupCard` method, which can be time-consuming depending on the chosen approach.

**Benefit**: High. This change will significantly improve the security of the application by mitigating XSS risks and enhance the maintainability and readability of the frontend code, making future UI development easier and safer.