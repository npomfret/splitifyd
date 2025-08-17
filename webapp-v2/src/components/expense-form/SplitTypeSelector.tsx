import { Card } from '../ui';
import { Stack } from '../ui/Stack';

interface SplitTypeSelectorProps {
    splitType: string;
    updateField: (field: string, value: any) => void;
}

export function SplitTypeSelector({ splitType, updateField }: SplitTypeSelectorProps) {
    return (
        <Card>
            <Stack spacing="md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">How to split</h2>
                <div className="grid grid-cols-3 gap-3">
                    <label
                        className={`
            flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-center
            ${splitType === 'equal' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}
          `}
                    >
                        <input type="radio" name="splitType" value="equal" checked={splitType === 'equal'} onChange={() => updateField('splitType', 'equal')} className="sr-only" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Equal</span>
                    </label>

                    <label
                        className={`
            flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-center
            ${splitType === 'exact' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}
          `}
                    >
                        <input type="radio" name="splitType" value="exact" checked={splitType === 'exact'} onChange={() => updateField('splitType', 'exact')} className="sr-only" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Exact amounts</span>
                    </label>

                    <label
                        className={`
            flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-center
            ${splitType === 'percentage' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}
          `}
                    >
                        <input type="radio" name="splitType" value="percentage" checked={splitType === 'percentage'} onChange={() => updateField('splitType', 'percentage')} className="sr-only" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Percentage</span>
                    </label>
                </div>
            </Stack>
        </Card>
    );
}
