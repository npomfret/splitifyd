import { ThemePage } from '@billsplit-wl/test-support';
import { simpleTest as test } from '../../fixtures/simple-test.fixture';
import { EMULATOR_URL } from '../../helpers';

const emulatorUrl = new URL(EMULATOR_URL);
const portSegment = emulatorUrl.port ? `:${emulatorUrl.port}` : '';
const pathSuffix = emulatorUrl.pathname === '/' ? '' : emulatorUrl.pathname;
const protocol = emulatorUrl.protocol || 'http:';

const AURORA_URL = `${protocol}//localhost${portSegment}${pathSuffix}`;
const BRUTALIST_URL = `${protocol}//127.0.0.1${portSegment}${pathSuffix}`;

test.describe('Theme switching smoke tests', () => {
    test('Aurora theme surfaces teal primary actions', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const themePage = new ThemePage(page);

        await themePage.navigateTo(AURORA_URL);

        // Check the primary CTA button uses a colored (non-gray) background
        await themePage.expectSignUpButtonHasColor();

        const appName = await themePage.getTenantAppName(AURORA_URL);
        await themePage.expectHeaderAppName(appName);
    });

    test('Brutalist theme restricts actions to grayscale palette', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const themePage = new ThemePage(page);

        await themePage.navigateTo(BRUTALIST_URL);

        // Check the primary CTA button uses grayscale palette only
        await themePage.expectSignUpButtonIsGrayscale();

        const appName = await themePage.getTenantAppName(BRUTALIST_URL);
        await themePage.expectHeaderAppName(appName);
    });

    test('Aurora theme enables glassmorphism via .glass-panel class', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const themePage = new ThemePage(page);

        await themePage.navigateTo(AURORA_URL);

        // Aurora theme should have glassmorphism support
        await themePage.expectGlassmorphismSupport();
    });

    test('Brutalist theme has no .glass-panel styling', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const themePage = new ThemePage(page);

        await themePage.navigateTo(BRUTALIST_URL);

        // Brutalist theme should have no glassmorphism
        await themePage.expectNoGlassmorphism();
    });

    test('Aurora maintains accessible contrast between text and base surface', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const themePage = new ThemePage(page);

        await themePage.navigateTo(AURORA_URL);

        await themePage.expectAccessibleContrast();
    });

    test('Brutalist maintains accessible contrast between text and base surface', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const themePage = new ThemePage(page);

        await themePage.navigateTo(BRUTALIST_URL);

        await themePage.expectAccessibleContrast();
    });
});
