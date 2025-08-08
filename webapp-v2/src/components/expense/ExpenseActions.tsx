import { useState } from 'preact/hooks';
import { Button, ConfirmDialog, Alert } from '../ui';
import type { ExpenseData } from '@shared/types/webapp-shared-types';
import { logError } from '../../utils/browser-logger';

interface ExpenseActionsProps {
  expense: ExpenseData;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onShare: () => void;
}

export function ExpenseActions({ expense, onEdit, onDelete, onShare }: ExpenseActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await onDelete();
      setShowDeleteConfirm(false);
    } catch (error) {
      logError('Failed to delete expense', error, { expenseId: expense.id });
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete expense');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeleteError(null);
  };

  return (
    <>
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
        <Button variant="primary" onClick={onEdit}>
          Edit
        </Button>
        
        <Button variant="secondary" onClick={onShare}>
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            Share
          </>
        </Button>
        
        <Button variant="danger" onClick={handleDeleteClick}>
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </>
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Expense"
        message={`Are you sure you want to delete "${expense.description}"? This action cannot be undone and will affect group balances.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Error Display */}
      {deleteError && (
        <div className="mt-4">
          <Alert type="error" message={deleteError} />
        </div>
      )}
    </>
  );
}