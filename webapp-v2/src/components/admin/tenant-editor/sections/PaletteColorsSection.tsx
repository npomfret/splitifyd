import { AdminFormSection } from '@/components/admin/forms';
import { Button, ColorInput } from '@/components/ui';
import { SparklesIcon } from '@/components/ui/icons';
import { useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { deriveSemanticColorsFromFormData } from '../color-derivation';
import type { TenantData } from '../types';
import type { CreationModeSectionProps } from './types';

const STYLE_OPTIONS: Array<{ value: TenantData['derivationStyle']; labelKey: string; }> = [
    { value: 'balanced', labelKey: 'admin.tenantEditor.derivation.style.balanced' },
    { value: 'bold', labelKey: 'admin.tenantEditor.derivation.style.bold' },
    { value: 'soft', labelKey: 'admin.tenantEditor.derivation.style.soft' },
    { value: 'vibrant', labelKey: 'admin.tenantEditor.derivation.style.vibrant' },
    { value: 'elegant', labelKey: 'admin.tenantEditor.derivation.style.elegant' },
];

interface PaletteColorsSectionProps extends CreationModeSectionProps {
    simplified?: boolean;
}

export function PaletteColorsSection({ formData, update, isSaving, mode, creationMode, simplified = false }: PaletteColorsSectionProps) {
    const { t } = useTranslation();
    const [isDerivationOpen, setIsDerivationOpen] = useState(false);

    const canDeriveColors = Boolean(
        formData.primaryColor && formData.secondaryColor && formData.accentColor,
    );

    const handleDeriveColors = () => {
        const derivedColors = deriveSemanticColorsFromFormData(formData);
        if (Object.keys(derivedColors).length > 0) {
            update(derivedColors);
        }
    };

    if (simplified) {
        return (
            <AdminFormSection
                title={t('admin.tenantEditor.sections.brandColors.title')}
                description={t('admin.tenantEditor.sections.brandColors.description')}
                defaultOpen={true}
                testId='section-palette-basic'
            >
                <div className='space-y-4'>
                    {/* Color Pickers */}
                    <div className='grid grid-cols-3 gap-4'>
                        <ColorInput id='primary-color' label='Primary *' value={formData.primaryColor} onChange={(v) => update({ primaryColor: v })} disabled={isSaving} testId='primary-color-input' />
                        <ColorInput
                            id='secondary-color'
                            label='Secondary *'
                            value={formData.secondaryColor}
                            onChange={(v) => update({ secondaryColor: v })}
                            disabled={isSaving}
                            testId='secondary-color-input'
                        />
                        <ColorInput id='accent-color' label='Accent *' value={formData.accentColor} onChange={(v) => update({ accentColor: v })} disabled={isSaving} testId='accent-color-input' />
                    </div>

                    {/* Derivation Toggle Button */}
                    <div className='border-t border-gray-200 pt-4'>
                        <button
                            type='button'
                            onClick={() => setIsDerivationOpen(!isDerivationOpen)}
                            disabled={!canDeriveColors || isSaving}
                            class={`
                                w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium
                                transition-all duration-200
                                ${
                                canDeriveColors && !isSaving
                                    ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }
                            `}
                        >
                            <span className='flex items-center gap-2'>
                                <SparklesIcon size={18} />
                                <span>{t('admin.tenantEditor.derivationWand.popoverTitle')}</span>
                            </span>
                            <svg
                                class={`w-4 h-4 transition-transform ${isDerivationOpen ? 'rotate-180' : ''}`}
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                            >
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                            </svg>
                        </button>

                        {/* Collapsible Derivation Options */}
                        {isDerivationOpen && canDeriveColors && (
                            <div className='mt-4 p-4 bg-gray-50 rounded-lg space-y-4'>
                                {/* Theme Mode Toggle */}
                                <div>
                                    <label className='block text-xs font-medium text-gray-600 mb-2'>
                                        {t('admin.tenantEditor.derivation.themeMode.label')}
                                    </label>
                                    <div className='inline-flex rounded-md border border-gray-300 overflow-hidden' role='radiogroup'>
                                        {(['light', 'medium', 'dark'] as const).map((themeMode, index) => (
                                            <button
                                                key={themeMode}
                                                type='button'
                                                role='radio'
                                                aria-checked={formData.derivationThemeMode === themeMode}
                                                class={`px-3 py-1.5 text-xs font-medium transition-colors ${index > 0 ? 'border-l border-gray-300' : ''} ${
                                                    formData.derivationThemeMode === themeMode
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                                onClick={() => update({ derivationThemeMode: themeMode })}
                                                disabled={isSaving}
                                                data-testid={`theme-mode-${themeMode}`}
                                            >
                                                {t(`admin.tenantEditor.derivation.themeMode.${themeMode}`)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Style Presets */}
                                <div>
                                    <label className='block text-xs font-medium text-gray-600 mb-2'>
                                        {t('admin.tenantEditor.derivation.style.label')}
                                    </label>
                                    <div className='flex flex-wrap gap-1.5'>
                                        {STYLE_OPTIONS.map(({ value, labelKey }) => (
                                            <button
                                                key={value}
                                                type='button'
                                                class={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                                                    formData.derivationStyle === value
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                                }`}
                                                onClick={() => update({ derivationStyle: value })}
                                                disabled={isSaving}
                                                data-testid={`style-${value}`}
                                            >
                                                {t(labelKey)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Intensity Slider */}
                                <div>
                                    <label className='block text-xs font-medium text-gray-600 mb-2'>
                                        {t('admin.tenantEditor.derivation.intensity.label')}
                                    </label>
                                    <div className='flex items-center gap-2'>
                                        <span className='text-[10px] text-gray-500 w-10'>
                                            {t('admin.tenantEditor.derivation.intensity.subtle')}
                                        </span>
                                        <input
                                            type='range'
                                            min='0'
                                            max='100'
                                            value={formData.derivationIntensity}
                                            onChange={(e) => update({ derivationIntensity: parseInt((e.target as HTMLInputElement).value, 10) })}
                                            disabled={isSaving}
                                            className='flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600'
                                            data-testid='intensity-slider'
                                        />
                                        <span className='text-[10px] text-gray-500 w-10 text-right'>
                                            {t('admin.tenantEditor.derivation.intensity.strong')}
                                        </span>
                                    </div>
                                    <div className='text-center text-[10px] text-gray-500 mt-1'>
                                        {formData.derivationIntensity}%
                                    </div>
                                </div>

                                {/* Apply Button */}
                                <Button
                                    variant='primary'
                                    size='sm'
                                    onClick={handleDeriveColors}
                                    disabled={isSaving}
                                    className='w-full'
                                >
                                    <SparklesIcon size={16} className='mr-2' />
                                    {t('admin.tenantEditor.derivationWand.derive')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </AdminFormSection>
        );
    }

    return (
        <AdminFormSection
            title='Palette Colors'
            description='Core color palette (11 required)'
            defaultOpen={mode === 'create' && creationMode === 'empty'}
            testId='section-palette'
        >
            <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                    <ColorInput id='primary-color' label='Primary *' value={formData.primaryColor} onChange={(v) => update({ primaryColor: v })} disabled={isSaving} testId='primary-color-input' />
                    <ColorInput
                        id='primary-variant'
                        label='Primary Variant *'
                        value={formData.primaryVariantColor}
                        onChange={(v) => update({ primaryVariantColor: v })}
                        disabled={isSaving}
                        testId='primary-variant-color-input'
                    />
                </div>
                <div className='grid grid-cols-2 gap-4'>
                    <ColorInput
                        id='secondary-color'
                        label='Secondary *'
                        value={formData.secondaryColor}
                        onChange={(v) => update({ secondaryColor: v })}
                        disabled={isSaving}
                        testId='secondary-color-input'
                    />
                    <ColorInput
                        id='secondary-variant'
                        label='Secondary Variant *'
                        value={formData.secondaryVariantColor}
                        onChange={(v) => update({ secondaryVariantColor: v })}
                        disabled={isSaving}
                        testId='secondary-variant-color-input'
                    />
                </div>
                <ColorInput id='accent-color' label='Accent *' value={formData.accentColor} onChange={(v) => update({ accentColor: v })} disabled={isSaving} testId='accent-color-input' />
                <div className='grid grid-cols-2 gap-4'>
                    <ColorInput id='neutral-color' label='Neutral *' value={formData.neutralColor} onChange={(v) => update({ neutralColor: v })} disabled={isSaving} testId='neutral-color-input' />
                    <ColorInput
                        id='neutral-variant'
                        label='Neutral Variant *'
                        value={formData.neutralVariantColor}
                        onChange={(v) => update({ neutralVariantColor: v })}
                        disabled={isSaving}
                        testId='neutral-variant-color-input'
                    />
                </div>
                <div className='grid grid-cols-2 gap-4'>
                    <ColorInput id='success-color' label='Success *' value={formData.successColor} onChange={(v) => update({ successColor: v })} disabled={isSaving} testId='success-color-input' />
                    <ColorInput id='warning-color' label='Warning *' value={formData.warningColor} onChange={(v) => update({ warningColor: v })} disabled={isSaving} testId='warning-color-input' />
                    <ColorInput id='danger-color' label='Danger *' value={formData.dangerColor} onChange={(v) => update({ dangerColor: v })} disabled={isSaving} testId='danger-color-input' />
                    <ColorInput id='info-color' label='Info *' value={formData.infoColor} onChange={(v) => update({ infoColor: v })} disabled={isSaving} testId='info-color-input' />
                </div>
            </div>
        </AdminFormSection>
    );
}
