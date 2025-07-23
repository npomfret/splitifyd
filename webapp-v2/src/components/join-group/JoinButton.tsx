/**
 * Join Button Component
 * 
 * Primary action button for joining a group
 */

import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface JoinButtonProps {
  onJoin: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function JoinButton({ onJoin, loading = false, disabled = false }: JoinButtonProps) {
  return (
    <Button
      onClick={onJoin}
      disabled={loading || disabled}
      fullWidth
      className="py-3"
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          <span className="ml-2">Joining...</span>
        </>
      ) : (
        'Join Group'
      )}
    </Button>
  );
}