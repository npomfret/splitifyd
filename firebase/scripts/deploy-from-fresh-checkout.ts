import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

type DeployMode = 'all' | 'functions' | 'hosting' | 'rules' | 'indexes';

const repoRoot = resolve(__dirname, '../..');
const firebaseDir = resolve(__dirname, '..');
const functionsDir = join(firebaseDir, 'functions');
const envTemplateName = '.env.instanceprod';
const serviceAccountName = 'service-account-key.json';

const deployScriptMap: Record<DeployMode, string> = {
    all: 'deploy:prod:inner',
    functions: 'deploy:functions:inner',
    hosting: 'deploy:hosting:inner',
    rules: 'deploy:rules:inner',
    indexes: 'deploy:indexes:inner',
};

function run(command: string, args: string[], options?: Parameters<typeof spawnSync>[2]): void {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        ...options,
    });

    if (result.status !== 0) {
        const reason = result.error?.message ?? `exit code ${result.status}`;
        throw new Error(`Command failed: ${command} ${args.join(' ')} (${reason})`);
    }
}

function parseMode(rawMode: string | undefined): DeployMode {
    const normalised = (rawMode === undefined || rawMode === 'prod') ? 'all' : rawMode;
    if (!Object.hasOwn(deployScriptMap, normalised)) {
        throw new Error(
            `Unknown deploy mode "${rawMode}". Expected one of: ${Object.keys(deployScriptMap).join(', ')}`,
        );
    }
    return normalised as DeployMode;
}

function ensureFile(path: string, description: string): void {
    if (!existsSync(path)) {
        throw new Error(`Missing required ${description}. Expected file at ${path}.`);
    }
}

function cloneRepository(): { tempRoot: string; cloneDir: string; } {
    const tempRoot = mkdtempSync(join(tmpdir(), 'app-deploy-'));
    const cloneDir = join(tempRoot, 'repo');
    run('git', ['clone', '--depth', '1', repoRoot, cloneDir]);
    return { tempRoot, cloneDir };
}

function installDependencies(cloneDir: string, env: NodeJS.ProcessEnv): void {
    run('npm', ['install'], { cwd: cloneDir, env });
}

function runMonorepoBuild(cloneDir: string, env: NodeJS.ProcessEnv): void {
    run('npm', ['run', 'build'], {
        cwd: cloneDir,
        env: {
            ...env,
            BUILD_MODE: 'production',
        },
    });
}

function copySecretsIntoClone(cloneFirebaseDir: string): { envPath: string; serviceAccountPath: string; } {
    const envSource = join(functionsDir, envTemplateName);
    const envDestination = join(cloneFirebaseDir, 'functions', envTemplateName);
    copyFileSync(envSource, envDestination);

    const serviceAccountSource = join(firebaseDir, serviceAccountName);
    const serviceAccountDestination = join(cloneFirebaseDir, serviceAccountName);
    copyFileSync(serviceAccountSource, serviceAccountDestination);

    return {
        envPath: envDestination,
        serviceAccountPath: serviceAccountDestination,
    };
}

function runLinkWebapp(cloneFirebaseDir: string, env: NodeJS.ProcessEnv): void {
    run('npm', ['run', 'link-webapp'], { cwd: cloneFirebaseDir, env });
}

function runInnerDeploy(cloneFirebaseDir: string, mode: DeployMode, env: NodeJS.ProcessEnv): void {
    const scriptName = deployScriptMap[mode];
    run('npm', ['run', scriptName], { cwd: cloneFirebaseDir, env });
}

function runPostDeploySyncTenant(cloneFirebaseDir: string, env: NodeJS.ProcessEnv): void {
    console.log('🔄 Syncing default tenant to production Firestore...');
    run('npm', ['run', 'postdeploy:sync-tenant'], { cwd: cloneFirebaseDir, env });
}

function removeSecrets(cloneFirebaseDir: string): void {
    rmSync(join(cloneFirebaseDir, 'functions', envTemplateName), { force: true });
    rmSync(join(cloneFirebaseDir, 'functions', '.env'), { force: true });
    rmSync(join(cloneFirebaseDir, serviceAccountName), { force: true });
}

function deploy(mode: DeployMode): void {
    const envSourcePath = join(functionsDir, envTemplateName);
    const serviceAccountSourcePath = join(firebaseDir, serviceAccountName);

    ensureFile(envSourcePath, 'production environment template (.env.instanceprod)');
    ensureFile(serviceAccountSourcePath, 'service account key');

    const { tempRoot, cloneDir } = cloneRepository();
    const cloneFirebaseDir = join(cloneDir, 'firebase');

    const deployEnv: NodeJS.ProcessEnv = {
        ...process.env,
    };

    const npmHomeDir = join(cloneDir, '.npm-home');
    const npmLogDir = join(npmHomeDir, '_logs');
    mkdirSync(npmLogDir, { recursive: true });
    deployEnv.HOME = npmHomeDir;
    deployEnv.NPM_CONFIG_LOGDIR = npmLogDir;

    try {
        installDependencies(cloneDir, deployEnv);

        const { serviceAccountPath } = copySecretsIntoClone(cloneFirebaseDir);
        deployEnv.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;

        runMonorepoBuild(cloneDir, deployEnv);

        if (mode === 'all' || mode === 'hosting') {
            runLinkWebapp(cloneFirebaseDir, deployEnv);
        }

        runInnerDeploy(cloneFirebaseDir, mode, deployEnv);

        // Sync default tenant after successful deployment
        runPostDeploySyncTenant(cloneFirebaseDir, deployEnv);

        removeSecrets(cloneFirebaseDir);
        rmSync(tempRoot, { recursive: true, force: true });
        console.log('✅ Deployment completed from fresh checkout');
    } catch (error) {
        removeSecrets(cloneFirebaseDir);
        console.error(`❌ Deployment failed. Temporary workspace preserved at ${cloneDir}`);
        throw error;
    }
}

function main(): void {
    const modeArg = process.argv[2];
    const mode = parseMode(modeArg);
    deploy(mode);
}

main();
