# Building

## Build Process

### No-Compile Development Mode

**Important**: This project uses a no-compile development mode for faster startup times. Instead of compiling TypeScript to JavaScript during development, we use `tsx` to run TypeScript files directly.

#### How It Works

The build system uses conditional logic based on the `BUILD_MODE` environment variable:

- **Development** (`BUILD_MODE` unset or `development`): Creates lightweight wrapper files that use `tsx` to execute TypeScript directly. No compilation occurs, resulting in instant startup.
- **Testing** (`BUILD_MODE=test`): Our test harness sets this automatically before kicking off package builds so integration tests run against the compiled output when they need it.
- **Production** (`BUILD_MODE=production`): Full TypeScript compilation for optimized deployment. In this mode the Firebase Functions build emits compiled JavaScript rather than the tsx wrapper.

#### Impact on Development

- `npm run dev`: Starts instantly without compilation
- `npm run test`: Runs tests directly on TypeScript files (no build required)
- `npm run build`: Creates development wrappers (unless `BUILD_MODE` is set to `production` or `test`)
- `BUILD_MODE=production npm run build`: Full production compilation

### Traditional Build Process

Before any tests are run, the entire project must "compile". We use TypeScript's `tsc` compiler with the `--noEmit` flag to perform type-checking without generating JavaScript files. This ensures that all code, including test files, adheres to our type-safety standards.

The root `package.json` provides scripts to build all sub-projects. Run these from the monorepo root directory:

```bash
# From the monorepo root directory
npm run build                      # Builds all workspaces in development mode
BUILD_MODE=production npm run build  # Builds all workspaces for production
```
