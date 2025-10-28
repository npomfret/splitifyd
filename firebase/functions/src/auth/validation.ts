import { UserRegistration } from '@splitifyd/shared';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/errors';
import { AcceptanceBooleanSchema, createPasswordSchema, createRequestValidator, DisplayNameSchema, EmailSchema } from '../validation/common';

const registerSchema = z.object({
    email: EmailSchema,
    password: createPasswordSchema(),
    displayName: DisplayNameSchema,
    termsAccepted: AcceptanceBooleanSchema({
        required: 'Terms acceptance is required',
        invalidType: 'Terms acceptance must be a boolean value',
        notAccepted: 'You must accept the Terms of Service',
    }),
    cookiePolicyAccepted: AcceptanceBooleanSchema({
        required: 'Cookie policy acceptance is required',
        invalidType: 'Cookie policy acceptance must be a boolean value',
        notAccepted: 'You must accept the Cookie Policy',
    }),
});

const mapRegisterError = (error: z.ZodError): never => {
    const firstError = error.issues[0];
    const field = firstError.path[0];
    let errorCode = 'INVALID_INPUT';
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
        default:
            break;
    }

    throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
};

export const validateRegisterRequest = createRequestValidator({
    schema: registerSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        email: value.email.trim().toLowerCase(),
        password: value.password,
        displayName: value.displayName.trim(),
        termsAccepted: value.termsAccepted,
        cookiePolicyAccepted: value.cookiePolicyAccepted,
    }),
    mapError: mapRegisterError,
}) as (body: UserRegistration) => UserRegistration;
