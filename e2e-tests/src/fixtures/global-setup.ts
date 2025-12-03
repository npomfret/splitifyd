import { ApiDriver } from '@billsplit-wl/test-support';

async function globalSetup() {
    const apiDriver = await ApiDriver.create();

    console.log('Testing API connectivity...');
    const health = await apiDriver.getHealth();
    console.log(`✅ API healthy: ${health.status}`);
}

export default globalSetup;
