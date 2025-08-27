import { Card, Avatar } from '../ui';
import { Stack } from '../ui/Stack';

interface Member {
    uid: string;
    displayName: string;
}

interface PayerSelectorProps {
    members: Member[];
    paidBy: string;
    validationErrors: any;
    updateField: (field: string, value: any) => void;
}

export function PayerSelector({ members, paidBy, validationErrors, updateField }: PayerSelectorProps) {
    return (
        <Card>
            <Stack spacing="md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Who paid? <span className="text-red-500">*</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {members.map((member) => (
                        <label
                            key={member.uid}
                            className={`
                flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors
                ${paidBy === member.uid ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}
              `}
                        >
                            <input
                                type="radio"
                                name="paidBy"
                                value={member.uid}
                                checked={paidBy === member.uid}
                                onChange={() => updateField('paidBy', member.uid)}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <Avatar displayName={member.displayName} userId={member.uid} size="sm" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{member.displayName}</span>
                        </label>
                    ))}
                </div>
                {validationErrors.paidBy && <p className="text-sm text-red-600 dark:text-red-400" role="alert" data-testid="validation-error-paidBy">{validationErrors.paidBy}</p>}
            </Stack>
        </Card>
    );
}
