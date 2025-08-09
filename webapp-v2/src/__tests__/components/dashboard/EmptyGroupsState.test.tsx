import { render, screen, fireEvent } from '@testing-library/preact';
import { vi } from 'vitest';
import { EmptyGroupsState } from '@/components/dashboard/EmptyGroupsState.tsx';

describe('EmptyGroupsState', () => {
  const mockOnCreateGroup = vi.fn();

  beforeEach(() => {
    mockOnCreateGroup.mockClear();
  });

  it('displays empty state message', () => {
    render(<EmptyGroupsState onCreateGroup={mockOnCreateGroup} />);

    expect(screen.getByText('No groups yet')).toBeInTheDocument();
    expect(screen.getByText(/Create your first group to start splitting expenses/)).toBeInTheDocument();
  });

  it('shows create group button', () => {
    render(<EmptyGroupsState onCreateGroup={mockOnCreateGroup} />);

    const createButton = screen.getByRole('button', { name: /Create Your First Group/ });
    expect(createButton).toBeInTheDocument();
  });

  it('calls onCreateGroup when button is clicked', () => {
    render(<EmptyGroupsState onCreateGroup={mockOnCreateGroup} />);

    const createButton = screen.getByRole('button', { name: /Create Your First Group/ });
    fireEvent.click(createButton);

    expect(mockOnCreateGroup).toHaveBeenCalledTimes(1);
  });

  it('displays getting started tips', () => {
    render(<EmptyGroupsState onCreateGroup={mockOnCreateGroup} />);

    expect(screen.getByText('Getting started with Splitifyd:')).toBeInTheDocument();
    expect(screen.getByText('1. Create a group')).toBeInTheDocument();
    expect(screen.getByText('2. Add expenses')).toBeInTheDocument();
    expect(screen.getByText('3. Settle up')).toBeInTheDocument();
  });

  it('shows helpful descriptions for each step', () => {
    render(<EmptyGroupsState onCreateGroup={mockOnCreateGroup} />);

    expect(screen.getByText('Add friends, roommates, or travel companions')).toBeInTheDocument();
    expect(screen.getByText('Track who paid and how to split costs')).toBeInTheDocument();
    expect(screen.getByText('See who owes what and settle balances')).toBeInTheDocument();
  });

  it('has proper accessibility structure', () => {
    render(<EmptyGroupsState onCreateGroup={mockOnCreateGroup} />);

    // Check that the main heading is present
    const heading = screen.getByRole('heading', { level: 4 });
    expect(heading).toHaveTextContent('No groups yet');

    // Check that the create button is properly labeled
    const button = screen.getByRole('button', { name: /Create Your First Group/ });
    expect(button).toBeInTheDocument();
  });
});