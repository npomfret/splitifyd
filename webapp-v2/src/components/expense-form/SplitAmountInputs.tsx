import { Avatar } from '../ui';

interface Member {
  uid: string;
  displayName: string;
}

interface Split {
  userId: string;
  amount: number;
  percentage?: number;
}

interface SplitAmountInputsProps {
  splitType: string;
  amount: string | number;
  participants: string[];
  splits: Split[];
  members: Member[];
  updateSplitAmount: (userId: string, amount: number) => void;
  updateSplitPercentage: (userId: string, percentage: number) => void;
}

export function SplitAmountInputs({
  splitType,
  amount,
  participants,
  splits,
  members,
  updateSplitAmount,
  updateSplitPercentage
}: SplitAmountInputsProps) {
  const memberMap = members.reduce((acc, member) => {
    acc[member.uid] = member;
    return acc;
  }, {} as Record<string, Member>);
  
  const amountValue = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  
  if (amountValue <= 0) {
    return null;
  }
  
  if (splitType === 'exact') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Enter exact amounts for each person:
        </p>
        {participants.map(participantId => {
          const member = memberMap[participantId];
          const split = splits.find(s => s.userId === participantId);
          return (
            <div key={participantId} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Avatar 
                  displayName={member?.displayName || 'Unknown'}
                  userId={participantId}
                  size="sm"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {member?.displayName || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={split?.amount || 0}
                  onInput={(e) => {
                    const value = parseFloat((e.target as HTMLInputElement).value) || 0;
                    updateSplitAmount(participantId, value);
                  }}
                  className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-right"
                />
              </div>
            </div>
          );
        })}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Total:</span>
            <span className={`font-medium ${
              Math.abs(splits.reduce((sum, s) => sum + s.amount, 0) - amountValue) < 0.01
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              ${splits.reduce((sum, s) => sum + s.amount, 0).toFixed(2)} / ${amountValue.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  
  if (splitType === 'percentage') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Enter percentage for each person:
        </p>
        {participants.map(participantId => {
          const member = memberMap[participantId];
          const split = splits.find(s => s.userId === participantId);
          return (
            <div key={participantId} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Avatar 
                  displayName={member?.displayName || 'Unknown'}
                  userId={participantId}
                  size="sm"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {member?.displayName || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={split?.percentage || 0}
                  onInput={(e) => {
                    const value = parseFloat((e.target as HTMLInputElement).value) || 0;
                    updateSplitPercentage(participantId, value);
                  }}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-right"
                />
                <span className="text-gray-500">%</span>
                <span className="text-xs text-gray-500 w-16 text-right">
                  ${split?.amount.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          );
        })}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Total:</span>
            <span className={`font-medium ${
              Math.abs(splits.reduce((sum, s) => sum + (s.percentage || 0), 0) - 100) < 0.01
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {splits.reduce((sum, s) => sum + (s.percentage || 0), 0).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  
  if (splitType === 'equal') {
    return (
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Each person pays:
        </p>
        <div className="space-y-1">
          {splits.map(split => {
            const member = memberMap[split.userId];
            return (
              <div key={split.userId} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar 
                    displayName={member?.displayName || 'Unknown'}
                    userId={split.userId}
                    size="sm"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {member?.displayName || 'Unknown'}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  ${split.amount.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  
  return null;
}