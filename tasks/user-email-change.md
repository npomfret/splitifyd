# Task: Implement Email Change Functionality

## Overview

Allow users to change their email address with proper security measures including password verification and email verification for the new address.

## Key Requirements

- **Security First**: Require current password verification before allowing email change
- **Email Verification**: Send verification email to new address before committing change
- **Firebase Auth Sync**: Update both Firebase Auth and Firestore user document
- **Error Handling**: Comprehensive validation and error messages
- **User Experience**: Clear feedback during verification process
- **No Group Impact**: Email change only affects user account, not group memberships

## Architecture

### Current State

The `_updateProfile` method in `UserService2.ts` (lines 177-214) currently supports:
- `displayName` - User's display name
- `photoURL` - User's profile photo URL
- `preferredLanguage` - User's language preference

**Email updates are NOT currently supported.**

### Security Considerations

Firebase Authentication treats email updates as a sensitive operation requiring:

1. **Re-authentication**: User must verify current password
2. **Email Verification**: Verification email sent to new address
3. **State Management**: Handle pending verification state
4. **Rollback**: Support reverting if verification fails or times out

### Data Model

#### No Schema Changes Required

User email is stored in:
- **Firebase Auth**: Primary source of truth (UserRecord.email)
- **RegisteredUser**: DTO does NOT include email field (removed in recent refactor)
- **GroupMember**: Does NOT include email field (removed in recent refactor)

**Important**: Email is only stored in Firebase Auth. No Firestore document updates required.

## Server-Side Implementation

### 1. Add Validation Schema

**Location**: `firebase/functions/src/user/validation.ts`

Add new validation schema after `changePasswordSchema`:

```typescript
/**
 * Schema for change email request
 */
const changeEmailSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'any.required': 'Current password is required',
        'string.empty': 'Current password cannot be empty',
    }),
    newEmail: Joi.string().email().required().messages({
        'any.required': 'New email is required',
        'string.empty': 'New email cannot be empty',
        'string.email': 'Invalid email format',
    }),
});

/**
 * Change email request interface
 */
interface ChangeEmailRequest {
    currentPassword: string;
    newEmail: string;
}

/**
 * Validate change email request
 */
export const validateChangeEmail = (body: unknown, language: string = 'en'): ChangeEmailRequest => {
    const { error, value } = changeEmailSchema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const translatedMessage = translateJoiError(error, language);
        throw Errors.INVALID_INPUT(translatedMessage);
    }

    // Normalize email to lowercase
    return {
        currentPassword: value.currentPassword,
        newEmail: value.newEmail.toLowerCase().trim(),
    };
};
```

### 2. Add Email Change Method to AuthService

**Location**: `firebase/functions/src/services/auth/FirebaseAuthService.ts`

Add new method to handle email change with verification:

```typescript
/**
 * Change user's email address
 * Requires password verification and sends verification email
 * @throws ApiError if current password is invalid or email already in use
 */
async changeEmail(
    userId: string,
    currentPassword: string,
    newEmail: string
): Promise<void> {
    LoggerContext.update({ userId, operation: 'change-email' });

    try {
        // Get current user
        const user = await this.auth.getUser(userId);

        if (!user.email) {
            throw Errors.INVALID_INPUT('User does not have an email address');
        }

        // Verify current password by attempting sign-in
        try {
            await this.signInWithPassword(user.email, currentPassword);
        } catch (error) {
            throw Errors.INVALID_INPUT('Current password is incorrect');
        }

        // Check if new email is already in use
        try {
            await this.auth.getUserByEmail(newEmail);
            throw Errors.CONFLICT('Email address is already in use');
        } catch (error) {
            // Email not found - good, we can use it
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
        }

        // Update email in Firebase Auth
        // This automatically sends a verification email
        await this.auth.updateUser(userId, {
            email: newEmail,
            emailVerified: false, // Reset verification status
        });

        logger.info('Email changed successfully', {
            userId,
            oldEmail: user.email,
            newEmail,
        });
    } catch (error) {
        logger.error('Failed to change email', {
            userId,
            error: error.message,
            errorCode: error.code,
        });
        throw error;
    }
}
```

### 3. Add Email Change Method to UserService

**Location**: `firebase/functions/src/services/UserService2.ts`

Add new method after `_updateProfile`:

```typescript
/**
 * Change user's email address
 * Requires current password verification
 */
async changeEmail(userId: string, requestBody: unknown, language: string = 'en'): Promise<void> {
    LoggerContext.update({ userId, operation: 'change-email' });

    // Validate the request body
    const validatedData = validateChangeEmail(requestBody, language);

    try {
        // Use auth service to change email
        await this.authService.changeEmail(
            userId,
            validatedData.currentPassword,
            validatedData.newEmail
        );

        logger.info('User email changed successfully', { userId });
    } catch (error) {
        logger.error('Failed to change user email', {
            userId,
            error: error.message,
        });
        throw error;
    }
}
```

### 4. Add API Endpoint

**Location**: `firebase/functions/src/user/handlers.ts`

Add new handler after `changePassword`:

```typescript
/**
 * Change user email
 * POST /user/email/change
 */
export const changeEmail = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.uid;
    const language = req.headers['accept-language']?.split(',')[0] || 'en';

    await userService.changeEmail(userId, req.body, language);

    res.json({
        message: 'Email changed successfully. Please verify your new email address.',
    });
};
```

**Location**: `firebase/functions/src/index.ts`

Add route:

```typescript
app.post('/user/email/change', authenticate, asyncHandler(changeEmail));
```

### 5. Update Auth Types

**Location**: `firebase/functions/src/services/auth/auth-types.ts`

Add export for changeEmail:

```typescript
export interface IAuthService {
    // ... existing methods ...
    changeEmail(userId: string, currentPassword: string, newEmail: string): Promise<void>;
}
```

## Client-Side Implementation

### 1. Add Response Schema

**Location**: `webapp-v2/src/api/apiSchemas.ts`

Add schema after `ChangePasswordResponseSchema`:

```typescript
const ChangeEmailResponseSchema = z.object({
    message: z.string(),
});

type ChangeEmailResponse = z.infer<typeof ChangeEmailResponseSchema>;
```

### 2. Add API Client Method

**Location**: `webapp-v2/src/api/apiClient.ts`

Add method in ApiClient class:

```typescript
async changeEmail(currentPassword: string, newEmail: string): Promise<ChangeEmailResponse> {
    const response = await this.request('/user/email/change', {
        method: 'POST',
        body: JSON.stringify({
            currentPassword,
            newEmail,
        }),
    });
    return ChangeEmailResponseSchema.parse(response);
}
```

### 3. Create Email Change Component

**Location**: `webapp-v2/src/components/EmailChangeForm.tsx`

New component for changing email:

```tsx
import { h } from 'preact';
import { useState, FormEvent } from 'preact/hooks';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { apiClient } from '../api/apiClient';
import translationEn from '../locales/en/translation.json';

interface EmailChangeFormProps {
    currentEmail: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function EmailChangeForm({
    currentEmail,
    onSuccess,
    onCancel,
}: EmailChangeFormProps) {
    const [newEmail, setNewEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        // Validate emails match
        if (newEmail !== confirmEmail) {
            setError('Email addresses do not match');
            setLoading(false);
            return;
        }

        // Validate not same as current
        if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
            setError('New email must be different from current email');
            setLoading(false);
            return;
        }

        try {
            await apiClient.changeEmail(currentPassword, newEmail);
            setSuccess(true);
            setNewEmail('');
            setConfirmEmail('');
            setCurrentPassword('');

            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            if (err.message?.includes('password is incorrect')) {
                setError('Current password is incorrect');
            } else if (err.message?.includes('already in use')) {
                setError('Email address is already in use');
            } else if (err.message?.includes('Invalid email')) {
                setError('Invalid email format');
            } else {
                setError('Failed to change email. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div
                className="bg-green-50 border border-green-200 rounded-lg p-4"
                role="alert"
                data-testid="email-change-success"
            >
                <h3 className="text-sm font-medium text-green-800">
                    Email Changed Successfully
                </h3>
                <p className="text-sm text-green-700 mt-2">
                    A verification email has been sent to {newEmail}.
                    Please verify your new email address.
                </p>
                {onCancel && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onCancel}
                        className="mt-3"
                    >
                        Close
                    </Button>
                )}
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Email
                </label>
                <p className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2">
                    {currentEmail}
                </p>
            </div>

            <Input
                id="newEmail"
                type="email"
                label="New Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.currentTarget.value)}
                placeholder="Enter new email address"
                required
                autoComplete="email"
                data-testid="new-email-input"
            />

            <Input
                id="confirmEmail"
                type="email"
                label="Confirm New Email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.currentTarget.value)}
                placeholder="Confirm new email address"
                required
                autoComplete="email"
                data-testid="confirm-email-input"
            />

            <Input
                id="currentPassword"
                type="password"
                label="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.currentTarget.value)}
                placeholder="Enter your current password"
                required
                autoComplete="current-password"
                data-testid="current-password-input"
            />

            {error && (
                <p
                    className="text-sm text-red-600"
                    role="alert"
                    data-testid="email-change-error"
                >
                    {error}
                </p>
            )}

            <div className="flex gap-3 pt-2">
                {onCancel && (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                )}
                <Button
                    type="submit"
                    variant="primary"
                    disabled={
                        !newEmail ||
                        !confirmEmail ||
                        !currentPassword ||
                        loading
                    }
                    loading={loading}
                    data-testid="submit-email-change"
                >
                    Change Email
                </Button>
            </div>
        </form>
    );
}
```

### 4. Add to Settings Page

**Location**: `webapp-v2/src/pages/SettingsPage.tsx`

Add email change section after password change section:

```tsx
// Import component
import { EmailChangeForm } from '../components/EmailChangeForm';

// Add state for email change modal
const [showEmailChange, setShowEmailChange] = useState(false);

// Add UI section after password change
<section className="bg-white rounded-lg shadow-sm p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Email Address
    </h2>

    {!showEmailChange ? (
        <div className="flex items-center justify-between">
            <div>
                <label className="text-sm font-medium text-gray-700">
                    Current Email
                </label>
                <p className="text-sm text-gray-900">{user?.email}</p>
            </div>
            <Button
                variant="secondary"
                size="md"
                onClick={() => setShowEmailChange(true)}
                data-testid="change-email-button"
            >
                Change Email
            </Button>
        </div>
    ) : (
        <EmailChangeForm
            currentEmail={user?.email || ''}
            onSuccess={() => {
                // Optionally refresh user data
                setShowEmailChange(false);
            }}
            onCancel={() => setShowEmailChange(false)}
        />
    )}
</section>
```

## Testing Requirements

### Unit Tests

#### Server-Side

**Location**: `firebase/functions/src/__tests__/unit/services/FirebaseAuthService.test.ts`

```typescript
describe('changeEmail', () => {
    it('should change email successfully with valid password', async () => {
        // Test successful email change
    });

    it('should throw error if current password is incorrect', async () => {
        // Test password verification
    });

    it('should throw error if new email is already in use', async () => {
        // Test email uniqueness check
    });

    it('should throw error if user has no current email', async () => {
        // Test edge case
    });

    it('should reset email verification status', async () => {
        // Test emailVerified set to false
    });
});
```

**Location**: `firebase/functions/src/__tests__/unit/services/UserService2.test.ts`

```typescript
describe('changeEmail', () => {
    it('should validate request body', async () => {
        // Test validation
    });

    it('should call auth service with correct parameters', async () => {
        // Test delegation
    });

    it('should handle validation errors', async () => {
        // Test error handling
    });
});
```

**Location**: `firebase/functions/src/__tests__/unit/user/validation.test.ts`

```typescript
describe('validateChangeEmail', () => {
    it('should accept valid email change request', () => {
        const result = validateChangeEmail({
            currentPassword: 'Password123!',
            newEmail: 'new@example.com',
        });
        expect(result.newEmail).toBe('new@example.com');
    });

    it('should normalize email to lowercase', () => {
        const result = validateChangeEmail({
            currentPassword: 'Password123!',
            newEmail: 'NEW@EXAMPLE.COM',
        });
        expect(result.newEmail).toBe('new@example.com');
    });

    it('should reject invalid email format', () => {
        expect(() =>
            validateChangeEmail({
                currentPassword: 'Password123!',
                newEmail: 'not-an-email',
            })
        ).toThrow(/Invalid email/i);
    });

    it('should reject missing password', () => {
        expect(() =>
            validateChangeEmail({
                newEmail: 'new@example.com',
            })
        ).toThrow(/password.*required/i);
    });

    it('should reject empty email', () => {
        expect(() =>
            validateChangeEmail({
                currentPassword: 'Password123!',
                newEmail: '',
            })
        ).toThrow(/email.*required/i);
    });
});
```

#### Client-Side

**Location**: `webapp-v2/src/__tests__/unit/playwright/email-change-form.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('EmailChangeForm', () => {
    test('should show validation error if emails do not match', async ({ page }) => {
        // Test email confirmation validation
    });

    test('should show error if new email is same as current', async ({ page }) => {
        // Test same email validation
    });

    test('should submit email change with valid data', async ({ page }) => {
        // Test successful submission
    });

    test('should show error if password is incorrect', async ({ page }) => {
        // Test password error handling
    });

    test('should show success message after change', async ({ page }) => {
        // Test success state
    });

    test('should allow canceling', async ({ page }) => {
        // Test cancel flow
    });
});
```

### Integration Tests

**Location**: `firebase/functions/src/__tests__/integration/user-email-change.test.ts`

```typescript
import { beforeEach, describe, expect, test } from 'vitest';
import { ApiDriver, borrowTestUsers } from '@splitifyd/test-support';
import type { PooledTestUser } from '@splitifyd/shared';

describe('User Email Change - Integration Tests', () => {
    let apiDriver: ApiDriver;
    let user: PooledTestUser;

    beforeEach(async () => {
        apiDriver = new ApiDriver();
        const users = await borrowTestUsers(1);
        user = users[0];
    });

    describe('POST /api/user/email/change', () => {
        test('should change email successfully with valid password', async () => {
            const newEmail = `test-${Date.now()}@example.com`;

            const response = await apiDriver.changeEmail(
                user.password,
                newEmail,
                user.token
            );

            expect(response).toBeDefined();
            expect(response.message).toContain('Email changed successfully');
        });

        test('should reject incorrect current password', async () => {
            await expect(
                apiDriver.changeEmail(
                    'wrong-password',
                    'new@example.com',
                    user.token
                ),
            ).rejects.toThrow(/password.*incorrect/i);
        });

        test('should reject email already in use', async () => {
            // Get another user's email
            const otherUsers = await borrowTestUsers(1);
            const existingEmail = otherUsers[0].email;

            await expect(
                apiDriver.changeEmail(
                    user.password,
                    existingEmail,
                    user.token
                ),
            ).rejects.toThrow(/already in use/i);
        });

        test('should reject invalid email format', async () => {
            await expect(
                apiDriver.changeEmail(
                    user.password,
                    'not-an-email',
                    user.token
                ),
            ).rejects.toThrow(/Invalid email/i);
        });

        test('should require authentication', async () => {
            await expect(
                apiDriver.changeEmail(
                    'password',
                    'new@example.com',
                    'invalid-token'
                ),
            ).rejects.toThrow(/auth|unauthorized|token/i);
        });
    });
});
```

### E2E Tests

**Location**: `e2e-tests/src/tests/normal-flow/user-email-change.e2e.test.ts`

```typescript
import { authenticatedPageTest, expect } from '../../fixtures/authenticated-page-test';

authenticatedPageTest.describe('User Email Change', () => {
    authenticatedPageTest(
        'should change email successfully',
        async ({ authenticatedPage, settingsPage }) => {
            const { page, user } = authenticatedPage;

            // Navigate to settings
            await settingsPage.navigate();
            await expect(page).toHaveURL(/\/settings/);

            // Click change email button
            await page.getByTestId('change-email-button').click();

            // Fill in email change form
            const newEmail = `test-${Date.now()}@example.com`;
            await page.getByTestId('new-email-input').fill(newEmail);
            await page.getByTestId('confirm-email-input').fill(newEmail);
            await page.getByTestId('current-password-input').fill(user.password);

            // Submit form
            await page.getByTestId('submit-email-change').click();

            // Verify success message
            await expect(page.getByTestId('email-change-success')).toBeVisible();
            await expect(page.getByText(/verification email has been sent/i)).toBeVisible();
        }
    );

    authenticatedPageTest(
        'should show error for incorrect password',
        async ({ authenticatedPage, settingsPage }) => {
            const { page } = authenticatedPage;

            await settingsPage.navigate();
            await page.getByTestId('change-email-button').click();

            // Fill with wrong password
            const newEmail = `test-${Date.now()}@example.com`;
            await page.getByTestId('new-email-input').fill(newEmail);
            await page.getByTestId('confirm-email-input').fill(newEmail);
            await page.getByTestId('current-password-input').fill('wrong-password');

            await page.getByTestId('submit-email-change').click();

            // Verify error message
            await expect(page.getByTestId('email-change-error')).toBeVisible();
            await expect(page.getByText(/password is incorrect/i)).toBeVisible();
        }
    );

    authenticatedPageTest(
        'should show error for mismatched emails',
        async ({ authenticatedPage, settingsPage }) => {
            const { page, user } = authenticatedPage;

            await settingsPage.navigate();
            await page.getByTestId('change-email-button').click();

            // Fill with mismatched emails
            await page.getByTestId('new-email-input').fill('email1@example.com');
            await page.getByTestId('confirm-email-input').fill('email2@example.com');
            await page.getByTestId('current-password-input').fill(user.password);

            await page.getByTestId('submit-email-change').click();

            // Verify validation error
            await expect(page.getByTestId('email-change-error')).toBeVisible();
            await expect(page.getByText(/do not match/i)).toBeVisible();
        }
    );

    authenticatedPageTest(
        'should allow canceling email change',
        async ({ authenticatedPage, settingsPage }) => {
            const { page } = authenticatedPage;

            await settingsPage.navigate();
            await page.getByTestId('change-email-button').click();

            // Verify form is visible
            await expect(page.getByTestId('new-email-input')).toBeVisible();

            // Cancel
            await page.getByRole('button', { name: 'Cancel' }).click();

            // Verify form is hidden
            await expect(page.getByTestId('new-email-input')).not.toBeVisible();
            await expect(page.getByTestId('change-email-button')).toBeVisible();
        }
    );
});
```

## Validation Rules

### Email Requirements

- **Format**: Valid email address format
- **Uniqueness**: Must not be already registered in Firebase Auth
- **Normalization**: Converted to lowercase automatically
- **Different**: Must be different from current email

### Password Requirements

- **Current Password**: Must match user's current password
- **Required**: Cannot be empty

### Error Codes

- `INVALID_INPUT` (400): Validation failed (incorrect password, invalid email format)
- `CONFLICT` (409): Email already in use
- `UNAUTHORIZED` (401): Invalid authentication token

## Implementation Order

1. **Backend Foundation** (Day 1)
   - [ ] Add `validateChangeEmail` to `user/validation.ts`
   - [ ] Add `changeEmail` method to `FirebaseAuthService`
   - [ ] Add `changeEmail` method to `UserService2`
   - [ ] Add API endpoint and route
   - [ ] Write unit tests for validation and service methods

2. **Backend Integration Testing** (Day 1)
   - [ ] Add `changeEmail` method to `ApiDriver` in test-support
   - [ ] Write integration tests
   - [ ] Test with Firebase emulator

3. **Client API Integration** (Day 2)
   - [ ] Add response schema to `apiSchemas.ts`
   - [ ] Add `changeEmail` method to `apiClient.ts`
   - [ ] Create `EmailChangeForm` component
   - [ ] Write Playwright component tests

4. **Settings UI Integration** (Day 2)
   - [ ] Add email change section to `SettingsPage`
   - [ ] Wire up form submission
   - [ ] Test UI flow manually

5. **E2E Testing & Polish** (Day 3)
   - [ ] Write E2E tests for happy path
   - [ ] Write E2E tests for error scenarios
   - [ ] Test verification email flow manually
   - [ ] Final QA pass

## Security Considerations

### Password Verification

- Current password must be verified before allowing email change
- Use Firebase Auth's sign-in method to verify password
- Do NOT store or compare passwords directly

### Email Verification

- Firebase Auth automatically sends verification email to new address
- `emailVerified` flag is reset to `false` after email change
- User must verify new email before it's fully confirmed

### Rate Limiting

Consider adding rate limiting for email change endpoint to prevent abuse:
- Maximum 3 email changes per hour per user
- Implement using Firebase Functions quotas or custom middleware

### Audit Logging

All email changes should be logged for security audit:
- Old email address
- New email address
- User ID
- Timestamp
- IP address (if available)

## User Experience Considerations

### Verification Email

- Email sent automatically by Firebase Auth
- Contains verification link that redirects to Firebase-hosted page
- After verification, user can sign in with new email

### Session Management

- After email change, user's session remains valid
- User can continue using the app while waiting for verification
- Consider showing banner/notification about pending verification

### Error Messages

Use clear, user-friendly error messages:
- "Current password is incorrect" (not "Authentication failed")
- "Email address is already in use" (not "Duplicate key error")
- "Invalid email format" (not "Validation error")

## Migration Notes

**NO DATA MIGRATION REQUIRED** - This is a new feature.

- Email is only stored in Firebase Auth (not in Firestore)
- No Firestore document updates needed
- No impact on existing user data or group memberships

## Performance Considerations

- **Firebase Auth Latency**: Email change involves Firebase Auth API calls (~100-200ms)
- **Password Verification**: Requires sign-in attempt (~200-300ms)
- **Total Operation Time**: ~300-500ms for successful email change
- **Rate Limiting**: Consider implementing to prevent abuse

## Future Enhancements (Out of Scope)

- Custom verification email templates
- Support for changing email without password (via email verification link)
- Email change history/audit log in user profile
- Notification to old email address when email is changed
- Two-factor authentication requirement for email change

## Success Criteria

- [ ] Users can change their email address via settings page
- [ ] Current password verification required before change
- [ ] Verification email automatically sent to new address
- [ ] Clear error messages for all failure scenarios
- [ ] Email uniqueness enforced (cannot use existing email)
- [ ] Comprehensive test coverage (unit, integration, E2E)
- [ ] No Firestore schema changes required
- [ ] Security best practices followed (password verification, email verification)
- [ ] User experience is smooth and intuitive

## Related Files

### Backend
- `firebase/functions/src/user/validation.ts` - Validation schema
- `firebase/functions/src/services/auth/FirebaseAuthService.ts` - Email change logic
- `firebase/functions/src/services/UserService2.ts` - User service integration
- `firebase/functions/src/user/handlers.ts` - API endpoint handler
- `firebase/functions/src/index.ts` - Route registration

### Frontend
- `webapp-v2/src/api/apiSchemas.ts` - Response schema
- `webapp-v2/src/api/apiClient.ts` - API client method
- `webapp-v2/src/components/EmailChangeForm.tsx` - Form component
- `webapp-v2/src/pages/SettingsPage.tsx` - Settings page integration

### Testing
- `firebase/functions/src/__tests__/unit/user/validation.test.ts` - Validation tests
- `firebase/functions/src/__tests__/unit/services/FirebaseAuthService.test.ts` - Auth service tests
- `firebase/functions/src/__tests__/unit/services/UserService2.test.ts` - User service tests
- `firebase/functions/src/__tests__/integration/user-email-change.test.ts` - Integration tests
- `e2e-tests/src/tests/normal-flow/user-email-change.e2e.test.ts` - E2E tests
- `packages/test-support/src/ApiDriver.ts` - Test helper updates

## Notes

- Email is the ONLY user attribute stored in Firebase Auth but not in Firestore DTOs
- This is by design: email is authentication-related, not profile data
- Recent refactor removed email from `RegisteredUser` and `GroupMember` types
- Email changes do NOT affect group memberships or user identity in groups
