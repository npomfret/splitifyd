import { getHostingPort, ThemePage } from '@billsplit-wl/test-support';
import { expect } from '@playwright/test';
import { simpleTest as test } from '../../fixtures/simple-test.fixture';

const port = getHostingPort();
const AURORA_URL = `http://localhost:${port}`;
const BRUTALIST_URL = `http://127.0.0.1:${port}`;

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

    test('Different hosts serve different app names', async ({ newEmptyBrowser }) => {
        // Get Aurora app name
        const { page: auroraPage } = await newEmptyBrowser();
        const auroraTheme = new ThemePage(auroraPage);
        await auroraTheme.navigateTo(AURORA_URL);
        const auroraAppName = await auroraTheme.getTenantAppName(AURORA_URL);

        // Get Brutalist app name
        const { page: brutalistPage } = await newEmptyBrowser();
        const brutalistTheme = new ThemePage(brutalistPage);
        await brutalistTheme.navigateTo(BRUTALIST_URL);
        const brutalistAppName = await brutalistTheme.getTenantAppName(BRUTALIST_URL);

        // Assert they are DIFFERENT (don't care what the values are)
        expect(auroraAppName).not.toBe(brutalistAppName);
    });
});
