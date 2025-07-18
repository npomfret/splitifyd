#!/usr/bin/env ts-node

import { spawn } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';

import { generateTestData } from '../functions/scripts/generate-test-data';
import { logger } from './logger';

const firebaseConfigPath = path.join(__dirname, '../firebase.json');
if (!fs.existsSync(firebaseConfigPath)) {
  logger.error('❌ firebase.json not found. Run the build process first to generate it.');
  process.exit(1);
}

const firebaseConfig: any = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const UI_PORT: string = firebaseConfig.emulators.ui.port || '4000';
const FUNCTIONS_PORT: string = firebaseConfig.emulators.functions.port || '5001';

logger.info('🚀 Starting Firebase emulator with test data generation...', {
  uiPort: UI_PORT,
  functionsPort: FUNCTIONS_PORT
});

const emulatorProcess = spawn('firebase', [
  'emulators:start'
], {
  stdio: 'pipe',
  env: { ...process.env, NODE_ENV: 'development' }
});

let emulatorsReady = false;

emulatorProcess.stdout.on('data', (data: Buffer) => {
  const output = data.toString();
  process.stdout.write(output);
  
  if (output.includes('All emulators ready!')) {
    emulatorsReady = true;
  }
});

emulatorProcess.stderr.on('data', (data: Buffer) => {
  process.stderr.write(data);
});

function checkEmulatorReady(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: Number(UI_PORT),
      path: '/',
      method: 'GET',
      timeout: 1000
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

function checkApiReady(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: Number(FUNCTIONS_PORT),
      path: '/demo/us-central1/api',
      method: 'GET',
      timeout: 1000
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (data.includes('Function us-central1-api does not exist')) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

setTimeout((() => {
  const startupProcess = async () => {
    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts && !emulatorsReady) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!emulatorsReady) {
      logger.error('❌ Firebase emulators failed to start within timeout', { attempts, maxAttempts });
      return;
    }
    
    logger.info('🎯 All emulators are ready!');
    
    let apiAttempts = 0;
    const maxApiAttempts = 30;
    let apiReady = false;
    
    while (apiAttempts < maxApiAttempts && !apiReady) {
      apiAttempts++;
      apiReady = await checkApiReady();
      if (!apiReady) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!apiReady) {
      logger.error('❌ API functions failed to become ready within timeout', {
        apiAttempts,
        maxApiAttempts,
        note: 'This may indicate an issue with function deployment or configuration'
      });
      return;
    }
    
    logger.info('🎯 API functions are ready!');
    
    try {
      logger.info('🎲 Generating test data...');
      await generateTestData();
      logger.info('✅ Test data generation completed!');
    } catch (error) {
      logger.error('❌ Test data generation failed', { error });
    }
  };

  startupProcess().catch(error => {
    logger.error('❌ An unexpected error occurred during emulator startup', { error });
    process.exit(1);
  });
}), 5000);

let isShuttingDown = false;

process.on('SIGINT', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info('🛑 Shutting down...');
  
  if (emulatorProcess && !emulatorProcess.killed) {
    emulatorProcess.kill('SIGINT');
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  if (emulatorProcess && !emulatorProcess.killed) {
    emulatorProcess.kill('SIGTERM');
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

emulatorProcess.on('exit', (code: number | null) => {
  if (!isShuttingDown) {
    logger.info(`🔥 Firebase emulator exited`, { code });
    process.exit(code || 0);
  }
});

process.on('uncaughtException', (error: any) => {
  if (error.code === 'EIO') {
    return;
  }
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});