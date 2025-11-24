type DevInstanceName = `dev${number}`;
type StagingInstanceName = `staging-${number}`;
export type InstanceName = DevInstanceName | StagingInstanceName;

const DEV_NAME_PATTERN = /^dev[0-9]+$/;
const STAGING_NAME_PATTERN = /^staging-[0-9]+$/;

export function assertValidInstanceName(value: string | undefined): asserts value is InstanceName {
    if (typeof value === 'string' && (DEV_NAME_PATTERN.test(value) || STAGING_NAME_PATTERN.test(value))) {
        return;
    }

    const allowed = 'dev<number>, staging-<number>';
    throw new Error(`INSTANCE_NAME must be one of ${allowed}. Received: ${value ?? 'undefined'}`);
}

export function requireInstanceName(): InstanceName {
    const name = process.env.INSTANCE_NAME;
    assertValidInstanceName(name);
    return name;
}

/**
 * Get instance name with strict validation - no defaults.
 * INSTANCE_NAME must be set explicitly via environment variables.
 */
export function getInstanceName(): InstanceName {
    const name = process.env.INSTANCE_NAME;
    assertValidInstanceName(name);
    return name;
}

export function isDevInstanceName(name: InstanceName): name is DevInstanceName {
    return name.startsWith('dev');
}

export function isStagingInstanceName(name: InstanceName): name is StagingInstanceName {
    return STAGING_NAME_PATTERN.test(name);
}
