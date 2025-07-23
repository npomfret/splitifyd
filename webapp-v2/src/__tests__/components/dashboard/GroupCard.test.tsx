import { render, screen, fireEvent } from '@testing-library/preact';
import { vi } from 'vitest';
import { GroupCard } from '../../../components/dashboard/GroupCard';
import { GroupBuilder } from '../../../../../firebase/functions/__tests__/support/builders/GroupBuilder';
import type { User } from '@shared/apiTypes';
import { TransformedGroupAdapter } from '../../support/test-adapters';

describe('GroupCard', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it('displays group name and basic info', () => {
    const group = TransformedGroupAdapter.fromTestGroup(
      new GroupBuilder().withName('Trip to Paris').build(),
      { memberCount: 3, expenseCount: 5 }
    );

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('Trip to Paris')).toBeInTheDocument();
    expect(screen.getByText('3 members')).toBeInTheDocument();
    expect(screen.getByText('5 expenses')).toBeInTheDocument();
  });

  it('shows settled up state when balance is zero', () => {
    const group = TransformedGroupAdapter.fromTestGroup(
      new GroupBuilder().withName('Apartment Bills').build(),
      { yourBalance: 0 }
    );

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('Settled up')).toBeInTheDocument();
    expect(screen.getByText('Settled up').closest('div')).toHaveClass('text-green-600');
  });

  it('shows amount owed when user has positive balance', () => {
    const group = TransformedGroupAdapter.withBalance(
      new GroupBuilder().withName('Dinner Split').build(),
      25.50
    );

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText("You're owed $25.50")).toBeInTheDocument();
    expect(screen.getByText("You're owed $25.50").closest('div')).toHaveClass('text-green-600');
  });

  it('shows amount owing when user has negative balance', () => {
    const group = TransformedGroupAdapter.withBalance(
      new GroupBuilder().withName('Grocery Run').build(),
      -15.75
    );

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('You owe $15.75')).toBeInTheDocument();
    expect(screen.getByText('You owe $15.75').closest('div')).toHaveClass('text-red-600');
  });

  it('displays last expense information', () => {
    const group = TransformedGroupAdapter.fromTestGroup(
      new GroupBuilder().withName('Weekend Trip').build(),
      {
        lastExpense: {
          description: 'Hotel booking',
          amount: 120.00,
          date: '2025-07-20'
        }
      }
    );

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('Latest: Hotel booking - $120.00')).toBeInTheDocument();
  });

  it('shows member avatars when members are present', () => {
    const user1: User = { uid: 'user1', email: 'alice@test.com', displayName: 'Alice Johnson', token: 'token1' };
    const user2: User = { uid: 'user2', email: 'bob@test.com', displayName: 'Bob Smith', token: 'token2' };
    const user3: User = { uid: 'user3', email: 'charlie@test.com', displayName: 'Charlie Brown', token: 'token3' };

    const group = TransformedGroupAdapter.fromTestGroup(
      new GroupBuilder()
        .withName('Study Group')
        .withMember(user1)
        .withMember(user2)
        .withMember(user3)
        .build()
    );

    render(<GroupCard group={group} onClick={mockOnClick} />);

    // Check that member initials are displayed
    expect(screen.getByText('AJ')).toBeInTheDocument();
    expect(screen.getByText('BS')).toBeInTheDocument();
    expect(screen.getByText('CB')).toBeInTheDocument();
  });

  it('shows +N indicator when there are more than 5 members', () => {
    const users: User[] = Array.from({ length: 7 }, (_, i) => ({
      uid: `user${i + 1}`,
      email: `user${i + 1}@test.com`,
      displayName: `User ${i + 1}`,
      token: `token${i + 1}`
    }));

    let groupBuilder = new GroupBuilder().withName('Large Group');
    users.forEach(user => {
      groupBuilder = groupBuilder.withMember(user);
    });

    const group = TransformedGroupAdapter.fromTestGroup(groupBuilder.build());

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const group = TransformedGroupAdapter.fromTestGroup(
      new GroupBuilder().withName('Clickable Group').build()
    );

    render(<GroupCard group={group} onClick={mockOnClick} />);

    fireEvent.click(screen.getByText('Clickable Group').closest('div')!);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('handles singular forms correctly', () => {
    const group = TransformedGroupAdapter.fromTestGroup(
      new GroupBuilder().withName('Solo Trip').build(),
      { memberCount: 1, expenseCount: 1 }
    );

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('1 member')).toBeInTheDocument();
    expect(screen.getByText('1 expense')).toBeInTheDocument();
  });

  it('handles empty members array', () => {
    const group = TransformedGroupAdapter.fromTestGroup(
      new GroupBuilder().withName('Empty Group').build(),
      { members: [] }
    );

    render(<GroupCard group={group} onClick={mockOnClick} />);

    expect(screen.getByText('Empty Group')).toBeInTheDocument();
    // Should not crash and should not show member avatars
    expect(screen.queryByText('Members:')).not.toBeInTheDocument();
  });
});