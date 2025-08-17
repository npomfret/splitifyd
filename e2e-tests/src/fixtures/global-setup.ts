import { EMULATOR_URL } from '../helpers';

async function globalSetup() {
    console.log('🚀 Starting e2e test global setup...');

    const baseURL = EMULATOR_URL;

    // Simple connectivity test without creating a browser instance
    try {
        console.log(`Testing connectivity to ${baseURL}`);
        const response = await fetch(baseURL);
        if (response.ok) {
            console.log('✅ Basic connectivity confirmed');

            // Test register page accessibility (critical for user creation)
            console.log('Testing register page navigation...');
            const registerResponse = await fetch(`${baseURL}/register`);
            if (registerResponse.ok) {
                console.log('✅ Register page accessible');
            } else {
                console.warn(`⚠️  Register page returned status ${registerResponse.status}`);
            }
        } else {
            console.warn(`⚠️  Server responded with status ${response.status}, but tests will proceed`);
        }

        console.log('✅ Global setup completed - workers will create users on-demand');
    } catch (error: any) {
        console.warn(`⚠️  Connectivity test failed: ${error.message}`);
        console.log('Tests will proceed - connectivity will be tested during actual test execution');
    }
}

export default globalSetup;
