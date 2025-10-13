import translation from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

/**
 * Centralized selector constants to avoid hardcoding in tests
 */

export const SELECTORS = {
    // Error messages
    ERROR_MESSAGE: '.text-red-600',

    // Form elements
    FORM: 'form',
    SUBMIT_BUTTON: 'button[type="submit"]',

    // Meta elements
    META_DESCRIPTION: 'meta[name="description"]',
    META_VIEWPORT: 'meta[name="viewport"]',

    // Input types
    EMAIL_INPUT: 'input[type="email"]',
    PASSWORD_INPUT: 'input[type="password"]',
    TEXT_INPUT: 'input[type="text"]',
    NUMBER_INPUT: 'input[type="number"]',
    CHECKBOX: 'input[type="checkbox"]',
    RADIO: 'input[type="radio"]',

    // Layout elements
    HEADER: 'header',
    FOOTER: 'footer',
    MAIN: 'main',
    NAV: 'nav',
    MODAL_OVERLAY: '.fixed.inset-0',
} as const;

export const FORM_LABELS = {
    DESCRIPTION: translation.expenseBasicFields.descriptionLabel,
    AMOUNT: translation.expenseBasicFields.amountLabel,
    SETTLEMENT_AMOUNT: translation.settlementForm.amountLabel,
    CATEGORY: translation.expenseBasicFields.categoryLabel,
    DATE: translation.expenseBasicFields.dateLabel,
    SETTLEMENT_DATE: translation.settlementForm.dateLabel,
    TIME: translation.expenseBasicFields.timeLabel,
    WHO_PAID: new RegExp(translation.expenseForm.whoPaid, 'i'),
    WHO_PAID_SETTLEMENT: translation.settlementForm.whoPaidLabel,
    WHO_RECEIVED_PAYMENT: translation.settlementForm.whoReceivedPaymentLabel,
    SPLIT_BETWEEN: translation.expenseForm.splitBetween,
    NOTE: /note/i,
    SETTLEMENT_NOTE: translation.settlementForm.noteLabel,
} as const;
