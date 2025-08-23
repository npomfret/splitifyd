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
    EXPENSE_DESCRIPTION: 'What was this expense for?',
    EXPENSE_AMOUNT: '0.00',
    GROUP_DESCRIPTION: translation.createGroupModal.groupDescriptionPlaceholder,
} as const;

export const HEADINGS = {
    SIGN_IN: translation.loginPage.title,
    CREATE_ACCOUNT: translation.registerPage.title,
    PRICING: 'Pricing',
    HOMEPAGE: 'Effortless Bill Splitting, Simplified & Smart.',
    YOUR_GROUPS: /Your Groups|My Groups/i,
    BALANCES: 'Balances',
    EXPENSES: 'Expenses',
    JOIN_GROUP: translation.common.joinGroup,
    EXPENSE_DETAILS: 'Expense Details',
    WHO_PAID: new RegExp(translation.expenseForm.whoPaid),
    SPLIT_BETWEEN: new RegExp(translation.expenseForm.splitBetween),
    STATISTICS: translation.dashboardStats.title,
} as const;

export const BUTTON_TEXTS = {
    SETTLE_UP: new RegExp(translation.common.settleUp, 'i'),
    JOIN_GROUP: new RegExp(translation.common.joinGroup, 'i'),
    RECORD_PAYMENT: new RegExp(translation.settlementForm.recordPayment, 'i'),
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
    CREATE_FIRST_GROUP: translation.emptyGroupsState.createFirstGroup,
    CREATE_NEW_GROUP: translation.quickActions.createNewGroup,
} as const;

export const MESSAGES = {
    ALL_SETTLED_UP: translation.common.allSettledUp,
    NO_EXPENSES_YET: /no expenses yet/i,
    WELCOME_BACK: /Welcome (back|to Splitifyd)/i,
    LOADING_BALANCES: translation.common.loadingBalances,
    LOADING_EXPENSE_FORM: translation.common.loadingExpenseForm,
    CHECKING_AUTH: translation.common.checkingAuth,
    INVALID_LINK: translation.common.invalidLink,
    NO_GROUPS_YET: translation.emptyGroupsState.title,
    SETTLED_UP: translation.groupCard.settledUp,
    NO_RECENT_ACTIVITY: translation.groupCard.noRecentActivity,
} as const;

export const FORM_LABELS = {
    DESCRIPTION: translation.expenseForm.description,
    AMOUNT: translation.expenseForm.amount,
    WHO_PAID: new RegExp(translation.expenseForm.whoPaid, 'i'),
    WHO_RECEIVED_PAYMENT: /who received the payment/i,
    SPLIT_BETWEEN: translation.expenseForm.splitBetween,
    NOTE: /note/i,
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
