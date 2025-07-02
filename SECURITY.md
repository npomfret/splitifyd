# Security Configuration Guide

## Overview

This document explains the security configuration for the Splitifyd application, particularly regarding Firebase configuration management.

## Firebase Configuration Management

### Background

Firebase Web API keys are designed to be public and are meant to identify your Firebase project. They are NOT secret keys and are protected by:
- Firebase Security Rules
- Domain restrictions
- App restrictions

However, as a best practice, we've implemented an environment-based configuration system to:
1. Keep configuration out of source control
2. Allow different configurations for different environments
3. Follow security best practices

### Configuration Flow

1. **Backend Configuration Service**: The Firebase configuration MUST be stored in environment variables on the server
2. **Dynamic Loading**: The frontend fetches configuration from the `/configFn` endpoint at startup
3. **No Hardcoded Values**: There are NO hardcoded API keys or configuration values in the codebase

### Setting Up Secure Configuration

#### 1. Backend Environment Variables (REQUIRED)

You MUST set up environment variables before the application will work. Copy the `.env.example` file to `.env` in the `firebase/functions` directory and set your Firebase configuration:

```bash
# Firebase Client Configuration
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
FIREBASE_MEASUREMENT_ID=your-measurement-id  # Optional
```

#### 2. Firebase Console Security Setup

**IMPORTANT**: Even though Firebase Web API keys are public, you must configure security settings in the Firebase Console:

1. **API Key Restrictions**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Find your Firebase Web API key
   - Add HTTP referrer restrictions:
     - For production: `https://your-domain.com/*`
     - For Firebase hosting: `https://your-project.web.app/*`
     - For development: `http://localhost:*`

2. **Firebase Security Rules**:
   - Configure Firestore security rules to control data access
   - Set up Authentication rules to control who can sign up
   - Review Storage rules if using Firebase Storage

3. **App Check** (Recommended for production):
   - Enable App Check in Firebase Console
   - This adds an additional layer of security to verify requests come from your app

### Local Development

For local development, the system works seamlessly:
1. The frontend detects it's running locally
2. It fetches configuration from the local Functions emulator
3. Firebase Auth emulator is automatically connected

### Production Deployment

For production deployment:

1. Set environment variables in your hosting platform (Firebase Functions, Cloud Run, etc.)
2. Ensure your domain is added to Firebase Auth authorized domains
3. Configure API key restrictions in Google Cloud Console
4. Review and tighten Firebase Security Rules

### Security Best Practices

1. **Never commit `.env` files** - They are gitignored by default
2. **Rotate API keys periodically** - Even though they're public, rotation is good practice
3. **Monitor usage** - Use Firebase Console to monitor API usage and detect anomalies
4. **Use Firebase Security Rules** - This is your primary security mechanism
5. **Enable audit logging** - Track who accesses what data
6. **Implement rate limiting** - Already configured in the backend
7. **Use HTTPS everywhere** - Enforced by Firebase hosting

### Monitoring and Alerts

Set up monitoring for:
- Unusual API usage patterns
- Failed authentication attempts
- Rate limit violations
- Unauthorized domain access attempts

### Incident Response

If you suspect your Firebase project is compromised:
1. Immediately restrict API keys in Google Cloud Console
2. Review Firebase Security Rules
3. Check audit logs for unauthorized access
4. Rotate all credentials
5. Review and revoke user sessions if needed

## Additional Security Measures

The application includes several built-in security features:
- CORS configuration limiting allowed origins
- Rate limiting to prevent abuse
- Request validation and sanitization
- Structured logging for security monitoring
- Health check endpoints for monitoring

## Questions or Concerns?

If you have security concerns or questions, please:
1. Review Firebase security documentation
2. Check Google Cloud security best practices
3. Consider hiring a security consultant for production deployments