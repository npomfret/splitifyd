import { render, screen, waitFor } from '@testing-library/preact';
import { vi, beforeEach, describe, it, expect, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { CommentBuilder } from '@splitifyd/test-support';

// Mock Heroicons to avoid JSX serialization issues
vi.mock('@heroicons/react/24/outline', () => ({
    PaperAirplaneIcon: () => <div data-testid="paper-airplane-icon">Send</div>,
}));

// Mock the comments store without hoisting issues
vi.mock('@/stores/comments-store', async () => {
    const { signal } = await import('@preact/signals');
    
    return {
        commentsStore: {
            commentsSignal: signal([]),
            loadingSignal: signal(false),
            submittingSignal: signal(false),
            errorSignal: signal(null),
            hasMoreSignal: signal(false),
            registerComponent: vi.fn(),
            deregisterComponent: vi.fn(),
            addComment: vi.fn(),
            loadMoreComments: vi.fn(),
            reset: vi.fn(),
        },
    };
});

// Mock child components
vi.mock('@/components/comments/CommentsList', () => ({
    CommentsList: ({ comments, loading, hasMore, onLoadMore, maxHeight }: { comments: any[]; loading: boolean; hasMore: boolean; onLoadMore: () => void; maxHeight: string }) => (
        <div data-testid="comments-list">
            <div data-testid="comments-count">{comments.length}</div>
            <div data-testid="loading-state">{loading ? 'loading' : 'not-loading'}</div>
            <div data-testid="has-more">{hasMore ? 'has-more' : 'no-more'}</div>
            <div data-testid="max-height">{maxHeight}</div>
            {hasMore && (
                <button
                    data-testid="load-more-button"
                    onClick={() => {
                        // Properly handle the promise to avoid unhandled rejections
                        Promise.resolve(onLoadMore()).catch(() => {
                            // Error is handled by the store
                        });
                    }}
                >
                    Load More
                </button>
            )}
        </div>
    ),
}));

vi.mock('@/components/comments/CommentInput', () => ({
    CommentInput: ({ onSubmit, disabled, placeholder }: { onSubmit: (text: string) => Promise<void>; disabled?: boolean; placeholder?: string }) => (
        <div data-testid="comment-input">
            <input
                data-testid="input-field"
                placeholder={placeholder}
                disabled={disabled}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        const target = e.target as HTMLInputElement;
                        // Properly handle the promise to avoid unhandled rejections
                        onSubmit(target.value).catch(() => {
                            // Error is handled by the store
                        });
                        target.value = '';
                    }
                }}
            />
            <div data-testid="disabled-state">{disabled ? 'disabled' : 'enabled'}</div>
        </div>
    ),
}));


// Import after mocks
import { commentsStore } from '@/stores/comments-store';

describe('CommentsSection', () => {
    let user: ReturnType<typeof userEvent.setup>;
    const mockCommentsStore = vi.mocked(commentsStore) as any;

    beforeEach(() => {
        vi.clearAllMocks();
        user = userEvent.setup();

        // Reset all signals to default state
        mockCommentsStore.commentsSignal.value = [];
        mockCommentsStore.loadingSignal.value = false;
        mockCommentsStore.submittingSignal.value = false;
        mockCommentsStore.errorSignal.value = null;
        mockCommentsStore.hasMoreSignal.value = false;
    });

    afterEach(() => {
        mockCommentsStore.reset();
    });

    const renderCommentsSection = (props = {}) => {
        const defaultProps = {
            targetType: 'group' as const,
            targetId: 'test-group-123',
            maxHeight: '400px',
        };

        return render(<CommentsSection {...defaultProps} {...props} />);
    };

    describe('Component Lifecycle', () => {
        it('should register component on mount', () => {
            renderCommentsSection();

            expect(mockCommentsStore.registerComponent).toHaveBeenCalledWith('group', 'test-group-123');
        });

        it('should deregister component on unmount', () => {
            const { unmount } = renderCommentsSection();

            unmount();

            expect(mockCommentsStore.deregisterComponent).toHaveBeenCalledWith('test-group-123');
        });

        it('should reregister when target changes', () => {
            const { rerender } = renderCommentsSection({ targetId: 'group-1' });

            expect(mockCommentsStore.registerComponent).toHaveBeenCalledWith('group', 'group-1');

            // Change target
            rerender(<CommentsSection targetType="expense" targetId="expense-2" />);

            expect(mockCommentsStore.deregisterComponent).toHaveBeenCalledWith('group-1');
            expect(mockCommentsStore.registerComponent).toHaveBeenCalledWith('expense', 'expense-2');
        });
    });

    describe('Rendering States', () => {
        it('should render with no error state initially', () => {
            renderCommentsSection();

            expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
            expect(screen.getByTestId('comments-list')).toBeInTheDocument();
            expect(screen.getByTestId('comment-input')).toBeInTheDocument();
        });

        it('should display error message when error exists', () => {
            mockCommentsStore.errorSignal.value = 'Failed to load comments';

            renderCommentsSection();

            expect(screen.getByText('Failed to load comments')).toBeInTheDocument();
            const errorContainer = screen.getByText('Failed to load comments').parentElement;
            expect(errorContainer).toHaveClass('bg-red-50', 'border-red-200');
        });

        it('should pass correct props to CommentsList', () => {
            const comments = [new CommentBuilder().withId('comment-1').build(), new CommentBuilder().withId('comment-2').build()];
            mockCommentsStore.commentsSignal.value = comments;
            mockCommentsStore.loadingSignal.value = true;
            mockCommentsStore.hasMoreSignal.value = true;

            renderCommentsSection({ maxHeight: '300px' });

            expect(screen.getByTestId('comments-count')).toHaveTextContent('2');
            expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');
            expect(screen.getByTestId('has-more')).toHaveTextContent('has-more');
            expect(screen.getByTestId('max-height')).toHaveTextContent('300px');
        });

        it('should pass correct props to CommentInput', () => {
            mockCommentsStore.submittingSignal.value = true;

            renderCommentsSection({ targetType: 'expense' });

            expect(screen.getByTestId('disabled-state')).toHaveTextContent('disabled');
            expect(screen.getByPlaceholderText('Add a comment to this expense...')).toBeInTheDocument();
        });

        it('should show group placeholder for group target', () => {
            renderCommentsSection({ targetType: 'group' });

            expect(screen.getByPlaceholderText('Add a comment to this group...')).toBeInTheDocument();
        });
    });

    describe('Comment Submission', () => {
        it('should call addComment when submitting through CommentInput', async () => {
            mockCommentsStore.addComment.mockResolvedValue(undefined);
            renderCommentsSection();

            const input = screen.getByTestId('input-field');

            // Type and submit
            await user.type(input, 'New comment');
            await user.keyboard('{Enter}');

            expect(mockCommentsStore.addComment).toHaveBeenCalledWith('New comment');
        });

        it('should handle submission errors gracefully', async () => {
            const error = new Error('Submission failed');
            mockCommentsStore.addComment.mockRejectedValue(error);

            renderCommentsSection();

            const input = screen.getByTestId('input-field');
            await user.type(input, 'Failed comment');
            await user.keyboard('{Enter}');

            await vi.waitFor(() => {
                expect(mockCommentsStore.addComment).toHaveBeenCalledWith('Failed comment');
            });
            // Error should be handled by the store, component should not crash
        });
    });

    describe('Load More Functionality', () => {
        it('should call loadMoreComments when load more is triggered', async () => {
            mockCommentsStore.hasMoreSignal.value = true;
            mockCommentsStore.loadMoreComments.mockResolvedValue(undefined);

            renderCommentsSection();

            const loadMoreButton = screen.getByTestId('load-more-button');
            await user.click(loadMoreButton);

            expect(mockCommentsStore.loadMoreComments).toHaveBeenCalled();
        });

        it('should handle load more errors gracefully', async () => {
            mockCommentsStore.hasMoreSignal.value = true;
            const error = new Error('Load more failed');
            mockCommentsStore.loadMoreComments.mockRejectedValue(error);

            renderCommentsSection();

            const loadMoreButton = screen.getByTestId('load-more-button');
            await user.click(loadMoreButton);

            await vi.waitFor(() => {
                expect(mockCommentsStore.loadMoreComments).toHaveBeenCalled();
            });
            // Error should be handled by the store
        });
    });

    describe('Responsive Design', () => {
        it('should apply custom className', () => {
            renderCommentsSection({ className: 'custom-comments' });

            const container = screen.getByTestId('comments-list').parentElement;
            expect(container).toHaveClass('custom-comments');
        });

        it('should have proper layout classes', () => {
            renderCommentsSection();

            const container = screen.getByTestId('comments-list').parentElement;
            expect(container).toHaveClass('flex', 'flex-col', 'gap-4');
        });

        it('should have border and padding on input section', () => {
            renderCommentsSection();

            const inputSection = screen.getByTestId('comment-input').parentElement;
            expect(inputSection).toHaveClass('border-t', 'pt-4');
        });
    });

    describe('Real-time Updates', () => {
        it('should react to comments signal changes', async () => {
            renderCommentsSection();

            // Initially no comments
            expect(screen.getByTestId('comments-count')).toHaveTextContent('0');

            // Add comments via signal
            const comments = [new CommentBuilder().withId('comment-1').build(), new CommentBuilder().withId('comment-2').build()];

            mockCommentsStore.commentsSignal.value = comments;

            await waitFor(() => {
                expect(screen.getByTestId('comments-count')).toHaveTextContent('2');
            });
        });

        it('should react to loading state changes', async () => {
            renderCommentsSection();

            expect(screen.getByTestId('loading-state')).toHaveTextContent('not-loading');

            mockCommentsStore.loadingSignal.value = true;

            await waitFor(() => {
                expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');
            });
        });

        it('should react to submitting state changes', async () => {
            renderCommentsSection();

            expect(screen.getByTestId('disabled-state')).toHaveTextContent('enabled');

            mockCommentsStore.submittingSignal.value = true;

            await waitFor(() => {
                expect(screen.getByTestId('disabled-state')).toHaveTextContent('disabled');
            });
        });

        it('should react to error state changes', async () => {
            renderCommentsSection();

            expect(screen.queryByText(/error/i)).not.toBeInTheDocument();

            mockCommentsStore.errorSignal.value = 'Connection failed';

            await waitFor(() => {
                expect(screen.getByText('Connection failed')).toBeInTheDocument();
            });

            // Clear error
            mockCommentsStore.errorSignal.value = null;

            await waitFor(() => {
                expect(screen.queryByText('Connection failed')).not.toBeInTheDocument();
            });
        });

        it('should react to hasMore state changes', async () => {
            renderCommentsSection();

            expect(screen.getByTestId('has-more')).toHaveTextContent('no-more');
            expect(screen.queryByTestId('load-more-button')).not.toBeInTheDocument();

            mockCommentsStore.hasMoreSignal.value = true;

            await waitFor(() => {
                expect(screen.getByTestId('has-more')).toHaveTextContent('has-more');
                expect(screen.getByTestId('load-more-button')).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility and Performance', () => {
        it('should use semantic HTML structure', () => {
            renderCommentsSection();

            // Check for proper form structure in CommentInput mock
            const input = screen.getByTestId('input-field');
            expect(input).toHaveAttribute('placeholder');
        });

        it('should handle rapid state changes without errors', async () => {
            renderCommentsSection();

            // Simulate rapid state changes that might happen with real-time updates
            mockCommentsStore.loadingSignal.value = true;
            mockCommentsStore.errorSignal.value = 'Error 1';
            mockCommentsStore.loadingSignal.value = false;
            mockCommentsStore.errorSignal.value = null;
            mockCommentsStore.commentsSignal.value = [new CommentBuilder().build()];
            mockCommentsStore.hasMoreSignal.value = true;

            // Component should handle all changes without crashing
            await waitFor(() => {
                expect(screen.getByTestId('comments-count')).toHaveTextContent('1');
                expect(screen.getByTestId('has-more')).toHaveTextContent('has-more');
            });
        });
    });
});
