import { AdminFormInput, AdminFormSection, SubsectionHeader } from '@/components/admin/forms';
import type { SectionProps } from './types';

interface SizeSelectProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
    options: string[];
}

function SizeSelect({ label, value, onChange, disabled, options }: SizeSelectProps) {
    return (
        <div>
            <label className='block text-xs font-medium text-text-secondary mb-1'>{label} *</label>
            <select
                value={value}
                onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
                disabled={disabled}
                className='w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm'
            >
                {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );
}

const BODY_SIZE_OPTIONS = ['xs', 'sm', 'md', 'lg', 'xl'];
const HEADING_SIZE_OPTIONS = ['xl', '2xl', '3xl', '4xl', '5xl'];
const DISPLAY_SIZE_OPTIONS = ['2xl', '3xl', '4xl', '5xl'];

export function TypographySection({ formData, update, isSaving }: SectionProps) {
    return (
        <AdminFormSection title='Typography' description='Font families, sizes, weights, and more' testId='section-typography'>
            <div className='space-y-4'>
                <SubsectionHeader title='Font Families' />
                <div className='grid grid-cols-3 gap-4'>
                    <AdminFormInput
                        label='Sans'
                        value={formData.fontFamilySans}
                        onChange={(v) => update({ fontFamilySans: v })}
                        placeholder='Inter, system-ui'
                        disabled={isSaving}
                        required
                        id='font-family-sans'
                    />
                    <AdminFormInput
                        label='Serif'
                        value={formData.fontFamilySerif}
                        onChange={(v) => update({ fontFamilySerif: v })}
                        placeholder='Georgia, serif'
                        disabled={isSaving}
                        id='font-family-serif'
                    />
                    <AdminFormInput
                        label='Mono'
                        value={formData.fontFamilyMono}
                        onChange={(v) => update({ fontFamilyMono: v })}
                        placeholder='Monaco, monospace'
                        disabled={isSaving}
                        required
                        id='font-family-mono'
                    />
                </div>

                <SubsectionHeader title='Sizes (rem)' />
                <div className='grid grid-cols-5 gap-4'>
                    <AdminFormInput label='XS' value={formData.typographySizeXs} onChange={(v) => update({ typographySizeXs: v })} placeholder='0.75rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='SM' value={formData.typographySizeSm} onChange={(v) => update({ typographySizeSm: v })} placeholder='0.875rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='MD' value={formData.typographySizeMd} onChange={(v) => update({ typographySizeMd: v })} placeholder='1rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='LG' value={formData.typographySizeLg} onChange={(v) => update({ typographySizeLg: v })} placeholder='1.125rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='XL' value={formData.typographySizeXl} onChange={(v) => update({ typographySizeXl: v })} placeholder='1.25rem' disabled={isSaving} monospace required />
                </div>
                <div className='grid grid-cols-4 gap-4'>
                    <AdminFormInput label='2XL' value={formData.typographySize2xl} onChange={(v) => update({ typographySize2xl: v })} placeholder='1.5rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='3XL' value={formData.typographySize3xl} onChange={(v) => update({ typographySize3xl: v })} placeholder='1.875rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='4XL' value={formData.typographySize4xl} onChange={(v) => update({ typographySize4xl: v })} placeholder='2.25rem' disabled={isSaving} monospace required />
                    <AdminFormInput label='5XL' value={formData.typographySize5xl} onChange={(v) => update({ typographySize5xl: v })} placeholder='3rem' disabled={isSaving} monospace required />
                </div>

                <SubsectionHeader title='Weights' />
                <div className='grid grid-cols-4 gap-4'>
                    <AdminFormInput
                        label='Regular'
                        type='number'
                        value={formData.fontWeightRegular}
                        onChange={(v) => update({ fontWeightRegular: parseInt(v) || 0 })}
                        placeholder='400'
                        disabled={isSaving}
                        required
                    />
                    <AdminFormInput
                        label='Medium'
                        type='number'
                        value={formData.fontWeightMedium}
                        onChange={(v) => update({ fontWeightMedium: parseInt(v) || 0 })}
                        placeholder='500'
                        disabled={isSaving}
                        required
                    />
                    <AdminFormInput
                        label='Semibold'
                        type='number'
                        value={formData.fontWeightSemibold}
                        onChange={(v) => update({ fontWeightSemibold: parseInt(v) || 0 })}
                        placeholder='600'
                        disabled={isSaving}
                        required
                    />
                    <AdminFormInput
                        label='Bold'
                        type='number'
                        value={formData.fontWeightBold}
                        onChange={(v) => update({ fontWeightBold: parseInt(v) || 0 })}
                        placeholder='700'
                        disabled={isSaving}
                        required
                    />
                </div>

                <SubsectionHeader title='Line Heights' />
                <div className='grid grid-cols-3 gap-4'>
                    <AdminFormInput
                        label='Compact'
                        value={formData.lineHeightCompact}
                        onChange={(v) => update({ lineHeightCompact: v })}
                        placeholder='1.25rem'
                        disabled={isSaving}
                        monospace
                        required
                    />
                    <AdminFormInput
                        label='Standard'
                        value={formData.lineHeightStandard}
                        onChange={(v) => update({ lineHeightStandard: v })}
                        placeholder='1.5rem'
                        disabled={isSaving}
                        monospace
                        required
                    />
                    <AdminFormInput
                        label='Spacious'
                        value={formData.lineHeightSpacious}
                        onChange={(v) => update({ lineHeightSpacious: v })}
                        placeholder='1.75rem'
                        disabled={isSaving}
                        monospace
                        required
                    />
                </div>

                <SubsectionHeader title='Letter Spacing' />
                <div className='grid grid-cols-3 gap-4'>
                    <AdminFormInput
                        label='Tight'
                        value={formData.letterSpacingTight}
                        onChange={(v) => update({ letterSpacingTight: v })}
                        placeholder='-0.02rem'
                        disabled={isSaving}
                        monospace
                        required
                    />
                    <AdminFormInput
                        label='Normal'
                        value={formData.letterSpacingNormal}
                        onChange={(v) => update({ letterSpacingNormal: v })}
                        placeholder='0rem'
                        disabled={isSaving}
                        monospace
                        required
                    />
                    <AdminFormInput label='Wide' value={formData.letterSpacingWide} onChange={(v) => update({ letterSpacingWide: v })} placeholder='0.02rem' disabled={isSaving} monospace required />
                </div>

                <SubsectionHeader title='Semantic Sizes' />
                <div className='grid grid-cols-4 gap-4'>
                    <SizeSelect label='Body' value={formData.typographySemanticBody} onChange={(v) => update({ typographySemanticBody: v })} disabled={isSaving} options={BODY_SIZE_OPTIONS} />
                    <SizeSelect
                        label='Body Strong'
                        value={formData.typographySemanticBodyStrong}
                        onChange={(v) => update({ typographySemanticBodyStrong: v })}
                        disabled={isSaving}
                        options={BODY_SIZE_OPTIONS}
                    />
                    <SizeSelect label='Caption' value={formData.typographySemanticCaption} onChange={(v) => update({ typographySemanticCaption: v })} disabled={isSaving} options={BODY_SIZE_OPTIONS} />
                    <SizeSelect label='Button' value={formData.typographySemanticButton} onChange={(v) => update({ typographySemanticButton: v })} disabled={isSaving} options={BODY_SIZE_OPTIONS} />
                </div>
                <div className='grid grid-cols-3 gap-4'>
                    <SizeSelect label='Eyebrow' value={formData.typographySemanticEyebrow} onChange={(v) => update({ typographySemanticEyebrow: v })} disabled={isSaving} options={BODY_SIZE_OPTIONS} />
                    <SizeSelect
                        label='Heading'
                        value={formData.typographySemanticHeading}
                        onChange={(v) => update({ typographySemanticHeading: v })}
                        disabled={isSaving}
                        options={HEADING_SIZE_OPTIONS}
                    />
                    <SizeSelect
                        label='Display'
                        value={formData.typographySemanticDisplay}
                        onChange={(v) => update({ typographySemanticDisplay: v })}
                        disabled={isSaving}
                        options={DISPLAY_SIZE_OPTIONS}
                    />
                </div>
            </div>
        </AdminFormSection>
    );
}
