import { HTTP_STATUS } from '../constants';

export interface HttpRequest {
    method: string;
}

export interface HttpResponse {
    setHeader(name: string, value: string): void;
    status(code: number): HttpResponse;
    json(body: unknown): HttpResponse;
}

export const ensureGetMethod = (req: HttpRequest, res: HttpResponse): boolean => {
    if (req.method === 'GET') {
        return true;
    }

    res.setHeader('Allow', 'GET');
    res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
        error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'Only GET is supported',
        },
    });
    return false;
};

export const createDiagnosticsFunctionOptions = () => ({
    invoker: 'public' as const,
    region: 'us-central1',
    timeoutSeconds: 10,
    memory: '256MiB' as const,
});
