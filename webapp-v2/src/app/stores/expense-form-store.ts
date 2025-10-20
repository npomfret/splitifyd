import { logWarning } from '@/utils/browser-logger.ts';
import { getAmountPrecisionError } from '@/utils/currency-validation.ts';
import { getUTCDateTime, isDateInFuture } from '@/utils/dateUtils.ts';
import type { UserScopedStorage } from '@/utils/userScopedStorage.ts';
import { ReadonlySignal, signal } from '@preact/signals';
import {
    Amount,
    amountToSmallestUnit,
    calculateEqualSplits,
    calculateExactSplits,
    calculatePercentageSplits,
    CreateExpenseRequest,
    ExpenseDTO,
    ExpenseSplit,
    smallestUnitToAmountString,
    SplitTypes,
    ZERO,
} from '@splitifyd/shared';
import { apiClient, ApiError } from '../apiClient';
import { enhancedGroupDetailStore } from './group-detail-store-enhanced';
import { enhancedGroupsStore as groupsStore } from './groups-store-enhanced';
import {GroupId, ExpenseId} from "@splitifyd/shared";

interface ExpenseFormStore {
    // Form fields
    description: string;
    amount: Amount;
    currency: string;
    date: string;
    time: string; // Time in HH:mm format (24-hour)
    paidBy: string;
    category: string;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: string[];
    splits: ExpenseSplit[];

    // UI state
    loading: boolean;
    saving: boolean;
    error: string | null;
    validationErrors: Record<string, string>;

    // Readonly signal accessors for reactive components
    readonly descriptionSignal: ReadonlySignal<string>;
    readonly amountSignal: ReadonlySignal<string>;
    readonly currencySignal: ReadonlySignal<string>;
    readonly dateSignal: ReadonlySignal<string>;
    readonly timeSignal: ReadonlySignal<string>;
    readonly paidBySignal: ReadonlySignal<string>;
    readonly categorySignal: ReadonlySignal<string>;
    readonly splitTypeSignal: ReadonlySignal<typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE>;
    readonly participantsSignal: ReadonlySignal<string[]>;
    readonly splitsSignal: ReadonlySignal<ExpenseSplit[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly savingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly validationErrorsSignal: ReadonlySignal<Record<string, string>>;

    // Actions
    updateField<K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]): void;
    setParticipants(participants: string[]): void;
    toggleParticipant(uid: string): void;
    calculateEqualSplits(): void;
    updateSplitAmount(uid: string, amount: Amount): void;
    updateSplitPercentage(uid: string, percentage: number): void;
    validateForm(): boolean;
    saveExpense(groupId: GroupId): Promise<ExpenseDTO>;
    updateExpense(groupId: GroupId, expenseId: ExpenseId): Promise<ExpenseDTO>;
    clearError(): void;
    reset(): void;
    hasUnsavedChanges(): boolean;
    saveDraft(groupId: GroupId): void;
    loadDraft(groupId: GroupId): boolean;
    clearDraft(groupId: GroupId): void;

    // Storage management
    setStorage(storage: UserScopedStorage): void;
    clearStorage(): void;
}

// Type for form data fields
interface ExpenseFormData {
    description: string;
    amount: Amount;
    currency: string;
    date: string;
    time: string; // Time in HH:mm format (24-hour)
    paidBy: string;
    category: string;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
}

// Get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Note: Signals are now encapsulated within the ExpenseFormStoreImpl class below

// Categories are now imported from shared types

// Storage management for user-scoped data
class ExpenseStorageManager {
    private storage: UserScopedStorage | null = null;
    private static readonly RECENT_CATEGORIES_KEY = 'recent-expense-categories';
    private static readonly RECENT_AMOUNTS_KEY = 'recent-expense-amounts';
    private static readonly MAX_RECENT_CATEGORIES = 3;
    private static readonly MAX_RECENT_AMOUNTS = 5;

    setStorage(storage: UserScopedStorage): void {
        this.storage = storage;
    }

    clearStorage(): void {
        this.storage = null;
    }

    getRecentCategories(): string[] {
        if (!this.storage) return [];

        try {
            const recent = this.storage.getItem(ExpenseStorageManager.RECENT_CATEGORIES_KEY);
            return recent ? JSON.parse(recent) : [];
        } catch {
            return [];
        }
    }

    addRecentCategory(category: string): void {
        if (!this.storage) return;

        try {
            const recent = this.getRecentCategories();
            const filtered = recent.filter((cat) => cat !== category);
            const updated = [category, ...filtered].slice(0, ExpenseStorageManager.MAX_RECENT_CATEGORIES);
            this.storage.setItem(ExpenseStorageManager.RECENT_CATEGORIES_KEY, JSON.stringify(updated));
        } catch {
            // Ignore storage errors
        }
    }

    getRecentAmounts(): Amount[] {
        if (!this.storage) return [];

        try {
            const recent = this.storage.getItem(ExpenseStorageManager.RECENT_AMOUNTS_KEY);
            if (!recent) {
                return [];
            }
            const parsed = JSON.parse(recent);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.filter((value: unknown): value is Amount => typeof value === 'string');
        } catch {
            return [];
        }
    }

    addRecentAmount(amount: Amount): void {
        if (!this.storage) return;

        try {
            const recent = this.getRecentAmounts();
            const normalizedAmount = amount;
            const filtered = recent.filter((amt) => amt !== normalizedAmount);
            const updated = [normalizedAmount, ...filtered].slice(0, ExpenseStorageManager.MAX_RECENT_AMOUNTS);
            this.storage.setItem(ExpenseStorageManager.RECENT_AMOUNTS_KEY, JSON.stringify(updated));
        } catch {
            // Ignore storage errors
        }
    }

    saveDraft(groupId: GroupId, draftData: any): void {
        if (!this.storage) return;

        try {
            const draftKey = `expense-draft-${groupId}`;
            this.storage.setItem(draftKey, JSON.stringify(draftData));
        } catch (error) {
            logWarning('Failed to save expense draft to user-scoped storage', { error });
        }
    }

    loadDraft(groupId: GroupId): any | null {
        if (!this.storage) return null;

        try {
            const draftKey = `expense-draft-${groupId}`;
            const draftJson = this.storage.getItem(draftKey);
            return draftJson ? JSON.parse(draftJson) : null;
        } catch (error) {
            logWarning('Failed to load expense draft from user-scoped storage', { error });
            return null;
        }
    }

    clearDraft(groupId: GroupId): void {
        if (!this.storage) return;

        try {
            const draftKey = `expense-draft-${groupId}`;
            this.storage.removeItem(draftKey);
        } catch (error) {
            logWarning('Failed to clear expense draft from user-scoped storage', { error });
        }
    }
}

// Create singleton storage manager
const storageManager = new ExpenseStorageManager();

export function getRecentAmounts(): Amount[] {
    return storageManager.getRecentAmounts();
}

class ExpenseFormStoreImpl implements ExpenseFormStore {
    // Private signals - encapsulated within the class
    readonly #descriptionSignal = signal<string>('');
    readonly #amountSignal = signal<string>(ZERO);
    readonly #currencySignal = signal<string>(''); // Force user to select currency - detected from group data or left empty
    readonly #dateSignal = signal<string>(getTodayDate());
    readonly #timeSignal = signal<string>('12:00'); // Default to noon (12:00 PM)
    readonly #paidBySignal = signal<string>('');
    readonly #categorySignal = signal<string>('food');
    readonly #splitTypeSignal = signal<typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE>(SplitTypes.EQUAL);
    readonly #participantsSignal = signal<string[]>([]);
    readonly #splitsSignal = signal<ExpenseSplit[]>([]);

    // UI state signals
    readonly #loadingSignal = signal<boolean>(false);
    readonly #savingSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #validationErrorsSignal = signal<Record<string, string>>({});

    private getActiveCurrency(): string | null {
        const currency = this.#currencySignal.value;
        return currency ? currency : null;
    }

    private toUnits(amount: Amount): number {
        const currency = this.getActiveCurrency();
        if (!currency) {
            const parsed = parseFloat(amount);
            return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
        }
        try {
            return amountToSmallestUnit(amount, currency);
        } catch {
            return 0;
        }
    }

    private fromUnits(units: number): Amount {
        const currency = this.getActiveCurrency();
        if (!currency) {
            return (units / 100).toFixed(2);
        }
        return smallestUnitToAmountString(units, currency);
    }

    private normalizeAmountInput(value: Amount | number): Amount {
        if (typeof value === 'number') {
            return value.toString();
        }
        return value;
    }

    // State getters - readonly values for external consumers
    get description() {
        return this.#descriptionSignal.value;
    }
    get amount() {
        return this.#amountSignal.value;
    }
    get currency() {
        return this.#currencySignal.value;
    }
    get date() {
        return this.#dateSignal.value;
    }
    get time() {
        return this.#timeSignal.value;
    }
    get paidBy() {
        return this.#paidBySignal.value;
    }
    get category() {
        return this.#categorySignal.value;
    }
    get splitType() {
        return this.#splitTypeSignal.value;
    }
    get participants() {
        return this.#participantsSignal.value;
    }
    get splits() {
        return this.#splitsSignal.value;
    }
    get loading() {
        return this.#loadingSignal.value;
    }
    get saving() {
        return this.#savingSignal.value;
    }
    get error() {
        return this.#errorSignal.value;
    }
    get validationErrors() {
        return this.#validationErrorsSignal.value;
    }

    // Signal accessors for reactive components - return readonly signals
    get descriptionSignal(): ReadonlySignal<string> {
        return this.#descriptionSignal;
    }
    get amountSignal(): ReadonlySignal<string> {
        return this.#amountSignal;
    }
    get currencySignal(): ReadonlySignal<string> {
        return this.#currencySignal;
    }
    get dateSignal(): ReadonlySignal<string> {
        return this.#dateSignal;
    }
    get timeSignal(): ReadonlySignal<string> {
        return this.#timeSignal;
    }
    get paidBySignal(): ReadonlySignal<string> {
        return this.#paidBySignal;
    }
    get categorySignal(): ReadonlySignal<string> {
        return this.#categorySignal;
    }
    get splitTypeSignal(): ReadonlySignal<typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE> {
        return this.#splitTypeSignal;
    }
    get participantsSignal(): ReadonlySignal<string[]> {
        return this.#participantsSignal;
    }
    get splitsSignal(): ReadonlySignal<ExpenseSplit[]> {
        return this.#splitsSignal;
    }
    get loadingSignal(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }
    get savingSignal(): ReadonlySignal<boolean> {
        return this.#savingSignal;
    }
    get errorSignal(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }
    get validationErrorsSignal(): ReadonlySignal<Record<string, string>> {
        return this.#validationErrorsSignal;
    }

    // Computed property to check if required fields are filled (for button enabling)
    get hasRequiredFields(): boolean {
        // Check basic required fields are filled (not empty)
        if (!this.#descriptionSignal.value?.trim()) return false;
        if (this.toUnits(this.#amountSignal.value) <= 0) return false;
        if (!this.#dateSignal.value) return false;
        if (!this.#paidBySignal.value) return false;
        if (this.#participantsSignal.value.length === 0) return false;

        // For exact and percentage splits, also check if splits are properly configured
        if (this.#splitTypeSignal.value === SplitTypes.EXACT || this.#splitTypeSignal.value === SplitTypes.PERCENTAGE) {
            const splitsError = this.validateField('splits');
            if (splitsError) return false;
        }

        return true;
    }

    // Computed property to check if form is valid
    get isFormValid(): boolean {
        // First check if required fields are filled
        if (!this.hasRequiredFields) return false;

        // Then check if values are valid
        if (this.toUnits(this.#amountSignal.value) <= 0) return false;

        // Validate each field
        const descError = this.validateField('description');
        if (descError) return false;

        const amountError = this.validateField('amount');
        if (amountError) return false;

        const dateError = this.validateField('date');
        if (dateError) return false;

        const paidByError = this.validateField('paidBy');
        if (paidByError) return false;

        const participantsError = this.validateField('participants');
        if (participantsError) return false;

        const splitsError = this.validateField('splits');
        if (splitsError) return false;

        // Check if there are any existing validation errors
        return Object.keys(this.#validationErrorsSignal.value).length === 0;
    }

    updateField<K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]): void {
        this.#errorSignal.value = null;

        // Update the field value first
        switch (field) {
            case 'description':
                this.#descriptionSignal.value = value as string;
                break;
            case 'amount': {
                const amountValue = this.normalizeAmountInput(value as Amount | number);
                const currency = this.getActiveCurrency();
                const previousAmount = this.#amountSignal.value;

                this.#amountSignal.value = amountValue;

                if (!currency) {
                    break;
                }

                if (this.#splitTypeSignal.value === SplitTypes.EQUAL) {
                    this.calculateEqualSplits();
                } else if (this.#splitTypeSignal.value === SplitTypes.PERCENTAGE) {
                    const amountUnits = this.toUnits(amountValue);
                    const updatedSplits = this.#splitsSignal.value.map((split) => {
                        if (split.percentage === undefined) {
                            return split;
                        }
                        const splitUnits = Math.round((amountUnits * split.percentage) / 100);
                        return {
                            ...split,
                            amount: this.fromUnits(splitUnits),
                        };
                    });
                    this.#splitsSignal.value = updatedSplits;
                } else if (this.#splitTypeSignal.value === SplitTypes.EXACT) {
                    const currentSplits = [...this.#splitsSignal.value];
                    const newUnits = this.toUnits(amountValue);
                    const oldUnits = this.toUnits(previousAmount);

                    if (oldUnits > 0 && currentSplits.length > 0) {
                        let allocated = 0;
                        currentSplits.forEach((split, index) => {
                            const splitUnits = this.toUnits(split.amount);
                            let updatedUnits: number;
                            if (index === currentSplits.length - 1) {
                                updatedUnits = Math.max(0, newUnits - allocated);
                            } else {
                                updatedUnits = Math.round((splitUnits * newUnits) / oldUnits);
                                allocated += updatedUnits;
                            }
                            currentSplits[index] = {
                                ...split,
                                amount: this.fromUnits(updatedUnits),
                            };
                        });
                        this.#splitsSignal.value = currentSplits;
                    } else {
                        this.#splitsSignal.value = calculateExactSplits(amountValue, currency, this.#participantsSignal.value);
                    }
                }
                break;
            }
            case 'currency':
                this.#currencySignal.value = value as string;

                // Revalidate amount when currency changes (precision rules depend on currency)
                const currentErrors = { ...this.#validationErrorsSignal.value };
                const amountError = this.validateField('amount');
                if (amountError) {
                    currentErrors.amount = amountError;
                } else {
                    delete currentErrors.amount;
                }
                this.#validationErrorsSignal.value = currentErrors;

                // Recalculate splits when currency changes (currency affects split precision)
                // Only recalculate if we have all required data
                if (this.toUnits(this.#amountSignal.value) > 0 && this.#participantsSignal.value.length > 0) {
                    this.handleSplitTypeChange(this.#splitTypeSignal.value);
                }
                break;
            case 'date':
                this.#dateSignal.value = value as string;
                break;
            case 'time':
                this.#timeSignal.value = value as string;
                break;
            case 'paidBy':
                this.#paidBySignal.value = value as string;
                // Auto-add payer to participants if not already included
                if (!this.#participantsSignal.value.includes(value as string)) {
                    this.#participantsSignal.value = [...this.#participantsSignal.value, value as string];
                }
                // Always recalculate splits when payer changes
                // This handles the case where participants list changed (e.g., member left group)
                // Only recalculate if we have all required data
                if (this.#currencySignal.value && this.toUnits(this.#amountSignal.value) > 0 && this.#participantsSignal.value.length > 0) {
                    this.handleSplitTypeChange(this.#splitTypeSignal.value);
                }
                break;
            case 'category':
                this.#categorySignal.value = value as string;
                break;
            case 'splitType':
                this.#splitTypeSignal.value = value as typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
                this.handleSplitTypeChange(value as typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE);
                break;
        }

        // Perform real-time validation for the field
        // Skip validation for currency if it's empty (user hasn't selected one yet)
        const shouldValidate = field !== 'currency' || (value as string) !== '';

        const errors = { ...this.#validationErrorsSignal.value };
        if (shouldValidate) {
            const fieldError = this.validateField(field, value);

            if (fieldError) {
                errors[field] = fieldError;
            } else {
                delete errors[field];
            }
        } else {
            // Clear any existing error for this field
            delete errors[field];
        }

        if (field === 'amount' || field === 'splitType') {
            const splitsError = this.validateField('splits');
            if (splitsError) {
                errors.splits = splitsError;
            } else {
                delete errors.splits;
            }
        }

        this.#validationErrorsSignal.value = errors;
    }

    setParticipants(participants: string[]): void {
        this.#participantsSignal.value = participants;
        // Always include payer in participants
        if (this.#paidBySignal.value && !participants.includes(this.#paidBySignal.value)) {
            this.#participantsSignal.value = [...participants, this.#paidBySignal.value];
        }
        // Recalculate splits based on current type
        this.handleSplitTypeChange(this.#splitTypeSignal.value);

        // Validate participants
        const errors = { ...this.#validationErrorsSignal.value };
        const participantsError = this.validateField('participants');
        if (participantsError) {
            errors.participants = participantsError;
        } else {
            delete errors.participants;
        }
        this.#validationErrorsSignal.value = errors;
    }

    toggleParticipant(uid: string): void {
        const current = this.#participantsSignal.value;
        const isIncluded = current.includes(uid);

        // Don't allow removing the payer
        if (uid === this.#paidBySignal.value && isIncluded) {
            return;
        }

        if (isIncluded) {
            this.#participantsSignal.value = current.filter((id) => id !== uid);
        } else {
            this.#participantsSignal.value = [...current, uid];
        }

        // Recalculate splits based on current type
        this.handleSplitTypeChange(this.#splitTypeSignal.value);
    }

    calculateEqualSplits(): void {
        const participants = this.#participantsSignal.value;
        const amount = this.#amountSignal.value;
        const currency = this.#currencySignal.value;

        if (participants.length === 0 || this.toUnits(amount) <= 0 || !currency) {
            this.#splitsSignal.value = [];
            return;
        }

        // Use shared currency-aware split calculation
        this.#splitsSignal.value = calculateEqualSplits(amount, currency, participants);
    }

    updateSplitAmount(uid: string, amount: Amount | number): void {
        const currentSplits = [...this.#splitsSignal.value];
        const splitIndex = currentSplits.findIndex((s) => s.uid === uid);
        const normalizedAmount = this.normalizeAmountInput(amount);

        if (splitIndex >= 0) {
            currentSplits[splitIndex] = { ...currentSplits[splitIndex], amount: normalizedAmount };
        } else {
            currentSplits.push({ uid, amount: normalizedAmount });
        }

        this.#splitsSignal.value = currentSplits;

        // Validate splits
        const errors = { ...this.#validationErrorsSignal.value };
        const splitsError = this.validateField('splits');
        if (splitsError) {
            errors.splits = splitsError;
        } else {
            delete errors.splits;
        }
        this.#validationErrorsSignal.value = errors;
    }

    updateSplitPercentage(uid: string, percentage: number): void {
        const currentSplits = [...this.#splitsSignal.value];
        const splitIndex = currentSplits.findIndex((s) => s.uid === uid);
        const currency = this.getActiveCurrency();

        if (!currency) {
            return;
        }

        const amountUnits = this.toUnits(this.#amountSignal.value);
        const splitUnits = Math.round((amountUnits * percentage) / 100);
        const formattedAmount = this.fromUnits(splitUnits);

        if (splitIndex >= 0) {
            currentSplits[splitIndex] = {
                ...currentSplits[splitIndex],
                percentage,
                amount: formattedAmount,
            };
        } else {
            currentSplits.push({
                uid,
                percentage,
                amount: formattedAmount,
            });
        }

        this.#splitsSignal.value = currentSplits;

        // Validate splits
        const errors = { ...this.#validationErrorsSignal.value };
        const splitsError = this.validateField('splits');
        if (splitsError) {
            errors.splits = splitsError;
        } else {
            delete errors.splits;
        }
        this.#validationErrorsSignal.value = errors;
    }

    private handleSplitTypeChange(newType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE): void {
        const participants = this.#participantsSignal.value;
        const amount = this.#amountSignal.value;
        const currency = this.#currencySignal.value;

        if (participants.length === 0 || this.toUnits(amount) <= 0 || !currency) {
            this.#splitsSignal.value = [];
            return;
        }

        switch (newType) {
            case SplitTypes.EQUAL:
                // Use shared currency-aware equal split calculation
                this.#splitsSignal.value = calculateEqualSplits(amount, currency, participants);
                break;

            case SplitTypes.EXACT:
                // Use shared currency-aware exact split calculation (equal amounts as starting point)
                this.#splitsSignal.value = calculateExactSplits(amount, currency, participants);
                break;

            case SplitTypes.PERCENTAGE:
                // Use shared currency-aware percentage split calculation
                this.#splitsSignal.value = calculatePercentageSplits(amount, currency, participants);
                break;
        }
    }

    private validateField(field: string, value?: any): string | null {
        switch (field) {
            case 'description':
                const desc = value ?? this.#descriptionSignal.value;
                if (!desc.trim()) {
                    return 'Description is required';
                } else if (desc.length > 100) {
                    return 'Description must be less than 100 characters';
                }
                break;

            case 'amount':
                const amountValue = this.normalizeAmountInput((value ?? this.#amountSignal.value) as Amount | number);
                const numericAmount = parseFloat(amountValue);
                if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                    return 'Amount must be greater than 0';
                } else if (numericAmount > 1000000) {
                    return 'Amount seems too large';
                }

                // Validate currency precision if currency is set
                const currency = this.#currencySignal.value;
                if (currency) {
                    const precisionError = getAmountPrecisionError(amountValue, currency);
                    if (precisionError) {
                        return precisionError;
                    }
                }
                break;

            case 'currency':
                const curr = value ?? this.#currencySignal.value;
                if (!curr || curr.trim() === '') {
                    return 'Currency is required';
                }
                if (curr.length !== 3) {
                    return 'Currency must be a 3-letter code (e.g., USD, EUR)';
                }
                break;

            case 'date':
                const dt = value ?? this.#dateSignal.value;
                if (!dt) {
                    return 'Date is required';
                }
                // Check if date is in the future (compares local dates properly)
                if (isDateInFuture(dt)) {
                    return 'Date cannot be in the future';
                }
                break;

            case 'paidBy':
                const pb = value ?? this.#paidBySignal.value;
                if (!pb) {
                    return 'Please select who paid';
                }
                break;

            case 'participants':
                const parts = value ?? this.#participantsSignal.value;
                if (parts.length === 0) {
                    return 'At least one participant is required';
                }
                break;

            case 'splits':
                // Validate splits based on split type
                if (this.#splitTypeSignal.value === SplitTypes.EXACT) {
                    const currencyRequired = this.getActiveCurrency();
                    if (!currencyRequired) {
                        return 'Currency must be selected before configuring splits';
                    }
                    const totalSplitUnits = this.#splitsSignal.value.reduce((sum, split) => sum + amountToSmallestUnit(split.amount, currencyRequired), 0);
                    const amountUnits = amountToSmallestUnit(this.#amountSignal.value, currencyRequired);
                    if (totalSplitUnits !== amountUnits) {
                        return `Split amounts must equal the total expense amount`;
                    }
                } else if (this.#splitTypeSignal.value === SplitTypes.PERCENTAGE) {
                    const totalPercentage = this.#splitsSignal.value.reduce((sum, split) => sum + (split.percentage || 0), 0);
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

        const currencyError = this.validateField('currency');
        if (currencyError) errors.currency = currencyError;

        const dateError = this.validateField('date');
        if (dateError) errors.date = dateError;

        const payerError = this.validateField('paidBy');
        if (payerError) errors.paidBy = payerError;

        const participantsError = this.validateField('participants');
        if (participantsError) errors.participants = participantsError;

        const splitsError = this.validateField('splits');
        if (splitsError) errors.splits = splitsError;

        this.#validationErrorsSignal.value = errors;
        const isValid = Object.keys(errors).length === 0;

        // Log validation failures using browser logger
        if (!isValid) {
            logWarning('[ExpenseForm] Validation failed', { errors });
        }

        return isValid;
    }

    async saveExpense(groupId: GroupId): Promise<ExpenseDTO> {
        if (!this.validateForm()) {
            const errors = this.#validationErrorsSignal.value;
            logWarning('[ExpenseForm] Cannot submit form due to validation errors', { errors });
            throw new Error('Please fix validation errors');
        }

        this.#savingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            // Convert date and time to UTC timestamp
            const utcDateTime = getUTCDateTime(this.#dateSignal.value, this.#timeSignal.value);

            const amount = this.#amountSignal.value;
            const request: CreateExpenseRequest = {
                groupId,
                description: this.#descriptionSignal.value.trim(),
                amount: amount,
                currency: this.#currencySignal.value,
                paidBy: this.#paidBySignal.value,
                category: this.#categorySignal.value,
                date: utcDateTime,
                splitType: this.#splitTypeSignal.value,
                participants: this.#participantsSignal.value,
                splits: this.#splitsSignal.value,
            };

            const expense = await apiClient.createExpense(request);

            // Track recent category and amount
            storageManager.addRecentCategory(this.#categorySignal.value);
            storageManager.addRecentAmount(amount);

            // Clear draft and reset form immediately after successful creation
            this.clearDraft(groupId);
            this.reset();

            // Refresh group data to show the new expense (non-blocking)
            // Don't await this to avoid blocking navigation
            Promise.all([enhancedGroupDetailStore.refreshAll(), groupsStore.refreshGroups()]).catch((refreshError) => {
                // Log refresh error but don't fail the expense creation
                logWarning('Failed to refresh data after creating expense', { error: refreshError });
            });

            return expense;
        } catch (error) {
            this.#errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            this.#savingSignal.value = false;
        }
    }

    async updateExpense(groupId: GroupId, expenseId: ExpenseId): Promise<ExpenseDTO> {
        if (!this.validateForm()) {
            throw new Error('Please fix validation errors');
        }

        this.#savingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            // Convert date and time to UTC timestamp
            const utcDateTime = getUTCDateTime(this.#dateSignal.value, this.#timeSignal.value);

            // For updates, only include fields that can be changed
            // Backend doesn't allow changing: groupId, paidBy
            const amount = this.#amountSignal.value;
            const updateRequest = {
                description: this.#descriptionSignal.value.trim(),
                amount: amount,
                currency: this.#currencySignal.value,
                category: this.#categorySignal.value,
                date: utcDateTime,
                splitType: this.#splitTypeSignal.value,
                participants: this.#participantsSignal.value,
                splits: this.#splitsSignal.value,
            };

            const expense = await apiClient.updateExpense(expenseId, updateRequest as CreateExpenseRequest);

            // Track recent category and amount
            storageManager.addRecentCategory(this.#categorySignal.value);
            storageManager.addRecentAmount(amount);

            // Clear draft immediately after successful update
            this.clearDraft(groupId);

            // Refresh group data to show the updated expense (non-blocking)
            // Don't await this to avoid blocking navigation
            Promise.all([enhancedGroupDetailStore.refreshAll(), groupsStore.refreshGroups()]).catch((refreshError) => {
                // Log refresh error but don't fail the expense update
                logWarning('Failed to refresh data after updating expense', { error: refreshError });
            });

            return expense;
        } catch (error) {
            this.#errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            this.#savingSignal.value = false;
        }
    }

    clearError(): void {
        this.#errorSignal.value = null;
    }

    reset(): void {
        this.#descriptionSignal.value = '';
        this.#amountSignal.value = ZERO;
        this.#currencySignal.value = ''; // Force user to select currency
        this.#dateSignal.value = getTodayDate();
        this.#timeSignal.value = '12:00'; // Default to noon
        this.#paidBySignal.value = '';
        this.#categorySignal.value = 'food';
        this.#splitTypeSignal.value = SplitTypes.EQUAL;
        this.#participantsSignal.value = [];
        this.#splitsSignal.value = [];
        this.#errorSignal.value = null;
        this.#validationErrorsSignal.value = {};
    }

    hasUnsavedChanges(): boolean {
        // Check if any field has been modified from initial state
        const hasAmount = this.toUnits(this.#amountSignal.value) > 0;
        return (
            this.#descriptionSignal.value.trim() !== ''
            || hasAmount
            || this.#currencySignal.value !== ''
            || this.#dateSignal.value !== getTodayDate()
            || this.#paidBySignal.value !== ''
            || this.#categorySignal.value !== 'food'
            || this.#splitTypeSignal.value !== SplitTypes.EQUAL
            || this.#participantsSignal.value.length > 0
            || this.#splitsSignal.value.length > 0
        );
    }

    setStorage(storage: UserScopedStorage): void {
        storageManager.setStorage(storage);
    }

    clearStorage(): void {
        storageManager.clearStorage();
    }

    saveDraft(groupId: GroupId): void {
        const draftData = {
            description: this.#descriptionSignal.value,
            amount: this.#amountSignal.value,
            currency: this.#currencySignal.value,
            date: this.#dateSignal.value,
            time: this.#timeSignal.value,
            paidBy: this.#paidBySignal.value,
            category: this.#categorySignal.value,
            splitType: this.#splitTypeSignal.value,
            participants: this.#participantsSignal.value,
            splits: this.#splitsSignal.value,
            timestamp: Date.now(),
        };

        storageManager.saveDraft(groupId, draftData);
    }

    loadDraft(groupId: GroupId): boolean {
        try {
            const draftData = storageManager.loadDraft(groupId);

            if (!draftData) {
                return false;
            }

            // Check if draft is not too old (24 hours)
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
            if (Date.now() - draftData.timestamp > maxAge) {
                this.clearDraft(groupId);
                return false;
            }

            // Restore form data
            this.#descriptionSignal.value = draftData.description || '';
            this.#amountSignal.value = draftData.amount ?? ZERO;
            this.#currencySignal.value = draftData.currency || ''; // Force user to select if draft has none
            this.#dateSignal.value = draftData.date || getTodayDate();
            this.#timeSignal.value = draftData.time || '12:00'; // Default to noon
            this.#paidBySignal.value = draftData.paidBy || '';
            this.#categorySignal.value = draftData.category || 'food';
            this.#splitTypeSignal.value = draftData.splitType || SplitTypes.EQUAL;
            this.#participantsSignal.value = draftData.participants || [];
            this.#splitsSignal.value = draftData.splits || [];

            return true;
        } catch (error) {
            logWarning('Failed to load expense draft from user-scoped storage', { error });
            return false;
        }
    }

    clearDraft(groupId: GroupId): void {
        storageManager.clearDraft(groupId);
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
