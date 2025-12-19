import { EmailVerificationRequest, EmailVerificationRequestSchema, LoginRequest, LoginRequestSchema, PasswordResetRequest, PasswordResetRequestSchema, RegisterRequestSchema, UserRegistration } from '@billsplit-wl/shared';
import { z } from 'zod';
import { ErrorDetail, Errors } from '../errors';
import { createRequestValidator } from '../validation/common';

const mapRegisterError = (error: z.ZodError): never => {
    const firstError = error.issues[0];
    const field = firstError.path[0];
    let errorCode = 'VALIDATION_ERROR';
    let errorMessage = firstError.message;

    switch (field) {
        case 'email':
            if (errorMessage.toLowerCase().includes('format')) {
                errorCode = 'INVALID_EMAIL_FORMAT';
            } else {
                errorCode = 'MISSING_EMAIL';
                errorMessage = 'Email is required';
            }
            break;
        case 'password':
            if (errorMessage.includes('12 characters')) {
                errorCode = 'WEAK_PASSWORD';
            } else {
                errorCode = 'MISSING_PASSWORD';
                errorMessage = 'Password is required';
            }
            break;
        case 'displayName':
            if (errorMessage.includes('2 characters')) {
                errorCode = 'DISPLAY_NAME_TOO_SHORT';
            } else if (errorMessage.includes('50 characters')) {
                errorCode = 'DISPLAY_NAME_TOO_LONG';
            } else if (errorMessage.includes('only contain')) {
                errorCode = 'INVALID_DISPLAY_NAME_CHARS';
            } else {
                errorCode = 'MISSING_DISPLAY_NAME';
            }
            break;
        case 'termsAccepted':
            if (errorMessage === 'Required') {
                errorCode = 'MISSING_TERMS_ACCEPTANCE';
                errorMessage = 'Terms acceptance is required';
            } else if (errorMessage.includes('You must accept')) {
                errorCode = 'TERMS_NOT_ACCEPTED';
            } else {
                errorCode = 'MISSING_TERMS_ACCEPTANCE';
                errorMessage = 'Terms acceptance must be a boolean value';
            }
            break;
        case 'cookiePolicyAccepted':
            if (errorMessage === 'Required') {
                errorCode = 'MISSING_COOKIE_POLICY_ACCEPTANCE';
                errorMessage = 'Cookie policy acceptance is required';
            } else if (errorMessage.includes('You must accept')) {
                errorCode = 'COOKIE_POLICY_NOT_ACCEPTED';
            } else {
                errorCode = 'MISSING_COOKIE_POLICY_ACCEPTANCE';
                errorMessage = 'Cookie policy acceptance must be a boolean value';
            }
            break;
        case 'privacyPolicyAccepted':
            if (errorMessage === 'Required') {
                errorCode = 'MISSING_PRIVACY_POLICY_ACCEPTANCE';
                errorMessage = 'Privacy policy acceptance is required';
            } else if (errorMessage.includes('You must accept')) {
                errorCode = 'PRIVACY_POLICY_NOT_ACCEPTED';
            } else {
                errorCode = 'MISSING_PRIVACY_POLICY_ACCEPTANCE';
                errorMessage = 'Privacy policy acceptance must be a boolean value';
            }
            break;
        case 'signupHostname':
            errorCode = 'MISSING_SIGNUP_HOSTNAME';
            errorMessage = 'Signup hostname is required';
            break;
        case 'adminEmailsAccepted':
            if (errorMessage === 'Required') {
                errorCode = 'MISSING_ADMIN_EMAILS_ACCEPTANCE';
                errorMessage = 'Account notifications acceptance is required';
            } else if (errorMessage.includes('You must accept')) {
                errorCode = 'ADMIN_EMAILS_NOT_ACCEPTED';
            } else {
                errorCode = 'MISSING_ADMIN_EMAILS_ACCEPTANCE';
                errorMessage = 'Account notifications acceptance must be a boolean value';
            }
            break;
        default:
            break;
    }

    throw Errors.validationError(String(field), errorCode as ErrorDetail);
};

export const validateRegisterRequest = createRequestValidator({
    schema: RegisterRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        email: value.email.trim().toLowerCase(),
        password: value.password,
        displayName: value.displayName.trim(),
        termsAccepted: value.termsAccepted,
        cookiePolicyAccepted: value.cookiePolicyAccepted,
        privacyPolicyAccepted: value.privacyPolicyAccepted,
        signupHostname: value.signupHostname.trim().toLowerCase(),
        adminEmailsAccepted: value.adminEmailsAccepted,
        marketingEmailsAccepted: value.marketingEmailsAccepted,
    }),
    mapError: mapRegisterError,
}) as (body: UserRegistration) => UserRegistration;

// ========================================================================
// Login Validation
// ========================================================================

const mapLoginError = (error: z.ZodError): never => {
    const firstError = error.issues[0];
    const field = firstError.path[0];

    switch (field) {
        case 'email':
            throw Errors.validationError('email', ErrorDetail.INVALID_EMAIL);
        case 'password':
            throw Errors.validationError('password', ErrorDetail.MISSING_FIELD);
        default:
            throw Errors.validationError(String(field));
    }
};

export const validateLoginRequest = createRequestValidator({
    schema: LoginRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        email: value.email.trim().toLowerCase(),
        password: value.password,
    }),
    mapError: mapLoginError,
}) as (body: LoginRequest) => LoginRequest;

// ========================================================================
// Password Reset Validation
// ========================================================================

const mapPasswordResetError = (error: z.ZodError): never => {
    const firstError = error.issues[0];
    const field = firstError.path[0];

    if (field === 'email') {
        throw Errors.validationError('email', ErrorDetail.INVALID_EMAIL);
    }

    throw Errors.validationError(String(field));
};

export const validatePasswordResetRequest = createRequestValidator({
    schema: PasswordResetRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        email: value.email.trim().toLowerCase(),
    }),
    mapError: mapPasswordResetError,
}) as (body: PasswordResetRequest) => PasswordResetRequest;

// ========================================================================
// Email Verification Validation
// ========================================================================

const mapEmailVerificationError = (error: z.ZodError): never => {
    const firstError = error.issues[0];
    const field = firstError.path[0];

    if (field === 'email') {
        throw Errors.validationError('email', ErrorDetail.INVALID_EMAIL);
    }

    throw Errors.validationError(String(field));
};

export const validateEmailVerificationRequest = createRequestValidator({
    schema: EmailVerificationRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        email: value.email.trim().toLowerCase(),
    }),
    mapError: mapEmailVerificationError,
}) as (body: EmailVerificationRequest) => EmailVerificationRequest;
