# Insecure Random Token Generation for Shareable Links

## Problem
- **Location**: `firebase/functions/src/groups/shareHandlers.ts`
- **Description**: The `generateShareToken` function uses `Math.random()` to create a shareable token. This method is not cryptographically secure and can lead to predictable tokens, allowing an attacker to guess valid share links and gain unauthorized access to groups.
- **Current vs Expected**:
  - **Current**: `Math.random()` is used, which is not suitable for security-sensitive tokens.
  - **Expected**: A cryptographically secure random number generator should be used to create unpredictable, high-entropy tokens.

## Solution
Use Node.js's built-in `crypto` module to generate a secure, random token.

```typescript
// In firebase/functions/src/groups/shareHandlers.ts
import { randomBytes } from 'crypto';

// Replace the existing generateShareToken function
const generateShareToken = (): string => {
  return randomBytes(16).toString('hex'); // Generates a 32-character hex string
};
```

This approach generates a much more secure and longer token, significantly reducing the risk of collision or guessing.

## Impact
- **Type**: Behavior change (tokens will be longer and more secure)
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: High value (critical security fix)

## Implementation Notes
- The change is self-contained within the `generateShareToken` function.
- Existing share links will become invalid, which is acceptable for this stage of the project. If this were a production system, a migration strategy would be needed.
- Ensure the `crypto` module is properly imported. It's a built-in Node.js module, so no dependency changes are needed.
