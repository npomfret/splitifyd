import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { PresenceManager, type UserPresence } from '../../utils/presence-manager';
import './PresenceIndicator.css';

interface PresenceIndicatorProps {
  location?: 'group' | 'expense-form' | 'expense-detail';
  locationId?: string;
  showCount?: boolean;
  showAvatars?: boolean;
  maxAvatars?: number;
  className?: string;
}

export function PresenceIndicator({ 
  location = 'group',
  locationId = '',
  showCount = true,
  showAvatars = true,
  maxAvatars = 3,
  className = ''
}: PresenceIndicatorProps) {
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  
  const presenceManager = PresenceManager.getInstance();

  useEffect(() => {
    // Subscribe to presence updates
    const unsubscribe = presenceManager.onlineUsers.subscribe((onlineUsers) => {
      const locationUsers = onlineUsers.filter(user => 
        user.location === location && user.locationId === locationId
      );
      setUsers(locationUsers);
      setIsVisible(locationUsers.length > 0);
    });

    return unsubscribe;
  }, [location, locationId]);

  if (!isVisible || users.length === 0) {
    return null;
  }

  const displayUsers = users.slice(0, maxAvatars);
  const additionalCount = Math.max(0, users.length - maxAvatars);

  return (
    <div className={`presence-indicator ${className}`}>
      {showAvatars && (
        <div className="presence-avatars">
          {displayUsers.map((user, index) => (
            <div
              key={user.userId}
              className={`presence-avatar ${user.activity}`}
              style={{ zIndex: displayUsers.length - index }}
              title={`${user.userName} is ${user.activity}`}
            >
              {user.userAvatar ? (
                <img 
                  src={user.userAvatar} 
                  alt={user.userName}
                  className="avatar-image"
                />
              ) : (
                <div className="avatar-initial">
                  {user.userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`activity-indicator ${user.activity}`} />
            </div>
          ))}
          
          {additionalCount > 0 && (
            <div className="presence-avatar additional-count">
              <div className="avatar-initial">+{additionalCount}</div>
            </div>
          )}
        </div>
      )}
      
      {showCount && (
        <div className="presence-count">
          <span className="count-number">{users.length}</span>
          <span className="count-label">
            {users.length === 1 ? 'user' : 'users'} active
          </span>
        </div>
      )}
    </div>
  );
}

interface TypingIndicatorProps {
  location?: string;
  className?: string;
}

export function TypingIndicator({ location, className = '' }: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const presenceManager = PresenceManager.getInstance();

  useEffect(() => {
    const unsubscribe = presenceManager.typingUsers.subscribe((indicators) => {
      const locationTyping = location 
        ? indicators.filter(t => t.location === location)
        : indicators;
      
      setTypingUsers(locationTyping.map(t => t.userName));
    });

    return unsubscribe;
  }, [location]);

  if (typingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    } else if (typingUsers.length === 3) {
      return `${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers[2]} are typing...`;
    } else {
      return `${typingUsers.length} people are typing...`;
    }
  };

  return (
    <div className={`typing-indicator ${className}`}>
      <div className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span className="typing-text">{getTypingText()}</span>
    </div>
  );
}

interface ActivityFeedProps {
  groupId: string;
  limit?: number;
  className?: string;
}

export function ActivityFeed({ groupId, limit = 10, className = '' }: ActivityFeedProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Subscribe to recent activities for the group
    // This would connect to a real-time activity feed
    setIsLoading(false);
  }, [groupId]);

  if (isLoading) {
    return (
      <div className={`activity-feed loading ${className}`}>
        <div className="activity-item skeleton">
          <div className="activity-avatar skeleton-circle"></div>
          <div className="activity-content">
            <div className="activity-text skeleton-line"></div>
            <div className="activity-time skeleton-line short"></div>
          </div>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={`activity-feed empty ${className}`}>
        <div className="empty-state">
          <p>No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`activity-feed ${className}`}>
      {activities.slice(0, limit).map((activity, index) => (
        <div key={`${activity.id}-${index}`} className="activity-item">
          <div className="activity-avatar">
            {activity.userAvatar ? (
              <img src={activity.userAvatar} alt={activity.userName} />
            ) : (
              <div className="avatar-initial">
                {activity.userName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="activity-content">
            <div className="activity-text">
              <strong>{activity.userName}</strong> {activity.description}
            </div>
            <div className="activity-time">
              {formatRelativeTime(activity.timestamp)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper function to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) {
    return 'just now';
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}