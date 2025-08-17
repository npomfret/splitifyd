interface LogContext {
    [key: string]: any;
}

function formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
}

export const logger = {
    debug: (message: string, context?: LogContext) => {
        if (process.env.DEBUG) {
            console.log(formatMessage('DEBUG', message, context));
        }
    },

    info: (message: string, context?: LogContext) => {
        console.log(formatMessage('INFO', message, context));
    },

    warn: (message: string, context?: LogContext) => {
        console.warn(formatMessage('WARN', message, context));
    },

    error: (message: string, context?: LogContext) => {
        console.error(formatMessage('ERROR', message, context));
    },
};
