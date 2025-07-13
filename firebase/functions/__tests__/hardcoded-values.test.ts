import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Hardcoded Values Validation', () => {
  it('should not contain hardcoded "splitifyd" references outside of config files', () => {
    const projectRoot = path.join(__dirname, '../../..');
    
    // Files and patterns to exclude from the check
    const excludePatterns = [
      'app-config.json',
      'hardcoded-values.test.ts',
      'infrastructure-references.test.ts', // This test validates infrastructure configuration
      '.idea/',
      '.firebaserc',
      'firebase.template.json',
      'firebase.json',
      '.git/',
      'node_modules/',
      'dist/',
      'lib/',
      'coverage/',
      '*.log',
      '.env',
      '.env.*',
      'docs/todo/rename-app.md', // Task documentation about renaming
      'hardcoded-references-summary.md', // Summary of violations
      // Documentation files (not user-visible)
      'README.md',
      'docs/',
      // Firebase infrastructure scripts (not user-visible)
      'firebase/scripts/', // Build/deployment scripts
      // Developer tools (not user-visible)
      'webapp/developer_tools/'
    ];
    
    // Get all git tracked files
    const gitFiles = execSync('git ls-files', { 
      cwd: projectRoot,
      encoding: 'utf8' 
    }).trim().split('\n').filter(Boolean);
    
    // Filter out excluded files
    const filesToCheck = gitFiles.filter(file => {
      return !excludePatterns.some(pattern => {
        if (pattern.endsWith('/')) {
          return file.startsWith(pattern);
        }
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace('*', '.*'));
          return regex.test(file);
        }
        return file === pattern || file.includes(pattern);
      });
    });
    
    // Search for hardcoded values
    const violations: { file: string; lines: string[] }[] = [];
    const searchTerms = ['splitifyd', 'Splitifyd', 'SPLITIFYD'];
    
    filesToCheck.forEach(file => {
      const filePath = path.join(projectRoot, file);
      
      // Skip if file doesn't exist or is not readable
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return;
      }
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const matchingLines: string[] = [];
        
        lines.forEach((line, index) => {
          searchTerms.forEach(term => {
            if (line.includes(term)) {
              // Skip lines that are comments
              if (line.trim().startsWith('//') || 
                  line.trim().startsWith('*')) {
                return;
              }
              matchingLines.push(`  Line ${index + 1}: ${line.trim()}`);
            }
          });
        });
        
        if (matchingLines.length > 0) {
          violations.push({ file, lines: matchingLines });
        }
      } catch (error) {
        // Skip files that can't be read (binary files, etc.)
      }
    });
    
    // Report violations
    if (violations.length > 0) {
      console.log('\n❌ Found hardcoded "splitifyd" references in the following files:\n');
      violations.forEach(({ file, lines }) => {
        console.log(`📄 ${file}`);
        lines.forEach(line => console.log(line));
        console.log('');
      });
      console.log(`Total files with violations: ${violations.length}`);
      console.log('\nThese references should be replaced with values from app-config.json');
      
      // Fail the test
      expect(violations.length).toBe(0);
    }
  });
});