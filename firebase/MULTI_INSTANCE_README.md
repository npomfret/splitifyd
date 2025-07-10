# Multi-Instance Firebase Emulator Setup

This project now supports running multiple Firebase emulator instances side by side on different ports. This is useful for testing, running multiple feature branches, or comparing different versions.

## Quick Start

### Instance 1 (Default Ports)
```bash
cd firebase
npm run switch-instance 1
npm run dev:with-data
```

### Instance 2 (Alternative Ports)
```bash
cd firebase
npm run switch-instance 2
npm run dev:with-data
```

### Instance 3 (Third Set of Ports)
```bash
cd firebase
npm run switch-instance 3
npm run dev:with-data
```

## Port Configuration

### Instance 1 (Default)
- UI: http://localhost:4000
- Auth: 9099
- Functions: 5001
- Firestore: 8080
- Hosting: http://localhost:5002

### Instance 2
- UI: http://localhost:6000
- Auth: 9199
- Functions: 6001
- Firestore: 8180
- Hosting: http://localhost:6002

### Instance 3
- UI: http://localhost:7100
- Auth: 9299
- Functions: 7001
- Firestore: 8280
- Hosting: http://localhost:7002

## How It Works

1. **Environment Variables**: Each instance uses different port configurations stored in `.env.instance1`, `.env.instance2`, and `.env.instance3`
2. **Dynamic Configuration**: The `firebase.json` file is generated dynamically based on environment variables
3. **Smart Client**: The webapp automatically detects which port it's running on and connects to the appropriate emulator ports

## Custom Instances

You can create your own instance configurations:

1. Copy an existing instance file:
   ```bash
   cp firebase/functions/.env.instance1 firebase/functions/.env.instance3
   ```

2. Edit the ports in the new file to avoid conflicts

3. Switch to your custom instance:
   ```bash
   npm run switch-instance 3
   ```

## Troubleshooting

- **Port conflicts**: Make sure no other services are using the configured ports
- **CORS issues**: Check that your `.env` file has the correct `CORS_ALLOWED_ORIGINS` for your hosting port
- **Auth connection**: The client automatically calculates auth ports based on hosting port

## Technical Details

The system uses:
- Environment variables for port configuration
- Dynamic `firebase.json` generation
- Smart client-side port detection
- Automatic health check port adaptation

All existing functionality is preserved when not using multiple instances.