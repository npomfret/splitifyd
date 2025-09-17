import { Card, Avatar, Button } from '../ui';
import { Stack } from '../ui/Stack';

interface Member {
    uid: string;
    displayName: string;
}

interface ParticipantSelectorProps {
    members: Member[];
    participants: string[];
    paidBy: string;
    validationErrors: any;
    handleParticipantToggle: (memberId: string) => void;
    handleSelectAll: () => void;
    handleSelectNone: () => void;
}

export function ParticipantSelector({ members, participants, paidBy, validationErrors, handleParticipantToggle, handleSelectAll, handleSelectNone }: ParticipantSelectorProps) {
    return (
        <Card>
            <Stack spacing="md">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Split between{' '}
                        <span className="text-red-500" data-testid="required-indicator">
                            *
                        </span>
                    </h2>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll}>
                            Select all
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleSelectNone}>
                            Select none
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" data-testid="participant-selector-grid">
                    {members.map((member) => {
                        const isSelected = participants.includes(member.uid);
                        const isPayer = paidBy === member.uid;
                        return (
                            <label
                                key={member.uid}
                                className={`
                  flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}
                  ${isPayer ? 'ring-2 ring-green-500' : ''}
                `}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleParticipantToggle(member.uid)}
                                    disabled={isPayer}
                                    className="text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                />
                                <Avatar displayName={member.displayName} userId={member.uid} size="sm" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                                    {member.displayName}
                                    {isPayer && <span className="text-green-600 dark:text-green-400 ml-1">(Payer)</span>}
                                </span>
                            </label>
                        );
                    })}
                </div>
                {validationErrors.participants && (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert" data-testid="validation-error-participants">
                        {validationErrors.participants}
                    </p>
                )}
            </Stack>
        </Card>
    );
}
