/**
 * Reusable performance timer for tracking operation timings
 */
export class PerformanceTimer {
    private phases: Map<string, number> = new Map();
    private currentPhase: string | null = null;
    private phaseStart: number = 0;

    /**
     * Start timing a phase
     */
    startPhase(phaseName: string): void {
        // End current phase if one is running
        if (this.currentPhase) {
            this.endPhase();
        }

        this.currentPhase = phaseName;
        this.phaseStart = performance.now();
    }

    /**
     * End the current phase
     */
    endPhase(): void {
        if (!this.currentPhase) {
            return;
        }

        const duration = performance.now() - this.phaseStart;
        this.phases.set(this.currentPhase, duration);
        this.currentPhase = null;
        this.phaseStart = 0;
    }

    /**
     * Get timing results in milliseconds
     */
    getTimings(): Record<string, number> {
        // End current phase if still running
        if (this.currentPhase) {
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
        this.currentPhase = null;
        this.phaseStart = 0;
    }
}
