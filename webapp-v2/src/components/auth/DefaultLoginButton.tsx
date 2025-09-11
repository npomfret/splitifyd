import { useState, useEffect } from 'preact/hooks';
import { Button } from '../ui';
import { firebaseConfigManager } from '../../app/firebase-config';

interface DefaultLoginButtonProps {
    onFillForm: (email: string, password: string) => void;
    onSubmit: () => void;
    disabled?: boolean;
}

export function DefaultLoginButton({ onFillForm, onSubmit, disabled }: DefaultLoginButtonProps) {
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
                onFillForm(config.formDefaults.email, config.formDefaults.password);
                // Small delay to ensure form is filled before submit
                setTimeout(() => {
                    onSubmit();
                    setLoading(false);
                }, 50);
            }
        } catch (error) {
            setLoading(false);
        }
    };

    if (!hasDefaults) {
        return null;
    }

    return (
        <Button type="button" variant="secondary" size="sm" onClick={handleDefaultLogin} disabled={disabled || loading} loading={loading} className="w-full" data-testid="default-login-button">
            Default Login
        </Button>
    );
}
