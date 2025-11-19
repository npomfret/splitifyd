type DevInstanceName = `dev${number}`;
export type InstanceName = DevInstanceName | 'prod';

const DEV_NAME_PATTERN = /^dev[0-9]+$/;

export function assertValidInstanceName(value: string | undefined): asserts value is InstanceName {
    if (value === 'prod') {
        return;
    }

    if (typeof value === 'string' && DEV_NAME_PATTERN.test(value)) {
        return;
    }

    const allowed = 'prod, dev<number>';
    throw new Error(`INSTANCE_NAME must be one of ${allowed}. Received: ${value ?? 'undefined'}`);
}

export function requireInstanceName(): InstanceName {
    const name = process.env.INSTANCE_NAME;
    assertValidInstanceName(name);
    return name;
}

/**
 * Get instance name, defaulting to 'prod' if not set.
 * This is useful for Cloud Functions where INSTANCE_NAME may not be explicitly set.
 */
export function getInstanceName(): InstanceName {
    const name = process.env.INSTANCE_NAME;
    if (!name) {
        return 'prod';
    }
    assertValidInstanceName(name);
    return name;
}

export function isDevInstanceName(name: InstanceName): name is DevInstanceName {
    return name.startsWith('dev');
}
