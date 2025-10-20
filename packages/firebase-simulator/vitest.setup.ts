import { beforeEach, afterEach } from 'vitest';

const DEFAULT_TIMEOUT_MS = 3000;
const activeTimers = new WeakMap<Parameters<typeof beforeEach>[0], NodeJS.Timeout>();

function getLabel(context: Parameters<typeof beforeEach>[0]): string {
    const meta = context as Record<string, any>;
    return meta?.task?.name ?? meta?.meta?.name ?? 'Unknown test';
}

beforeEach((ctx) => {
    const timer = setTimeout(() => {
        // Fail hard so the suite never hangs indefinitely.
        const label = getLabel(ctx);
        console.error(`\n⏱️  Test timed out after ${DEFAULT_TIMEOUT_MS}ms: ${label}`);
        process.exitCode = 1;
        process.exit(1);
    }, DEFAULT_TIMEOUT_MS);

    activeTimers.set(ctx, timer);

    const maybeCtx = ctx as unknown as { onTestFinished?: (callback: () => void) => void };
    if (typeof maybeCtx.onTestFinished === 'function') {
        maybeCtx.onTestFinished(() => {
            clearTimeout(timer);
            activeTimers.delete(ctx);
        });
    }
});

afterEach((ctx) => {
    const timer = activeTimers.get(ctx);
    if (timer) {
        clearTimeout(timer);
        activeTimers.delete(ctx);
    }
});
