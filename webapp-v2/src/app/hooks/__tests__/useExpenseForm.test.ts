import { renderHook, act } from '@testing-library/preact';
import { vi } from 'vitest';
import { useExpenseForm } from '../useExpenseForm';
import { expenseFormStore } from '../../stores/expense-form-store'; // Add this import
import { route } from 'preact-router'; // Add this import

// Mock dependencies
vi.mock('../../../utils/browser-logger', () => ({
    logError: vi.fn(),
}));

vi.mock('preact-router', () => ({
    route: vi.fn(),
}));

vi.mock('../useAuth', () => ({
    useAuth: vi.fn(() => ({
        user: { uid: 'test-user', email: 'test@example.com' },
    })),
}));

vi.mock('../../apiClient', () => ({
    apiClient: {
        createExpense: vi.fn(),
        updateExpense: vi.fn(),
        getExpense: vi.fn(),
    },
}));

vi.mock('../../stores/expense-form-store', () => ({
    expenseFormStore: {
        description: 'Test Expense',
        amount: '25.50',
        date: '2024-01-15',
        paidBy: 'user1',
        category: 'Food',
        splitType: 'equal',
        participants: ['user1', 'user2'],
        splits: [
            { userId: 'user1', amount: 12.75 },
            { userId: 'user2', amount: 12.75 },
        ],
        saving: false,
        error: null,
        validationErrors: {},
        reset: vi.fn(),
        updateField: vi.fn(),
        setSaving: vi.fn(),
        setError: vi.fn(),
        setValidationErrors: vi.fn(),
        updateSplitAmount: vi.fn(),
        updateSplitPercentage: vi.fn(),
        toggleParticipant: vi.fn(),
        handleSelectAll: vi.fn(),
        handleSelectNone: vi.fn(),
    },
    getRecentAmounts: vi.fn(() => [25.5, 45.0, 12.75]),
}));

vi.mock('../../stores/group-detail-store-enhanced', () => ({
    enhancedGroupDetailStore: {
        group: {
            id: 'test-group',
            name: 'Test Group',
            memberIds: ['user1', 'user2'],
        },
        members: [
            { uid: 'user1', displayName: 'Alice Johnson' },
            { uid: 'user2', displayName: 'Bob Smith' },
        ],
        loading: false,
        fetchGroup: vi.fn(),
    },
}));

describe('useExpenseForm', () => {
    const defaultOptions = {
        groupId: 'test-group',
        expenseId: null,
        isEditMode: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes correctly for add mode', () => {
        const { result } = renderHook(() => useExpenseForm(defaultOptions));

        expect(result.current.description).toBe('Test Expense');
        expect(result.current.amount).toBe('25.50');
        expect(result.current.date).toBe('2024-01-15');
        expect(result.current.paidBy).toBe('user1');
        expect(result.current.category).toBe('Food');
        expect(result.current.splitType).toBe('equal');
        expect(result.current.participants).toEqual(['user1', 'user2']);
        expect(result.current.splits).toHaveLength(2);
    });

    it('provides access to group and members data', () => {
        const { result } = renderHook(() => useExpenseForm(defaultOptions));

        expect(result.current.group).toEqual(
            expect.objectContaining({
                id: 'test-group',
                name: 'Test Group',
                memberIds: ['user1', 'user2'],
            }),
        );

        expect(result.current.members).toEqual(
            expect.arrayContaining([expect.objectContaining({ uid: 'user1', displayName: 'Alice Johnson' }), expect.objectContaining({ uid: 'user2', displayName: 'Bob Smith' })]),
        );
    });

    it('provides form state signals', () => {
        const { result } = renderHook(() => useExpenseForm(defaultOptions));

        expect(result.current.loading).toBe(false);
        expect(result.current.saving).toBe(false);
        expect(result.current.formError).toBeNull();
        expect(result.current.validationErrors).toEqual({});
    });

    it('provides update functions', () => {
        const { result } = renderHook(() => useExpenseForm(defaultOptions));

        expect(typeof result.current.updateField).toBe('function');
        expect(typeof result.current.updateSplitAmount).toBe('function');
        expect(typeof result.current.updateSplitPercentage).toBe('function');
        expect(typeof result.current.handleParticipantToggle).toBe('function');
        expect(typeof result.current.handleSelectAll).toBe('function');
        expect(typeof result.current.handleSelectNone).toBe('function');
    });

    it('provides utility functions', () => {
        const { result } = renderHook(() => useExpenseForm(defaultOptions));

        expect(typeof result.current.handleAmountChange).toBe('function');
        expect(typeof result.current.getRecentAmounts).toBe('function');
        expect(typeof result.current.handleSubmit).toBe('function');
        expect(typeof result.current.handleCancel).toBe('function');
    });

    it('provides predefined categories', () => {
        const { result } = renderHook(() => useExpenseForm(defaultOptions));

        expect(Array.isArray(result.current.PREDEFINED_EXPENSE_CATEGORIES)).toBe(true);
    });

    describe('Edit Mode', () => {
        it('initializes correctly for edit mode', () => {
            const editOptions = {
                ...defaultOptions,
                expenseId: 'test-expense-123',
                isEditMode: true,
            };

            const { result } = renderHook(() => useExpenseForm(editOptions));

            // Should still have all the same properties but in edit mode
            expect(result.current.description).toBe('Test Expense');
            expect(result.current.amount).toBe('25.50');
        });
    });

    describe('Form Interactions', () => {
        it('calls store methods when form functions are invoked', () => {

            const { result } = renderHook(() => useExpenseForm(defaultOptions));

            act(() => {
                result.current.updateField('description', 'New Description');
            });

            expect(expenseFormStore.updateField).toHaveBeenCalledWith('description', 'New Description');
        });

        it('calls split amount update method', () => {

            const { result } = renderHook(() => useExpenseForm(defaultOptions));

            act(() => {
                result.current.updateSplitAmount('user1', 15.0);
            });

            expect(expenseFormStore.updateSplitAmount).toHaveBeenCalledWith('user1', 15.0);
        });

        it('calls split percentage update method', () => {

            const { result } = renderHook(() => useExpenseForm(defaultOptions));

            act(() => {
                result.current.updateSplitPercentage('user1', 60);
            });

            expect(expenseFormStore.updateSplitPercentage).toHaveBeenCalledWith('user1', 60);
        });

        it('calls participant toggle method', () => {

            const { result } = renderHook(() => useExpenseForm(defaultOptions));

            act(() => {
                result.current.handleParticipantToggle('user1');
            });

            expect(expenseFormStore.toggleParticipant).toHaveBeenCalledWith('user1');
        });
    });

    describe('Recent Amounts', () => {
        it('provides getRecentAmounts function', () => {
            const { result } = renderHook(() => useExpenseForm(defaultOptions));

            const recentAmounts = result.current.getRecentAmounts();
            expect(recentAmounts).toEqual([25.5, 45.0, 12.75]);
        });
    });

    describe('Navigation', () => {
        it('redirects to dashboard when no groupId provided', () => {
            

            renderHook(() =>
                useExpenseForm({
                    ...defaultOptions,
                    groupId: '',
                }),
            );

            expect(route).toHaveBeenCalledWith('/dashboard');
        });
    });
});
