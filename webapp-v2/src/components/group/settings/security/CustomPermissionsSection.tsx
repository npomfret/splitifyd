import { permissionOptions, permissionOrder } from '@/app/hooks/useGroupSecuritySettings';
import { translatePermission, translatePermissionOption } from '@/app/i18n/dynamic-translations';
import { Tooltip } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { InfoCircleIcon } from '@/components/ui/icons';
import { formSelect } from '@/components/ui/styles';
import { cx } from '@/utils/cx';
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
                        <span className='flex items-center justify-between'>
                            <span className='font-medium text-text-primary'>{translatePermission(key, 'label', t)}</span>
                            <Tooltip content={translatePermission(key, 'description', t)} placement='top'>
                                <Clickable
                                    as='button'
                                    type='button'
                                    className='text-text-muted hover:text-text-primary transition-colors p-0.5 -mr-0.5 rounded focus:outline-hidden focus:ring-2 focus:ring-interactive-primary'
                                    aria-label={t('securitySettingsModal.permissions.infoLabel')}
                                >
                                    <InfoCircleIcon size={16} />
                                </Clickable>
                            </Tooltip>
                        </span>
                        <select
                            className={cx(...formSelect.base)}
                            value={permissionDraft[key]}
                            onChange={(event) => onPermissionChange(key, event.currentTarget.value)}
                        >
                            {permissionOptions[key].map((option) => (
                                <option key={option} value={option}>
                                    {translatePermissionOption(option, t)}
                                </option>
                            ))}
                        </select>
                    </label>
                ))}
            </div>
            <p className='text-xs text-text-primary/60 text-end mt-2'>{t('securitySettingsModal.custom.saveHelper')}</p>
        </section>
    );
}
