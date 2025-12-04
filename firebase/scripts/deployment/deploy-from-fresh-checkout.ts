import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

type DeployMode = 'all' | 'functions' | 'hosting' | 'rules' | 'indexes';

const repoRoot = resolve(__dirname, '../../..');
const firebaseDir = resolve(__dirname, '../..');
const functionsDir = join(firebaseDir, 'functions');
const serviceAccountName = 'service-account-key.json';

function getEnvTemplateName(instance: string): string {
    return `.env.instance${instance}`;
}

function getDeployScriptMap(instance: string): Record<DeployMode, string[]> {
    return {
        all: ['deploy:staging-1:inner', instance],
        functions: ['deploy:functions:inner', instance],
        hosting: ['deploy:hosting:inner', instance],
        rules: ['deploy:rules:inner', instance],
        indexes: ['deploy:indexes:inner', instance],
    };
}

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

interface ParsedArgs {
    mode: DeployMode;
    instance: string;
}

function parseArgs(args: string[]): ParsedArgs {
    const validModes: DeployMode[] = ['all', 'functions', 'hosting', 'rules', 'indexes'];
    let mode: DeployMode = 'all';
    let instance = 'staging-1';

    for (const arg of args) {
        if (validModes.includes(arg as DeployMode)) {
            mode = arg as DeployMode;
        } else if (/^staging-\d+$/.test(arg)) {
            instance = arg;
        } else if (arg) {
            throw new Error(
                `Unknown argument "${arg}". Expected mode (${validModes.join(', ')}) or instance (staging-N).`,
            );
        }
    }

    return { mode, instance };
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

function runMonorepoBuild(cloneDir: string, instance: string, env: NodeJS.ProcessEnv): void {
    run('npm', ['run', 'build'], {
        cwd: cloneDir,
        env: {
            ...env,
            __INSTANCE_NAME: instance,
        },
    });
}

function copySecretsIntoClone(cloneFirebaseDir: string, instance: string): { envPath: string; serviceAccountPath: string; } {
    const envTemplateName = getEnvTemplateName(instance);
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

function runInnerDeploy(cloneFirebaseDir: string, mode: DeployMode, instance: string, env: NodeJS.ProcessEnv): void {
    const [scriptName, instanceArg] = getDeployScriptMap(instance)[mode];
    run('npm', ['run', scriptName, '--', instanceArg], { cwd: cloneFirebaseDir, env });
}

function removeSecrets(cloneFirebaseDir: string, instance: string): void {
    const envTemplateName = getEnvTemplateName(instance);
    rmSync(join(cloneFirebaseDir, 'functions', envTemplateName), { force: true });
    rmSync(join(cloneFirebaseDir, 'functions', '.env'), { force: true });
    rmSync(join(cloneFirebaseDir, serviceAccountName), { force: true });
}

function deploy(mode: DeployMode, instance: string): void {
    const envTemplateName = getEnvTemplateName(instance);
    const envSourcePath = join(functionsDir, envTemplateName);
    const serviceAccountSourcePath = join(firebaseDir, serviceAccountName);

    ensureFile(envSourcePath, `staging environment template (${envTemplateName})`);
    ensureFile(serviceAccountSourcePath, 'service account key');

    console.log(`🚀 Deploying ${mode} to ${instance} from fresh checkout...`);

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

        const { serviceAccountPath } = copySecretsIntoClone(cloneFirebaseDir, instance);
        deployEnv.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;

        runMonorepoBuild(cloneDir, instance, deployEnv);

        if (mode === 'all' || mode === 'hosting') {
            runLinkWebapp(cloneFirebaseDir, deployEnv);
        }

        runInnerDeploy(cloneFirebaseDir, mode, instance, deployEnv);

        removeSecrets(cloneFirebaseDir, instance);
        rmSync(tempRoot, { recursive: true, force: true });
        console.log(`✅ Deployment to ${instance} completed from fresh checkout`);
        console.log('');
        console.log('📋 Next steps:');
        console.log('  1. Sync tenants to deployed Firebase:');
        console.log('     GCLOUD_PROJECT=splitifyd npm run postdeploy:sync-tenant -- test@test.com passwordpass');
        console.log('');
    } catch (error) {
        removeSecrets(cloneFirebaseDir, instance);
        console.error(`❌ Deployment failed. Temporary workspace preserved at ${cloneDir}`);
        throw error;
    }
}

function main(): void {
    const args = process.argv.slice(2);
    const { mode, instance } = parseArgs(args);
    deploy(mode, instance);
}

main();
