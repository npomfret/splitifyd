// Page-specific type definitions for TypeScript migration Phase 5

// App initialization types
interface AppInitConfig {
  maxRetries?: number;
  retryDelay?: number;
  authRedirectPath?: string;
}

interface AppInitManager {
  waitForFirebase(): Promise<void>;
  initializeAuth(): void;
  showErrorBanner(message: string): void;
  handleError(error: Error | string): void;
}

// Join group types
interface JoinGroupParams {
  linkId: string;
  groupId?: string;
}

interface JoinGroupManager {
  init(): Promise<void>;
  processJoinLink(linkId: string): Promise<void>;
  handleJoinSuccess(groupId: string): void;
  handleJoinError(error: any): void;
}

// Registration types
interface RegistrationFormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
}

interface RegistrationManager {
  init(): void;
  validateForm(formData: RegistrationFormData): ValidationResult;
  handleRegistration(event: Event): Promise<void>;
  showError(message: string): void;
  showSuccess(message: string): void;
}

// Auth redirect types
interface AuthRedirectManager {
  checkAuth(): void;
  redirectToDashboard(): void;
  getRedirectUrl(): string;
}

// Logout handler types
interface LogoutManager {
  init(): void;
  performLogout(): Promise<void>;
  clearLocalData(): void;
  redirectToLogin(): void;
}

// Password reset types
interface PasswordResetFormData {
  email: string;
}

interface PasswordResetManager {
  init(): void;
  handlePasswordReset(event: Event): Promise<void>;
  validateEmail(email: string): ValidationResult;
  showMessage(message: string, isError: boolean): void;
}

// Dashboard init types
interface DashboardInitManager {
  init(): Promise<void>;
  checkAuthentication(): Promise<boolean>;
  loadDashboard(): void;
  handleAuthError(): void;
}

// Expense detail types
interface ExpenseDetailState {
  expense: Expense | null;
  group: Group | null;
  currentUser: User | null;
  isCreator: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface ExpenseDetailManager {
  init(): Promise<void>;
  loadExpenseDetails(expenseId: string, groupId: string): Promise<void>;
  renderExpenseDetails(): void;
  handleEdit(): void;
  handleDelete(): Promise<void>;
}

// Add expense types
interface AddExpenseFormData {
  description: string;
  amount: string;
  paidBy: string;
  splitMethod: 'equal' | 'custom' | 'percentage';
  splits: Record<string, number>;
  selectedMembers: string[];
}

interface AddExpenseManager {
  init(): Promise<void>;
  loadGroupMembers(groupId: string): Promise<void>;
  validateForm(formData: AddExpenseFormData): ValidationResult;
  calculateSplits(amount: number, method: string, selectedMembers: string[]): Record<string, number>;
  handleSubmit(event: Event): Promise<void>;
  handleEdit(expenseId: string): Promise<void>;
}

// Group detail types
interface GroupDetailState {
  group: GroupDetail | null;
  expenses: ExpenseData[];
  balances: GroupBalances | null;
  members: Member[];
  currentTab: 'balances' | 'expenses' | 'activity';
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
}

interface GroupDetailManager {
  init(): Promise<void>;
  loadGroupDetails(groupId: string): Promise<void>;
  switchTab(tab: string): void;
  loadExpenses(page: number): Promise<void>;
  calculateBalances(): void;
  handleMemberInvite(): void;
  handleMemberRemove(memberId: string): Promise<void>;
  generateShareableLink(): Promise<void>;
}

// Shared page utilities
interface PageUtils {
  getUrlParams(): URLSearchParams;
  getRequiredParam(params: URLSearchParams, key: string): string;
  formatCurrency(amount: number): string;
  formatDate(date: string): string;
  debounce<T extends (...args: any[]) => any>(func: T, wait: number): T;
}

// Export all page types
export {
  AppInitConfig,
  AppInitManager,
  JoinGroupParams,
  JoinGroupManager,
  RegistrationFormData,
  RegistrationManager,
  AuthRedirectManager,
  LogoutManager,
  PasswordResetFormData,
  PasswordResetManager,
  DashboardInitManager,
  ExpenseDetailState,
  ExpenseDetailManager,
  AddExpenseFormData,
  AddExpenseManager,
  GroupDetailState,
  GroupDetailManager,
  PageUtils
};