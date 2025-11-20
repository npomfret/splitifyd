import { GroupCard } from '@/components/dashboard/GroupCard';
import {toCurrencyISOCode, type GroupDTO } from '@billsplit-wl/shared';
import { GroupDTOBuilder } from '@billsplit-wl/test-support';
import { render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options: Record<string, string> = {}) => {
            switch (key) {
                case 'groupCard.settledUp':
                    return 'Settled up';
                case 'groupCard.noRecentActivity':
                    return 'No recent activity';
                case 'dashboard.groupCard.youAreOwed':
                    return `You're owed ${options.amount ?? ''}`;
                case 'dashboard.groupCard.youOwe':
                    return `You owe ${options.amount ?? ''}`;
                case 'groupCard.addExpenseTooltip':
                    return `Add expense to ${options.groupName ?? ''}`;
                case 'groupCard.inviteTooltip':
                    return `Invite members to ${options.groupName ?? ''}`;
                case 'dashboard.groupCard.archivedBadge':
                    return 'Archived';
                default:
                    return key;
            }
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

const buildBaseGroup = (): GroupDTO =>
    new GroupDTOBuilder()
        .withId('group-1')
        .withName('Housemates')
        .withDescription('Monthly expenses')
        .withCreatedBy('user-1')
        .withCreatedAt('2024-01-01T00:00:00.000Z')
        .withUpdatedAt('2024-01-01T00:00:00.000Z')
        .withPermissions({
            expenseEditing: 'anyone',
            expenseDeletion: 'admin-only',
            memberInvitation: 'anyone',
            memberApproval: 'automatic',
            settingsManagement: 'admin-only',
        })
        .withDeletedAt(null)
        .withBalance({})
        .withLastActivity('2 days ago')
        .build();

const renderGroupCard = (groupOverrides: Partial<GroupDTO>, extraProps: Partial<Parameters<typeof GroupCard>[0]> = {}) => {
    const baseGroup = buildBaseGroup();
    const group: GroupDTO = {
        ...baseGroup,
        ...groupOverrides,
    };

    return render(
        <GroupCard
            group={group}
            onClick={() => {}}
            {...extraProps}
        />,
    );
};

describe('GroupCard', () => {
    it('shows settled message when no balances are present', () => {
        const { container } = renderGroupCard({
            balance: {
                balancesByCurrency: {
                    USD: {
                        currency: toCurrencyISOCode('USD'),
                        netBalance: '0',
                        totalOwed: '0',
                        totalOwing: '0',
                    },
                },
            },
        });

        expect(screen.getByText('Settled up')).toBeInTheDocument();
        const badges = container.querySelectorAll('[data-financial-amount="balance"]');
        expect(badges).toHaveLength(1);
        expect(badges[0]).toHaveTextContent('Settled up');
    });

    it('renders all non-zero balances across currencies', () => {
        const { container } = renderGroupCard({
            balance: {
                balancesByCurrency: {
                    USD: {
                        currency: toCurrencyISOCode('USD'),
                        netBalance: '50',
                        totalOwed: '50',
                        totalOwing: '0',
                    },
                    CAD: {
                        currency: toCurrencyISOCode('CAD'),
                        netBalance: '-75',
                        totalOwed: '0',
                        totalOwing: '75',
                    },
                },
            },
        });

        const badges = Array.from(container.querySelectorAll('[data-financial-amount="balance"]'));
        expect(badges).toHaveLength(2);
        expect(badges[0]).toHaveTextContent('You\'re owed $50.00 USD');
        expect(badges[1]).toHaveTextContent('You owe $75.00 CAD');
    });

    it('prioritises positive balances before negative balances', () => {
        const { container } = renderGroupCard({
            balance: {
                balancesByCurrency: {
                    EUR: {
                        currency: toCurrencyISOCode('EUR'),
                        netBalance: '-10',
                        totalOwed: '0',
                        totalOwing: '10',
                    },
                    GBP: {
                        currency: toCurrencyISOCode('GBP'),
                        netBalance: '25',
                        totalOwed: '25',
                        totalOwing: '0',
                    },
                },
            },
        });

        const badges = Array.from(container.querySelectorAll('[data-financial-amount="balance"]'));
        expect(badges).toHaveLength(2);
        expect(badges[0]).toHaveTextContent('You\'re owed £25.00 GBP');
        expect(badges[1]).toHaveTextContent('You owe €10.00 EUR');
    });

    it('renders archived badge in archived view', () => {
        renderGroupCard({}, { isArchivedView: true });

        expect(screen.getByText('Archived')).toBeInTheDocument();
    });
});
