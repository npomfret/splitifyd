import translation from '../../../webapp-v2/src/locales/en/translation.json' with { type: "json" };

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

export const ARIA_ROLES = {
    BUTTON: 'button',
    HEADING: 'heading',
    LINK: 'link',
    NAVIGATION: 'navigation',
    FORM: 'form',
    DIALOG: 'dialog',
    TEXTBOX: 'textbox',
    COMBOBOX: 'combobox',
    MAIN: 'main',
} as const;

export const PLACEHOLDERS = {
    EXPENSE_DESCRIPTION: translation.expenseBasicFields.descriptionPlaceholder,
    EXPENSE_AMOUNT: '0.00',
    SETTLEMENT_AMOUNT: translation.settlementForm.amountPlaceholder,
    GROUP_DESCRIPTION: translation.createGroupModal.groupDescriptionPlaceholder,
    CATEGORY_INPUT: translation.expenseBasicFields.categoryPlaceholder,
    SELECT_PERSON: translation.settlementForm.selectPersonPlaceholder,
    SETTLEMENT_NOTE: translation.settlementForm.notePlaceholder,
} as const;

export const HEADINGS = {
    SIGN_IN: translation.loginPage.title,
    CREATE_ACCOUNT: translation.registerPage.title,
    PRICING: 'Pricing',
    HOMEPAGE: 'Effortless Bill Splitting, Simplified & Smart.',
    YOUR_GROUPS: /Your Groups|My Groups/i,
    BALANCES: translation.balanceSummary.title,
    EXPENSES: translation.expensesList.title,
    JOIN_GROUP: translation.common.joinGroup,
    EXPENSE_DETAILS: translation.expenseBasicFields.title,
    WHO_PAID: new RegExp(translation.expenseForm.whoPaid),
    SPLIT_BETWEEN: new RegExp(translation.expenseForm.splitBetween),
    STATISTICS: translation.dashboardStats.title,
    UPDATE_PAYMENT: translation.settlementForm.updatePayment,
    RECORD_PAYMENT: translation.settlementForm.recordPayment,
    DELETE_PAYMENT: translation.settlementHistory.deletePaymentTitle,
} as const;

export const BUTTON_TEXTS = {
    SETTLE_UP: new RegExp(translation.common.settleUp, 'i'),
    JOIN_GROUP: new RegExp(translation.common.joinGroup, 'i'),
    RECORD_PAYMENT: new RegExp(translation.settlementForm.recordPayment, 'i'),
    UPDATE_PAYMENT: new RegExp(translation.settlementForm.updatePayment, 'i'),
    SELECT_ALL: translation.expenseForm.selectAll,
    SHOW_HISTORY: translation.common.showHistory,
    ADD_EXPENSE: new RegExp(translation.common.addExpense, 'i'),
    SAVE_EXPENSE: new RegExp(translation.expenseForm.saveExpense, 'i'),
    UPDATE_EXPENSE: new RegExp(translation.expenseForm.updateExpense, 'i'),
    SHARE: new RegExp(translation.common.share, 'i'),
    SIGN_OUT: /^Sign out$/i,
    SIGN_IN: translation.loginPage.submitButton,
    EDIT: new RegExp(translation.common.edit, 'i'),
    SETTINGS: new RegExp(translation.common.settings, 'i'),
    CREATE_ACCOUNT: translation.registerPage.submitButton,
    CREATE_GROUP: translation.createGroupModal.submitButton,
    CANCEL: translation.expenseForm.cancel,
    CANCEL_SETTLEMENT: translation.settlementForm.cancelButton,
    DELETE_SETTLEMENT: translation.settlementHistory.deleteButton,
    CREATE_FIRST_GROUP: translation.emptyGroupsState.createFirstGroup,
    CREATE_NEW_GROUP: translation.quickActions.createNewGroup,
    TODAY: translation.expenseBasicFields.today,
    YESTERDAY: translation.expenseBasicFields.yesterday,
    THIS_MORNING: translation.expenseBasicFields.thisMorning,
    LAST_NIGHT: translation.expenseBasicFields.lastNight,
    LOAD_MORE: translation.expensesList.loadMore,
    LOAD_MORE_SETTLEMENTS: translation.settlementHistory.loadMore,
} as const;

export const MESSAGES = {
    ALL_SETTLED_UP: translation.common.allSettledUp,
    ALL_SETTLED_UP_BALANCE: translation.balanceSummary.allSettledUp,
    NO_EXPENSES_YET: translation.expensesList.noExpensesYet,
    NO_PAYMENTS_YET: translation.settlementHistory.noPaymentsYet,
    WELCOME_BACK: /Welcome (back|to Splitifyd)/i,
    LOADING_BALANCES: translation.balanceSummary.loadingBalances,
    LOADING_EXPENSE_FORM: translation.common.loadingExpenseForm,
    CHECKING_AUTH: translation.common.checkingAuth,
    INVALID_LINK: translation.common.invalidLink,
    NO_GROUPS_YET: translation.emptyGroupsState.title,
    SETTLED_UP: translation.groupCard.settledUp,
    NO_RECENT_ACTIVITY: translation.groupCard.noRecentActivity,
    RECENT_AMOUNTS: translation.expenseBasicFields.recentAmounts,
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

export const SPLIT_TYPES = {
    EQUAL: translation.expenseForm.equal,
    PERCENTAGE: translation.expenseForm.percentage,
    EXACT_AMOUNTS: translation.expenseForm.exactAmounts,
} as const;

export const SPLIT_INSTRUCTIONS = {
    EXACT_AMOUNTS: translation.expenseForm.exactAmountsInstruction,
    PERCENTAGE: translation.expenseForm.percentageInstruction,
} as const;

export const ERROR_MESSAGES = {
    DISPLAY_NAME_EMPTY: translation.errors.displayNameEmpty,
    DISPLAY_NAME_TOO_LONG: translation.errors.displayNameTooLong,
    PASSWORD_TOO_SHORT: translation.errors.passwordTooShort,
    PASSWORDS_NO_MATCH: translation.errors.passwordsNoMatch,
    PASSWORD_SAME_AS_CURRENT: translation.errors.passwordSameAsCurrent,
    PASSWORD_AND_NEW_REQUIRED: translation.errors.passwordAndNewRequired,
} as const;

export const SETTLEMENT_SELECTORS = {
    MODAL: '[data-testid="settlement-form-modal"]',
    PAYER_SELECT: '[data-testid="settlement-payer-select"]',
    PAYEE_SELECT: '[data-testid="settlement-payee-select"]',
    AMOUNT_INPUT: '[data-testid="settlement-amount-input"]',
    DATE_INPUT: '[data-testid="settlement-date-input"]',
    NOTE_INPUT: '[data-testid="settlement-note-input"]',
    SAVE_BUTTON: '[data-testid="save-settlement-button"]',
    CANCEL_BUTTON: '[data-testid="cancel-settlement-button"]',
    SETTLEMENT_ITEM: '[data-testid="settlement-item"]',
    EDIT_BUTTON: '[data-testid="edit-settlement-button"]',
    DELETE_BUTTON: '[data-testid="delete-settlement-button"]',
} as const;
