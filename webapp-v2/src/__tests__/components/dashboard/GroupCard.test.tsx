import { render, screen, fireEvent } from '@testing-library/preact';
import { vi } from 'vitest';
import { GroupCard } from '../../../components/dashboard/GroupCard';
import type { Group, User } from '@shared/types/webapp-shared-types';

// Helper to create test groups
function createTestGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: `group-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Group',
    memberCount: 1,
    balance: {
      userBalance: {
        userId: 'test-user',
        netBalance: 0,
        owes: {},
        owedBy: {}
      },
      totalOwed: 0,
      totalOwing: 0
    },
    lastActivity: 'Just created',
    lastActivityRaw: new Date().toISOString(),
    expenseCount: 0,
    ...overrides
  };
}

// Helper to create test users
function createTestUser(overrides: Partial<User> = {}): User {
  const id = Math.random().toString(36).substr(2, 9);
  return {
    uid: `user-${id}`,
    email: `test-${id}@example.com`,
    displayName: `Test User ${id}`,
    ...overrides
  };
}

describe('GroupCard', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it('displays group name and basic info', () => {
    const group = createTestGroup({
      name: 'Trip to Paris',
      memberCount: 3,
      expenseCount: 5
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('Trip to Paris')).toBeInTheDocument();
    expect(screen.getByText('3 members')).toBeInTheDocument();
    expect(screen.getByText('5 expenses')).toBeInTheDocument();
  });

  it('shows settled up state when balance is zero', () => {
    const group = createTestGroup({
      name: 'Apartment Bills',
      balance: {
        userBalance: {
          userId: 'test-user',
          netBalance: 0,
          owes: {},
          owedBy: {}
        },
        totalOwed: 0,
        totalOwing: 0
      }
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    const balanceDisplay = screen.getByText('Settled up');
    expect(balanceDisplay).toBeInTheDocument();
    expect(balanceDisplay).toHaveClass('text-green-600');
  });

  it('shows money owed when balance is negative', () => {
    const group = createTestGroup({
      name: 'Dinner Split',
      balance: {
        userBalance: {
          userId: 'test-user',
          netBalance: -25.50,
          owes: { 'user-2': 25.50 },
          owedBy: {}
        },
        totalOwed: 0,
        totalOwing: 25.50
      }
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    const balanceDisplay = screen.getByText('You owe $25.50');
    expect(balanceDisplay).toBeInTheDocument();
    expect(balanceDisplay).toHaveClass('text-red-600');
  });

  it('shows money owed to user when balance is positive', () => {
    const group = createTestGroup({
      name: 'Grocery Run',
      balance: {
        userBalance: {
          userId: 'test-user',
          netBalance: 42.75,
          owes: {},
          owedBy: { 'user-2': 42.75 }
        },
        totalOwed: 42.75,
        totalOwing: 0
      }
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    const balanceDisplay = screen.getByText("You're owed $42.75");
    expect(balanceDisplay).toBeInTheDocument();
    expect(balanceDisplay).toHaveClass('text-green-600');
  });

  it('displays last activity and last expense', () => {
    const group = createTestGroup({
      name: 'Weekend Trip',
      lastActivity: '2 hours ago',
      lastExpense: {
        description: 'Gas station',
        amount: 45.00,
        date: new Date().toISOString()
      }
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('Last activity: 2 hours ago')).toBeInTheDocument();
    expect(screen.getByText('Latest: Gas station - $45.00')).toBeInTheDocument();
  });

  it('shows member avatars when members are provided', () => {
    const members: User[] = [
      createTestUser({ displayName: 'Alice Anderson' }),
      createTestUser({ displayName: 'Bob Brown' }),
      createTestUser({ displayName: 'Charlie Chen' })
    ];

    const group = createTestGroup({
      name: 'Large Group',
      members,
      memberCount: members.length
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('Members:')).toBeInTheDocument();
    expect(screen.getByText('AA')).toBeInTheDocument(); // Alice Anderson
    expect(screen.getByText('BB')).toBeInTheDocument(); // Bob Brown
    expect(screen.getByText('CC')).toBeInTheDocument(); // Charlie Chen
  });

  it('limits member avatars to 5 and shows count for rest', () => {
    const members: User[] = [];
    for (let i = 0; i < 8; i++) {
      members.push(createTestUser({ 
        displayName: `User ${String.fromCharCode(65 + i)}`, // User A, User B, etc.
        uid: `user-${i}` 
      }));
    }

    const group = createTestGroup({
      name: 'Large Group',
      members,
      memberCount: members.length
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    // Should show first 5 initials
    expect(screen.getByText('UA')).toBeInTheDocument();
    expect(screen.getByText('UE')).toBeInTheDocument();
    
    // Should show +3 for the remaining members
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const group = createTestGroup({ name: 'Clickable Group' });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    const card = screen.getByText('Clickable Group').closest('[class*="cursor-pointer"]');
    fireEvent.click(card!);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('handles groups with single member correctly', () => {
    const group = createTestGroup({
      name: 'Solo Trip',
      memberCount: 1
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('1 member')).toBeInTheDocument(); // singular
  });

  it('handles groups with single expense correctly', () => {
    const group = createTestGroup({
      name: 'Single Expense',
      expenseCount: 1
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('1 expense')).toBeInTheDocument(); // singular
  });

  it('handles groups without members array', () => {
    const group = createTestGroup({
      name: 'No Members Array',
      members: undefined
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    // Should not render member avatars section
    expect(screen.queryByText('Members:')).not.toBeInTheDocument();
  });

  it('handles empty members array', () => {
    const group = createTestGroup({
      name: 'Empty Members',
      members: []
    });

    render(<GroupCard group={group} onClick={mockOnClick} />);

    // Should not render member avatars section
    expect(screen.queryByText('Members:')).not.toBeInTheDocument();
  });
});