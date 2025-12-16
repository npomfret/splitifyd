import { translatePreset, translatePresetActiveBadge } from '@/app/i18n/dynamic-translations';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui';

type ManagedPreset = 'open' | 'managed';

interface PermissionPresetsSectionProps {
    selectedPreset: ManagedPreset | 'custom';
    presetKeys: ManagedPreset[];
    onApplyPreset: (preset: ManagedPreset) => void;
}

export function PermissionPresetsSection({
    selectedPreset,
    presetKeys,
    onApplyPreset,
}: PermissionPresetsSectionProps) {
    const { t } = useTranslation();

    return (
        <section>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3 items-start'>
                {presetKeys.map((preset) => {
                    const isActive = selectedPreset === preset;
                    return (
                        <Button
                            key={preset}
                            type='button'
                            onClick={() => onApplyPreset(preset)}
                            variant='ghost'
                            magnetic={false}
                            aria-pressed={isActive}
                            className={`h-full flex-col items-start border rounded-lg px-4 py-3 text-start transition ${
                                isActive
                                    ? 'border-interactive-primary bg-interactive-primary/10 shadow-sm'
                                    : 'border-border-default hover:border-interactive-primary/40 hover:bg-interactive-primary/10/40'
                            }`}
                        >
                            <span className='font-medium text-text-primary'>{translatePreset(preset, 'label', t)}</span>
                            <p className='text-sm text-text-primary/70 mt-1'>{translatePreset(preset, 'description', t)}</p>
                            {isActive && <span className='text-xs text-interactive-primary font-medium mt-2 block'>{translatePresetActiveBadge(t)}</span>}
                        </Button>
                    );
                })}
            </div>
        </section>
    );
}
