import { useAsyncAction } from '@/app/hooks/useAsyncAction';
import { act, renderHook, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useAsyncAction', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('initial state', () => {
        it('starts with isLoading false and no error', () => {
            const { result } = renderHook(() => useAsyncAction(async () => 'result'));

            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toBeNull();
        });
    });

    describe('successful execution', () => {
        it('sets isLoading to true during execution', async () => {
            let resolvePromise: (value: string) => void;
            const action = vi.fn(
                () =>
                    new Promise<string>((resolve) => {
                        resolvePromise = resolve;
                    }),
            );

            const { result } = renderHook(() => useAsyncAction(action));

            expect(result.current.isLoading).toBe(false);

            act(() => {
                result.current.execute();
            });

            expect(result.current.isLoading).toBe(true);

            await act(async () => {
                resolvePromise!('done');
                await vi.runAllTimersAsync();
            });

            expect(result.current.isLoading).toBe(false);
        });

        it('returns the result from the action', async () => {
            const action = vi.fn(async () => 'success result');

            const { result } = renderHook(() => useAsyncAction(action));

            let returnValue: string | undefined;
            await act(async () => {
                returnValue = await result.current.execute();
            });

            expect(returnValue).toBe('success result');
        });

        it('calls onSuccess with the result', async () => {
            const action = vi.fn(async () => 'result');
            const onSuccess = vi.fn();

            const { result } = renderHook(() => useAsyncAction(action, { onSuccess }));

            await act(async () => {
                await result.current.execute();
            });

            expect(onSuccess).toHaveBeenCalledWith('result');
            expect(onSuccess).toHaveBeenCalledTimes(1);
        });

        it('clears previous error on new execution', async () => {
            const action = vi
                .fn()
                .mockRejectedValueOnce(new Error('First error'))
                .mockResolvedValueOnce('success');

            const { result } = renderHook(() => useAsyncAction(action));

            // First call - fails
            await act(async () => {
                await result.current.execute();
            });

            expect(result.current.error).toBe('First error');

            // Second call - succeeds, should clear error
            await act(async () => {
                await result.current.execute();
            });

            expect(result.current.error).toBeNull();
        });
    });

    describe('error handling', () => {
        it('sets error message from Error instance', async () => {
            const action = vi.fn(async () => {
                throw new Error('Something went wrong');
            });

            const { result } = renderHook(() => useAsyncAction(action));

            await act(async () => {
                await result.current.execute();
            });

            expect(result.current.error).toBe('Something went wrong');
            expect(result.current.isLoading).toBe(false);
        });

        it('sets default error for non-Error throws', async () => {
            const action = vi.fn(async () => {
                throw 'string error';
            });

            const { result } = renderHook(() => useAsyncAction(action));

            await act(async () => {
                await result.current.execute();
            });

            expect(result.current.error).toBe('An error occurred');
        });

        it('uses custom error message from onError', async () => {
            const action = vi.fn(async () => {
                throw new Error('Original error');
            });

            const onError = vi.fn(() => 'Custom error message');

            const { result } = renderHook(() => useAsyncAction(action, { onError }));

            await act(async () => {
                await result.current.execute();
            });

            expect(result.current.error).toBe('Custom error message');
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });

        it('uses default message when onError returns undefined', async () => {
            const action = vi.fn(async () => {
                throw new Error('Original error');
            });

            const onError = vi.fn(() => undefined);

            const { result } = renderHook(() => useAsyncAction(action, { onError }));

            await act(async () => {
                await result.current.execute();
            });

            expect(result.current.error).toBe('Original error');
        });

        it('returns undefined on error', async () => {
            const action = vi.fn(async () => {
                throw new Error('error');
            });

            const { result } = renderHook(() => useAsyncAction(action));

            let returnValue: unknown;
            await act(async () => {
                returnValue = await result.current.execute();
            });

            expect(returnValue).toBeUndefined();
        });
    });

    describe('double-execution prevention', () => {
        it('prevents execution while already loading', async () => {
            let resolvePromise: (value: string) => void;
            const action = vi.fn(
                () =>
                    new Promise<string>((resolve) => {
                        resolvePromise = resolve;
                    }),
            );

            const { result } = renderHook(() => useAsyncAction(action));

            // Start first execution
            act(() => {
                result.current.execute();
            });

            expect(action).toHaveBeenCalledTimes(1);

            // Try second execution while loading
            let secondResult: string | undefined;
            act(() => {
                result.current.execute().then((r) => {
                    secondResult = r;
                });
            });

            // Should not call action again
            expect(action).toHaveBeenCalledTimes(1);

            // Complete first execution
            await act(async () => {
                resolvePromise!('done');
                await vi.runAllTimersAsync();
            });

            expect(secondResult).toBeUndefined();
        });

        it('allows execution after previous completes', async () => {
            const action = vi.fn(async () => 'result');

            const { result } = renderHook(() => useAsyncAction(action));

            await act(async () => {
                await result.current.execute();
            });

            expect(action).toHaveBeenCalledTimes(1);

            await act(async () => {
                await result.current.execute();
            });

            expect(action).toHaveBeenCalledTimes(2);
        });
    });

    describe('race condition handling', () => {
        it('ignores result from stale request after reset', async () => {
            let resolvePromise: (value: string) => void;
            const action = vi.fn(
                () =>
                    new Promise<string>((resolve) => {
                        resolvePromise = resolve;
                    }),
            );

            const onSuccess = vi.fn();

            const { result } = renderHook(() => useAsyncAction(action, { onSuccess }));

            // Start execution
            act(() => {
                result.current.execute();
            });

            // Reset while loading
            act(() => {
                result.current.reset();
            });

            // Complete the original request
            await act(async () => {
                resolvePromise!('stale result');
                await vi.runAllTimersAsync();
            });

            // Should not call onSuccess because request was reset
            expect(onSuccess).not.toHaveBeenCalled();
            expect(result.current.isLoading).toBe(false);
        });
    });

    describe('with arguments', () => {
        it('passes arguments to the action', async () => {
            const action = vi.fn(async (a: number, b: string) => `${a}-${b}`);

            const { result } = renderHook(() => useAsyncAction(action));

            let returnValue: string | undefined;
            await act(async () => {
                returnValue = await result.current.execute(42, 'test');
            });

            expect(action).toHaveBeenCalledWith(42, 'test');
            expect(returnValue).toBe('42-test');
        });
    });

    describe('clearError', () => {
        it('clears the error', async () => {
            const action = vi.fn(async () => {
                throw new Error('error');
            });

            const { result } = renderHook(() => useAsyncAction(action));

            await act(async () => {
                await result.current.execute();
            });

            expect(result.current.error).toBe('error');

            act(() => {
                result.current.clearError();
            });

            expect(result.current.error).toBeNull();
        });
    });

    describe('reset', () => {
        it('clears error and sets isLoading to false', async () => {
            let resolvePromise: (value: string) => void;
            const action = vi.fn(
                () =>
                    new Promise<string>((resolve) => {
                        resolvePromise = resolve;
                    }),
            );

            const { result } = renderHook(() => useAsyncAction(action));

            // Start execution to set isLoading
            act(() => {
                result.current.execute();
            });

            expect(result.current.isLoading).toBe(true);

            // Reset
            act(() => {
                result.current.reset();
            });

            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toBeNull();

            // Cleanup - resolve the pending promise
            await act(async () => {
                resolvePromise!('done');
                await vi.runAllTimersAsync();
            });
        });
    });

    describe('hook stability', () => {
        it('maintains stable function references across rerenders', () => {
            const action = vi.fn(async () => 'result');

            const { result, rerender } = renderHook(() => useAsyncAction(action));

            const firstExecute = result.current.execute;
            const firstClearError = result.current.clearError;
            const firstReset = result.current.reset;

            rerender();

            expect(result.current.execute).toBe(firstExecute);
            expect(result.current.clearError).toBe(firstClearError);
            expect(result.current.reset).toBe(firstReset);
        });
    });
});
