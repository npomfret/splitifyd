import { AdminFormSection } from '@/components/admin/forms';
import { Button, ColorInput } from '@/components/ui';
import { useTranslation } from 'react-i18next';
import { deriveSemanticColorsFromFormData } from '../color-derivation';
import type { TenantData } from '../types';
import type { CreationModeSectionProps } from './types';

interface PaletteColorsSectionProps extends CreationModeSectionProps {
    simplified?: boolean;
}

const STYLE_OPTIONS: Array<{ value: TenantData['derivationStyle']; labelKey: string; }> = [
    { value: 'balanced', labelKey: 'admin.tenantEditor.derivation.style.balanced' },
    { value: 'bold', labelKey: 'admin.tenantEditor.derivation.style.bold' },
    { value: 'soft', labelKey: 'admin.tenantEditor.derivation.style.soft' },
    { value: 'vibrant', labelKey: 'admin.tenantEditor.derivation.style.vibrant' },
    { value: 'elegant', labelKey: 'admin.tenantEditor.derivation.style.elegant' },
];

export function PaletteColorsSection({ formData, update, isSaving, mode, creationMode, simplified = false }: PaletteColorsSectionProps) {
    const { t } = useTranslation();

    const handleDeriveColors = () => {
        const derivedColors = deriveSemanticColorsFromFormData(formData);
        if (Object.keys(derivedColors).length > 0) {
            update(derivedColors);
        }
    };

    const canDeriveColors = Boolean(
        formData.primaryColor
            && formData.secondaryColor
            && formData.accentColor,
    );

    if (simplified) {
        return (
            <AdminFormSection
                title={t('admin.tenantEditor.sections.brandColors.title')}
                description={t('admin.tenantEditor.sections.brandColors.description')}
                defaultOpen={true}
                testId='section-palette-basic'
            >
                <div class='space-y-5'>
                    {/* Color Pickers */}
                    <div class='grid grid-cols-3 gap-4'>
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

                    {/* Derivation Options */}
                    <div class='border-t border-admin-border pt-4 space-y-4'>
                        {/* Theme Mode Toggle */}
                        <div>
                            <label class='block text-sm font-medium text-admin-text-secondary mb-2'>
                                {t('admin.tenantEditor.derivation.themeMode.label')}
                            </label>
                            <div class='inline-flex rounded-md border border-gray-300 overflow-hidden' role='radiogroup'>
                                <button
                                    type='button'
                                    role='radio'
                                    aria-checked={formData.derivationThemeMode === 'light'}
                                    class={`px-4 py-2 text-sm font-medium transition-colors ${
                                        formData.derivationThemeMode === 'light'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                    }`}
                                    onClick={() => update({ derivationThemeMode: 'light' })}
                                    disabled={isSaving}
                                    data-testid='theme-mode-light'
                                >
                                    {t('admin.tenantEditor.derivation.themeMode.light')}
                                </button>
                                <button
                                    type='button'
                                    role='radio'
                                    aria-checked={formData.derivationThemeMode === 'medium'}
                                    class={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                                        formData.derivationThemeMode === 'medium'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                    }`}
                                    onClick={() => update({ derivationThemeMode: 'medium' })}
                                    disabled={isSaving}
                                    data-testid='theme-mode-medium'
                                >
                                    {t('admin.tenantEditor.derivation.themeMode.medium')}
                                </button>
                                <button
                                    type='button'
                                    role='radio'
                                    aria-checked={formData.derivationThemeMode === 'dark'}
                                    class={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                                        formData.derivationThemeMode === 'dark'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                    }`}
                                    onClick={() => update({ derivationThemeMode: 'dark' })}
                                    disabled={isSaving}
                                    data-testid='theme-mode-dark'
                                >
                                    {t('admin.tenantEditor.derivation.themeMode.dark')}
                                </button>
                            </div>
                        </div>

                        {/* Style Presets */}
                        <div>
                            <label class='block text-sm font-medium text-admin-text-secondary mb-2'>
                                {t('admin.tenantEditor.derivation.style.label')}
                            </label>
                            <div class='flex flex-wrap gap-2'>
                                {STYLE_OPTIONS.map(({ value, labelKey }) => (
                                    <button
                                        key={value}
                                        type='button'
                                        class={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                                            formData.derivationStyle === value
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                            <label class='block text-sm font-medium text-admin-text-secondary mb-2'>
                                {t('admin.tenantEditor.derivation.intensity.label')}
                            </label>
                            <div class='flex items-center gap-3'>
                                <span class='text-xs text-admin-text-muted w-12'>
                                    {t('admin.tenantEditor.derivation.intensity.subtle')}
                                </span>
                                <input
                                    type='range'
                                    min='0'
                                    max='100'
                                    value={formData.derivationIntensity}
                                    onChange={(e) => update({ derivationIntensity: parseInt((e.target as HTMLInputElement).value, 10) })}
                                    disabled={isSaving}
                                    class='flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-admin-primary'
                                    data-testid='intensity-slider'
                                />
                                <span class='text-xs text-admin-text-muted w-12 text-right'>
                                    {t('admin.tenantEditor.derivation.intensity.strong')}
                                </span>
                            </div>
                            <div class='text-center text-xs text-admin-text-muted mt-1'>
                                {formData.derivationIntensity}%
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div class='flex items-center justify-between pt-2 border-t border-admin-border'>
                        <p class='text-xs text-text-muted'>
                            {t('admin.tenantEditor.modeHint.moreColors')}
                        </p>
                        <Button
                            variant='secondary'
                            size='sm'
                            onClick={handleDeriveColors}
                            disabled={isSaving || !canDeriveColors}
                            data-testid='derive-colors-button'
                        >
                            {t('admin.tenantEditor.actions.deriveColors')}
                        </Button>
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
            <div class='space-y-4'>
                <div class='grid grid-cols-2 gap-4'>
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
                <div class='grid grid-cols-2 gap-4'>
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
                <div class='grid grid-cols-2 gap-4'>
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
                <div class='grid grid-cols-2 gap-4'>
                    <ColorInput id='success-color' label='Success *' value={formData.successColor} onChange={(v) => update({ successColor: v })} disabled={isSaving} testId='success-color-input' />
                    <ColorInput id='warning-color' label='Warning *' value={formData.warningColor} onChange={(v) => update({ warningColor: v })} disabled={isSaving} testId='warning-color-input' />
                    <ColorInput id='danger-color' label='Danger *' value={formData.dangerColor} onChange={(v) => update({ dangerColor: v })} disabled={isSaving} testId='danger-color-input' />
                    <ColorInput id='info-color' label='Info *' value={formData.infoColor} onChange={(v) => update({ infoColor: v })} disabled={isSaving} testId='info-color-input' />
                </div>
            </div>
        </AdminFormSection>
    );
}
