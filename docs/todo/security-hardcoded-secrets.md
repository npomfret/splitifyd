# Hardcoded API Keys and Configuration

## Problem
- **Location**: `firebase/functions/src/config.ts`
- **Description**: The configuration file contains hardcoded API keys, project IDs, and other sensitive or environment-specific values. This is a major security risk, as it exposes secrets in the source code. It also makes it difficult to manage different environments (development, staging, production) without changing the code.
- **Current vs Expected**: 
  - **Current**: Secrets are directly in the source code.
  - **Expected**: Secrets should be loaded from environment variables or a secure secret management service (like Google Secret Manager).

## Solution
1.  **Use Environment Variables**: Modify the `config.ts` file to read all sensitive values from `process.env`.
2.  **Create `.env` files**: Provide a `.env.example` file in `firebase/functions` that developers can copy to `.env` and populate with their own credentials for local development.
3.  **Update `.gitignore`**: Ensure that `.env` files are included in the `firebase/functions/.gitignore` file to prevent them from being committed.
4.  **Firebase Functions Configuration**: For deployed environments, use Firebase's built-in support for environment variables. This can be managed via the Firebase CLI or the Google Cloud Console.

Example change in `config.ts`:

```typescript
// Before
export const CONFIG = {
  firebase: {
    apiKey: 'test-api-key',
    // ...
  },
  // ...
};

// After
import *dostenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  firebase: {
    apiKey: process.env.API_KEY,
    // ...
  },
  // ...
};
```

## Impact
- **Type**: Pure refactoring
- **Risk**: Low (if done carefully)
- **Complexity**: Moderate
- **Benefit**: High value (major security improvement)

## Implementation Notes
- The `dotenv` package will need to be added as a dependency in `firebase/functions/package.json`.
- All developers will need to create their own `.env` file for local development.
- The deployment process will need to be updated to set the required environment variables in the Firebase/Google Cloud environment.
