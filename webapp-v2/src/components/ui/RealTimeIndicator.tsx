import { useEffect, useState } from 'preact/hooks';
import { ConnectionManager } from '../../utils/connection-manager';

interface RealTimeIndicatorProps {
  className?: string;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function RealTimeIndicator({ 
  className = '', 
  showLabel = false,
  size = 'medium'
}: RealTimeIndicatorProps) {
  const [connectionManager] = useState(() => ConnectionManager.getInstance());
  const [isOnline, setIsOnline] = useState(connectionManager.isOnline.value);
  const [quality, setQuality] = useState(connectionManager.connectionQuality.value);
  const [reconnectAttempts, setReconnectAttempts] = useState(connectionManager.reconnectAttempts.value);

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribeOnline = connectionManager.isOnline.subscribe(setIsOnline);
    const unsubscribeQuality = connectionManager.connectionQuality.subscribe(setQuality);
    const unsubscribeReconnect = connectionManager.reconnectAttempts.subscribe(setReconnectAttempts);

    return () => {
      unsubscribeOnline();
      unsubscribeQuality();
      unsubscribeReconnect();
    };
  }, [connectionManager]);

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-2 h-2';
      case 'large':
        return 'w-4 h-4';
      default:
        return 'w-3 h-3';
    }
  };

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        color: 'bg-gray-400',
        pulse: false,
        title: 'Working offline',
        label: 'Offline',
        icon: '⚠️'
      };
    }

    if (reconnectAttempts > 0) {
      return {
        color: 'bg-yellow-500',
        pulse: true,
        title: `Reconnecting... (attempt ${reconnectAttempts})`,
        label: 'Reconnecting',
        icon: '🔄'
      };
    }

    switch (quality) {
      case 'good':
        return {
          color: 'bg-green-500',
          pulse: true,
          title: 'Real-time updates active',
          label: 'Live',
          icon: '🟢'
        };
      case 'poor':
        return {
          color: 'bg-yellow-500',
          pulse: true,
          title: 'Slow connection - updates may be delayed',
          label: 'Slow',
          icon: '🟡'
        };
      default:
        return {
          color: 'bg-red-500',
          pulse: false,
          title: 'Connection issues detected',
          label: 'Issues',
          icon: '🔴'
        };
    }
  };

  const status = getStatusInfo();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <div 
          className={`
            ${getSizeClasses()} 
            rounded-full 
            ${status.color}
            transition-colors duration-300
          `}
          title={status.title}
        />
        {status.pulse && (
          <div 
            className={`
              absolute inset-0 
              ${getSizeClasses()} 
              rounded-full 
              ${status.color} 
              animate-ping 
              opacity-75
            `}
          />
        )}
      </div>
      
      {showLabel && (
        <span 
          className="text-sm text-gray-600 dark:text-gray-400 select-none"
          title={status.title}
        >
          {status.label}
        </span>
      )}
    </div>
  );
}

export function ConnectionStatusBar() {
  const [connectionManager] = useState(() => ConnectionManager.getInstance());
  const [isOnline, setIsOnline] = useState(connectionManager.isOnline.value);
  const [quality, setQuality] = useState(connectionManager.connectionQuality.value);
  const [reconnectAttempts, setReconnectAttempts] = useState(connectionManager.reconnectAttempts.value);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const unsubscribeOnline = connectionManager.isOnline.subscribe(setIsOnline);
    const unsubscribeQuality = connectionManager.connectionQuality.subscribe(setQuality);
    const unsubscribeReconnect = connectionManager.reconnectAttempts.subscribe(setReconnectAttempts);

    return () => {
      unsubscribeOnline();
      unsubscribeQuality();
      unsubscribeReconnect();
    };
  }, [connectionManager]);

  useEffect(() => {
    // Show banner for offline or poor connections
    setShowBanner(!isOnline || quality === 'poor' || reconnectAttempts > 0);
  }, [isOnline, quality, reconnectAttempts]);

  if (!showBanner) {
    return null;
  }

  const getBannerContent = () => {
    if (!isOnline) {
      return {
        type: 'warning',
        message: 'You\'re working offline. Changes will sync when connection is restored.',
        action: null
      };
    }

    if (reconnectAttempts > 0) {
      return {
        type: 'info',
        message: `Reconnecting to live updates... (attempt ${reconnectAttempts})`,
        action: null
      };
    }

    if (quality === 'poor') {
      return {
        type: 'info',
        message: 'Slow connection detected. Updates may be less frequent.',
        action: null
      };
    }

    return null;
  };

  const bannerContent = getBannerContent();
  if (!bannerContent) return null;

  const typeClasses: Record<string, string> = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800'
  };

  return (
    <div className={`
      border-b px-4 py-3 text-sm
      ${typeClasses[bannerContent.type] || typeClasses.info}
      transition-all duration-300
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RealTimeIndicator size="small" />
          <span>{bannerContent.message}</span>
        </div>
        
        {bannerContent.action && (
          <button 
            className="text-xs underline hover:no-underline"
            onClick={bannerContent.action}
          >
            Retry
          </button>
        )}
        
        <button 
          className="text-xs opacity-70 hover:opacity-100"
          onClick={() => setShowBanner(false)}
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}