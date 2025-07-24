import { getInitials, getUserColor, getAvatarSize, type AvatarProps } from '../../utils/avatar';

export function Avatar({ displayName, userId, size = 'md' }: AvatarProps) {
  const initials = getInitials(displayName);
  const colors = getUserColor(userId);
  const sizeClasses = getAvatarSize(size);
  
  return (
    <div 
      className={`${colors.bg} rounded-full flex items-center justify-center ${sizeClasses.container}`}
      title={displayName}
    >
      <span className={`${sizeClasses.text} font-medium ${colors.text}`}>
        {initials}
      </span>
    </div>
  );
}