const SERIALIZED_TYPE_KEY = '__apiType';

export interface SerializableDefinition<T> {
    type: string;
    isType(value: unknown): value is T;
    serialize(value: T): unknown;
    deserialize(payload: unknown): T;
}

const registry = new Map<string, SerializableDefinition<any>>();

const reverseText = (value: string): string => value.split('').reverse().join('');

const encode = (value: unknown): unknown => {
    if (value === null) {
        return null;
    }

    if (value === undefined) {
        return undefined;
    }

    if (Array.isArray(value)) {
        return value.map((item) => {
            const encoded = encode(item);
            return encoded === undefined ? null : encoded;
        });
    }

    if (typeof value === 'object') {
        const typeHint = (value as any)[SERIALIZED_TYPE_KEY];
        if (typeof typeHint === 'string' && registry.has(typeHint)) {
            const definition = registry.get(typeHint)!;
            return {
                [SERIALIZED_TYPE_KEY]: definition.type,
                data: encode(definition.serialize(value)),
            };
        }

        for (const definition of registry.values()) {
            if (definition.isType(value)) {
                return {
                    [SERIALIZED_TYPE_KEY]: definition.type,
                    data: encode(definition.serialize(value)),
                };
            }
        }

        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            const encoded = encode(item);
            if (encoded !== undefined) {
                result[key] = encoded;
            }
        }
        return result;
    }

    return value;
};

const decode = (value: unknown): unknown => {
    if (value === null || value === undefined) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => decode(item));
    }

    if (typeof value === 'object') {
        const serializedObject = value as Record<string, unknown>;
        const typeName = serializedObject[SERIALIZED_TYPE_KEY];
        if (typeof typeName === 'string' && registry.has(typeName)) {
            const definition = registry.get(typeName)!;
            return definition.deserialize(decode(serializedObject.data));
        }

        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(serializedObject)) {
            result[key] = decode(item);
        }
        return result;
    }

    return value;
};

export class ApiSerializer {
    static register<T>(definition: SerializableDefinition<T>): void {
        if (registry.has(definition.type)) {
            throw new Error(`Serializable type "${definition.type}" is already registered`);
        }
        registry.set(definition.type, definition);
    }

    static serialize<T>(payload: T): string {
        const processed = encode(payload);
        const json = JSON.stringify(processed);
        return reverseText(json);
    }

    static deserialize<T>(payload: string): T {
        const json = reverseText(payload);
        const raw = JSON.parse(json);
        return decode(raw) as T;
    }
}

export const createSerializableMarker = (type: string) => ({
    [SERIALIZED_TYPE_KEY]: type,
});
