import { AdminFormSection } from '@/components/admin/forms';
import { ColorInput } from '@/components/ui';
import type { SectionProps } from './types';

export function AuroraGradientSection({ formData, update, isSaving }: SectionProps) {
    if (!formData.enableParallax) {
        return null;
    }

    return (
        <AdminFormSection title='Aurora Gradient' description='2-4 colors for the aurora animation' testId='section-aurora-gradient' defaultOpen={true}>
            <div className='grid grid-cols-2 gap-4'>
                {[0, 1, 2, 3].map((i) => (
                    <ColorInput
                        key={i}
                        id={`aurora-${i}`}
                        label={`Color ${i + 1}${i < 2 ? ' *' : ''}`}
                        value={formData.auroraGradient[i] || ''}
                        onChange={(v) => {
                            const newGradient = [...formData.auroraGradient];
                            newGradient[i] = v;
                            update({ auroraGradient: newGradient });
                        }}
                        disabled={isSaving}
                        testId={`aurora-gradient-color-${i + 1}-input`}
                    />
                ))}
            </div>
        </AdminFormSection>
    );
}
