import { signal } from '@preact/signals';
import type { CreateExpenseRequest, ExpenseData, ExpenseSplit } from '@shared/types/webapp-shared-types';
import { apiClient, ApiError } from '../apiClient';
import { groupDetailStore } from './group-detail-store';
import { groupsStore } from './groups-store';

export interface ExpenseFormStore {
  // Form fields
  description: string;
  amount: number;
  date: string;
  paidBy: string;
  category: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  splits: ExpenseSplit[];
  
  // UI state
  loading: boolean;
  saving: boolean;
  error: string | null;
  validationErrors: Record<string, string>;
  
  // Actions
  updateField<K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]): void;
  setParticipants(participants: string[]): void;
  toggleParticipant(userId: string): void;
  calculateEqualSplits(): void;
  updateSplitAmount(userId: string, amount: number): void;
  updateSplitPercentage(userId: string, percentage: number): void;
  validateForm(): boolean;
  saveExpense(groupId: string): Promise<ExpenseData>;
  clearError(): void;
  reset(): void;
  hasUnsavedChanges(): boolean;
  saveDraft(groupId: string): void;
  loadDraft(groupId: string): boolean;
  clearDraft(groupId: string): void;
}

// Type for form data fields
interface ExpenseFormData {
  description: string;
  amount: number;
  date: string;
  paidBy: string;
  category: string;
  splitType: 'equal' | 'exact' | 'percentage';
}

// Get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Signals for form state
const descriptionSignal = signal<string>('');
const amountSignal = signal<number>(0);
const dateSignal = signal<string>(getTodayDate());
const paidBySignal = signal<string>('');
const categorySignal = signal<string>('General');
const splitTypeSignal = signal<'equal' | 'exact' | 'percentage'>('equal');
const participantsSignal = signal<string[]>([]);
const splitsSignal = signal<ExpenseSplit[]>([]);

// UI state signals
const loadingSignal = signal<boolean>(false);
const savingSignal = signal<boolean>(false);
const errorSignal = signal<string | null>(null);
const validationErrorsSignal = signal<Record<string, string>>({});

// Common expense categories with icons
export const EXPENSE_CATEGORIES = [
  { name: 'General', icon: '📄' },
  { name: 'Food & Dining', icon: '🍽️' },
  { name: 'Transportation', icon: '🚗' },  
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Bills & Utilities', icon: '⚡' },
  { name: 'Travel', icon: '✈️' },
  { name: 'Healthcare', icon: '🏥' },
  { name: 'Other', icon: '❓' }
];


// Recent categories management
const RECENT_CATEGORIES_KEY = 'recent-expense-categories';
const MAX_RECENT_CATEGORIES = 3;

function getRecentCategories(): string[] {
  try {
    const recent = localStorage.getItem(RECENT_CATEGORIES_KEY);
    return recent ? JSON.parse(recent) : [];
  } catch {
    return [];
  }
}

function addRecentCategory(category: string): void {
  try {
    const recent = getRecentCategories();
    const filtered = recent.filter(cat => cat !== category);
    const updated = [category, ...filtered].slice(0, MAX_RECENT_CATEGORIES);
    localStorage.setItem(RECENT_CATEGORIES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

// Recent amounts management
const RECENT_AMOUNTS_KEY = 'recent-expense-amounts';
const MAX_RECENT_AMOUNTS = 5;

function getRecentAmounts(): number[] {
  try {
    const recent = localStorage.getItem(RECENT_AMOUNTS_KEY);
    return recent ? JSON.parse(recent) : [];
  } catch {
    return [];
  }
}

function addRecentAmount(amount: number): void {
  try {
    const recent = getRecentAmounts();
    const filtered = recent.filter(amt => amt !== amount);
    const updated = [amount, ...filtered].slice(0, MAX_RECENT_AMOUNTS);
    localStorage.setItem(RECENT_AMOUNTS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

export { getRecentCategories, getRecentAmounts };

class ExpenseFormStoreImpl implements ExpenseFormStore {
  // State getters
  get description() { return descriptionSignal.value; }
  get amount() { return amountSignal.value; }
  get date() { return dateSignal.value; }
  get paidBy() { return paidBySignal.value; }
  get category() { return categorySignal.value; }
  get splitType() { return splitTypeSignal.value; }
  get participants() { return participantsSignal.value; }
  get splits() { return splitsSignal.value; }
  get loading() { return loadingSignal.value; }
  get saving() { return savingSignal.value; }
  get error() { return errorSignal.value; }
  get validationErrors() { return validationErrorsSignal.value; }

  updateField<K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]): void {
    errorSignal.value = null;
    
    // Update the field value first
    switch (field) {
      case 'description':
        descriptionSignal.value = value as string;
        break;
      case 'amount':
        amountSignal.value = value as number;
        // Recalculate splits based on current type
        if (splitTypeSignal.value === 'equal') {
          this.calculateEqualSplits();
        } else if (splitTypeSignal.value === 'percentage') {
          // Recalculate amounts for percentage splits
          const currentSplits = [...splitsSignal.value];
          currentSplits.forEach(split => {
            if (split.percentage !== undefined) {
              split.amount = (value as number * split.percentage) / 100;
            }
          });
          splitsSignal.value = currentSplits;
        }
        break;
      case 'date':
        dateSignal.value = value as string;
        break;
      case 'paidBy':
        paidBySignal.value = value as string;
        // Auto-add payer to participants if not already included
        if (!participantsSignal.value.includes(value as string)) {
          participantsSignal.value = [...participantsSignal.value, value as string];
        }
        break;
      case 'category':
        categorySignal.value = value as string;
        break;
      case 'splitType':
        splitTypeSignal.value = value as 'equal' | 'exact' | 'percentage';
        // Recalculate splits when type changes
        this.handleSplitTypeChange(value as 'equal' | 'exact' | 'percentage');
        break;
    }
    
    // Perform real-time validation for the field
    const errors = { ...validationErrorsSignal.value };
    const fieldError = this.validateField(field, value);
    
    if (fieldError) {
      errors[field] = fieldError;
    } else {
      delete errors[field];
    }
    
    // Also validate splits if amount or split type changed
    if (field === 'amount' || field === 'splitType') {
      const splitsError = this.validateField('splits');
      if (splitsError) {
        errors.splits = splitsError;
      } else {
        delete errors.splits;
      }
    }
    
    validationErrorsSignal.value = errors;
  }

  setParticipants(participants: string[]): void {
    participantsSignal.value = participants;
    // Always include payer in participants
    if (paidBySignal.value && !participants.includes(paidBySignal.value)) {
      participantsSignal.value = [...participants, paidBySignal.value];
    }
    // Recalculate splits based on current type
    this.handleSplitTypeChange(splitTypeSignal.value);
    
    // Validate participants
    const errors = { ...validationErrorsSignal.value };
    const participantsError = this.validateField('participants');
    if (participantsError) {
      errors.participants = participantsError;
    } else {
      delete errors.participants;
    }
    validationErrorsSignal.value = errors;
  }

  toggleParticipant(userId: string): void {
    const current = participantsSignal.value;
    const isIncluded = current.includes(userId);
    
    // Don't allow removing the payer
    if (userId === paidBySignal.value && isIncluded) {
      return;
    }
    
    if (isIncluded) {
      participantsSignal.value = current.filter(id => id !== userId);
    } else {
      participantsSignal.value = [...current, userId];
    }
    
    // Recalculate splits based on current type
    this.handleSplitTypeChange(splitTypeSignal.value);
  }

  calculateEqualSplits(): void {
    const participants = participantsSignal.value;
    const amount = amountSignal.value;
    
    if (participants.length === 0 || amount <= 0) {
      splitsSignal.value = [];
      return;
    }
    
    // Calculate equal split amount
    const splitAmount = Math.floor((amount * 100) / participants.length) / 100;
    const remainder = amount - (splitAmount * participants.length);
    
    // Create splits
    const splits: ExpenseSplit[] = participants.map((userId, index) => ({
      userId,
      amount: index === 0 ? splitAmount + remainder : splitAmount
    }));
    
    splitsSignal.value = splits;
  }

  updateSplitAmount(userId: string, amount: number): void {
    const currentSplits = [...splitsSignal.value];
    const splitIndex = currentSplits.findIndex(s => s.userId === userId);
    
    if (splitIndex >= 0) {
      currentSplits[splitIndex] = { ...currentSplits[splitIndex], amount };
    } else {
      currentSplits.push({ userId, amount });
    }
    
    splitsSignal.value = currentSplits;
    
    // Validate splits
    const errors = { ...validationErrorsSignal.value };
    const splitsError = this.validateField('splits');
    if (splitsError) {
      errors.splits = splitsError;
    } else {
      delete errors.splits;
    }
    validationErrorsSignal.value = errors;
  }

  updateSplitPercentage(userId: string, percentage: number): void {
    const currentSplits = [...splitsSignal.value];
    const splitIndex = currentSplits.findIndex(s => s.userId === userId);
    
    if (splitIndex >= 0) {
      currentSplits[splitIndex] = { 
        ...currentSplits[splitIndex], 
        percentage,
        amount: (amountSignal.value * percentage) / 100
      };
    } else {
      currentSplits.push({ 
        userId, 
        percentage,
        amount: (amountSignal.value * percentage) / 100
      });
    }
    
    splitsSignal.value = currentSplits;
    
    // Validate splits
    const errors = { ...validationErrorsSignal.value };
    const splitsError = this.validateField('splits');
    if (splitsError) {
      errors.splits = splitsError;
    } else {
      delete errors.splits;
    }
    validationErrorsSignal.value = errors;
  }

  private handleSplitTypeChange(newType: 'equal' | 'exact' | 'percentage'): void {
    const participants = participantsSignal.value;
    const amount = amountSignal.value;
    
    if (participants.length === 0 || amount <= 0) {
      splitsSignal.value = [];
      return;
    }
    
    switch (newType) {
      case 'equal':
        this.calculateEqualSplits();
        break;
        
      case 'exact':
        // Initialize with equal amounts as a starting point
        const exactAmount = amount / participants.length;
        splitsSignal.value = participants.map(userId => ({
          userId,
          amount: exactAmount
        }));
        break;
        
      case 'percentage':
        // Initialize with equal percentages
        const equalPercentage = 100 / participants.length;
        splitsSignal.value = participants.map(userId => ({
          userId,
          percentage: equalPercentage,
          amount: (amount * equalPercentage) / 100
        }));
        break;
    }
  }

  private validateField(field: string, value?: any): string | null {
    switch (field) {
      case 'description':
        const desc = value ?? descriptionSignal.value;
        if (!desc.trim()) {
          return 'Description is required';
        } else if (desc.length > 100) {
          return 'Description must be less than 100 characters';
        }
        break;
      
      case 'amount':
        const amt = value ?? amountSignal.value;
        if (amt <= 0) {
          return 'Amount must be greater than 0';
        } else if (amt > 1000000) {
          return 'Amount seems too large';
        }
        break;
        
      case 'date':
        const dt = value ?? dateSignal.value;
        if (!dt) {
          return 'Date is required';
        }
        // Check if date is in the future
        const selectedDate = new Date(dt);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (selectedDate > today) {
          return 'Date cannot be in the future';
        }
        break;
        
      case 'paidBy':
        const pb = value ?? paidBySignal.value;
        if (!pb) {
          return 'Please select who paid';
        }
        break;
        
      case 'participants':
        const parts = value ?? participantsSignal.value;
        if (parts.length === 0) {
          return 'At least one participant is required';
        }
        break;
        
      case 'splits':
        // Validate splits based on split type
        if (splitTypeSignal.value === 'exact') {
          const totalSplit = splitsSignal.value.reduce((sum, split) => sum + split.amount, 0);
          if (Math.abs(totalSplit - amountSignal.value) > 0.01) {
            return `Split amounts must equal the total expense amount`;
          }
        } else if (splitTypeSignal.value === 'percentage') {
          const totalPercentage = splitsSignal.value.reduce((sum, split) => sum + (split.percentage || 0), 0);
          if (Math.abs(totalPercentage - 100) > 0.01) {
            return 'Percentages must add up to 100%';
          }
        }
        break;
    }
    return null;
  }

  validateForm(): boolean {
    const errors: Record<string, string> = {};
    
    // Validate all fields
    const descError = this.validateField('description');
    if (descError) errors.description = descError;
    
    const amountError = this.validateField('amount');
    if (amountError) errors.amount = amountError;
    
    const dateError = this.validateField('date');
    if (dateError) errors.date = dateError;
    
    const payerError = this.validateField('paidBy');
    if (payerError) errors.paidBy = payerError;
    
    const participantsError = this.validateField('participants');
    if (participantsError) errors.participants = participantsError;
    
    const splitsError = this.validateField('splits');
    if (splitsError) errors.splits = splitsError;
    
    validationErrorsSignal.value = errors;
    return Object.keys(errors).length === 0;
  }

  async saveExpense(groupId: string): Promise<ExpenseData> {
    if (!this.validateForm()) {
      throw new Error('Please fix validation errors');
    }
    
    savingSignal.value = true;
    errorSignal.value = null;
    
    try {
      // Convert date string to ISO format with time
      const dateTime = new Date(dateSignal.value);
      dateTime.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      
      const request: CreateExpenseRequest = {
        groupId,
        description: descriptionSignal.value.trim(),
        amount: amountSignal.value,
        paidBy: paidBySignal.value,
        category: categorySignal.value,
        date: dateTime.toISOString(),
        splitType: splitTypeSignal.value,
        participants: participantsSignal.value,
        splits: splitsSignal.value
      };
      
      const expense = await apiClient.createExpense(request);
      
      // Track recent category and amount
      addRecentCategory(categorySignal.value);
      addRecentAmount(amountSignal.value);
      
      // Refresh group data to show the new expense immediately
      try {
        await Promise.all([
          groupDetailStore.refreshAll(),
          groupsStore.refreshGroups()
        ]);
      } catch (refreshError) {
        // Log refresh error but don't fail the expense creation
        console.warn('Failed to refresh data after creating expense:', refreshError);
      }
      
      // Clear draft and reset form after successful save
      this.clearDraft(groupId);
      this.reset();
      
      return expense;
    } catch (error) {
      errorSignal.value = this.getErrorMessage(error);
      throw error;
    } finally {
      savingSignal.value = false;
    }
  }

  clearError(): void {
    errorSignal.value = null;
  }

  reset(): void {
    descriptionSignal.value = '';
    amountSignal.value = 0;
    dateSignal.value = getTodayDate();
    paidBySignal.value = '';
    categorySignal.value = 'General';
    splitTypeSignal.value = 'equal';
    participantsSignal.value = [];
    splitsSignal.value = [];
    errorSignal.value = null;
    validationErrorsSignal.value = {};
  }

  hasUnsavedChanges(): boolean {
    // Check if any field has been modified from initial state
    return (
      descriptionSignal.value.trim() !== '' ||
      amountSignal.value > 0 ||
      dateSignal.value !== getTodayDate() ||
      paidBySignal.value !== '' ||
      categorySignal.value !== 'General' ||
      splitTypeSignal.value !== 'equal' ||
      participantsSignal.value.length > 0 ||
      splitsSignal.value.length > 0
    );
  }

  saveDraft(groupId: string): void {
    try {
      const draftKey = `expense-draft-${groupId}`;
      const draftData = {
        description: descriptionSignal.value,
        amount: amountSignal.value,
        date: dateSignal.value,
        paidBy: paidBySignal.value,
        category: categorySignal.value,
        splitType: splitTypeSignal.value,
        participants: participantsSignal.value,
        splits: splitsSignal.value,
        timestamp: Date.now()
      };
      
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch (error) {
      // Silently ignore localStorage errors (privacy mode, storage full, etc.)
      console.warn('Failed to save expense draft:', error);
    }
  }

  loadDraft(groupId: string): boolean {
    try {
      const draftKey = `expense-draft-${groupId}`;
      const draftJson = localStorage.getItem(draftKey);
      
      if (!draftJson) {
        return false;
      }
      
      const draftData = JSON.parse(draftJson);
      
      // Check if draft is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - draftData.timestamp > maxAge) {
        this.clearDraft(groupId);
        return false;
      }
      
      // Restore form data
      descriptionSignal.value = draftData.description || '';
      amountSignal.value = draftData.amount || 0;
      dateSignal.value = draftData.date || getTodayDate();
      paidBySignal.value = draftData.paidBy || '';
      categorySignal.value = draftData.category || 'General';
      splitTypeSignal.value = draftData.splitType || 'equal';
      participantsSignal.value = draftData.participants || [];
      splitsSignal.value = draftData.splits || [];
      
      return true;
    } catch (error) {
      console.warn('Failed to load expense draft:', error);
      return false;
    }
  }

  clearDraft(groupId: string): void {
    try {
      const draftKey = `expense-draft-${groupId}`;
      localStorage.removeItem(draftKey);
    } catch (error) {
      console.warn('Failed to clear expense draft:', error);
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      return error.message;
    } else if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}

// Export singleton instance
export const expenseFormStore = new ExpenseFormStoreImpl();