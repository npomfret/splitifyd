import { FunctionalComponent } from 'preact';
import { useComputed } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { ConnectionManager } from '@/utils/connection-manager';

export const RealTimeIndicator: FunctionalComponent = () => {
    const { t } = useTranslation();
    const connectionManager = ConnectionManager.getInstance();
    const isOnline = connectionManager.isOnline;
    const connectionQuality = connectionManager.connectionQuality;

    // Network connectivity status
    const networkStatusColor = useComputed(() => {
        return isOnline.value ? 'bg-green-500' : 'bg-red-500';
    });

    const networkStatusText = useComputed(() => {
        return isOnline.value ? t('uiComponents.realTimeIndicator.networkConnected') : t('uiComponents.realTimeIndicator.networkOffline');
    });

    // Server connectivity status
    const serverStatusColor = useComputed(() => {
        if (!isOnline.value) return 'bg-gray-400'; // Gray when offline
        switch (connectionQuality.value) {
            case 'good':
                return 'bg-green-500';
            case 'poor':
                return 'bg-yellow-500';
            case 'server-unavailable':
                return 'bg-red-500';
            case 'offline':
                return 'bg-gray-400';
            default:
                return 'bg-green-500';
        }
    });

    const serverStatusText = useComputed(() => {
        if (!isOnline.value) return t('uiComponents.realTimeIndicator.serverUnknownOffline');
        switch (connectionQuality.value) {
            case 'good':
                return t('uiComponents.realTimeIndicator.serverConnected');
            case 'poor':
                return t('uiComponents.realTimeIndicator.serverPoorConnection');
            case 'server-unavailable':
                return t('uiComponents.realTimeIndicator.serverUnavailable');
            case 'offline':
                return t('uiComponents.realTimeIndicator.serverUnknown');
            default:
                return t('uiComponents.realTimeIndicator.serverConnected');
        }
    });

    return (
        <div className="flex flex-col gap-1">
            <div className="p-2 cursor-help -m-2" title={networkStatusText.value}>
                <div className={`h-2 w-2 rounded-full ${networkStatusColor.value}`}></div>
            </div>
            <div className="p-2 cursor-help -m-2" title={serverStatusText.value}>
                <div className={`h-2 w-2 rounded-full ${serverStatusColor.value}`}></div>
            </div>
        </div>
    );
};
