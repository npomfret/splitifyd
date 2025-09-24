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
    SIGN_OUT: new RegExp(translation.userMenu.signOut, 'i'),
    SIGNING_OUT: new RegExp(translation.userMenu.signingOut, 'i'),
    HEADER_LOGIN: translation.header.login,
    HEADER_SIGN_UP: translation.header.signUp,
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
    // Group Actions
    ADD_EXPENSE_GROUP: translation.groupActions.addExpense,
    SETTLE_UP_GROUP: translation.groupActions.settleUp,
    INVITE_OTHERS_GROUP: translation.groupActions.inviteOthers,
    GROUP_SETTINGS: translation.groupActions.groupSettings,
    // Member Management
    LEAVE_GROUP: translation.membersList.leaveGroup,
    YESTERDAY: translation.expenseBasicFields.yesterday,
    THIS_MORNING: translation.expenseBasicFields.thisMorning,
    LAST_NIGHT: translation.expenseBasicFields.lastNight,
    LOAD_MORE: translation.expensesList.loadMore,
    LOAD_MORE_SETTLEMENTS: translation.settlementHistory.loadMore,
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

export const SETTINGS_SELECTORS = {
    ACCOUNT_SETTINGS_HEADER: '[data-testid="account-settings-header"]',
    PROFILE_INFORMATION_SECTION: '[data-testid="profile-information-section"]',
    PROFILE_DISPLAY_NAME: '[data-testid="profile-display-name"]',
    PROFILE_EMAIL: '[data-testid="profile-email"]',
    DISPLAY_NAME_INPUT: '[data-testid="display-name-input"]',
    SAVE_CHANGES_BUTTON: '[data-testid="save-changes-button"]',
    PASSWORD_SECTION: '[data-testid="password-section"]',
    CHANGE_PASSWORD_BUTTON: '[data-testid="change-password-button"]',
    PASSWORD_FORM: '[data-testid="password-form"]',
    CURRENT_PASSWORD_INPUT: '[data-testid="current-password-input"]',
    NEW_PASSWORD_INPUT: '[data-testid="new-password-input"]',
    CONFIRM_PASSWORD_INPUT: '[data-testid="confirm-password-input"]',
    UPDATE_PASSWORD_BUTTON: '[data-testid="update-password-button"]',
    CANCEL_PASSWORD_BUTTON: '[data-testid="cancel-password-button"]',
} as const;

export const SETTINGS_TEXTS = {
    ACCOUNT_SETTINGS_HEADER: translation.settingsPage.accountSettingsHeader,
    ACCOUNT_SETTINGS_SUBHEADER: translation.settingsPage.accountSettingsSubheader,
    PROFILE_INFORMATION_HEADER: translation.settingsPage.profileInformationHeader,
    CURRENT_DISPLAY_NAME: translation.settingsPage.currentDisplayName,
    EMAIL: translation.settingsPage.email,
    DISPLAY_NAME_LABEL: translation.settingsPage.displayNameLabel,
    DISPLAY_NAME_PLACEHOLDER: translation.settingsPage.displayNamePlaceholder,
    SAVE_CHANGES_BUTTON: translation.settingsPage.saveChangesButton,
    PASSWORD_HEADER: translation.settingsPage.passwordHeader,
    CHANGE_PASSWORD_BUTTON: translation.settingsPage.changePasswordButton,
    CURRENT_PASSWORD_LABEL: translation.settingsPage.currentPasswordLabel,
    NEW_PASSWORD_LABEL: translation.settingsPage.newPasswordLabel,
    CONFIRM_NEW_PASSWORD_LABEL: translation.settingsPage.confirmNewPasswordLabel,
    UPDATE_PASSWORD_BUTTON: translation.settingsPage.updatePasswordButton,
    CANCEL_BUTTON: translation.settingsPage.cancelButton,
    SUCCESS_PROFILE_UPDATED: translation.settingsPage.successMessages.profileUpdated,
    SUCCESS_PASSWORD_CHANGED: translation.settingsPage.successMessages.passwordChanged,
} as const;
