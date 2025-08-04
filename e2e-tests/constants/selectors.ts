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
  
  // User interface
  USER_MENU_BUTTON: (displayName: string) => `button:has-text("${displayName}")`,
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

export const TEST_IDS = {
  // Add data-testid constants here as needed
  FEATURES_SECTION: 'features-section',
  FREE_PLAN: 'free-plan',
  PREMIUM_PLAN: 'premium-plan',
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
  BALANCES: /balance/i,
  JOIN_GROUP: 'Join Group',
} as const;