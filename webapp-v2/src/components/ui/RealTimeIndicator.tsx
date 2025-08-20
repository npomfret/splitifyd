import { FunctionalComponent } from 'preact';
import { useComputed } from '@preact/signals';
import { ConnectionManager } from '@/utils/connection-manager';
import { WifiIcon, NoSymbolIcon } from '@heroicons/react/24/outline';

export const RealTimeIndicator: FunctionalComponent = () => {
    const connectionManager = ConnectionManager.getInstance();
    const isOnline = connectionManager.isOnline;
    const connectionQuality = connectionManager.connectionQuality;
    
    // Computed signal for connection status text
    const statusText = useComputed(() => {
        if (!isOnline.value) return 'Offline';
        switch (connectionQuality.value) {
            case 'good': return 'Connected';
            case 'poor': return 'Poor Connection';
            case 'offline': return 'Offline';
            default: return 'Connected';
        }
    });

    // Computed signal for status color classes
    const statusColorClass = useComputed(() => {
        if (!isOnline.value) return 'bg-red-500';
        switch (connectionQuality.value) {
            case 'good': return 'bg-green-500';
            case 'poor': return 'bg-yellow-500';
            case 'offline': return 'bg-red-500';
            default: return 'bg-green-500';
        }
    });

    return (
        <div className="flex items-center gap-2">
            {isOnline.value ? (
                <div className="relative flex items-center" title={statusText.value}>
                    <div className={`h-2 w-2 rounded-full ${statusColorClass.value}`}>
                        {connectionQuality.value === 'good' && (
                            <>
                                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusColorClass.value} opacity-75`}></span>
                                <span className={`relative inline-flex h-2 w-2 rounded-full ${statusColorClass.value}`}></span>
                            </>
                        )}
                    </div>
                    <WifiIcon className="h-4 w-4 text-gray-600 dark:text-gray-400 ml-1" />
                </div>
            ) : (
                <div className="flex items-center" title={statusText.value}>
                    <div className={`h-2 w-2 rounded-full ${statusColorClass.value} mr-1`}></div>
                    <NoSymbolIcon className="h-4 w-4 text-red-500" />
                </div>
            )}
        </div>
    );
};