#!/usr/bin/env tsx
/**
 * Quick verification script to generate and inspect theme CSS for both themes
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { LocalThemeArtifactStorage } from '../firebase/functions/src/services/storage/ThemeArtifactStorage';
import { ThemeArtifactService } from '../firebase/functions/src/services/tenant/ThemeArtifactService';
import { localhostBrandingTokens, loopbackBrandingTokens } from '../packages/shared/src/fixtures/branding-tokens';

async function main() {
    const tmpDir = join(process.cwd(), 'tmp', 'theme-verification');
    await mkdir(tmpDir, { recursive: true });

    const storage = new LocalThemeArtifactStorage(tmpDir);
    const service = new ThemeArtifactService(storage);

    console.log('🎨 Generating Aurora theme CSS (localhost)...\n');
    const auroraResult = await service.generate('localhost', localhostBrandingTokens);

    console.log('✅ Aurora Theme:');
    console.log(`   Hash: ${auroraResult.hash}`);
    console.log(`   CSS Size: ${auroraResult.bytes.css} bytes`);
    console.log(`   Has gradients: ${auroraResult.cssContent.includes('gradient')}`);
    console.log(`   Has @font-face: ${auroraResult.cssContent.includes('@font-face')}`);
    console.log(`   Has glassmorphism: ${auroraResult.cssContent.includes('glass-panel')}`);
    console.log(`   Has motion query: ${auroraResult.cssContent.includes('prefers-reduced-motion')}`);
    console.log(`   Has fluid typography: ${auroraResult.cssContent.includes('--fluid-')}`);
    console.log('');

    console.log('🏗️  Generating Brutalist theme CSS (127.0.0.1)...\n');
    const brutalistResult = await service.generate('loopback', loopbackBrandingTokens);

    console.log('✅ Brutalist Theme:');
    console.log(`   Hash: ${brutalistResult.hash}`);
    console.log(`   CSS Size: ${brutalistResult.bytes.css} bytes`);
    console.log(`   Has gradients: ${brutalistResult.cssContent.includes('gradient')}`);
    console.log(`   Has @font-face: ${brutalistResult.cssContent.includes('@font-face')}`);
    console.log(`   Has glassmorphism: ${brutalistResult.cssContent.includes('glass-panel')}`);
    console.log(`   Has motion query: ${brutalistResult.cssContent.includes('prefers-reduced-motion')}`);
    console.log(`   Has fluid typography: ${brutalistResult.cssContent.includes('--fluid-')}`);
    console.log('');

    // Write CSS files for manual inspection
    await writeFile(join(tmpDir, 'aurora.css'), auroraResult.cssContent);
    await writeFile(join(tmpDir, 'brutalist.css'), brutalistResult.cssContent);

    console.log(`📁 CSS files written to: ${tmpDir}`);
    console.log('   - aurora.css');
    console.log('   - brutalist.css');
    console.log('');

    // Show first 50 lines of Aurora CSS
    console.log('📋 Aurora CSS Preview (first 50 lines):');
    console.log('─'.repeat(80));
    console.log(auroraResult.cssContent.split('\n').slice(0, 50).join('\n'));
    console.log('─'.repeat(80));
}

main().catch(console.error);
