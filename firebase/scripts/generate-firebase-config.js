#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../functions/.env') });

const firebaseConfigTemplate = {
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log"
      ],
      "predeploy": [
        "npm --prefix \"$RESOURCE_DIR\" run build"
      ]
    }
  ],
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate, private, max-age=0"
          },
          {
            "key": "Pragma",
            "value": "no-cache"
          },
          {
            "key": "Expires",
            "value": "0"
          },
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://firebase.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://ws-mt1.pusher.com http://localhost:* http://127.0.0.1:*; frame-src 'self' https://splitifyd.firebaseapp.com; object-src 'none'; base-uri 'self'; form-action 'self';"
          }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": {
      "port": parseInt(process.env.FIREBASE_AUTH_EMULATOR_PORT || '9099')
    },
    "functions": {
      "port": parseInt(process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001')
    },
    "firestore": {
      "port": parseInt(process.env.FIREBASE_FIRESTORE_EMULATOR_PORT || '8080')
    },
    "hosting": {
      "port": parseInt(process.env.FIREBASE_HOSTING_EMULATOR_PORT || '5002')
    },
    "ui": {
      "enabled": true,
      "port": parseInt(process.env.FIREBASE_EMULATOR_UI_PORT || '4000')
    },
    "singleProjectMode": true
  }
};

const configPath = path.join(__dirname, '../firebase.json');
const configContent = JSON.stringify(firebaseConfigTemplate, null, 2);

fs.writeFileSync(configPath, configContent);

console.log('🔥 Firebase configuration generated with ports:');
console.log(`  - UI: ${process.env.FIREBASE_EMULATOR_UI_PORT || '4000'}`);
console.log(`  - Auth: ${process.env.FIREBASE_AUTH_EMULATOR_PORT || '9099'}`);
console.log(`  - Functions: ${process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001'}`);
console.log(`  - Firestore: ${process.env.FIREBASE_FIRESTORE_EMULATOR_PORT || '8080'}`);
console.log(`  - Hosting: ${process.env.FIREBASE_HOSTING_EMULATOR_PORT || '5002'}`);