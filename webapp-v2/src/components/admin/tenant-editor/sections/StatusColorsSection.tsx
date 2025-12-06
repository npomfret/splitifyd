import { AdminFormSection } from '@/components/admin/forms';
import { ColorInput } from '@/components/ui';
import type { SectionProps } from './types';

export function StatusColorsSection({ formData, update, isSaving }: SectionProps) {
    return (
        <AdminFormSection title='Status Colors' description='Semantic status colors (4 required)' testId='section-status-colors'>
            <div class='grid grid-cols-2 gap-4'>
                <ColorInput
                    id='status-success'
                    label='Success *'
                    value={formData.statusSuccessColor}
                    onChange={(v) => update({ statusSuccessColor: v })}
                    disabled={isSaving}
                    testId='status-success-color-input'
                />
                <ColorInput
                    id='status-warning'
                    label='Warning *'
                    value={formData.statusWarningColor}
                    onChange={(v) => update({ statusWarningColor: v })}
                    disabled={isSaving}
                    testId='status-warning-color-input'
                />
                <ColorInput
                    id='status-danger'
                    label='Danger *'
                    value={formData.statusDangerColor}
                    onChange={(v) => update({ statusDangerColor: v })}
                    disabled={isSaving}
                    testId='status-danger-color-input'
                />
                <ColorInput id='status-info' label='Info *' value={formData.statusInfoColor} onChange={(v) => update({ statusInfoColor: v })} disabled={isSaving} testId='status-info-color-input' />
            </div>
        </AdminFormSection>
    );
}
