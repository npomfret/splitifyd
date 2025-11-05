type DevInstanceMode = `dev${number}`;
export type InstanceMode = DevInstanceMode | 'prod' | 'test';

const DEV_MODE_PATTERN = /^dev[0-9]+$/;

export function assertValidInstanceMode(value: string | undefined): asserts value is InstanceMode {
    if (value === 'prod' || value === 'test') {
        return;
    }

    if (typeof value === 'string' && DEV_MODE_PATTERN.test(value)) {
        return;
    }

    const allowed = 'prod, test, dev<number>';
    throw new Error(`INSTANCE_MODE must be one of ${allowed}. Received: ${value ?? 'undefined'}`);
}

export function requireInstanceMode(): InstanceMode {
    const mode = process.env.INSTANCE_MODE;
    assertValidInstanceMode(mode);
    return mode;
}

/**
 * Get instance mode, defaulting to 'prod' if not set.
 * This is useful for Cloud Functions where INSTANCE_MODE may not be explicitly set.
 */
export function getInstanceMode(): InstanceMode {
    const mode = process.env.INSTANCE_MODE;
    if (!mode) {
        return 'prod';
    }
    assertValidInstanceMode(mode);
    return mode;
}

export function isDevInstanceMode(mode: InstanceMode): mode is DevInstanceMode {
    return mode.startsWith('dev');
}
