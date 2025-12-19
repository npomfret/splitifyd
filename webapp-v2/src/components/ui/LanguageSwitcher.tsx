import { apiClient } from '@/app/apiClient';
import { useClickOutside } from '@/app/hooks/useClickOutside';
import { changeLanguage } from '@/i18n';
import { logError } from '@/utils/browser-logger';
import { cx } from '@/utils/cx';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/utils/languageDetection';
import { useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from './icons';
import { Select } from './Select';

interface LanguageSwitcherProps {
    variant?: 'compact' | 'full';
    className?: string;
}

/**
 * Language switcher component with two variants:
 * - compact: Small dropdown button for header use
 * - full: Full Select component with label for settings page
 */
export function LanguageSwitcher({ variant = 'compact', className }: LanguageSwitcherProps) {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language as SupportedLanguage;

    if (variant === 'full') {
        return <LanguageSwitcherFull currentLanguage={currentLanguage} className={className} />;
    }

    return <LanguageSwitcherCompact currentLanguage={currentLanguage} className={className} />;
}

interface LanguageSwitcherVariantProps {
    currentLanguage: SupportedLanguage;
    className?: string;
}

function LanguageSwitcherCompact({ currentLanguage, className }: LanguageSwitcherVariantProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useClickOutside(menuRef, () => setIsOpen(false), { enabled: isOpen });

    const handleLanguageChange = async (lng: SupportedLanguage) => {
        setIsOpen(false);
        await changeLanguage(lng);
    };

    return (
        <div className={cx('relative', className)} ref={menuRef}>
            <button
                type='button'
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className='flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-default/60 hover:border-interactive-primary/50 hover:bg-surface-raised transition-all duration-200 text-sm font-medium text-text-primary'
                aria-label={t('languageSelector.label')}
                aria-expanded={isOpen}
                aria-haspopup='listbox'
            >
                <span className='uppercase'>{currentLanguage}</span>
                <ChevronDownIcon
                    size={14}
                    className={cx('text-text-muted transition-transform duration-200', isOpen && 'rotate-180')}
                />
            </button>

            {isOpen && (
                <div
                    className='absolute end-0 mt-2 w-40 bg-surface-popover border border-border-default rounded-lg shadow-xl z-50'
                    role='listbox'
                    aria-label={t('languageSelector.label')}
                >
                    {SUPPORTED_LANGUAGES.map((lng) => (
                        <button
                            key={lng}
                            type='button'
                            onClick={() => handleLanguageChange(lng)}
                            className={cx(
                                'flex items-center justify-between w-full px-4 py-2.5 text-sm text-start transition-colors first:rounded-t-lg last:rounded-b-lg',
                                lng === currentLanguage
                                    ? 'bg-interactive-primary/10 text-interactive-primary font-medium'
                                    : 'text-text-primary hover:bg-interactive-primary/5 hover:text-interactive-primary',
                            )}
                            role='option'
                            aria-selected={lng === currentLanguage}
                        >
                            <span>{LANGUAGE_NAMES[lng]}</span>
                            {lng === currentLanguage && <span className='text-interactive-primary'>✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function LanguageSwitcherFull({ currentLanguage, className }: LanguageSwitcherVariantProps) {
    const handleChange = async (value: string) => {
        if (SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)) {
            // Change the UI language immediately
            await changeLanguage(value as SupportedLanguage);

            // Also persist to user profile (for authenticated users in settings)
            try {
                await apiClient.updateUserProfile({ preferredLanguage: value });
            } catch (error) {
                // Log but don't fail - language is already changed locally
                logError('Failed to save language preference to profile', error);
            }
        }
    };

    const options = SUPPORTED_LANGUAGES.map((lng) => ({
        value: lng,
        label: LANGUAGE_NAMES[lng],
    }));

    return (
        <div className={className}>
            <Select
                value={currentLanguage}
                onChange={handleChange}
                options={options}
                name='language'
            />
        </div>
    );
}
