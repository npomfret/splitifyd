import { ListComponents } from './list-components';
import type {
    TransformedGroup,
    ExpenseData,
    GroupMember,
    GroupBalance,
    EmptyStateConfig,
    PaginationConfig
} from '../types/business-logic';

// Mock Node constructor for instanceof checks
class MockNode {
    textContent: string = '';
    nodeType: number = 1;
    constructor() {}
}

global.Node = MockNode as any;

// Mock DOM environment
interface MockElement extends MockNode {
    id: string;
    querySelector: jest.Mock;
    querySelectorAll: jest.Mock;
    addEventListener: jest.Mock;
    dataset: Record<string, string>;
}

const createMockElement = (): MockElement => {
    const element = Object.create(MockNode.prototype);
    Object.assign(element, {
        textContent: '',
        nodeType: 1,
        id: '',
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(),
        addEventListener: jest.fn(),
        dataset: {}
    });
    return element;
};

describe('ListComponents', () => {
    beforeEach(() => {
        global.document = {
            getElementById: jest.fn()
        } as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('renderGroupCard', () => {
        it('should render group card with positive balance', () => {
            const group: TransformedGroup = {
                id: 'group1',
                name: 'Trip to Paris',
                members: [
                    { id: 'user1', name: 'John', email: 'john@example.com', initials: 'J' },
                    { id: 'user2', name: 'Jane', email: 'jane@example.com', initials: 'J' }
                ],
                yourBalance: 50.25,
                expenseCount: 5,
                createdAt: '2024-01-15T00:00:00Z',
                createdBy: 'user1',
                description: '',
                updatedAt: '2024-01-15T00:00:00Z',
                memberCount: 2,
                lastActivity: '2024-01-15T00:00:00Z'
            };

            const result = ListComponents.renderGroupCard(group);

            expect(result).toContain('href="/group-detail.html?id=group1"');
            expect(result).toContain('Trip to Paris');
            expect(result).toContain('2 members');
            expect(result).toContain('You are owed');
            expect(result).toContain('$50.25');
            expect(result).toContain('class="group-balance positive"');
        });

        it('should render group card with negative balance', () => {
            const group: TransformedGroup = {
                id: 'group2',
                name: 'Dinner Party',
                members: [{ id: 'user1', name: 'John', email: 'john@example.com', initials: 'J' }],
                yourBalance: -25.75,
                expenseCount: 3,
                createdAt: '2024-01-15T00:00:00Z',
                createdBy: 'user1',
                description: '',
                updatedAt: '2024-01-15T00:00:00Z',
                memberCount: 1,
                lastActivity: '2024-01-15T00:00:00Z'
            };

            const result = ListComponents.renderGroupCard(group);

            expect(result).toContain('Dinner Party');
            expect(result).toContain('1 members');
            expect(result).toContain('You owe');
            expect(result).toContain('$25.75');
            expect(result).toContain('class="group-balance negative"');
        });

        it('should handle group with no members', () => {
            const group: TransformedGroup = {
                id: 'group3',
                name: 'Empty Group',
                yourBalance: 0,
                expenseCount: 0,
                createdAt: '2024-01-15T00:00:00Z',
                createdBy: 'user1',
                description: '',
                updatedAt: '2024-01-15T00:00:00Z',
                memberCount: 0,
                members: [],
                lastActivity: '2024-01-15T00:00:00Z'
            };

            const result = ListComponents.renderGroupCard(group);

            expect(result).toContain('0 members');
            expect(result).toContain('$0.00');
        });
    });

    describe('renderExpenseItem', () => {
        it('should render expense paid by current user', () => {
            const expense: ExpenseData = {
                id: 'exp1',
                groupId: 'group1',
                description: 'Restaurant Bill',
                amount: 120.50,
                paidBy: 'user1',
                paidByName: 'John Doe',
                date: '2024-01-15',
                category: 'Food',
                createdAt: '2024-01-15T00:00:00Z',
                splits: [
                    { userId: 'user1', amount: 60.25 },
                    { userId: 'user2', amount: 60.25 }
                ]
            };

            const result = ListComponents.renderExpenseItem(expense, 'user1');

            expect(result).toContain('data-expense-id="exp1"');
            expect(result).toContain('Restaurant Bill');
            expect(result).toContain('$120.50');
            expect(result).toContain('You paid');
            expect(result).toContain('Food');
            expect(result).toContain('You lent $60.25');
        });

        it('should render expense paid by someone else', () => {
            const expense: ExpenseData = {
                id: 'exp2',
                groupId: 'group1',
                description: 'Gas Station',
                amount: 45.00,
                paidBy: 'user2',
                paidByName: 'Jane Smith',
                date: '2024-01-16',
                createdAt: '2024-01-16T00:00:00Z',
                splits: [
                    { userId: 'user1', amount: 22.50 },
                    { userId: 'user2', amount: 22.50 }
                ]
            };

            const result = ListComponents.renderExpenseItem(expense, 'user1');

            expect(result).toContain('Jane Smith paid');
            expect(result).toContain('You owe $22.50');
        });

        it('should handle expense without category', () => {
            const expense: ExpenseData = {
                id: 'exp3',
                groupId: 'group1',
                description: 'Miscellaneous',
                amount: 30.00,
                paidBy: 'user1',
                date: '2024-01-17',
                createdAt: '2024-01-17T00:00:00Z',
                splits: []
            };

            const result = ListComponents.renderExpenseItem(expense, 'user1');

            expect(result).not.toContain('expense-category');
        });

        it('should handle missing paidByName', () => {
            const expense: ExpenseData = {
                id: 'exp4',
                groupId: 'group1',
                description: 'Unknown Payer',
                amount: 25.00,
                paidBy: 'user2',
                date: '2024-01-18',
                createdAt: '2024-01-18T00:00:00Z',
                splits: []
            };

            const result = ListComponents.renderExpenseItem(expense, 'user1');

            expect(result).toContain('Someone paid');
        });
    });

    describe('renderMemberItem', () => {
        it('should render member with display name and balance', () => {
            const member: GroupMember = {
                id: 'user1',
                displayName: 'John Doe',
                email: 'john@example.com',
                joinedAt: '2024-01-15T00:00:00Z'
            };

            const result = ListComponents.renderMemberItem(member, 25.50);

            expect(result).toContain('John Doe');
            expect(result).toContain('john@example.com');
            expect(result).toContain('J'); // First letter avatar
            expect(result).toContain('+$25.50');
            expect(result).toContain('positive');
        });

        it('should render member with negative balance', () => {
            const member: GroupMember = {
                id: 'user2',
                displayName: 'Jane Smith',
                email: 'jane@example.com',
                joinedAt: '2024-01-15T00:00:00Z'
            };

            const result = ListComponents.renderMemberItem(member, -15.25);

            expect(result).toContain('Jane Smith');
            expect(result).toContain('$15.25');
            expect(result).toContain('negative');
            expect(result).not.toContain('+');
        });

        it('should handle member without display name', () => {
            const member = {
                email: 'unknown@example.com'
            };

            const result = ListComponents.renderMemberItem(member);

            expect(result).toContain('unknown@example.com');
            expect(result).toContain('?'); // Default avatar
            expect(result).not.toContain('member-balance');
        });

        it('should handle member with no balance', () => {
            const member: GroupMember = {
                id: 'user3',
                displayName: 'Bob Johnson',
                email: 'bob@example.com',
                joinedAt: '2024-01-15T00:00:00Z'
            };

            const result = ListComponents.renderMemberItem(member);

            expect(result).toContain('Bob Johnson');
            expect(result).not.toContain('member-balance');
        });
    });

    describe('renderBalanceItem', () => {
        it('should render positive balance (owed to you)', () => {
            const balance: GroupBalance = {
                userId: 'user1',
                userName: 'John Doe',
                amount: 50.75
            };

            const result = ListComponents.renderBalanceItem(balance);

            expect(result).toContain('John Doe');
            expect(result).toContain('J'); // Avatar
            expect(result).toContain('owes you');
            expect(result).toContain('$50.75');
            expect(result).toContain('positive');
        });

        it('should render negative balance (you owe)', () => {
            const balance: GroupBalance = {
                userId: 'user2',
                userName: 'Jane Smith',
                amount: -30.25
            };

            const result = ListComponents.renderBalanceItem(balance);

            expect(result).toContain('Jane Smith');
            expect(result).toContain('you owe');
            expect(result).toContain('$30.25');
            expect(result).toContain('negative');
        });

        it('should handle unknown user name', () => {
            const balance: GroupBalance = {
                userId: 'user3',
                userName: 'Bob Johnson',
                amount: 15.00
            };

            const result = ListComponents.renderBalanceItem(balance);

            expect(result).toContain('Bob Johnson');
            expect(result).toContain('B'); // First letter avatar
        });
    });

    describe('renderEmptyState', () => {
        it('should render complete empty state', () => {
            const config: EmptyStateConfig = {
                icon: 'fas fa-inbox',
                title: 'No Items',
                message: 'You have no items to display.',
                actionButton: '<button>Add Item</button>'
            };

            const result = ListComponents.renderEmptyState(config);

            expect(result).toContain('<i class="fas fa-inbox"></i>');
            expect(result).toContain('<h3>No Items</h3>');
            expect(result).toContain('<p>You have no items to display.</p>');
            expect(result).toContain('<button>Add Item</button>');
        });

        it('should render minimal empty state', () => {
            const config: EmptyStateConfig = {
                title: 'Empty'
            };

            const result = ListComponents.renderEmptyState(config);

            expect(result).toContain('<h3>Empty</h3>');
            expect(result).not.toContain('<i class=');
            expect(result).not.toContain('<p>');
            expect(result).not.toContain('<button>');
        });
    });

    describe('renderLoadingState', () => {
        it('should render loading state with default message', () => {
            const result = ListComponents.renderLoadingState();

            expect(result).toContain('class="loading-state"');
            expect(result).toContain('class="spinner"');
            expect(result).toContain('<p>Loading...</p>');
        });

        it('should render loading state with custom message', () => {
            const result = ListComponents.renderLoadingState('Fetching data...');

            expect(result).toContain('<p>Fetching data...</p>');
        });
    });

    describe('renderErrorState', () => {
        it('should render error state with default message', () => {
            const result = ListComponents.renderErrorState();

            expect(result).toContain('class="error-state"');
            expect(result).toContain('fas fa-exclamation-circle');
            expect(result).toContain('<p>An error occurred</p>');
        });

        it('should render error state with custom message and retry button', () => {
            const retryButton = '<button onclick="retry()">Retry</button>';
            const result = ListComponents.renderErrorState('Network error', retryButton);

            expect(result).toContain('<p>Network error</p>');
            expect(result).toContain(retryButton);
        });
    });

    describe('renderPaginationControls', () => {
        it('should render pagination controls', () => {
            const config: PaginationConfig = {
                currentPage: 2,
                totalPages: 5
            };

            const result = ListComponents.renderPaginationControls(config);

            expect(result).toContain('class="pagination"');
            expect(result).toContain('data-page="1"'); // Previous
            expect(result).toContain('data-page="3"'); // Next
            expect(result).toContain('Page 2 of 5');
            expect(result).not.toContain('disabled');
        });

        it('should disable previous button on first page', () => {
            const config: PaginationConfig = {
                currentPage: 1,
                totalPages: 3
            };

            const result = ListComponents.renderPaginationControls(config);

            expect(result).toContain('disabled');
            expect(result).toContain('data-page="2"'); // Next
        });

        it('should disable next button on last page', () => {
            const config: PaginationConfig = {
                currentPage: 3,
                totalPages: 3
            };

            const result = ListComponents.renderPaginationControls(config);

            expect(result).toContain('data-page="2"'); // Previous
            expect(result).toContain('disabled'); // Next disabled
            expect(result).toContain('data-page="4"');
        });

        it('should return empty string for single page', () => {
            const config: PaginationConfig = {
                currentPage: 1,
                totalPages: 1
            };

            const result = ListComponents.renderPaginationControls(config);

            expect(result).toBe('');
        });
    });

    describe('attachPaginationListeners', () => {
        it('should attach click listeners to pagination buttons', () => {
            const mockButton1 = createMockElement();
            const mockButton2 = createMockElement();
            mockButton1.dataset.page = '1';
            mockButton2.dataset.page = '3';
            
            const mockContainer = createMockElement();
            mockContainer.querySelectorAll.mockReturnValue([mockButton1, mockButton2]);
            
            (document.getElementById as jest.Mock).mockReturnValue(mockContainer);
            
            const mockCallback = jest.fn();

            ListComponents.attachPaginationListeners('pagination-container', mockCallback);

            expect(document.getElementById).toHaveBeenCalledWith('pagination-container');
            expect(mockContainer.querySelectorAll).toHaveBeenCalledWith('.pagination button[data-page]');
            expect(mockButton1.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockButton2.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('should handle missing container gracefully', () => {
            (document.getElementById as jest.Mock).mockReturnValue(null);
            
            const mockCallback = jest.fn();

            expect(() => {
                ListComponents.attachPaginationListeners('missing-container', mockCallback);
            }).not.toThrow();
        });

        it('should call callback with correct page number on click', () => {
            const mockButton = createMockElement();
            mockButton.dataset.page = '3';
            
            const mockContainer = createMockElement();
            mockContainer.querySelectorAll.mockReturnValue([mockButton]);
            
            (document.getElementById as jest.Mock).mockReturnValue(mockContainer);
            
            const mockCallback = jest.fn();

            ListComponents.attachPaginationListeners('pagination-container', mockCallback);

            // Simulate click event
            const clickHandler = mockButton.addEventListener.mock.calls[0][1];
            const mockEvent = {
                currentTarget: mockButton
            };
            
            clickHandler(mockEvent);

            expect(mockCallback).toHaveBeenCalledWith(3);
        });
    });
});