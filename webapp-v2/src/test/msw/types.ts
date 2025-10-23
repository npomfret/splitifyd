export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type UrlMatchKind = 'exact' | 'prefix' | 'regex';

export type SerializedBodyMatcher =
    | {
        type: 'json-equals';
        value: unknown;
    }
    | {
        type: 'json-subset';
        subset: Record<string, unknown>;
    }
    | {
        type: 'text-equals';
        value: string;
    };

interface SerializedMswResponse {
    status?: number;
    headers?: Record<string, string>;
    body?: unknown;
    rawBody?: string;
    contentType?: string;
}

export interface SerializedMswHandler {
    id?: string;
    method: HttpMethod;
    url: string;
    urlKind?: UrlMatchKind;
    once?: boolean;
    delayMs?: number;
    query?: Record<string, string>;
    bodyMatcher?: SerializedBodyMatcher;
    response: SerializedMswResponse;
}

export interface ActiveHandlerSummary {
    id: string;
    method: HttpMethod;
    url: string;
    urlKind: UrlMatchKind;
}
