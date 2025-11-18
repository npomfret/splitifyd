
import { convertToISOString } from '../test-helpers';
import type { ISOString } from '@billsplit-wl/shared';

export interface PolicyVersion {
    text: string;
    createdAt: ISOString;
}

export class PolicyVersionBuilder {
    private version: Partial<PolicyVersion> = {};

    constructor() {
        this.version.text = 'Default policy text';
        this.version.createdAt = convertToISOString(new Date());
    }

    withText(text: string): this {
        this.version.text = text;
        return this;
    }

    withCreatedAt(createdAt: ISOString | Date | string): this {
        this.version.createdAt = convertToISOString(createdAt);
        return this;
    }

    build(): PolicyVersion {
        return this.version as PolicyVersion;
    }
}
