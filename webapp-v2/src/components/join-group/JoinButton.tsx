/**
 * Join Button Component
 *
 * Primary action button for joining a group
 */

import { LoadingSpinner } from '@/components/ui';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';

interface JoinButtonProps {
    onJoin: () => void;
    loading?: boolean;
    disabled?: boolean;
}

export function JoinButton({ onJoin, loading = false, disabled = false }: JoinButtonProps) {
    const { t } = useTranslation();

    return (
        <Button onClick={onJoin} disabled={loading || disabled} fullWidth className='py-3' data-joining={loading ? 'true' : 'false'}>
            {loading
                ? (
                    <>
                        <LoadingSpinner size='sm' />
                        <span className='ml-2'>{t('joinGroupComponents.joinButton.joining')}</span>
                    </>
                )
                : (
                    t('joinGroupComponents.joinButton.joinGroup')
                )}
        </Button>
    );
}
