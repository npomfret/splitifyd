import translation from '../../../webapp-v2/src/locales/en/translation.json' with { type: 'json' };

export const SELECTORS = {
    SUBMIT_BUTTON: 'button[type="submit"]',
} as const;

export const FORM_LABELS = {
    DESCRIPTION: translation.expenseBasicFields.descriptionLabel,
    WHO_PAID: new RegExp(translation.expenseForm.whoPaid, 'i'),
    SPLIT_BETWEEN: translation.expenseForm.splitBetween,
} as const;
