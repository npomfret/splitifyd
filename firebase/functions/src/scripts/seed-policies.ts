#!/usr/bin/env npx tsx
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables
const envPath = path.join(__dirname, '../../.env.development');
dotenv.config({ path: envPath });

// Read emulator ports from firebase.json
const firebaseConfigPath = path.join(__dirname, '../../../firebase.json');
let firestorePort = 8080; // fallback defaults
let authPort = 9099;

try {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  if (firebaseConfig.emulators) {
    firestorePort = firebaseConfig.emulators.firestore?.port || firestorePort;
    authPort = firebaseConfig.emulators.auth?.port || authPort;
  }
} catch (error) {
  console.warn('Could not read firebase.json, using default ports');
}

// Set emulator host BEFORE initializing admin SDK
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || `localhost:${firestorePort}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || `localhost:${authPort}`;

console.log(`Connecting to Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
console.log(`Auth emulator at ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

// Initialize admin SDK with emulator settings
const projectId = process.env.FIREBASE_PROJECT_ID || 'splitifyd';
console.log(`Using project ID: ${projectId}`);

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: projectId
  });
}

/**
 * Calculate SHA-256 hash of policy text
 */
function calculatePolicyHash(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Seed initial policies into Firestore
 */
async function seedPolicies() {
  const firestore = admin.firestore();
  const now = new Date().toISOString();
  
  // Terms of Service text
  const termsText = `# Terms of Service

Last updated: ${new Date().toLocaleDateString()}

## 1. Acceptance of Terms

By accessing and using Splitifyd ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.

## 2. Description of Service

Splitifyd is a group expense tracking and splitting application that allows users to:
- Create and manage expense groups
- Track shared expenses
- Calculate and settle balances between group members
- Share expense data with other group members

## 3. User Accounts

### 3.1 Registration
You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials.

### 3.2 Account Security
You are responsible for all activities that occur under your account. Notify us immediately of any unauthorized use.

## 4. User Conduct

You agree not to:
- Use the Service for any illegal purposes
- Impersonate any person or entity
- Upload malicious code or interfere with the Service
- Attempt to gain unauthorized access to the Service or its systems
- Use the Service to harass, abuse, or harm others

## 5. Privacy and Data

### 5.1 Data Collection
We collect and process data as described in our Privacy Policy. By using the Service, you consent to such processing.

### 5.2 User Data
You retain ownership of the data you submit to the Service. You grant us a license to use this data solely to provide the Service to you.

### 5.3 Data Sharing
Expense data is shared among group members. You are responsible for only adding members who should have access to group financial information.

## 6. Intellectual Property

The Service and its original content, features, and functionality are owned by Splitifyd and are protected by international copyright, trademark, and other intellectual property laws.

## 7. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

## 8. Limitation of Liability

IN NO EVENT SHALL SPLITIFYD BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, OR GOODWILL.

## 9. Indemnification

You agree to indemnify and hold harmless Splitifyd from any claims, damages, losses, liabilities, and expenses arising from your use of the Service or violation of these Terms.

## 10. Termination

We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users of the Service.

## 11. Changes to Terms

We reserve the right to modify these Terms at any time. We will notify users of any material changes. Your continued use of the Service after changes constitutes acceptance of the new Terms.

## 12. Governing Law

These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Splitifyd operates, without regard to its conflict of law provisions.

## 13. Contact Information

If you have any questions about these Terms, please contact us at support@splitifyd.com.`;

  // Cookie Policy text
  const cookiePolicyText = `# Cookie Policy

Last updated: ${new Date().toLocaleDateString()}

## 1. Introduction

This Cookie Policy explains how Splitifyd ("we", "us", or "our") uses cookies and similar technologies to recognize you when you visit our application. It explains what these technologies are and why we use them, as well as your rights to control our use of them.

## 2. What are cookies?

Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to provide reporting information.

## 3. Why do we use cookies?

We use cookies for several reasons:

### 3.1 Essential Cookies
These cookies are strictly necessary to provide you with services available through our application and to use some of its features, such as:
- User authentication and session management
- Security features to protect against CSRF attacks
- Maintaining your preferences and settings

### 3.2 Performance and Analytics Cookies
These cookies help us understand how visitors interact with our application by collecting and reporting information anonymously:
- Page load times and performance metrics
- Error tracking and debugging
- Usage patterns to improve user experience

### 3.3 Functionality Cookies
These cookies enable enhanced functionality and personalization:
- Remembering your preferences (e.g., language, currency)
- Remembering your login details (if you choose)
- Customizing the interface based on your choices

## 4. Types of cookies we use

### Session Cookies
Temporary cookies that expire when you close your browser. Used for:
- Maintaining your session while using the app
- Security tokens for form submissions

### Persistent Cookies
Remain on your device for a set period. Used for:
- Remember me functionality
- User preferences
- Analytics tracking

## 5. Third-party cookies

We may use third-party services that set their own cookies:

### Firebase/Google Analytics
- Used for app analytics and performance monitoring
- Helps us understand usage patterns and improve the service
- You can opt-out at: https://tools.google.com/dlpage/gaoptout

### Authentication Providers
- If you log in using third-party authentication (Google, Facebook, etc.)
- These providers may set their own cookies

## 6. How can you control cookies?

### 6.1 Browser Settings
Most web browsers allow you to control cookies through their settings:
- Chrome: Settings > Privacy and security > Cookies
- Firefox: Settings > Privacy & Security > Cookies
- Safari: Preferences > Privacy > Cookies
- Edge: Settings > Privacy, search, and services > Cookies

### 6.2 Essential Cookies
Note that blocking essential cookies may prevent you from using core features of our application.

### 6.3 Do Not Track
We respect Do Not Track signals and do not track, plant cookies, or use advertising when a Do Not Track browser mechanism is in place.

## 7. Local Storage

In addition to cookies, we may use local storage (HTML5) to store:
- User preferences
- Temporary form data
- Offline data cache

You can clear local storage through your browser's developer tools or settings.

## 8. Updates to this Policy

We may update this Cookie Policy from time to time. We will notify you of any changes by posting the new Cookie Policy on this page and updating the "Last updated" date.

## 9. Contact Us

If you have any questions about our Cookie Policy, please contact us at:
- Email: privacy@splitifyd.com
- Website: https://splitifyd.com/contact

## 10. Your Rights

Depending on your location, you may have certain rights regarding cookies:
- Right to be informed about our cookie use
- Right to withdraw consent
- Right to opt-out of non-essential cookies
- Right to request deletion of cookie data

To exercise these rights, please contact us using the information above.`;

  // Privacy Policy text
  const privacyPolicyText = `# Privacy Policy

Last updated: ${new Date().toLocaleDateString()}

## 1. Introduction

Splitifyd ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our expense tracking application.

## 2. Information We Collect

### 2.1 Personal Information
Information you provide directly:
- Name and email address
- Password (stored encrypted)
- Profile information
- Payment and expense data you enter

### 2.2 Automatically Collected Information
- Device information (type, OS, browser)
- IP address and location data
- Usage data and analytics
- Cookies and similar technologies

## 3. How We Use Your Information

We use your information to:
- Provide and maintain the Service
- Process expense tracking and calculations
- Send notifications about group activities
- Improve and optimize the Service
- Comply with legal obligations
- Prevent fraud and enhance security

## 4. Information Sharing

### 4.1 Within Groups
- Expense data is shared with members of your groups
- Profile information visible to group members
- Transaction history accessible to group participants

### 4.2 Third Parties
We do not sell your personal information. We may share data with:
- Service providers (hosting, analytics, email)
- Legal authorities when required by law
- Business partners with your consent

## 5. Data Security

We implement appropriate technical and organizational measures:
- Encryption of data in transit and at rest
- Regular security audits and updates
- Access controls and authentication
- Secure backup procedures

## 6. Data Retention

We retain your information:
- Active account data: As long as your account is active
- Deleted account data: Up to 90 days for recovery
- Legal compliance: As required by applicable laws
- Aggregated data: May be retained indefinitely

## 7. Your Rights

You have the right to:
- Access your personal information
- Correct inaccurate data
- Request deletion of your data
- Export your data (data portability)
- Opt-out of marketing communications
- Withdraw consent

## 8. Children's Privacy

Our Service is not intended for children under 13. We do not knowingly collect information from children under 13. If you believe we have collected such information, please contact us.

## 9. International Data Transfers

Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers.

## 10. California Privacy Rights (CCPA)

California residents have additional rights:
- Right to know what personal information is collected
- Right to know if information is sold or disclosed
- Right to say no to the sale of personal information
- Right to equal service and price

## 11. European Privacy Rights (GDPR)

EU residents have additional rights:
- Legal basis for processing
- Right to restriction of processing
- Right to object to processing
- Right to lodge a complaint with supervisory authority

## 12. Changes to This Policy

We may update this Privacy Policy periodically. We will notify you of material changes via email or in-app notification. Your continued use after changes constitutes acceptance.

## 13. Contact Information

For privacy-related questions or to exercise your rights:
- Email: privacy@splitifyd.com
- Data Protection Officer: dpo@splitifyd.com
- Address: [Company Address]

## 14. Cookies and Tracking

Please refer to our separate Cookie Policy for detailed information about our use of cookies and similar technologies.

## 15. Third-Party Links

Our Service may contain links to third-party websites. We are not responsible for the privacy practices of these external sites.`;

  try {
    console.log('Starting policy seed process...\n');

    // Create Terms of Service
    const termsId = 'terms-of-service';
    const termsHash = calculatePolicyHash(termsText);
    
    console.log(`Creating Terms of Service (${termsId})...`);
    console.log(`  Hash: ${termsHash}`);
    
    await firestore.collection('policies').doc(termsId).set({
      policyName: 'Terms of Service',
      currentVersionHash: termsHash,
      versions: {
        [termsHash]: {
          text: termsText,
          createdAt: now
        }
      },
      createdAt: now,
      createdBy: 'system-seed',
      publishedAt: now,
      publishedBy: 'system-seed'
    });
    
    console.log('✓ Terms of Service created\n');

    // Create Cookie Policy
    const cookieId = 'cookie-policy';
    const cookieHash = calculatePolicyHash(cookiePolicyText);
    
    console.log(`Creating Cookie Policy (${cookieId})...`);
    console.log(`  Hash: ${cookieHash}`);
    
    await firestore.collection('policies').doc(cookieId).set({
      policyName: 'Cookie Policy',
      currentVersionHash: cookieHash,
      versions: {
        [cookieHash]: {
          text: cookiePolicyText,
          createdAt: now
        }
      },
      createdAt: now,
      createdBy: 'system-seed',
      publishedAt: now,
      publishedBy: 'system-seed'
    });
    
    console.log('✓ Cookie Policy created\n');

    // Create Privacy Policy
    const privacyId = 'privacy-policy';
    const privacyHash = calculatePolicyHash(privacyPolicyText);
    
    console.log(`Creating Privacy Policy (${privacyId})...`);
    console.log(`  Hash: ${privacyHash}`);
    
    await firestore.collection('policies').doc(privacyId).set({
      policyName: 'Privacy Policy',
      currentVersionHash: privacyHash,
      versions: {
        [privacyHash]: {
          text: privacyPolicyText,
          createdAt: now
        }
      },
      createdAt: now,
      createdBy: 'system-seed',
      publishedAt: now,
      publishedBy: 'system-seed'
    });
    
    console.log('✓ Privacy Policy created\n');

    // Verify all policies exist
    console.log('Verifying policies...');
    const policiesSnapshot = await firestore.collection('policies').get();
    
    console.log(`\nSuccessfully seeded ${policiesSnapshot.size} policies:`);
    policiesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.policyName} (${doc.id})`);
      console.log(`    Current version: ${data.currentVersionHash.substring(0, 8)}...`);
    });

    console.log('\n✅ Policy seeding complete!');
    console.log('The app should now work properly with registration requiring policy acceptance.');
    
  } catch (error) {
    console.error('❌ Error seeding policies:', error);
    process.exit(1);
  }
}

// Run the seed function
seedPolicies()
  .then(() => {
    console.log('\nExiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });