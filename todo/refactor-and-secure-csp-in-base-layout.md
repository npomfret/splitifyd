
# Refactor and Secure Content-Security-Policy in Base Layout

**Problem**: The `head` method in `webapp/js/templates/base-layout.js` contains a hardcoded `Content-Security-Policy` (CSP) that includes `'unsafe-inline'` and `'unsafe-eval'` for `script-src`. These directives are major security vulnerabilities as they allow inline scripts and `eval()` to execute, effectively bypassing XSS protection. Additionally, the CSP includes hardcoded URLs that might change, making it difficult to maintain.

**File**: `webapp/js/templates/base-layout.js`

**Suggested Solution**:
1. **Remove `unsafe-inline` and `unsafe-eval`**: Eliminate these directives from the `script-src` policy. All scripts should be loaded from external files with a `nonce` or `hash`.
2. **Use Hashes or Nonces**: For any necessary inline scripts (though they should be minimized), use CSP hashes or nonces. Nonces are generally preferred for dynamic content.
3. **Externalize CSP**: Move the CSP definition to an HTTP header (e.g., `Content-Security-Policy` header sent by the Firebase Function) rather than embedding it in the HTML. This provides better security and flexibility.
4. **Dynamic URL Generation**: If URLs need to be included, they should be dynamically generated based on environment variables or configuration, rather than hardcoded.
5. **Review All Directives**: Conduct a thorough review of all CSP directives to ensure they are as restrictive as possible while allowing necessary functionality.

**Behavior Change**: This is a behavior change. The application will have a stricter CSP, which may break existing inline scripts or `eval()` calls. This is an intentional security improvement.

**Risk**: High. Implementing a stricter CSP can break existing functionality if not all inline scripts or dynamic content sources are properly identified and whitelisted. Thorough testing is required.

**Complexity**: High. This change involves modifying the CSP, potentially refactoring inline scripts, and coordinating with backend deployment to set HTTP headers.

**Benefit**: High. This change will significantly improve the security of the application by providing a robust defense against XSS attacks.
