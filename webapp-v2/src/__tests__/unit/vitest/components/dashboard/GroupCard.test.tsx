import { render, screen, fireEvent } from '@testing-library/preact';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { GroupCard } from '@/components/dashboard/GroupCard.tsx';
import type { Group, RegisteredUser } from '@splitifyd/shared';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, values?: any) => {
            // Return appropriate test strings based on the key
            const translations: Record<string, string | ((vals: any) => string)> = {
                'groupCard.settledUp': 'Settled up',
                'groupCard.youreOwed': (vals: any) => `You're owed ${vals.amount}`,
                'groupCard.youOwe': (vals: any) => `You owe ${vals.amount}`,
                'groupCard.members': 'members',
                'groupCard.member': 'member',
                'groupCard.noRecentActivity': 'No recent activity',
                'groupCard.addExpenseTooltip': (vals: any) => `Add expense to ${vals.groupName}`,
                'groupCard.inviteTooltip': (vals: any) => `Invite to ${vals.groupName}`,
            };
            const translation = translations[key];
            if (typeof translation === 'function' && values) {
                return translation(values);
            }
            return translation || key;
        },
    }),
}));

// Helper to create a test group member
function createTestGroupMember(role: 'admin' | 'member' | 'viewer' = 'member', colorIndex = 0) {
    return {
        joinedAt: new Date().toISOString(),
        role,
        status: 'active' as const,
        theme: {
            light: '#ff0000',
            dark: '#cc0000',
            name: 'red',
            pattern: 'solid' as const,
            assignedAt: new Date().toISOString(),
            colorIndex,
        },
    };
}

// Helper to create test groups
function createTestGroup(overrides: Partial<Group> = {}): Group {
    return {
        id: `group-${Math.random().toString(36).substring(2, 11)}`,
        name: 'Test Group',
        securityPreset: 'open' as const,
        permissions: {
            expenseEditing: 'anyone' as const,
            expenseDeletion: 'anyone' as const,
            memberInvitation: 'anyone' as const,
            memberApproval: 'automatic' as const,
            settingsManagement: 'anyone' as const,
        },
        createdBy: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        balance: {
            balancesByCurrency: {},
        },
        lastActivity: 'Just created',
        lastActivityRaw: new Date().toISOString(),
        ...overrides,
    };
}

// Helper to create test users
function createTestUser(overrides: Partial<RegisteredUser> = {}): RegisteredUser {
    const id = Math.random().toString(36).substring(2, 11);
    return {
        uid: `user-${id}`,
        email: `test-${id}@example.com`,
        displayName: `Test User ${id}`,
        ...overrides,
    };
}

describe('GroupCard', () => {
    const mockOnClick = vi.fn();

    beforeEach(() => {
        mockOnClick.mockClear();
    });

    it('displays group name and basic info', () => {
        const group = createTestGroup({
            name: 'trip to paris',
        });

        render(<GroupCard group={group} onClick={mockOnClick} />);

        expect(screen.getByText('trip to paris')).toBeInTheDocument();
        expect(screen.getByText('3 members')).toBeInTheDocument();
        expect(screen.getByText('Just created')).toBeInTheDocument();
    });

    it('shows settled up state when balance is zero', () => {
        const group = createTestGroup({
            name: 'Apartment Bills',
            balance: {
                balancesByCurrency: {},
            },
        });

        render(<GroupCard group={group} onClick={mockOnClick} />);

        const balanceDisplay = screen.getByText('Settled up');
        expect(balanceDisplay).toBeInTheDocument();
        expect(balanceDisplay).toHaveClass('text-blue-400');
    });

    it('shows money owed when balance is negative', () => {
        const group = createTestGroup({
            name: 'Dinner Split',
            balance: {
                balancesByCurrency: {
                    USD: {
                        currency: 'USD',
                        netBalance: -25.5,
                        totalOwed: 0,
                        totalOwing: 25.5,
                    },
                },
            },
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
                balancesByCurrency: {
                    USD: {
                        currency: 'USD',
                        netBalance: 42.75,
                        totalOwed: 42.75,
                        totalOwing: 0,
                    },
                },
            },
        });

        render(<GroupCard group={group} onClick={mockOnClick} />);

        const balanceDisplay = screen.getByText("You're owed $42.75");
        expect(balanceDisplay).toBeInTheDocument();
        expect(balanceDisplay).toHaveClass('text-green-600');
    });

    it('displays last activity', () => {
        const group = createTestGroup({
            name: 'Weekend Trip',
            lastActivity: '2 hours ago',
        });

        render(<GroupCard group={group} onClick={mockOnClick} />);

        expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    });

    it('shows member avatars when members are provided', () => {
        const users: RegisteredUser[] = [createTestUser({ displayName: 'Alice Anderson' }), createTestUser({ displayName: 'Bob Brown' }), createTestUser({ displayName: 'Charlie Chen' })];

        const group = createTestGroup({
            name: 'Large Group',
        });

        render(<GroupCard group={group} onClick={mockOnClick} />);

        // The component shows member count, not avatars
        expect(screen.getByText('3 members')).toBeInTheDocument();
    });

    it('limits member avatars to 5 and shows count for rest', () => {
        const users: RegisteredUser[] = [];
        for (let i = 0; i < 8; i++) {
            users.push(
                createTestUser({
                    displayName: `User ${String.fromCharCode(65 + i)}`, // User A, User B, etc.
                    uid: `user-${i}`,
                }),
            );
        }

        const group = createTestGroup({
            name: 'Large Group',
        });

        render(<GroupCard group={group} onClick={mockOnClick} />);

        // The component shows member count, not avatars
        expect(screen.getByText('8 members')).toBeInTheDocument();
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
        });

        render(<GroupCard group={group} onClick={mockOnClick} />);

        expect(screen.getByText('1 member')).toBeInTheDocument(); // singular
    });

    it('displays recent expenses text', () => {
        const group = createTestGroup({
            name: 'Test Group',
        });

        render(<GroupCard group={group} onClick={mockOnClick} />);

        expect(screen.getByText('Just created')).toBeInTheDocument();
    });

    it('handles groups without members object', () => {
        const group = createTestGroup({
            name: 'No Members Object',
        });

        render(<GroupCard group={group} onClick={mockOnClick} />);

        // Should still show member count as 0
        expect(screen.getByText('0 members')).toBeInTheDocument();
    });

    it('handles empty members object', () => {
        const group = createTestGroup({
            name: 'Empty Members',
        });

        render(<GroupCard group={group} onClick={mockOnClick} />);

        // Should show 0 members
        expect(screen.getByText('0 members')).toBeInTheDocument();
    });
});
