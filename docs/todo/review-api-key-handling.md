# Review API Key Handling

## Problem
- **Location**: `firebase/functions/src/utils/config.ts`
- **Description**: The `config.ts` file retrieves `API_KEY` and `CLIENT_API_KEY` from environment variables (`process.env.API_KEY`, `process.env.CLIENT_API_KEY`). While using environment variables is a good practice, the file also contains fallback values like `'test-api-key'`, `'development-api-key'`, and `'placeholder-api-key'`. These fallbacks, especially `'placeholder-api-key'`, could potentially be deployed to production if environment variables are not correctly set, leading to security vulnerabilities or unexpected behavior.
- **Current vs Expected**: Currently, API keys are sourced from environment variables with fallbacks. Expected behavior is to strictly enforce the use of environment variables for production API keys and ensure that no placeholder or test keys are ever used in a production deployment.

## Solution
- **Remove placeholder/development API keys from production builds**: Implement a build-time check or a more robust environment variable validation to prevent the deployment of placeholder or development API keys to production environments.
- **Strict validation for production**: For `isProduction` environments, ensure that `API_KEY` and `CLIENT_API_KEY` are always provided via environment variables and throw an error if they are missing, instead of falling back to placeholder values.
- **Documentation**: Add clear documentation on how to manage API keys for different environments, especially for production.

## Impact
- **Type**: Behavior change (security, deployment)
- **Risk**: Medium
- **Complexity**: Moderate
- **Benefit**: High value (improves security posture, prevents accidental exposure of sensitive information, ensures correct configuration in production)

## Implementation Notes
- Consider using a dedicated configuration management library or a more explicit environment variable loading mechanism.
- Review the deployment pipeline to ensure environment variables are correctly set for production.
