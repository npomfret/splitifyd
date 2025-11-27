import { ThemePage } from '@billsplit-wl/test-support';
import { expect } from '@playwright/test';
import { simpleTest as test } from '../../fixtures/simple-test.fixture';
import { EMULATOR_URL } from '../../helpers';

const emulatorUrl = new URL(EMULATOR_URL);
const portSegment = emulatorUrl.port ? `:${emulatorUrl.port}` : '';
const pathSuffix = emulatorUrl.pathname === '/' ? '' : emulatorUrl.pathname;
const protocol = emulatorUrl.protocol || 'http:';

const AURORA_URL = `${protocol}//localhost${portSegment}${pathSuffix}`;
const BRUTALIST_URL = `${protocol}//127.0.0.1${portSegment}${pathSuffix}`;

test.describe('Theme switching smoke tests', () => {
    test('Different hosts serve different button styles', async ({ newEmptyBrowser }) => {
        // Get Aurora theme colors
        const { page: auroraPage } = await newEmptyBrowser();
        const auroraTheme = new ThemePage(auroraPage);
        await auroraTheme.navigateTo(AURORA_URL);
        const auroraColors = await auroraTheme.getSignUpButtonColors();

        // Get Brutalist theme colors
        const { page: brutalistPage } = await newEmptyBrowser();
        const brutalistTheme = new ThemePage(brutalistPage);
        await brutalistTheme.navigateTo(BRUTALIST_URL);
        const brutalistColors = await brutalistTheme.getSignUpButtonColors();

        // Assert they are DIFFERENT (don't care what the values are)
        const auroraStyle = auroraColors.backgroundImage !== 'none'
            ? auroraColors.backgroundImage
            : auroraColors.backgroundColor;
        const brutalistStyle = brutalistColors.backgroundImage !== 'none'
            ? brutalistColors.backgroundImage
            : brutalistColors.backgroundColor;

        expect(auroraStyle).not.toBe(brutalistStyle);
    });

    test('Different hosts serve different glassmorphism support', async ({ newEmptyBrowser }) => {
        // Get Aurora glassmorphism value
        const { page: auroraPage } = await newEmptyBrowser();
        const auroraTheme = new ThemePage(auroraPage);
        await auroraTheme.navigateTo(AURORA_URL);
        const auroraGlass = await auroraTheme.getGlassmorphismValue();

        // Get Brutalist glassmorphism value
        const { page: brutalistPage } = await newEmptyBrowser();
        const brutalistTheme = new ThemePage(brutalistPage);
        await brutalistTheme.navigateTo(BRUTALIST_URL);
        const brutalistGlass = await brutalistTheme.getGlassmorphismValue();

        // Assert they are DIFFERENT (don't care what the values are)
        expect(auroraGlass).not.toBe(brutalistGlass);
    });
});
