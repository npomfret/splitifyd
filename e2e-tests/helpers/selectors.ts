/**
 * Central repository for all test selectors
 * This eliminates .or() chains and provides single source of truth
 */

export const SELECTORS = {
  // Navigation
  navigation: {
    loginLink: { role: 'link', name: 'Login' },
    signUpLink: { role: 'link', name: 'Sign Up', exact: true },
    pricingLink: { role: 'link', name: 'Pricing' },
    logoLink: { role: 'link', name: /splitifyd|home/i }
  },
  
  // Auth pages
  auth: {
    signInHeading: { role: 'heading', name: 'Sign In' },
    createAccountHeading: { role: 'heading', name: 'Create Account' },
    emailInput: { placeholder: 'Email' },
    passwordInput: { placeholder: 'Password' },
    submitButton: { role: 'button', name: /sign in|create account/i }
  },
  
  // Dashboard
  dashboard: {
    createGroupButton: { role: 'button', name: 'Create Group' },
    groupsList: '[data-testid="groups-list"], .groups-list',
    groupItem: '[data-testid^="group-item-"], .group-item'
  },
  
  // Create group modal
  createGroupModal: {
    modal: '.fixed.inset-0',
    nameInput: { placeholder: 'Group name' },
    descriptionInput: { placeholder: 'Description (optional)' },
    createButton: { role: 'button', name: 'Create Group' },
    cancelButton: { role: 'button', name: 'Cancel' }
  },
  
  // Group detail page
  groupDetail: {
    addExpenseButton: { role: 'button', name: 'Add Expense' },
    shareButton: { role: 'button', name: /share/i },
    groupNameHeading: 'h1, h2',
    membersList: '[data-testid="members-list"], .members-section',
    balanceSection: '[data-testid="balance-summary"], .balance-summary',
    expensesList: '[data-testid="expenses-list"], .expenses-list',
    expenseItem: '[data-testid^="expense-item-"], .expense-item'
  },
  
  // Add expense page
  addExpense: {
    descriptionInput: { placeholder: 'What was this expense for?' },
    amountInput: { placeholder: '0.00' },
    categoryButton: { role: 'button', name: /category/i },
    splitTypeButton: { text: /split equally/i },
    paidByButton: { role: 'button', name: /paid by/i },
    submitButton: { role: 'button', name: 'Add Expense' },
    cancelButton: { role: 'button', name: 'Cancel' }
  },
  
  // Share dialog
  shareDialog: {
    dialog: { role: 'dialog' },
    shareLinkInput: { role: 'textbox' },
    copyButton: { role: 'button', name: /copy/i }
  },
  
  // Join group page
  joinGroup: {
    heading: { role: 'heading', name: 'Join Group' },
    joinButton: { role: 'button', name: 'Join Group' }
  },
  
  // Error messages
  errors: {
    networkError: { text: 'Network error' },
    serverError: { text: 'Server error' },
    validationError: { text: /required|invalid|must/i },
    genericError: { text: /error|failed|problem/i }
  },
  
  // Loading states
  loading: {
    spinner: '.spinner, [data-testid="loading"], .loading',
    skeleton: '.skeleton, [data-testid="skeleton"]'
  },
  
  // Balances
  balances: {
    settledMessage: { text: /all.*settled.*up/i },
    balanceItem: '[data-testid^="balance-item-"], .balance-item',
    owesText: { text: /owes/i },
    totalAmount: { text: /\$\d+/ }
  }
};

/**
 * Helper function to get a selector by role
 */
export function getByRole(page: any, selector: { role: string; name: string | RegExp; exact?: boolean }) {
  return page.getByRole(selector.role, { 
    name: selector.name, 
    exact: selector.exact 
  });
}

/**
 * Helper function to get a selector by placeholder
 */
export function getByPlaceholder(page: any, selector: { placeholder: string }) {
  return page.getByPlaceholder(selector.placeholder);
}

/**
 * Helper function to get a selector by text
 */
export function getByText(page: any, selector: { text: string | RegExp }) {
  return page.getByText(selector.text);
}'A'.repeat(100);
