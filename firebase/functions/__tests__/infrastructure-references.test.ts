import * as fs from 'fs';
import * as path from 'path';

describe('Infrastructure References Validation', () => {
  it('should contain "splitifyd" in required infrastructure files', () => {
    const projectRoot = path.join(__dirname, '../../..');
    
    // Files that MUST contain "splitifyd" for infrastructure to work
    const requiredReferences = [
      {
        file: 'firebase/.firebaserc',
        expectedMatches: ['default": "splitifyd"'],
        description: 'Firebase project configuration'
      },
      {
        file: 'firebase/package.json', 
        expectedMatches: ['firebase use splitifyd'],
        description: 'Firebase deployment scripts'
      },
      {
        file: 'firebase/functions/.env.example',
        expectedMatches: ['your-project-id'],
        description: 'Environment template (should NOT contain hardcoded splitifyd)'
      },
      {
        file: 'app-config.json',
        expectedMatches: ['"firebaseProjectId": "splitifyd"'],
        description: 'App configuration with Firebase project reference'
      }
    ];
    
    const violations: { file: string; missing: string[]; description: string }[] = [];
    
    requiredReferences.forEach(({ file, expectedMatches, description }) => {
      const filePath = path.join(projectRoot, file);
      
      if (!fs.existsSync(filePath)) {
        violations.push({ 
          file, 
          missing: ['FILE_NOT_FOUND'], 
          description 
        });
        return;
      }
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const missing = expectedMatches.filter(match => !content.includes(match));
        
        if (missing.length > 0) {
          violations.push({ file, missing, description });
        }
      } catch (error) {
        violations.push({ 
          file, 
          missing: ['READ_ERROR'], 
          description 
        });
      }
    });
    
    // Report violations
    if (violations.length > 0) {
      console.log('\n❌ Missing required infrastructure references:\n');
      violations.forEach(({ file, missing, description }) => {
        console.log(`📄 ${file} (${description})`);
        missing.forEach(ref => console.log(`  Missing: ${ref}`));
        console.log('');
      });
      console.log('These references are required for proper Firebase infrastructure operation');
      
      expect(violations.length).toBe(0);
    } else {
      console.log('\n✅ All required infrastructure references found');
    }
  });
  
  it('should NOT contain "splitifyd" in user-visible placeholder locations', () => {
    const projectRoot = path.join(__dirname, '../../..');
    
    // Files that should use "app-name-here" instead of "splitifyd" for user-visible content
    const placeholderFiles = [
      'webapp/src/index.html',
      'webapp/src/login.html', 
      'webapp/src/register.html',
      'webapp/src/reset-password.html',
      'webapp/src/terms-of-service.html',
      'webapp/src/privacy-policy.html',
      'webapp/src/cookies-policy.html',
      'webapp/src/pricing.html',
      'webapp/src/dashboard.html',
      'webapp/src/add-expense.html',
      'webapp/src/expense-detail.html',
      'webapp/src/group-detail.html',
      'webapp/src/join-group.html'
    ];
    
    const violations: { file: string; lines: string[] }[] = [];
    
    placeholderFiles.forEach(file => {
      const filePath = path.join(projectRoot, file);
      
      if (!fs.existsSync(filePath)) {
        return; // Skip files that don't exist
      }
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const matchingLines: string[] = [];
        
        lines.forEach((line, index) => {
          // Look for "Splitifyd" in user-visible contexts (titles, headers, content)
          if (line.includes('Splitifyd') && 
              !line.includes('api.splitifyd.com') && // Allow API URLs
              !line.trim().startsWith('//') && // Skip comments
              !line.trim().startsWith('*')) { // Skip comments
            matchingLines.push(`  Line ${index + 1}: ${line.trim()}`);
          }
        });
        
        if (matchingLines.length > 0) {
          violations.push({ file, lines: matchingLines });
        }
      } catch (error) {
        // Skip files that can't be read
      }
    });
    
    // Report violations
    if (violations.length > 0) {
      console.log('\n⚠️  Found "Splitifyd" in user-visible locations that should use "app-name-here":\n');
      violations.forEach(({ file, lines }) => {
        console.log(`📄 ${file}`);
        lines.forEach(line => console.log(line));
        console.log('');
      });
      console.log('These should be replaced with "app-name-here" placeholder for runtime replacement');
      
      // This test will initially fail, which is expected
      // We'll fix these in the next step
      expect(violations.length).toBe(0);
    }
  });
});