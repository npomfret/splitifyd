import { configStore } from '@/stores/config-store.ts';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

export function ThemeDebug() {
    const config = configStore.configSignal;
    const cssVars = useSignal({
        primary: '',
        secondary: '',
        primaryRgb: '',
        secondaryRgb: '',
    });

    useEffect(() => {
        const root = document.documentElement;
        const styles = getComputedStyle(root);
        cssVars.value = {
            primary: styles.getPropertyValue('--brand-primary'),
            secondary: styles.getPropertyValue('--brand-secondary'),
            primaryRgb: styles.getPropertyValue('--brand-primary-rgb'),
            secondaryRgb: styles.getPropertyValue('--brand-secondary-rgb'),
        };
    }, [config.value]);

    if (!config.value) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                background: 'white',
                border: '2px solid black',
                padding: '10px',
                fontSize: '12px',
                zIndex: 9999,
                maxWidth: '300px',
            }}
        >
            <strong>Theme Debug</strong>
            <div>Tenant: {config.value.tenant?.tenantId}</div>
            <div>App: {config.value.tenant?.branding.appName}</div>
            <div>Primary: {config.value.tenant?.branding.primaryColor}</div>
            <div>Secondary: {config.value.tenant?.branding.secondaryColor}</div>
            <hr />
            <div>CSS --brand-primary: {cssVars.value.primary}</div>
            <div>CSS --brand-primary-rgb: {cssVars.value.primaryRgb}</div>
            <div
                style={{
                    width: '50px',
                    height: '50px',
                    background: `rgb(${cssVars.value.primaryRgb})`,
                    border: '1px solid black',
                    marginTop: '5px',
                }}
            >
                <span style={{ color: 'white', fontSize: '10px' }}>Primary</span>
            </div>
        </div>
    );
}
