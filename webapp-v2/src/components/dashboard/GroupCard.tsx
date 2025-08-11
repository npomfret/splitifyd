import type { Group } from '@shared/shared-types';
import { Card } from '../ui';

interface GroupCardProps {
  group: Group;
  onClick: () => void;
}

export function GroupCard({ group, onClick }: GroupCardProps) {
  // Determine balance color and text
  const getBalanceDisplay = (balance: number) => {
    const absBalance = Math.abs(balance);
    const formattedBalance = absBalance.toFixed(2);
    
    if (balance === 0) {
      return {
        text: 'Settled up',
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      };
    } else if (balance > 0) {
      return {
        text: `You're owed $${formattedBalance}`,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      };
    } else {
      return {
        text: `You owe $${formattedBalance}`,
        color: 'text-red-600',
        bgColor: 'bg-red-50'
      };
    }
  };

  const balanceInfo = getBalanceDisplay(group.balance?.userBalance?.netBalance || 0);

  return (
    <Card 
      onClick={onClick}
      className="hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer border-gray-200 h-full flex flex-col"
      padding="md"
    >
      <div class="flex-1">
        {/* Group header */}
        <div class="mb-3">
          <h4 class="font-semibold text-gray-900 text-lg mb-1">
            {group.name}
          </h4>
          <div class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${balanceInfo.bgColor} ${balanceInfo.color}`}>
            {balanceInfo.text}
          </div>
        </div>

        {/* Group stats */}
        <div class="space-y-2 text-sm text-gray-600">
          <div class="flex items-center">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {group.memberIds.length} member{group.memberIds.length !== 1 ? 's' : ''}
          </div>
          <div class="flex items-center">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {group.lastActivity || 'No recent activity'}
          </div>
        </div>
      </div>
    </Card>
  );
}