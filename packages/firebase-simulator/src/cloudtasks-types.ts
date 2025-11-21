/**
 * Interface for Cloud Tasks client operations
 * Abstracts the Google Cloud Tasks API for dependency injection and testing
 */
export interface ICloudTasksClient {
    /**
     * Get the full queue path for Cloud Tasks
     */
    queuePath(projectId: string, location: string, queueName: string): string;

    /**
     * Create a new task in the specified queue
     */
    createTask(request: {
        parent: string;
        task: {
            httpRequest: {
                httpMethod: 'POST' | 'GET' | 'PUT' | 'DELETE';
                url: string;
                headers?: Record<string, string>;
                body?: string;
            };
        };
    }): Promise<[{ name: string }]>;
}
