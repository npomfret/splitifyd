// Dev-only convenience button that auto-fills and submits the login form.
// Only renders when formDefaults.email is configured (dev environments).
import { firebaseConfigManager } from '@/app/firebase-config.ts';
import { useEffect, useState } from 'preact/hooks';
import { Button } from '../ui';

interface DefaultLoginButtonProps {
    onFillForm: (email: string, password: string) => void;
    onLogin: (email: string, password: string) => Promise<void>;
    disabled?: boolean;
}

export function DefaultLoginButton({ onFillForm, onLogin, disabled }: DefaultLoginButtonProps) {
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
                await onLogin(config.formDefaults.email, config.formDefaults.password);
            }
        } catch (error) {
            // Silently fail - this is just a dev convenience feature
        } finally {
            setLoading(false);
        }
    };

    if (!hasDefaults) {
        return null;
    }

    return (
        <Button type='button' variant='secondary' size='sm' onClick={handleDefaultLogin} disabled={disabled || loading} loading={loading} className='w-full' dataTestId='default-login-button'>
            Quick Login
        </Button>
    );
}
