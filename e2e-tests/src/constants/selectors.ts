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

export const NAVIGATION_SELECTORS = {
    HEADER_LOGIN_LINK: '[data-testid="header-login-link"]',
    HEADER_SIGNUP_LINK: '[data-testid="header-signup-link"]',
    USER_MENU_BUTTON: '[data-testid="user-menu-button"]',
    USER_DROPDOWN_MENU: '[data-testid="user-dropdown-menu"]',
    USER_MENU_DASHBOARD_LINK: '[data-testid="user-menu-dashboard-link"]',
    USER_MENU_SETTINGS_LINK: '[data-testid="user-menu-settings-link"]',
    SIGN_OUT_BUTTON: '[data-testid="sign-out-button"]',
    GROUP_SETTINGS_BUTTON: '[data-testid="group-settings-button"]',
} as const;

export const FOOTER_SELECTORS = {
    PRICING_LINK: '[data-testid="footer-pricing-link"]',
    TERMS_LINK: '[data-testid="footer-terms-link"]',
    PRIVACY_LINK: '[data-testid="footer-privacy-link"]',
    COOKIES_LINK: '[data-testid="footer-cookies-link"]',
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

export const SETTINGS_ERROR_MESSAGES = {
    PROFILE_UPDATE_FAILED: translation.settingsPage.errorMessages.profileUpdateFailed,
    PASSWORD_AND_NEW_REQUIRED: translation.settingsPage.errorMessages.passwordAndNewRequired,
    PASSWORD_TOO_SHORT: translation.settingsPage.errorMessages.passwordTooShort,
    PASSWORDS_NO_MATCH: translation.settingsPage.errorMessages.passwordsNoMatch,
    PASSWORD_SAME_AS_CURRENT: translation.settingsPage.errorMessages.passwordSameAsCurrent,
    CURRENT_PASSWORD_INCORRECT: translation.settingsPage.errorMessages.currentPasswordIncorrect,
    PASSWORD_CHANGE_FAILED: translation.settingsPage.errorMessages.passwordChangeFailed,
    DISPLAY_NAME_EMPTY: translation.settingsPage.errorMessages.displayNameEmpty,
    DISPLAY_NAME_TOO_LONG: translation.settingsPage.errorMessages.displayNameTooLong,
} as const;

export const GROUP_MANAGEMENT_SELECTORS = {
    // Group Actions
    ADD_EXPENSE_BUTTON: '[data-testid="add-expense-button"]',
    SETTLE_UP_BUTTON: '[data-testid="settle-up-button"]',
    INVITE_OTHERS_BUTTON: '[data-testid="invite-others-button"]',
    GROUP_SETTINGS_BUTTON: '[data-testid="group-settings-button"]',
    
    // Member Management
    MEMBER_ITEM: '[data-testid="member-item"]',
    REMOVE_MEMBER_BUTTON: '[data-testid="remove-member-button"]',
    LEAVE_GROUP_BUTTON: '[data-testid="leave-group-button"]',
    LEAVE_GROUP_DIALOG: '[data-testid="leave-group-dialog"]',
    REMOVE_MEMBER_DIALOG: '[data-testid="remove-member-dialog"]',
    
    // Share Group Modal
    SHARE_LINK_INPUT: '[data-testid="share-link-input"]',
    COPY_LINK_BUTTON: '[data-testid="copy-link-button"]',
    CLOSE_SHARE_MODAL_BUTTON: '[data-testid="close-share-modal-button"]',
    GENERATE_NEW_LINK_BUTTON: '[data-testid="generate-new-link-button"]',
} as const;

export const GROUP_MANAGEMENT_TEXTS = {
    // Group Actions
    GROUP_ACTIONS_TITLE: translation.groupActions.title,
    ADD_EXPENSE: translation.groupActions.addExpense,
    SETTLE_UP: translation.groupActions.settleUp,
    INVITE_OTHERS: translation.groupActions.inviteOthers,
    GROUP_SETTINGS: translation.groupActions.groupSettings,
    
    // Member Management
    MEMBERS_TITLE: translation.membersList.title,
    ADMIN: translation.membersList.admin,
    LEAVE_GROUP: translation.membersList.leaveGroup,
    LEAVE_GROUP_DIALOG_TITLE: translation.membersList.leaveGroupDialog.title,
    LEAVE_GROUP_CONFIRM_TEXT: translation.membersList.leaveGroupDialog.confirmText,
    LEAVE_GROUP_CANCEL_TEXT: translation.membersList.leaveGroupDialog.cancelText,
    REMOVE_MEMBER_DIALOG_TITLE: translation.membersList.removeMemberDialog.title,
    REMOVE_MEMBER_CONFIRM_TEXT: translation.membersList.removeMemberDialog.confirmText,
    REMOVE_MEMBER_CANCEL_TEXT: translation.membersList.removeMemberDialog.cancelText,
    
    // Share Group Modal
    SHARE_GROUP_TITLE: translation.shareGroupModal.title,
    SHARE_GROUP_DESCRIPTION: translation.shareGroupModal.description,
    QR_CODE_DESCRIPTION: translation.shareGroupModal.qrCodeDescription,
    EXPIRATION: translation.shareGroupModal.expiration,
    GENERATE_NEW: translation.shareGroupModal.generateNew,
    LINK_COPIED: translation.shareGroupModal.linkCopied,
} as const;

export const NAVIGATION_TEXTS = {
    COMPANY_NAME: translation.footer.companyName,
    COMPANY_DESCRIPTION: translation.footer.companyDescription,
    PRODUCT_SECTION: translation.footer.productSection,
    PRICING: translation.footer.pricing,
    LEGAL_SECTION: translation.footer.legalSection,
    TERMS_OF_SERVICE: translation.footer.termsOfService,
    PRIVACY_POLICY: translation.footer.privacyPolicy,
    COOKIE_POLICY: translation.footer.cookiePolicy,
    COPYRIGHT: translation.footer.copyright,
    DASHBOARD: translation.userMenu.dashboard,
    SETTINGS: translation.userMenu.settings,
    LOGO_ALT: translation.header.logoAlt,
    GROUP_SETTINGS_ARIA: translation.groupHeader.groupSettingsAriaLabel,
} as const;
