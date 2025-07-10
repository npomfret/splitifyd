import { firebaseConfigManager } from './firebase-config.js';
import { config } from './config.js';

const testResults = document.getElementById('test-results') as HTMLDivElement;
const runButton = document.getElementById('run-tests') as HTMLButtonElement;

// Update environment info
const envEl = document.getElementById('current-env') as HTMLElement;
const hostnameEl = document.getElementById('current-hostname') as HTMLElement;
const protocolEl = document.getElementById('current-protocol') as HTMLElement;

envEl.textContent = config.isLocalEnvironment() ? 'Local Development' : 'Production';
hostnameEl.textContent = window.location.hostname;
protocolEl.textContent = window.location.protocol;

function addTestResult(title: string, status: 'success' | 'error' | 'pending', result: any): void {
    const section = document.createElement('div');
    section.className = `test-section ${status}`;
    
    const titleEl = document.createElement('div');
    titleEl.className = 'test-title';
    titleEl.textContent = title;
    
    const resultEl = document.createElement('div');
    resultEl.className = 'test-result';
    resultEl.textContent = typeof result === 'object' ? 
        JSON.stringify(result, null, 2) : String(result);
    
    section.appendChild(titleEl);
    section.appendChild(resultEl);
    testResults.appendChild(section);
}

function clearResults(): void {
    testResults.innerHTML = '';
}

async function testFirebaseConfigFetch(): Promise<boolean> {
    try {
        addTestResult('Firebase Config Fetch', 'pending', 'Testing...');
        
        // Initialize firebase config manager first
        await firebaseConfigManager.initialize();
        const config = firebaseConfigManager.getConfig();
        
        if (!config || !config.firebaseConfig.projectId) {
            throw new Error('Config missing projectId');
        }
        
        addTestResult('Firebase Config Fetch', 'success', {
            projectId: config.firebaseConfig.projectId,
            authDomain: config.firebaseConfig.authDomain,
            configUrl: 'Config fetched successfully'
        });
        
        return true;
    } catch (error: any) {
        addTestResult('Firebase Config Fetch', 'error', error.message);
        return false;
    }
}

async function testFirebaseInitialization(): Promise<boolean> {
    try {
        addTestResult('Firebase Initialization', 'pending', 'Testing...');
        
        await firebaseConfigManager.initialize();
        
        if (!firebaseConfigManager.isInitialized()) {
            throw new Error('Firebase not initialized');
        }
        
        addTestResult('Firebase Initialization', 'success', 'Firebase initialized successfully');
        return true;
    } catch (error: any) {
        addTestResult('Firebase Initialization', 'error', error.message);
        return false;
    }
}

async function testApiUrlConfiguration(): Promise<boolean> {
    try {
        addTestResult('API URL Configuration', 'pending', 'Testing...');
        
        const apiUrl = await config.getApiUrl();
        const apiUrlSync = config.getApiUrlSync();
        
        const result = {
            asyncUrl: apiUrl,
            syncUrl: apiUrlSync,
            isLocal: config.isLocalEnvironment()
        };
        
        if (!apiUrl) {
            throw new Error('API URL is empty');
        }
        
        if (config.isLocalEnvironment() && !apiUrl.includes('localhost') && !apiUrl.includes('127.0.0.1')) {
            throw new Error('Local environment but API URL not pointing to localhost');
        }
        
        addTestResult('API URL Configuration', 'success', result);
        return true;
    } catch (error: any) {
        addTestResult('API URL Configuration', 'error', error.message);
        return false;
    }
}

async function testCorsHeaders(): Promise<boolean> {
    try {
        addTestResult('CORS Headers Test', 'pending', 'Testing...');
        
        const apiUrl = await config.getApiUrl();
        const healthUrl = `${apiUrl}/health`;
        
        const response = await fetch(healthUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const corsHeaders = {
            'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
            'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
            'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
            'access-control-allow-headers': response.headers.get('access-control-allow-headers')
        };
        
        if (!corsHeaders['access-control-allow-origin']) {
            throw new Error('Missing Access-Control-Allow-Origin header');
        }
        
        addTestResult('CORS Headers Test', 'success', {
            url: healthUrl,
            headers: corsHeaders,
            status: response.status
        });
        return true;
    } catch (error: any) {
        addTestResult('CORS Headers Test', 'error', error.message);
        return false;
    }
}

async function testCorsPreflightRequest(): Promise<boolean> {
    try {
        addTestResult('CORS Preflight Test', 'pending', 'Testing...');
        
        const apiUrl = await config.getApiUrl();
        const loginUrl = `${apiUrl}/login`;
        
        // Send OPTIONS request to trigger preflight
        const response = await fetch(loginUrl, {
            method: 'OPTIONS',
            headers: {
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type,authorization'
            }
        });
        
        const corsHeaders = {
            'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
            'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
            'access-control-allow-headers': response.headers.get('access-control-allow-headers'),
            'access-control-max-age': response.headers.get('access-control-max-age')
        };
        
        if (response.status !== 200 && response.status !== 204) {
            throw new Error(`Preflight failed with status: ${response.status}`);
        }
        
        addTestResult('CORS Preflight Test', 'success', {
            url: loginUrl,
            headers: corsHeaders,
            status: response.status
        });
        return true;
    } catch (error: any) {
        addTestResult('CORS Preflight Test', 'error', error.message);
        return false;
    }
}

async function testProductionUrlDetection(): Promise<boolean> {
    try {
        addTestResult('Production URL Detection', 'pending', 'Testing...');
        
        const configManager = firebaseConfigManager;
        const config = configManager.getConfig();
        const isLocal = config ? config.isLocal : false;
        const configUrl = 'Config URL test';
        const apiUrl = config ? config.apiUrl : '';
        
        const result = {
            isLocal,
            configUrl,
            apiUrl,
            expectedBehavior: isLocal ? 
                'Should use localhost with port 5001' : 
                'Should use relative URLs based on current host'
        };
        
        if (!isLocal && (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1'))) {
            throw new Error('Production environment but using localhost URLs');
        }
        
        if (isLocal && !apiUrl.includes(':5001')) {
            throw new Error('Local environment but not using port 5001');
        }
        
        addTestResult('Production URL Detection', 'success', result);
        return true;
    } catch (error: any) {
        addTestResult('Production URL Detection', 'error', error.message);
        return false;
    }
}

async function runAllTests(): Promise<void> {
    clearResults();
    runButton.disabled = true;
    runButton.textContent = 'Running tests...';
    
    try {
        const tests = [
            testProductionUrlDetection,
            testFirebaseConfigFetch,
            testFirebaseInitialization,
            testApiUrlConfiguration,
            testCorsHeaders,
            testCorsPreflightRequest
        ];
        
        let passed = 0;
        let failed = 0;
        
        for (const test of tests) {
            const result = await test();
            if (result) passed++;
            else failed++;
            
            // Brief pause for visual feedback in test UI
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        addTestResult('Test Summary', passed === tests.length ? 'success' : 'error', 
            `Passed: ${passed}/${tests.length}, Failed: ${failed}`);
        
    } catch (error: any) {
        addTestResult('Test Runner Error', 'error', error.message);
    } finally {
        runButton.disabled = false;
        runButton.textContent = 'Run All Tests';
    }
}

async function waitForDOMReady(): Promise<void> {
    const maxAttempts = 50;
    let attempts = 0;
    
    while ((!document.getElementById('run-tests') || !document.getElementById('clear-results')) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!document.getElementById('run-tests') || !document.getElementById('clear-results')) {
        throw new Error('Test page elements failed to load');
    }
}

async function initializeTestPage(): Promise<void> {
    try {
        await waitForDOMReady();
        
        const runBtn = document.getElementById('run-tests') as HTMLButtonElement;
        const clearBtn = document.getElementById('clear-results') as HTMLButtonElement;
        
        runBtn.addEventListener('click', runAllTests);
        clearBtn.addEventListener('click', clearResults);
        
        await runAllTests();
    } catch (error: any) {
        addTestResult('Test Initialization Error', 'error', error.message);
    }
}

window.addEventListener('DOMContentLoaded', initializeTestPage);