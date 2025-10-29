interface PhaseStackEntry {
    name: string;
    startTime: number;
}

/**
 * Reusable performance timer for tracking operation timings with support for nested phases
 */
export class PerformanceTimer {
    private phases: Map<string, number> = new Map();
    private phaseStack: PhaseStackEntry[] = [];

    /**
     * Start timing a phase (supports nesting)
     */
    startPhase(phaseName: string): void {
        this.phaseStack.push({
            name: phaseName,
            startTime: performance.now(),
        });
    }

    /**
     * End the most recently started phase
     */
    endPhase(): void {
        if (this.phaseStack.length === 0) {
            return;
        }

        const phase = this.phaseStack.pop()!;
        const duration = performance.now() - phase.startTime;

        // Accumulate time if phase was already recorded (allows multiple measurements of same phase)
        const existingDuration = this.phases.get(phase.name) || 0;
        this.phases.set(phase.name, existingDuration + duration);
    }

    /**
     * Get timing results in milliseconds
     */
    getTimings(): Record<string, number> {
        // End all remaining phases on the stack
        while (this.phaseStack.length > 0) {
            this.endPhase();
        }

        const timings: Record<string, number> = {};
        let total = 0;

        // Convert to ms and build result object
        for (const [phase, duration] of this.phases.entries()) {
            const ms = Math.round(duration);
            timings[`${phase}Ms`] = ms;
            total += ms;
        }

        // Add total if there are multiple phases
        if (this.phases.size > 1) {
            timings.totalMs = total;
        }

        return timings;
    }

    /**
     * Reset the timer
     */
    reset(): void {
        this.phases.clear();
        this.phaseStack = [];
    }
}
