import { useTranslation } from 'react-i18next';

type EditorMode = 'basic' | 'advanced';

interface ModeToggleProps {
    mode: EditorMode;
    onChange: (mode: EditorMode) => void;
    disabled?: boolean;
    testId?: string;
}

export function ModeToggle({ mode, onChange, disabled = false, testId }: ModeToggleProps) {
    const { t } = useTranslation();

    const baseButtonClass = 'px-4 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary';
    const activeClass = 'bg-interactive-primary text-interactive-primary-foreground';
    const inactiveClass = 'text-text-secondary hover:text-text-primary';

    return (
        <div
            class='inline-flex rounded-lg bg-surface-muted p-1'
            role='radiogroup'
            aria-label={t('admin.tenantEditor.modeToggle.label')}
            data-testid={testId}
        >
            <button
                type='button'
                role='radio'
                aria-checked={mode === 'basic'}
                onClick={() => onChange('basic')}
                disabled={disabled}
                class={`${baseButtonClass} ${mode === 'basic' ? activeClass : inactiveClass}`}
                data-testid='mode-toggle-basic'
            >
                {t('admin.tenantEditor.modeToggle.basic')}
            </button>
            <button
                type='button'
                role='radio'
                aria-checked={mode === 'advanced'}
                onClick={() => onChange('advanced')}
                disabled={disabled}
                class={`${baseButtonClass} ${mode === 'advanced' ? activeClass : inactiveClass}`}
                data-testid='mode-toggle-advanced'
            >
                {t('admin.tenantEditor.modeToggle.advanced')}
            </button>
        </div>
    );
}
