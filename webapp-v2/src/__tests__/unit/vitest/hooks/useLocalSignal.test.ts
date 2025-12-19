import { useLocalSignal } from '@/app/hooks/useLocalSignal';
import { act, renderHook } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';

describe('useLocalSignal', () => {
    describe('initialization', () => {
        it('creates a signal with primitive value', () => {
            const { result } = renderHook(() => useLocalSignal('initial'));

            expect(result.current.value).toBe('initial');
        });

        it('creates a signal with null value', () => {
            const { result } = renderHook(() => useLocalSignal<string | null>(null));

            expect(result.current.value).toBeNull();
        });

        it('creates a signal with object value', () => {
            const initial = { name: 'test', count: 0 };
            const { result } = renderHook(() => useLocalSignal(initial));

            expect(result.current.value).toEqual({ name: 'test', count: 0 });
        });

        it('creates a signal with array value', () => {
            const { result } = renderHook(() => useLocalSignal<string[]>([]));

            expect(result.current.value).toEqual([]);
        });

        it('creates a signal with Set value', () => {
            const { result } = renderHook(() => useLocalSignal(new Set(['a', 'b'])));

            expect(result.current.value).toEqual(new Set(['a', 'b']));
        });
    });

    describe('initializer function', () => {
        it('accepts an initializer function', () => {
            const initializer = vi.fn(() => 'computed');
            const { result } = renderHook(() => useLocalSignal(initializer));

            expect(result.current.value).toBe('computed');
            expect(initializer).toHaveBeenCalledTimes(1);
        });

        it('only calls initializer once on mount', () => {
            const initializer = vi.fn(() => 'computed');
            const { rerender } = renderHook(() => useLocalSignal(initializer));

            rerender();
            rerender();

            expect(initializer).toHaveBeenCalledTimes(1);
        });

        it('works with complex computed initial values', () => {
            const initializer = () => ({
                timestamp: Date.now(),
                data: ['item1', 'item2'],
            });
            const { result } = renderHook(() => useLocalSignal(initializer));

            expect(result.current.value.data).toEqual(['item1', 'item2']);
            expect(typeof result.current.value.timestamp).toBe('number');
        });
    });

    describe('signal updates', () => {
        it('allows updating signal value', () => {
            const { result } = renderHook(() => useLocalSignal('initial'));

            act(() => {
                result.current.value = 'updated';
            });

            expect(result.current.value).toBe('updated');
        });

        it('maintains signal identity across rerenders', () => {
            const { result, rerender } = renderHook(() => useLocalSignal('test'));

            const signalBefore = result.current;

            rerender();

            expect(result.current).toBe(signalBefore);
        });

        it('supports object mutation', () => {
            const { result } = renderHook(() =>
                useLocalSignal({ count: 0, items: [] as string[] }),
            );

            act(() => {
                result.current.value = { count: 5, items: ['a', 'b'] };
            });

            expect(result.current.value.count).toBe(5);
            expect(result.current.value.items).toEqual(['a', 'b']);
        });
    });

    describe('instance isolation', () => {
        it('creates independent signals for multiple hook instances', () => {
            const { result: result1 } = renderHook(() => useLocalSignal('signal1'));
            const { result: result2 } = renderHook(() => useLocalSignal('signal2'));

            expect(result1.current.value).toBe('signal1');
            expect(result2.current.value).toBe('signal2');

            act(() => {
                result1.current.value = 'modified1';
            });

            expect(result1.current.value).toBe('modified1');
            expect(result2.current.value).toBe('signal2');
        });

        it('creates new signal on remount', () => {
            const { result, unmount } = renderHook(() => useLocalSignal('initial'));

            act(() => {
                result.current.value = 'modified';
            });

            unmount();

            const { result: newResult } = renderHook(() => useLocalSignal('initial'));

            expect(newResult.current.value).toBe('initial');
        });
    });

    describe('TypeScript types', () => {
        it('infers type from primitive', () => {
            const { result } = renderHook(() => useLocalSignal(42));

            expect(typeof result.current.value).toBe('number');
        });

        it('works with union types', () => {
            const { result } = renderHook(() => useLocalSignal<'a' | 'b' | null>('a'));

            expect(result.current.value).toBe('a');

            act(() => {
                result.current.value = 'b';
            });

            expect(result.current.value).toBe('b');

            act(() => {
                result.current.value = null;
            });

            expect(result.current.value).toBeNull();
        });
    });
});
