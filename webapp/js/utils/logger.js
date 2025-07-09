function formatArgs(args) {
    return args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return '[[Circular Reference]]';
            }
        }
        return arg;
    });
}

export const logger = {
    log: (...args) => {
        console.log(...formatArgs(args));
    },
    warn: (...args) => {
        console.warn(...formatArgs(args));
    },
    error: (...args) => {
        console.error(...formatArgs(args));
    },
};
