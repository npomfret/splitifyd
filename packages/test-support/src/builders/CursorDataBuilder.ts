import { generateShortId, randomDate } from '../test-helpers';

export interface CursorData {
    updatedAt: string;
    id: string;
}

/**
 * Builder for creating CursorData objects for pagination testing
 */
export class CursorDataBuilder {
    private data: CursorData = {
        updatedAt: randomDate(),
        id: `doc-${generateShortId()}`,
    };

    withUpdatedAt(updatedAt: string): this {
        this.data.updatedAt = updatedAt;
        return this;
    }

    withId(id: string): this {
        this.data.id = id;
        return this;
    }

    build(): CursorData {
        return { ...this.data };
    }
}
