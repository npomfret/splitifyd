export const STORAGE_KEYS = {
    USER_ID: 'userId',
    RECENT_CURRENCIES: 'recentCurrencies',
    LOGIN_EMAIL: 'login-email',
    LOGIN_PASSWORD: 'login-password',
    REGISTER_NAME: 'register-form-name',
    REGISTER_EMAIL: 'register-form-email',
    REGISTER_PASSWORD: 'register-form-password',
    REGISTER_CONFIRM_PASSWORD: 'register-form-confirmPassword',
    REGISTER_AGREE_TERMS: 'register-form-agreeToTerms',
    REGISTER_AGREE_COOKIES: 'register-form-agreeToCookies',
} as const;

// Authentication constants
export const USER_ID_KEY = STORAGE_KEYS.USER_ID;
