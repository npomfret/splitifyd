/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 * @param func The function to debounce.
 * @param wait The number of milliseconds to wait after the last call.
 * @param immediate If true, trigger the function on the leading edge.
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number, immediate: boolean = false): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null;
    let result: any;

    return function(this: any, ...args: Parameters<T>): void {
        const context = this;
        const later = function() {
            timeout = null;
            if (!immediate) {
                result = func.apply(context, args);
            }
        };

        const callNow = immediate && !timeout;
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
        if (callNow) {
            result = func.apply(context, args);
        }

        return result;
    };
}

/**
 * Creates a throttled function that only invokes `func` at most once per
 * every `wait` milliseconds.
 * @param func The function to throttle.
 * @param wait The number of milliseconds to throttle invocations to.
 */
export function throttle<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let inThrottle: boolean, lastFn: ReturnType<typeof setTimeout>, lastTime: number;
    return function(this: any, ...args: Parameters<T>): void {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            lastTime = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFn);
            lastFn = setTimeout(function() {
                if (Date.now() - lastTime >= wait) {
                    func.apply(context, args);
                    lastTime = Date.now();
                }
            }, Math.max(wait - (Date.now() - lastTime), 0));
        }
    };
}