import { permissionOptions, permissionOrder } from '@/app/hooks/useGroupSecuritySettings';
import { GroupPermissions } from '@billsplit-wl/shared';
import { useTranslation } from 'react-i18next';

interface CustomPermissionsSectionProps {
    permissionDraft: GroupPermissions;
    selectedPreset: string;
    hasPermissionChanges: boolean;
    onPermissionChange: (key: keyof GroupPermissions, value: string) => void;
}

export function CustomPermissionsSection({
    permissionDraft,
    selectedPreset,
    hasPermissionChanges,
    onPermissionChange,
}: CustomPermissionsSectionProps) {
    const { t } = useTranslation();

    return (
        <section>
            <div className='flex items-center justify-between mb-2'>
                <h3 className='text-base font-semibold text-text-primary'>{t('securitySettingsModal.custom.heading')}</h3>
                {selectedPreset === 'custom' && hasPermissionChanges && <span className='text-xs text-interactive-primary font-medium'>{t('securitySettingsModal.custom.unsaved')}</span>}
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {permissionOrder.map((key) => (
                    <label key={key} className='flex flex-col text-sm text-text-primary gap-2 border border-border-default rounded-lg px-4 py-3'>
                        <span className='font-medium text-text-primary'>{t(`securitySettingsModal.permissions.${key}.label`)}</span>
                        <select
                            className='border border-border-default bg-surface-raised backdrop-blur-sm text-text-primary rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary text-sm transition-colors duration-200'
                            value={permissionDraft[key]}
                            onChange={(event) => onPermissionChange(key, event.currentTarget.value)}
                            data-testid={`permission-select-${key}`}
                        >
                            {permissionOptions[key].map((option) => (
                                <option key={option} value={option}>
                                    {t(`securitySettingsModal.permissions.options.${option}`)}
                                </option>
                            ))}
                        </select>
                        <span className='text-xs text-text-primary/60'>{t(`securitySettingsModal.permissions.${key}.description`)}</span>
                    </label>
                ))}
            </div>
            <p className='text-xs text-text-primary/60 text-right mt-2'>{t('securitySettingsModal.custom.saveHelper')}</p>
        </section>
    );
}
