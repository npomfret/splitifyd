import { logWarning } from '@/utils/browser-logger.ts';
import { getAmountPrecisionError } from '@/utils/currency-validation.ts';
import { getUTCDateTime, isDateInFuture } from '@/utils/dateUtils.ts';
import type { UserScopedStorage } from '@/utils/userScopedStorage.ts';
import {
    Amount,
    amountToSmallestUnit,
    calculateEqualSplits,
    calculateExactSplits,
    calculatePercentageSplits,
    CreateExpenseRequest,
    CurrencyCodeSchema,
    ExpenseDTO,
    ExpenseSplit,
    smallestUnitToAmountString,
    SplitTypes,
} from '@billsplit-wl/shared';
import { ExpenseId, GroupId } from '@billsplit-wl/shared';
import type { CurrencyISOCode, UserId } from '@billsplit-wl/shared';
import { toCurrencyISOCode } from '@billsplit-wl/shared';
import { z } from 'zod';
import { ReadonlySignal, signal } from '@preact/signals';
import { apiClient, ApiError } from '../apiClient';
import { enhancedGroupDetailStore } from './group-detail-store-enhanced';
import { enhancedGroupsStore as groupsStore } from './groups-store-enhanced';

// Form-level validation schema for simple fields
// Complex fields (splits, date, participants) use manual validation
const ExpenseFormFieldsSchema = z.object({
    description: z
        .string()
        .min(1, 'Description is required')
        .max(200, 'Description must be less than 200 characters'),
    amount: z
        .string()
        .min(1, 'Amount is required')
        .regex(/^\d+(\.\d+)?$/, 'Invalid amount format')
        .refine((val) => parseFloat(val) > 0, 'Amount must be greater than 0')
        .refine((val) => parseFloat(val) < 1000000, 'Amount seems too large'),
    currency: CurrencyCodeSchema,
    label: z.string().min(1, 'Label is required').max(50, 'Label must be less than 50 characters'),
    paidBy: z.string().min(1, 'Please select who paid'),
});

interface ExpenseFormStore {
    // Form fields
    description: string;
    amount: Amount;
    currency: string;
    date: string;
    time: string; // Time in HH:mm format (24-hour)
    paidBy: UserId | '';
    label: string;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: UserId[];
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
    readonly labelSignal: ReadonlySignal<string>;
    readonly splitTypeSignal: ReadonlySignal<typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE>;
    readonly participantsSignal: ReadonlySignal<string[]>;
    readonly splitsSignal: ReadonlySignal<ExpenseSplit[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly savingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly validationErrorsSignal: ReadonlySignal<Record<string, string>>;

    // Actions
    updateField<K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]): void;
    validateOnBlur(field: keyof ExpenseFormData): void;
    setParticipants(participants: UserId[]): void;
    toggleParticipant(uid: string): void;
    calculateEqualSplits(): void;
    updateSplitAmount(uid: string, amount: Amount): void;
    updateSplitPercentage(uid: string, percentage: number): void;
    validateForm(): boolean;
    saveExpense(groupId: GroupId): Promise<ExpenseDTO>;
    updateExpense(groupId: GroupId, expenseId: ExpenseId): Promise<ExpenseDTO>;
    clearError(): void;
    reset(): void;
    captureInitialState(): void;
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
    currency: CurrencyISOCode;
    date: string;
    time: string; // Time in HH:mm format (24-hour)
    paidBy: UserId | '';
    label: string;
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

// Labels are now imported from shared types

// Storage management for user-scoped data
class ExpenseStorageManager {
    private storage: UserScopedStorage | null = null;
    private static readonly RECENT_LABELS_KEY = 'recent-expense-labels';
    private static readonly RECENT_AMOUNTS_KEY = 'recent-expense-amounts';
    private static readonly MAX_RECENT_LABELS = 3;
    private static readonly MAX_RECENT_AMOUNTS = 5;

    setStorage(storage: UserScopedStorage): void {
        this.storage = storage;
    }

    clearStorage(): void {
        this.storage = null;
    }

    getRecentLabels(): string[] {
        if (!this.storage) return [];

        try {
            const recent = this.storage.getItem(ExpenseStorageManager.RECENT_LABELS_KEY);
            return recent ? JSON.parse(recent) : [];
        } catch {
            return [];
        }
    }

    addRecentLabel(label: string): void {
        if (!this.storage) return;

        try {
            const recent = this.getRecentLabels();
            const filtered = recent.filter((cat) => cat !== label);
            const updated = [label, ...filtered].slice(0, ExpenseStorageManager.MAX_RECENT_LABELS);
            this.storage.setItem(ExpenseStorageManager.RECENT_LABELS_KEY, JSON.stringify(updated));
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
    readonly #amountSignal = signal<string>('');
    readonly #currencySignal = signal<string>(''); // Force user to select currency - detected from group data or left empty
    readonly #dateSignal = signal<string>(getTodayDate());
    readonly #timeSignal = signal<string>('12:00'); // Default to noon (12:00 PM)
    readonly #paidBySignal = signal<UserId | ''>('');
    readonly #labelSignal = signal<string>('food');
    readonly #splitTypeSignal = signal<typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE>(SplitTypes.EQUAL);
    readonly #participantsSignal = signal<UserId[]>([]);
    readonly #splitsSignal = signal<ExpenseSplit[]>([]);

    // UI state signals
    readonly #loadingSignal = signal<boolean>(false);
    readonly #savingSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #validationErrorsSignal = signal<Record<string, string>>({});

    // Initial state snapshot for tracking unsaved changes
    #initialState: {
        description: string;
        amount: Amount;
        currency: string;
        date: string;
        time: string;
        paidBy: string;
        label: string;
        splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
        participants: string[];
        splits: ExpenseSplit[];
    } | null = null;

    private getActiveCurrency(): CurrencyISOCode | null {
        const currency = this.#currencySignal.value;
        return currency ? toCurrencyISOCode(currency) : null;
    }

    private getFieldValue(field: string): unknown {
        switch (field) {
            case 'description':
                return this.#descriptionSignal.value;
            case 'amount':
                return this.#amountSignal.value;
            case 'currency':
                return this.#currencySignal.value;
            case 'label':
                return this.#labelSignal.value;
            case 'paidBy':
                return this.#paidBySignal.value;
            default:
                return undefined;
        }
    }

    private toUnits(amount: Amount): number {
        if (typeof amount === 'string' && amount.trim() === '') {
            return 0;
        }
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
    get label() {
        return this.#labelSignal.value;
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
    get labelSignal(): ReadonlySignal<string> {
        return this.#labelSignal;
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

                if (amountValue.trim() === '') {
                    this.#splitsSignal.value = [];
                    break;
                }

                if (!currency) {
                    break;
                }

                const precisionError = getAmountPrecisionError(amountValue, currency);
                if (precisionError) {
                    this.#splitsSignal.value = [];
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
                const amountIsEmpty = this.#amountSignal.value.trim() === '';
                if (!amountIsEmpty) {
                    const amountError = this.validateField('amount');
                    if (amountError) {
                        currentErrors.amount = amountError;
                    } else {
                        delete currentErrors.amount;
                    }
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
            case 'paidBy': {
                const paidByValue = value as UserId | '';
                this.#paidBySignal.value = paidByValue;
                // Auto-add payer to participants if not already included
                if (paidByValue && !this.#participantsSignal.value.includes(paidByValue)) {
                    this.#participantsSignal.value = [...this.#participantsSignal.value, paidByValue];
                }
                // Always recalculate splits when payer changes
                // This handles the case where participants list changed (e.g., member left group)
                // Only recalculate if we have all required data
                if (this.#currencySignal.value && this.toUnits(this.#amountSignal.value) > 0 && this.#participantsSignal.value.length > 0) {
                    this.handleSplitTypeChange(this.#splitTypeSignal.value);
                }
                break;
            }
            case 'label':
                this.#labelSignal.value = value as string;
                break;
            case 'splitType':
                this.#splitTypeSignal.value = value as typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
                this.handleSplitTypeChange(value as typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE);
                break;
        }

        // Perform real-time validation for the field
        // Skip validation for currency if it's empty (user hasn't selected one yet)
        const valueAsString = typeof value === 'string' ? value : undefined;
        const isAmountCleared = field === 'amount' && valueAsString === '';
        let shouldValidate = field !== 'currency' || (value as string) !== '';

        if (isAmountCleared) {
            shouldValidate = false;
        }

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

    /**
     * Validate a field on blur event (when user leaves the field).
     * This ensures validation runs even for empty fields that were skipped during onChange.
     */
    validateOnBlur(field: keyof ExpenseFormData): void {
        const errors = { ...this.#validationErrorsSignal.value };
        const fieldError = this.validateField(field);

        if (fieldError) {
            errors[field] = fieldError;
        } else {
            delete errors[field];
        }

        this.#validationErrorsSignal.value = errors;
    }

    setParticipants(participants: UserId[]): void {
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

    toggleParticipant(uid: UserId): void {
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
        const currency = this.getActiveCurrency();

        if (participants.length === 0 || this.toUnits(amount) <= 0 || !currency) {
            this.#splitsSignal.value = [];
            return;
        }

        const precisionError = getAmountPrecisionError(amount, currency);
        if (precisionError) {
            this.#splitsSignal.value = [];
            return;
        }

        // Use shared currency-aware split calculation
        this.#splitsSignal.value = calculateEqualSplits(amount, currency, participants);
    }

    updateSplitAmount(uid: UserId, amount: Amount | number): void {
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

    updateSplitPercentage(uid: UserId, percentage: number): void {
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
        const currency = this.getActiveCurrency();

        if (participants.length === 0 || this.toUnits(amount) <= 0 || !currency) {
            this.#splitsSignal.value = [];
            return;
        }

        const precisionError = getAmountPrecisionError(amount, currency);
        if (precisionError) {
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
        // Schema-validated fields
        const schemaFields = ['description', 'amount', 'currency', 'label', 'paidBy'] as const;

        if (schemaFields.includes(field as typeof schemaFields[number])) {
            const fieldValue = value ?? this.getFieldValue(field);
            const fieldSchema = ExpenseFormFieldsSchema.shape[field as keyof typeof ExpenseFormFieldsSchema.shape];
            const result = fieldSchema.safeParse(fieldValue);

            if (!result.success) {
                return result.error.issues[0]?.message || 'Invalid value';
            }

            // Additional currency-dependent amount precision check (not in schema)
            if (field === 'amount') {
                const currency = this.getActiveCurrency();
                if (currency) {
                    const amountValue = this.normalizeAmountInput(fieldValue as Amount | number);
                    const precisionError = getAmountPrecisionError(amountValue, currency);
                    if (precisionError) {
                        return precisionError;
                    }
                }
            }

            return null;
        }

        // Manual validation for complex fields
        switch (field) {
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
                    const currencyRequired = this.getActiveCurrency();
                    if (!currencyRequired) {
                        return 'Currency must be selected before configuring splits';
                    }
                    const totalPercentage = this.#splitsSignal.value.reduce((sum, split) => sum + (split.percentage || 0), 0);
                    if (Math.round(totalPercentage * 1000) !== 100 * 1000) {
                        return 'Percentages must add up to 100%';
                    }
                    const totalSplitUnits = this.#splitsSignal.value.reduce((sum, split) => sum + amountToSmallestUnit(split.amount, currencyRequired), 0);
                    const amountUnits = amountToSmallestUnit(this.#amountSignal.value, currencyRequired);
                    if (totalSplitUnits !== amountUnits) {
                        return 'Split amounts must equal the total expense amount';
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

        const labelError = this.validateField('label');
        if (labelError) errors.label = labelError;

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
            const paidBy = this.#paidBySignal.value;

            // Validation ensures paidBy is not empty
            if (!paidBy) {
                throw new Error('paidBy is required');
            }

            const request: CreateExpenseRequest = {
                groupId,
                description: this.#descriptionSignal.value.trim(),
                amount: amount,
                currency: toCurrencyISOCode(this.#currencySignal.value),
                paidBy,
                label: this.#labelSignal.value,
                date: utcDateTime,
                splitType: this.#splitTypeSignal.value,
                participants: this.#participantsSignal.value,
                splits: this.#splitsSignal.value,
            };

            const expense = await apiClient.createExpense(request);

            // Track recent label and amount
            storageManager.addRecentLabel(this.#labelSignal.value);
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
                label: this.#labelSignal.value,
                date: utcDateTime,
                splitType: this.#splitTypeSignal.value,
                participants: this.#participantsSignal.value,
                splits: this.#splitsSignal.value,
            };

            await apiClient.updateExpense(expenseId, updateRequest as CreateExpenseRequest);

            // Track recent label and amount
            storageManager.addRecentLabel(this.#labelSignal.value);
            storageManager.addRecentAmount(amount);

            // Clear draft immediately after successful update
            this.clearDraft(groupId);

            // Fetch the updated expense to return
            const { expense: updatedExpense } = await apiClient.getExpenseFullDetails(expenseId);

            // Refresh group data to show the updated expense (non-blocking)
            // Don't await this to avoid blocking navigation
            Promise.all([enhancedGroupDetailStore.refreshAll(), groupsStore.refreshGroups()]).catch((refreshError) => {
                // Log refresh error but don't fail the expense update
                logWarning('Failed to refresh data after updating expense', { error: refreshError });
            });

            return updatedExpense;
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
        this.#amountSignal.value = '';
        this.#currencySignal.value = ''; // Force user to select currency
        this.#dateSignal.value = getTodayDate();
        this.#timeSignal.value = '12:00'; // Default to noon
        this.#paidBySignal.value = '';
        this.#labelSignal.value = 'food';
        this.#splitTypeSignal.value = SplitTypes.EQUAL;
        this.#participantsSignal.value = [];
        this.#splitsSignal.value = [];
        this.#errorSignal.value = null;
        this.#validationErrorsSignal.value = {};
    }

    /**
     * Capture the current form state as the initial state for change tracking
     */
    captureInitialState(): void {
        this.#initialState = {
            description: this.#descriptionSignal.value,
            amount: this.#amountSignal.value,
            currency: this.#currencySignal.value,
            date: this.#dateSignal.value,
            time: this.#timeSignal.value,
            paidBy: this.#paidBySignal.value,
            label: this.#labelSignal.value,
            splitType: this.#splitTypeSignal.value,
            participants: [...this.#participantsSignal.value],
            splits: [...this.#splitsSignal.value],
        };
    }

    hasUnsavedChanges(): boolean {
        // If no initial state captured yet, compare against empty/default state
        if (!this.#initialState) {
            const hasAmount = this.toUnits(this.#amountSignal.value) > 0;
            return (
                this.#descriptionSignal.value.trim() !== ''
                || hasAmount
                || this.#currencySignal.value !== ''
                || this.#dateSignal.value !== getTodayDate()
                || this.#paidBySignal.value !== ''
                || this.#labelSignal.value !== 'food'
                || this.#splitTypeSignal.value !== SplitTypes.EQUAL
                || this.#participantsSignal.value.length > 0
                || this.#splitsSignal.value.length > 0
            );
        }

        // Compare current state against captured initial state
        return (
            this.#descriptionSignal.value !== this.#initialState.description
            || this.#amountSignal.value !== this.#initialState.amount
            || this.#currencySignal.value !== this.#initialState.currency
            || this.#dateSignal.value !== this.#initialState.date
            || this.#timeSignal.value !== this.#initialState.time
            || this.#paidBySignal.value !== this.#initialState.paidBy
            || this.#labelSignal.value !== this.#initialState.label
            || this.#splitTypeSignal.value !== this.#initialState.splitType
            || JSON.stringify(this.#participantsSignal.value) !== JSON.stringify(this.#initialState.participants)
            || JSON.stringify(this.#splitsSignal.value) !== JSON.stringify(this.#initialState.splits)
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
            label: this.#labelSignal.value,
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
            this.#amountSignal.value = draftData.amount ?? '';
            this.#currencySignal.value = draftData.currency || ''; // Force user to select if draft has none
            this.#dateSignal.value = draftData.date || getTodayDate();
            this.#timeSignal.value = draftData.time || '12:00'; // Default to noon
            this.#paidBySignal.value = draftData.paidBy || '';
            this.#labelSignal.value = draftData.label || 'food';
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
