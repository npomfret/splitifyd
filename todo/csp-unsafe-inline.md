# CSP `unsafe-inline` in Security Headers

## Problem
- **Location**: `firebase/functions/src/middleware/security-headers.ts:20`
- **Description**: The `Content-Security-Policy` (CSP) in `applySecurityHeaders` uses `'unsafe-inline'` for `script-src` and `style-src`. While this might be necessary for some legacy code or specific third-party libraries, it significantly weakens the protection against Cross-Site Scripting (XSS) attacks. An attacker could inject inline scripts or styles if they find another vulnerability.
- **Current vs Expected**:
  - Current: `script-src 'self' 'unsafe-inline' ...; style-src 'self' 'unsafe-inline' ...;`
  - Expected: Remove `'unsafe-inline'` and instead use cryptographic nonces or hashes for inline scripts and styles, or refactor code to avoid inline scripts/styles entirely.

## Solution
- **Option 1 (Recommended - Nonces)**: Generate a unique, cryptographically strong nonce for each request and include it in the CSP header and as an attribute on all inline `<script>` and `<style>` tags. This allows only scripts/styles with the correct nonce to execute.
- **Option 2 (Hashes)**: Calculate the SHA hash of each inline script/style block and include these hashes in the CSP header. This is less flexible than nonces as any change to the inline content requires updating the hash.
- **Option 3 (Refactor)**: Move all inline scripts and styles into external files. This is the most secure option but might require significant refactoring.

## Impact
- **Type**: Security improvement.
- **Risk**: Medium (implementing nonces/hashes requires careful integration; refactoring might be complex).
- **Complexity**: Moderate to Complex.
- **Benefit**: High value (significantly enhances protection against XSS attacks).

## Implementation Notes
- If using nonces, ensure the nonce is generated securely on each request and is not guessable.
- Consider the impact on any third-party scripts or libraries that might rely on inline execution.
