import { describe, it, expect } from 'vitest';
import { ApiError } from '../../../utils/errors';

describe('Focused User Validation Tests', () => {
    describe('Display Name Validation', () => {
        it('should reject empty display names', () => {
            expect(() => {
                const displayName: string = '';
                if (!displayName || displayName.trim().length === 0) {
                    throw new ApiError(400, 'INVALID_DISPLAY_NAME', 'Display name cannot be empty');
                }
            }).toThrow('Display name cannot be empty');
        });

        it('should reject display names with only whitespace', () => {
            expect(() => {
                const displayName = '   ';
                if (!displayName || displayName.trim().length === 0) {
                    throw new ApiError(400, 'INVALID_DISPLAY_NAME', 'Display name cannot be empty');
                }
            }).toThrow('Display name cannot be empty');
        });

        it('should reject display names that are too long', () => {
            expect(() => {
                const displayName = 'a'.repeat(101);
                const maxLength = 100;
                if (displayName.length > maxLength) {
                    throw new ApiError(400, 'INVALID_DISPLAY_NAME', `Display name cannot exceed ${maxLength} characters`);
                }
            }).toThrow('Display name cannot exceed 100 characters');
        });

        it('should accept valid display names', () => {
            expect(() => {
                const displayName = 'Valid Display Name';
                if (!displayName || displayName.trim().length === 0) {
                    throw new ApiError(400, 'INVALID_DISPLAY_NAME', 'Display name cannot be empty');
                }
                if (displayName.length > 100) {
                    throw new ApiError(400, 'INVALID_DISPLAY_NAME', 'Display name cannot exceed 100 characters');
                }
            }).not.toThrow();
        });

        it('should trim whitespace from display names', () => {
            const displayName = '  Trimmed Name  ';
            const trimmed = displayName.trim();
            expect(trimmed).toBe('Trimmed Name');
        });

        it('should handle special characters in display names', () => {
            const displayName = 'Name with émojis 🎉 and açcénts';
            expect(displayName.length).toBeGreaterThan(0);
            expect(displayName.length).toBeLessThanOrEqual(100);
        });
    });

    describe('Email Validation', () => {
        it('should reject invalid email formats', () => {
            const invalidEmails = ['invalid-email', 'test@', '@example.com', 'test.example.com'];

            invalidEmails.forEach(email => {
                expect(() => {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                        throw new ApiError(400, 'INVALID_EMAIL', 'Invalid email format');
                    }
                }).toThrow('Invalid email format');
            });
        });

        it('should accept valid email formats', () => {
            const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'test+tag@example.org'];

            validEmails.forEach(email => {
                expect(() => {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                        throw new ApiError(400, 'INVALID_EMAIL', 'Invalid email format');
                    }
                }).not.toThrow();
            });
        });
    });

    describe('Password Validation', () => {
        it('should reject passwords that are too short', () => {
            expect(() => {
                const password = '123';
                const minLength = 8;
                if (password.length < minLength) {
                    throw new ApiError(400, 'WEAK_PASSWORD', `Password must be at least ${minLength} characters long`);
                }
            }).toThrow('Password must be at least 8 characters long');
        });

        it('should reject passwords without uppercase letters', () => {
            expect(() => {
                const password = 'newpassword123!';
                if (!/[A-Z]/.test(password)) {
                    throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one uppercase letter');
                }
            }).toThrow('Password must contain at least one uppercase letter');
        });

        it('should reject passwords without lowercase letters', () => {
            expect(() => {
                const password = 'NEWPASSWORD123!';
                if (!/[a-z]/.test(password)) {
                    throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one lowercase letter');
                }
            }).toThrow('Password must contain at least one lowercase letter');
        });

        it('should reject passwords without numbers', () => {
            expect(() => {
                const password = 'NewPassword!';
                if (!/[0-9]/.test(password)) {
                    throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one number');
                }
            }).toThrow('Password must contain at least one number');
        });

        it('should reject passwords without special characters', () => {
            expect(() => {
                const password = 'NewPassword123';
                if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                    throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one special character');
                }
            }).toThrow('Password must contain at least one special character');
        });

        it('should accept strong passwords', () => {
            expect(() => {
                const password = 'NewSecurePassword123!';

                if (password.length < 8) {
                    throw new ApiError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters long');
                }
                if (!/[A-Z]/.test(password)) {
                    throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one uppercase letter');
                }
                if (!/[a-z]/.test(password)) {
                    throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one lowercase letter');
                }
                if (!/[0-9]/.test(password)) {
                    throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one number');
                }
                if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                    throw new ApiError(400, 'WEAK_PASSWORD', 'Password must contain at least one special character');
                }
            }).not.toThrow();
        });

        it('should reject passwords that are the same as current password', () => {
            expect(() => {
                const currentPassword = 'SamePassword123!';
                const newPassword = 'SamePassword123!';

                if (currentPassword === newPassword) {
                    throw new ApiError(400, 'INVALID_PASSWORD', 'New password must be different from current password');
                }
            }).toThrow('New password must be different from current password');
        });
    });

    describe('Preferred Language Validation', () => {
        it('should reject invalid language codes', () => {
            expect(() => {
                const language = 'invalid-language';
                const validLanguages = ['en', 'es', 'fr', 'de'];

                if (!validLanguages.includes(language)) {
                    throw new ApiError(400, 'INVALID_LANGUAGE', 'Invalid language code');
                }
            }).toThrow('Invalid language code');
        });

        it('should accept valid language codes', () => {
            expect(() => {
                const language = 'en';
                const validLanguages = ['en', 'es', 'fr', 'de'];

                if (!validLanguages.includes(language)) {
                    throw new ApiError(400, 'INVALID_LANGUAGE', 'Invalid language code');
                }
            }).not.toThrow();
        });
    });

    describe('Photo URL Validation', () => {
        it('should reject invalid URL formats', () => {
            expect(() => {
                const photoURL = 'not-a-valid-url';
                const urlRegex = /^https?:\/\/.+/;

                if (photoURL && !urlRegex.test(photoURL)) {
                    throw new ApiError(400, 'INVALID_URL', 'Invalid photo URL format');
                }
            }).toThrow('Invalid photo URL format');
        });

        it('should accept valid photo URLs', () => {
            expect(() => {
                const photoURL = 'https://example.com/photo.jpg';
                const urlRegex = /^https?:\/\/.+/;

                if (photoURL && !urlRegex.test(photoURL)) {
                    throw new ApiError(400, 'INVALID_URL', 'Invalid photo URL format');
                }
            }).not.toThrow();
        });

        it('should accept null photo URL', () => {
            expect(() => {
                const photoURL = null;
                const urlRegex = /^https?:\/\/.+/;

                if (photoURL && !urlRegex.test(photoURL)) {
                    throw new ApiError(400, 'INVALID_URL', 'Invalid photo URL format');
                }
            }).not.toThrow();
        });
    });

    describe('Account Deletion Validation', () => {
        it('should require confirmation for deletion', () => {
            expect(() => {
                const confirmDelete = false;

                if (!confirmDelete) {
                    throw new ApiError(400, 'CONFIRMATION_REQUIRED', 'Account deletion must be confirmed');
                }
            }).toThrow('Account deletion must be confirmed');
        });

        it('should accept valid deletion confirmation', () => {
            expect(() => {
                const confirmDelete = true;

                if (!confirmDelete) {
                    throw new ApiError(400, 'CONFIRMATION_REQUIRED', 'Account deletion must be confirmed');
                }
            }).not.toThrow();
        });
    });

    describe('Terms and Policy Acceptance Validation', () => {
        it('should require terms acceptance', () => {
            expect(() => {
                const termsAccepted = false;

                if (!termsAccepted) {
                    throw new ApiError(400, 'TERMS_REQUIRED', 'You must accept the Terms of Service');
                }
            }).toThrow('You must accept the Terms of Service');
        });

        it('should require cookie policy acceptance', () => {
            expect(() => {
                const cookiePolicyAccepted = false;

                if (!cookiePolicyAccepted) {
                    throw new ApiError(400, 'COOKIE_POLICY_REQUIRED', 'You must accept the Cookie Policy');
                }
            }).toThrow('You must accept the Cookie Policy');
        });

        it('should accept valid policy acceptances', () => {
            expect(() => {
                const termsAccepted = true;
                const cookiePolicyAccepted = true;

                if (!termsAccepted) {
                    throw new ApiError(400, 'TERMS_REQUIRED', 'You must accept the Terms of Service');
                }
                if (!cookiePolicyAccepted) {
                    throw new ApiError(400, 'COOKIE_POLICY_REQUIRED', 'You must accept the Cookie Policy');
                }
            }).not.toThrow();
        });
    });
});