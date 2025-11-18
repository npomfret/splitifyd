import { useConfig } from '@/hooks/useConfig.ts';

export function WarningBanner() {
    const config = useConfig();

    if (!config?.environment?.warningBanner) {
        return null;
    }

    return (
        <div
            className='bg-semantic-error py-2 px-4'
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
            }}
        >
            <p className='text-center text-sm font-medium text-white'>{config.environment.warningBanner}</p>
        </div>
    );
}
