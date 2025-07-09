#!/usr/bin/env node

const admin = require('firebase-admin');

// Set emulator environment variables before initializing
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// Initialize Firebase Admin for emulator
const app = admin.initializeApp({
  projectId: 'splitifyd'
});

const db = admin.firestore();
const auth = admin.auth();

async function debugGroupMembership() {
  try {
    console.log('🔍 Debugging Group Membership Issue\n');
    
    // Group ID from the error
    const groupId = 'IWddJCDULL7f4nFDyfbz';
    const userEmail = 'test1@test.com';
    
    // Get user info
    console.log(`📧 Looking up user: ${userEmail}`);
    const userRecord = await auth.getUserByEmail(userEmail);
    console.log(`✓ User found: ${userRecord.uid} (${userRecord.displayName})\n`);
    
    // Get group document
    console.log(`📁 Fetching group document: ${groupId}`);
    const groupDoc = await db.collection('documents').doc(groupId).get();
    
    if (!groupDoc.exists) {
      console.log('❌ Group document not found!');
      return;
    }
    
    const groupData = groupDoc.data();
    console.log('✓ Group document found\n');
    
    // Display group structure
    console.log('🏗️  Group Document Structure:');
    console.log(JSON.stringify(groupData, null, 2));
    console.log('\n');
    
    // Check members location
    console.log('👥 Checking members location:');
    console.log(`- groupData.members: ${groupData.members ? 'EXISTS' : 'NOT FOUND'}`);
    console.log(`- groupData.data?.members: ${groupData.data?.members ? 'EXISTS' : 'NOT FOUND'}`);
    
    if (groupData.data?.members) {
      console.log(`\n📋 Members in groupData.data.members:`);
      groupData.data.members.forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.name} (${member.uid}) - ${member.email}`);
      });
      
      const memberIds = groupData.data.members.map(m => m.uid);
      console.log(`\n🔍 Is ${userRecord.uid} in members list? ${memberIds.includes(userRecord.uid) ? 'YES ✓' : 'NO ✗'}`);
    }
    
    if (groupData.members) {
      console.log(`\n📋 Members in groupData.members:`);
      groupData.members.forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.name} (${member.uid}) - ${member.email}`);
      });
      
      const memberIds = groupData.members.map(m => m.uid);
      console.log(`\n🔍 Is ${userRecord.uid} in members list? ${memberIds.includes(userRecord.uid) ? 'YES ✓' : 'NO ✗'}`);
    }
    
    // List all groups to find pattern
    console.log('\n📊 Checking all groups for pattern:');
    const allGroups = await db.collection('documents').get();
    let groupCount = 0;
    
    allGroups.forEach(doc => {
      const data = doc.data();
      if (data.data?.name?.startsWith('group-')) {
        groupCount++;
        console.log(`\nGroup: ${data.data.name} (${doc.id})`);
        console.log(`- Has data.members: ${data.data?.members ? 'YES' : 'NO'}`);
        console.log(`- Has members: ${data.members ? 'YES' : 'NO'}`);
        console.log(`- Created by: ${data.userId}`);
        
        if (data.data?.members) {
          const memberIds = data.data.members.map(m => m.uid);
          console.log(`- Members: ${memberIds.join(', ')}`);
          console.log(`- Contains ${userRecord.uid}: ${memberIds.includes(userRecord.uid) ? 'YES' : 'NO'}`);
        }
      }
    });
    
    console.log(`\n✅ Found ${groupCount} groups total`);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the script
if (require.main === module) {
  debugGroupMembership().then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}