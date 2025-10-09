import {EMULATOR_URL} from '../helpers';

async function globalSetup() {
    const baseURL = EMULATOR_URL;

    // Simple connectivity test without creating a browser instance
    console.log(`Testing connectivity to ${baseURL}`);
    const response = await fetch(baseURL);
    if (response.ok) {
        const registerResponse = await fetch(`${baseURL}/register`);
        if (registerResponse.ok) {
            console.log('✅ Register page accessible');
        } else {
            console.warn(`⚠️  Register page returned status ${registerResponse.status}`);
        }
    } else {
        console.warn(`⚠️  Server responded with status ${response.status}, but tests will proceed`);
    }
}

export default globalSetup;
