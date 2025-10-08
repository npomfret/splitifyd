import { useConfig } from '@/hooks/useConfig.ts';

export function WarningBanner() {
    const config = useConfig();

    if (!config?.environment?.warningBanner) {
        return null;
    }

    return (
        <div className='fixed top-0 left-0 right-0 z-50 bg-red-500 py-1'>
            <p className='text-center text-xs text-yellow-300'>{config.environment.warningBanner}</p>
        </div>
    );
}
