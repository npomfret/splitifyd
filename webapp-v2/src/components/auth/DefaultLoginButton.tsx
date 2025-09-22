import { useState, useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui';
import { firebaseConfigManager } from '@/app/firebase-config.ts';

interface DefaultLoginButtonProps {
    onFillForm: (email: string, password: string) => Promise<void>;
    onSubmit: () => void;
    disabled?: boolean;
}

export function DefaultLoginButton({ onFillForm, onSubmit, disabled }: DefaultLoginButtonProps) {
    const { t } = useTranslation();
    const [hasDefaults, setHasDefaults] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        firebaseConfigManager
            .getConfig()
            .then((config) => {
                const hasEmail = config.formDefaults?.email?.trim();
                const hasPassword = config.formDefaults?.password?.trim();
                setHasDefaults(Boolean(hasEmail && hasPassword));
            })
            .catch(() => {
                setHasDefaults(false);
            });
    }, []);

    const handleDefaultLogin = async () => {
        if (disabled) return;

        setLoading(true);
        try {
            const config = await firebaseConfigManager.getConfig();
            if (config.formDefaults?.email && config.formDefaults?.password) {
                // Wait for form to be filled before submitting
                await onFillForm(config.formDefaults.email, config.formDefaults.password);
                onSubmit();
            }
        } catch (error) {
            // Error handling remains the same
        } finally {
            setLoading(false);
        }
    };

    if (!hasDefaults) {
        return null;
    }

    return (
        <Button type="button" variant="secondary" size="sm" onClick={handleDefaultLogin} disabled={disabled || loading} loading={loading} className="w-full" data-testid="default-login-button">
            {t('auth.defaultLoginButton')}
        </Button>
    );
}
