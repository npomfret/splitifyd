/**
 * Shared regular expressions for input validation.
 *
 * Prefer using these constants over ad-hoc regex definitions
 * to keep validation rules consistent across domains.
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_REGEX = new RegExp(`^.{${PASSWORD_MIN_LENGTH},}$`);

export const PHONE_E164_REGEX = /^\+[1-9]\d{1,14}$/;
