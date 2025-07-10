# Webapp Issue: Secure Token Generation

## Issue Description

Shareable group links are generated using `Math.random()`, which is not cryptographically secure and could allow attackers to guess valid links.

## Recommendation

Replace `Math.random()` with Node.js's built-in `crypto.randomBytes()` to generate high-entropy, unpredictable tokens for all shareable links.

## Implementation Suggestions

This issue primarily concerns the backend (Firebase Functions) where the shareable links are generated. The webapp consumes these links. Therefore, the fix needs to be applied on the server-side.

**Backend (Firebase Functions) Implementation:**

1.  **Identify Link Generation Logic:** Locate the function responsible for generating shareable group links in the Firebase Functions codebase (e.g., in `firebase/functions/src/groups/` or a related service).

2.  **Replace `Math.random()` with `crypto.randomBytes()`:**
    *   Import the `crypto` module.
    *   Generate a random byte array and convert it to a suitable string format (e.g., hex or base64).

    ```typescript
    // Example: firebase/functions/src/groups/service.ts (or similar)
    import * as crypto from 'crypto';

    // Function to generate a secure random token
    function generateSecureToken(length: number = 16): string {
      return crypto.randomBytes(length).toString('hex'); // Generates a 32-char hex string for 16 bytes
    }

    // In your shareable link generation function:
    // const linkId = Math.random().toString(36).substring(2, 15); // OLD
    const linkId = generateSecureToken(16); // NEW
    ```

3.  **Ensure Uniqueness and Collision Handling:**
    *   While `crypto.randomBytes()` significantly reduces collision probability, it's still good practice to implement a check to ensure the generated `linkId` is unique before saving it to the database. If a collision occurs (extremely rare), regenerate the token.

**Webapp-Specific Action:**

*   No direct code changes are required in the webapp for this fix, as it consumes the generated link. However, it's important to verify that the webapp correctly handles the new format of the `linkId` if its length or character set changes significantly.

**Next Steps:**
1.  Implement the secure token generation in the Firebase Functions backend.
2.  Verify that the webapp can still correctly process and join groups using the newly generated secure links.
