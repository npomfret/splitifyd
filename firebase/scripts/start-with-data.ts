#!/usr/bin/env npx tsx

import { spawn } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

import { generateTestData } from '../functions/scripts/generate-test-data';
import { seedPolicies } from '../functions/src/scripts/seed-policies';
import { logger } from './logger';

const firebaseConfigPath = path.join(__dirname, '../firebase.json');
if (!fs.existsSync(firebaseConfigPath)) {
  logger.error('❌ firebase.json not found. Run the build process first to generate it.');
  process.exit(1);
}

// Read project ID from .firebaserc
const firebaseRcPath = path.join(__dirname, '../.firebaserc');
if (!fs.existsSync(firebaseRcPath)) {
  logger.error('❌ .firebaserc not found.');
  process.exit(1);
}

const firebaseRc: any = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
const PROJECT_ID = firebaseRc.projects.default;

const firebaseConfig: any = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const UI_PORT: string = firebaseConfig.emulators.ui.port!;
const FUNCTIONS_PORT: string = firebaseConfig.emulators.functions.port!;

// Load .env file to get dev form defaults
const envPath = path.join(__dirname, '../functions/.env');
if (!fs.existsSync(envPath)) {
  logger.error('❌ .env file not found. Run switch-instance script first to set up environment.');
  process.exit(1);
}

// Load environment variables from .env file
dotenv.config({ path: envPath });

const devFormEmail = process.env.DEV_FORM_EMAIL || '';
const devFormPassword = process.env.DEV_FORM_PASSWORD || '';

logger.info('🚀 Starting Firebase emulator with test data generation...', {
  projectId: PROJECT_ID,
  uiPort: UI_PORT,
  functionsPort: FUNCTIONS_PORT,
  devFormEmail: devFormEmail ? '✓' : '✗',
  devFormPassword: devFormPassword ? '✓' : '✗'
});

const emulatorProcess = spawn('firebase', [
  'emulators:start'
], {
  stdio: 'pipe',
  env: { 
    ...process.env, 
    NODE_ENV: 'development',
    DEV_FORM_EMAIL: devFormEmail,
    DEV_FORM_PASSWORD: devFormPassword
  }
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


function checkApiReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: Number(FUNCTIONS_PORT),
      path: `/${PROJECT_ID}/us-central1/api`,
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
        apiPath: `/${PROJECT_ID}/us-central1/api`,
        note: 'This may indicate an issue with function deployment or configuration'
      });
      return;
    }
    
    logger.info('🎯 API functions are ready!');
    
    // Clear separation: App is now fully started and ready
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🎉✅ APP STARTUP COMPLETE! 🎉✅');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('📍 The Splitifyd application is now fully operational');
    logger.info('🌐 Firebase emulators are running and API functions are ready');
    logger.info('🚀 You can now use the webapp and all endpoints are available');
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('📊 STARTING POLICY SEEDING...');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');
    
    try {
      await seedPolicies();
      logger.info('');
      logger.info('✅ Policy seeding completed successfully!');
      logger.info('📋 Privacy policy, terms, and cookie policy are now available');
    } catch (error) {
      logger.error('❌ Policy seeding failed', { error });
    }
    
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('📊 STARTING TEST DATA GENERATION...');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');
    
    try {
      await generateTestData();
      logger.info('');
      logger.info('✅ Test data generation completed successfully!');
      logger.info('🎲 Groups now contain expenses and payments for testing');
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