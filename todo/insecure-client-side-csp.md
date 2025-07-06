# Insecure `unsafe-inline` and `unsafe-eval` in Client-Side CSP

## Problem
- **Location**: `webapp/js/templates/base-layout.js:10`
- **Description**: The `Content-Security-Policy` (CSP) defined in `baseLayout.head()` for the client-side application uses `'unsafe-inline'` for `script-src` and `style-src`, and `'unsafe-eval'` for `script-src`. These directives significantly weaken the security posture against Cross-Site Scripting (XSS) attacks. `unsafe-inline` allows the execution of inline scripts and styles, while `unsafe-eval` permits the use of `eval()` and similar functions, making it easier for attackers to inject and execute malicious code.
- **Current vs Expected**:
  - Current: `script-src 'self' 'unsafe-inline' 'unsafe-eval' ...; style-src 'self' 'unsafe-inline' ...;`
  - Expected: Remove `'unsafe-inline'` and `'unsafe-eval'`. Use cryptographic nonces or hashes for inline scripts/styles, and refactor code to avoid `eval()` and similar constructs.

## Solution
- **Option 1 (Recommended - Nonces)**: Generate a unique, cryptographically strong nonce for each page load. Include this nonce in the CSP header and as an attribute on all inline `<script>` and `<style>` tags. This allows only scripts/styles with the correct nonce to execute.
- **Option 2 (Hashes)**: Calculate the SHA hash of each inline script/style block and include these hashes in the CSP header. This is less flexible than nonces as any change to the inline content requires updating the hash.
- **Option 3 (Refactor)**: Move all inline scripts and styles into external files and refactor any code using `eval()` or similar functions. This is the most secure option but might require significant refactoring.

## Impact
- **Type**: Security improvement.
- **Risk**: High (implementing nonces/hashes requires careful integration; refactoring might be complex).
- **Complexity**: Moderate to Complex.
- **Benefit**: High value (significantly enhances protection against XSS attacks, a critical web vulnerability).

## Implementation Notes
- Prioritize removing `unsafe-eval` first, as it poses a greater risk.
- If using nonces, ensure the nonce is generated securely on the server-side and passed to the client-side template.
- Carefully audit all inline scripts and styles to determine if they can be externalized or if nonces/hashes are a viable solution.
