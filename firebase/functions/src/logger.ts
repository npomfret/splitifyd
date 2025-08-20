import * as functions from 'firebase-functions';

export const logger = {
    // Only log when something actually changes
    info: (label: string, data: { id?: string; [key: string]: any }) => {
        functions.logger.info(label, data);
    },

    // Keep errors rich and detailed
    error: (message: string, error: Error | any, context?: any) => {
        const errorData = error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
        } : error;
        
        functions.logger.error(message, {
            ...context,
            error: errorData,
        });
    },
};
