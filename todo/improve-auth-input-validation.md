# Improve Input Validation in Auth Handlers

## Problem
- **Location**: `firebase/functions/src/auth/handlers.ts:13-16`, `firebase/functions/src/auth/handlers.ts:80-83`
- **Description**: The `login` and `register` functions perform basic checks for the presence of `email`, `password`, and `displayName`. However, they lack more robust validation such as email format validation, password strength requirements, or display name length constraints. This could lead to invalid data being processed or stored, and potential security vulnerabilities (e.g., weak passwords).
- **Current vs Expected**:
  - Current:
    ```typescript
    if (!email || !password) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        }
      });
      return;
    }
    ```
  - Expected: Implement more comprehensive validation, potentially using a validation library or custom regex for email, and checks for password complexity (length, characters).

## Solution
- Implement more comprehensive input validation for `email`, `password`, and `displayName` in the `login` and `register` handlers.
- Consider using a validation library (e.g., `joi`, `yup`) or custom validation functions to enforce rules like:
    - Valid email format.
    - Minimum password length and complexity (e.g., requiring uppercase, lowercase, numbers, special characters).
    - Display name length limits.
- Return specific error codes and messages for each validation failure.

## Impact
- **Type**: Behavior change (improves data quality and security)
- **Risk**: Low to Medium (depending on the complexity of validation rules)
- **Complexity**: Moderate
- **Benefit**: High value (improves data integrity, security, and user experience by providing clearer feedback on invalid input).

## Implementation Notes
- Decide whether to use an external validation library or implement custom validation logic.
- Ensure that validation errors are returned with appropriate HTTP status codes (e.g., 400 Bad Request) and clear error messages.
