import { beforeEach, describe, expect, it } from 'vitest';
import { PerformanceTimer } from '../../../monitoring/PerformanceTimer';

describe('PerformanceTimer', () => {
    let timer: PerformanceTimer;

    beforeEach(() => {
        timer = new PerformanceTimer();
    });

    describe('basic phase timing', () => {
        it('should time a single phase', async () => {
            timer.startPhase('query');
            await sleep(10);
            timer.endPhase();

            const timings = timer.getTimings();

            expect(timings.queryMs).toBeGreaterThanOrEqual(10);
            expect(timings.queryMs).toBeLessThan(20);
            expect(timings.totalMs).toBeUndefined(); // Only one phase, no total
        });

        it('should time multiple sequential phases', async () => {
            timer.startPhase('query');
            await sleep(10);
            timer.endPhase();

            timer.startPhase('transaction');
            await sleep(15);
            timer.endPhase();

            const timings = timer.getTimings();

            expect(timings.queryMs).toBeGreaterThanOrEqual(10);
            expect(timings.queryMs).toBeLessThan(20);
            expect(timings.transactionMs).toBeGreaterThanOrEqual(15);
            expect(timings.transactionMs).toBeLessThan(25);
            expect(timings.totalMs).toBeGreaterThanOrEqual(25);
        });

        it('should handle phases with zero duration', () => {
            timer.startPhase('instant');
            timer.endPhase();

            const timings = timer.getTimings();

            expect(timings.instantMs).toBeDefined();
            expect(timings.instantMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('nested phase timing', () => {
        it('should properly handle nested phases', async () => {
            timer.startPhase('transaction');
            await sleep(5);

            timer.startPhase('transaction:read');
            await sleep(10);
            timer.endPhase(); // End nested phase

            await sleep(5);

            timer.startPhase('transaction:write');
            await sleep(10);
            timer.endPhase(); // End nested phase

            await sleep(5);
            timer.endPhase(); // End parent transaction phase

            const timings = timer.getTimings();

            // Nested phases should have their own timings
            expect(timings['transaction:readMs']).toBeGreaterThanOrEqual(10);
            expect(timings['transaction:readMs']).toBeLessThan(20);
            expect(timings['transaction:writeMs']).toBeGreaterThanOrEqual(10);
            expect(timings['transaction:writeMs']).toBeLessThan(20);

            // Parent transaction should include all the time (5 + 10 + 5 + 10 + 5 = 35ms)
            expect(timings.transactionMs).toBeGreaterThanOrEqual(35);
            expect(timings.transactionMs).toBeLessThan(50);

            // Total should sum all top-level phases
            expect(timings.totalMs).toBeGreaterThanOrEqual(35);
        });

        it('should handle multiple levels of nesting', async () => {
            timer.startPhase('operation');
            await sleep(5);

            timer.startPhase('operation:phase1');
            await sleep(5);

            timer.startPhase('operation:phase1:substep');
            await sleep(10);
            timer.endPhase(); // End substep

            await sleep(5);
            timer.endPhase(); // End phase1

            await sleep(5);
            timer.endPhase(); // End operation

            const timings = timer.getTimings();

            expect(timings['operation:phase1:substepMs']).toBeGreaterThanOrEqual(10);
            expect(timings['operation:phase1Ms']).toBeGreaterThanOrEqual(20); // 5 + 10 + 5
            expect(timings.operationMs).toBeGreaterThanOrEqual(30); // 5 + 20 + 5
        });

        it('should handle interleaved nested phases', async () => {
            timer.startPhase('parent');
            await sleep(5);

            timer.startPhase('child1');
            await sleep(10);
            timer.endPhase();

            await sleep(5);

            timer.startPhase('child2');
            await sleep(10);
            timer.endPhase();

            await sleep(5);
            timer.endPhase(); // End parent

            const timings = timer.getTimings();

            expect(timings.child1Ms).toBeGreaterThanOrEqual(10);
            expect(timings.child2Ms).toBeGreaterThanOrEqual(10);
            // Parent should include everything: 5 + 10 + 5 + 10 + 5 = 35ms
            expect(timings.parentMs).toBeGreaterThanOrEqual(35);
        });
    });

    describe('auto-ending phases', () => {
        it('should auto-end phases when getTimings() is called', async () => {
            timer.startPhase('query');
            await sleep(10);
            // Don't call endPhase()

            const timings = timer.getTimings();

            expect(timings.queryMs).toBeGreaterThanOrEqual(10);
            expect(timings.queryMs).toBeLessThan(20);
        });

        it('should auto-end nested phases when getTimings() is called', async () => {
            timer.startPhase('parent');
            await sleep(5);

            timer.startPhase('child');
            await sleep(10);
            // Don't call endPhase() for either

            const timings = timer.getTimings();

            expect(timings.childMs).toBeGreaterThanOrEqual(10);
            expect(timings.parentMs).toBeGreaterThanOrEqual(15);
        });
    });

    describe('phase accumulation', () => {
        it('should accumulate time when same phase is measured multiple times', async () => {
            timer.startPhase('query');
            await sleep(10);
            timer.endPhase();

            timer.startPhase('query'); // Same phase name again
            await sleep(15);
            timer.endPhase();

            const timings = timer.getTimings();

            // Should sum both measurements: 10 + 15 = 25ms
            expect(timings.queryMs).toBeGreaterThanOrEqual(25);
            expect(timings.queryMs).toBeLessThan(35);
        });
    });

    describe('edge cases', () => {
        it('should handle endPhase() when no phase is active', () => {
            timer.endPhase(); // Should not throw

            const timings = timer.getTimings();
            expect(Object.keys(timings)).toHaveLength(0);
        });

        it('should handle multiple endPhase() calls', () => {
            timer.startPhase('phase');
            timer.endPhase();
            timer.endPhase(); // Extra call, should not throw

            const timings = timer.getTimings();
            expect(timings.phaseMs).toBeDefined();
        });

        it('should return empty timings for unused timer', () => {
            const timings = timer.getTimings();
            expect(Object.keys(timings)).toHaveLength(0);
        });
    });

    describe('reset', () => {
        it('should clear all timings on reset', async () => {
            timer.startPhase('query');
            await sleep(10);
            timer.endPhase();

            timer.reset();

            const timings = timer.getTimings();
            expect(Object.keys(timings)).toHaveLength(0);
        });

        it('should allow reuse after reset', async () => {
            timer.startPhase('phase1');
            await sleep(10);
            timer.endPhase();

            timer.reset();

            timer.startPhase('phase2');
            await sleep(15);
            timer.endPhase();

            const timings = timer.getTimings();

            expect(timings.phase1Ms).toBeUndefined();
            expect(timings.phase2Ms).toBeGreaterThanOrEqual(15);
        });
    });

    describe('total calculation', () => {
        it('should not include total for single phase', () => {
            timer.startPhase('single');
            timer.endPhase();

            const timings = timer.getTimings();
            expect(timings.totalMs).toBeUndefined();
        });

        it('should calculate total for multiple phases', async () => {
            timer.startPhase('phase1');
            await sleep(10);
            timer.endPhase();

            timer.startPhase('phase2');
            await sleep(15);
            timer.endPhase();

            const timings = timer.getTimings();

            expect(timings.totalMs).toBeGreaterThanOrEqual(25);
            expect(timings.totalMs).toBeLessThan(35);
        });

        it('should sum all phases including nested ones', async () => {
            timer.startPhase('parent');
            await sleep(10);
            timer.endPhase();

            timer.startPhase('nested:child');
            await sleep(15);
            timer.endPhase();

            const timings = timer.getTimings();

            // Total should be sum of all phases
            expect(timings.totalMs).toBeGreaterThanOrEqual(25);
        });
    });

    describe('real-world scenarios', () => {
        it('should accurately measure transaction with nested operations', async () => {
            // Simulate the fixed group join scenario
            timer.startPhase('query');
            await sleep(20);
            timer.endPhase();

            timer.startPhase('transaction');
            await sleep(5); // Setup

            timer.startPhase('transaction:getMemberships');
            await sleep(8);
            timer.endPhase();

            timer.startPhase('transaction:createMembership');
            await sleep(1);
            timer.endPhase();

            timer.startPhase('transaction:recordActivityFeed');
            await sleep(1);
            timer.endPhase();

            await sleep(3000); // Simulated Firestore commit time
            timer.endPhase(); // End transaction

            const timings = timer.getTimings();

            expect(timings.queryMs).toBeGreaterThanOrEqual(20);
            expect(timings['transaction:getMembershipsMs']).toBeGreaterThanOrEqual(8);
            expect(timings['transaction:createMembershipMs']).toBeGreaterThanOrEqual(1);
            expect(timings['transaction:recordActivityFeedMs']).toBeGreaterThanOrEqual(1);

            // The transaction phase should include ALL time including commit
            expect(timings.transactionMs).toBeGreaterThanOrEqual(3015); // 5 + 8 + 1 + 1 + 3000

            // Total should include query + transaction
            expect(timings.totalMs).toBeGreaterThanOrEqual(3035);
        });
    });
});

/**
 * Sleep utility for testing
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
