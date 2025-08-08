import type { Group } from '@shared/types/webapp-shared-types';
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

  const balanceInfo = getBalanceDisplay(group.balance.userBalance?.netBalance || 0);

  return (
    <Card 
      onClick={onClick}
      className="hover:shadow-md transition-shadow cursor-pointer border-gray-200"
      padding="md"
    >
      <div class="flex items-center justify-between">
        {/* Left side - Group info */}
        <div class="flex-1">
          <div class="flex items-start justify-between">
            <div>
              <h4 class="font-semibold text-gray-900 text-lg mb-1">
                {group.name}
              </h4>
              <div class="flex items-center text-sm text-gray-600 space-x-4">
                <span class="flex items-center">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {group.memberIds.length} member{group.memberIds.length !== 1 ? 's' : ''}
                </span>
                <span class="flex items-center">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Recent expenses
                </span>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div class="mt-3">
            <p class="text-sm text-gray-500">
              Last activity: {group.lastActivity}
            </p>
          </div>
        </div>

        {/* Right side - Balance info */}
        <div class="ml-6 text-right">
          <div class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${balanceInfo.bgColor} ${balanceInfo.color}`}>
            {balanceInfo.text}
          </div>
        </div>
      </div>

      {/* Member count */}
      <div class="flex items-center mt-4 pt-4 border-t border-gray-100">
        <span class="text-sm text-gray-600">
          {group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'}
        </span>
      </div>
    </Card>
  );
}