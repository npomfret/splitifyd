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
  GROUP_DESCRIPTION: 'Add any details about this group...',
} as const;

export const HEADINGS = {
  SIGN_IN: 'Sign In',
  CREATE_ACCOUNT: 'Create Account',
  PRICING: 'Pricing',
  HOMEPAGE: 'Effortless Bill Splitting, Simplified & Smart.',
  YOUR_GROUPS: /Your Groups|My Groups/i,
  BALANCES: 'Balances',
  EXPENSES: 'Expenses',
  JOIN_GROUP: 'Join Group',
  EXPENSE_DETAILS: 'Expense Details',
  WHO_PAID: /Who paid/,
  SPLIT_BETWEEN: /Split between/,
} as const;

export const BUTTON_TEXTS = {
  SETTLE_UP: /settle up/i,
  JOIN_GROUP: /join group/i,
  RECORD_PAYMENT: /record payment/i,
  SELECT_ALL: 'Select all',
  SHOW_HISTORY: 'Show History',
  ADD_EXPENSE: /add expense/i,
  SAVE_EXPENSE: /save expense/i,
  SHARE: /share/i,
  SIGN_OUT: /Sign Out|Logout/i,
  SIGN_IN: /Sign In|Login/i,
} as const;

export const MESSAGES = {
  ALL_SETTLED_UP: 'All settled up!',
  NO_EXPENSES_YET: /no expenses yet/i,
  WELCOME_BACK: /Welcome back/i,
  LOADING_BALANCES: 'Loading balances...',
} as const;

export const FORM_LABELS = {
  WHO_PAID: /who paid/i,
  WHO_RECEIVED_PAYMENT: /who received the payment/i,
  AMOUNT: /amount/i,
  NOTE: /note/i,
} as const;

export const CLASS_SELECTORS = {
  WHITE_BACKGROUND: '.bg-white',
  RED_TEXT: '.text-red-600',
  GRAY_TEXT: '.text-sm.font-medium.text-gray-700',
} as const;