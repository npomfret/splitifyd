import { useTranslation } from 'react-i18next';
import { EmptyState } from '../ui';
import { BadgeCheckIcon, PlusIcon, UsersIcon } from '../ui/icons';

interface EmptyGroupsStateProps {
    onCreateGroup: () => void;
    emailNotVerified?: boolean;
}

export function EmptyGroupsState({ onCreateGroup, emailNotVerified }: EmptyGroupsStateProps) {
    const { t } = useTranslation();

    const groupIcon = <UsersIcon size={64} />;

    return (
        <EmptyState
            icon={groupIcon}
            title={t('emptyGroupsState.title')}
            description={t('emptyGroupsState.description')}
            action={{
                label: t('emptyGroupsState.createFirstGroup'),
                onClick: onCreateGroup,
                variant: 'primary',
                disabled: emailNotVerified,
                disabledTooltip: t('emailVerification.tooltip.disabled'),
            }}
        >
            {/* Additional getting started tips */}
            <div className='text-start max-w-2xl mx-auto'>
                <h5 className='text-sm font-medium text-text-primary mb-3'>{t('emptyGroupsState.gettingStartedTitle')}</h5>
                <div className='grid md:grid-cols-3 gap-4'>
                    <div className='bg-interactive-primary/10 p-4 rounded-lg'>
                        <div className='text-interactive-primary mb-2'>
                            <UsersIcon size={24} />
                        </div>
                        <h6 className='font-medium text-text-primary mb-1'>{t('emptyGroupsState.step1Title')}</h6>
                        <p className='help-text'>{t('emptyGroupsState.step1Description')}</p>
                    </div>

                    <div className='bg-interactive-accent/10 p-4 rounded-lg'>
                        <div className='text-semantic-success mb-2'>
                            <PlusIcon size={24} />
                        </div>
                        <h6 className='font-medium text-text-primary mb-1'>{t('emptyGroupsState.step2Title')}</h6>
                        <p className='help-text'>{t('emptyGroupsState.step2Description')}</p>
                    </div>

                    <div className='bg-interactive-primary/10 p-4 rounded-lg'>
                        <div className='text-interactive-primary mb-2'>
                            <BadgeCheckIcon size={24} />
                        </div>
                        <h6 className='font-medium text-text-primary mb-1'>{t('emptyGroupsState.step3Title')}</h6>
                        <p className='help-text'>{t('emptyGroupsState.step3Description')}</p>
                    </div>
                </div>
            </div>
        </EmptyState>
    );
}
