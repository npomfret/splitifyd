# Webapp v2 - Preact Migration

This is the new Preact-based version of the Splitifyd webapp, being built alongside the existing vanilla JS/TS webapp for incremental migration.

## Tech Stack

- **Preact** - Lightweight React alternative
- **Vite** - Fast build tool with HMR
- **TypeScript** - Type safety with strict mode
- **Tailwind CSS** - Utility-first styling
- **Preact Router** - Simple routing

## Development

### Quick Start

From the root directory:

```bash
# Start the development server
npm run webapp-v2:dev

# Build for production
npm run webapp-v2:build

# Preview production build
npm run webapp-v2:preview
```

### Direct Commands

From the webapp-v2 directory:

```bash
# Install dependencies
npm install

# Start dev server (opens http://localhost:3000)
npm run dev

# Type checking
npm run typecheck

# Build
npm run build

# Preview build
npm run preview
```

## Structure

```
webapp-v2/
├── src/
│   ├── assets/        # Static assets (images, fonts)
│   ├── components/    # Reusable components
│   ├── pages/         # Page components
│   ├── styles/        # Global styles
│   ├── App.tsx        # Main app component with router
│   └── main.tsx       # Entry point
├── index.html         # HTML template
├── vite.config.ts     # Vite configuration
├── tsconfig.json      # TypeScript configuration
└── tailwind.config.js # Tailwind configuration
```

## Migration Status

### Completed
- ✅ Basic Preact setup with Vite
- ✅ TypeScript with strict mode
- ✅ Tailwind CSS integration
- ✅ Basic routing (home, 404)
- ✅ Development scripts

### TODO
- [ ] Firebase integration
- [ ] Authentication pages
- [ ] Dashboard migration
- [ ] Group management
- [ ] Expense tracking
- [ ] API client setup

## Development Notes

- HMR is enabled - changes appear instantly
- TypeScript strict mode is enforced
- React compatibility is aliased for libraries
- Currently runs on port 3000 (configurable in vite.config.ts)

## Next Steps

1. Set up Firebase connection
2. Migrate authentication pages
3. Create shared API client
4. Begin migrating individual pages