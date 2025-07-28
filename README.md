# Splitifyd

A bill splitting app.

View the [docs](docs) for details on features, todo, dev stuff etc.

## Browser Testing with MCP

This project uses automated browser testing via [Microsoft's Playwright MCP server](https://github.com/microsoft/playwright-mcp). Install it:

```shell
claude mcp add playwright npx @playwright/mcp@latest
```

This enables Claude Code to automatically navigate pages, take screenshots, and check for console errors during development.

```shell
claude mcp add playwright npx @playwright/mcp@latest
```

### Prerequisites

**Claude Desktop Required**: MCP browser automation only works with Claude Desktop + Claude Code CLI, not the web version.

Open jdk: https://formulae.brew.sh/formula/openjdk

### Setup

1. **Install Claude Desktop** if you haven't already

2. **Configure MCP in Claude Desktop**:
   ```bash
   # Edit your Claude Desktop config
   open ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

   Add this configuration:
   ```json
   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": ["@playwright/mcp@latest"]
       }
     }
   }
   ```

3. **Restart Claude Desktop** completely (quit and reopen)

4. **Start a new Claude Code CLI session** to get MCP tools

### Testing Webapp-v2

Once MCP is configured, Claude can automatically:
- Navigate to webapp-v2 routes (`http://localhost:6002/v2/`)
- Take screenshots at different viewport sizes
- Check for console errors
- Verify page elements and functionality

Run the integrated development server first:
```bash
npm run dev  # Starts Firebase emulator + webapp-v2 at /v2/
```

## Getting started

Create a firebase project and from it create `firbase/functions/.env` and add:
```
PROJECT_ID=<your-project-id>
CLIENT_API_KEY=
CLIENT_AUTH_DOMAIN=<your-project-id>.firebaseapp.com
CLIENT_STORAGE_BUCKET=<your-project-id>.firebasestorage.app
CLIENT_MESSAGING_SENDER_ID=
CLIENT_APP_ID=
CLIENT_MEASUREMENT_ID=
```

To run the server locally via the firebase emulator

```
npm run dev
```

In your browser go to http://localhost:5002/

To stop the emulator, just hit `ctrl-c`, but if it doesn't stop cleanly run `./scripts/kill-emulators.js`

## Webapp v2 (Preact Migration)

A new Preact-based version of the webapp is being developed in the `webapp-v2` directory. This allows incremental migration from the current vanilla JS/TS webapp.

### Running Webapp v2

```bash
# Start the Preact dev server (with HMR)
npm run webapp-v2:dev

# Build webapp-v2
npm run webapp-v2:build

# Preview production build
npm run webapp-v2:preview
```

The Preact app runs on http://localhost:3000 by default.

## Deployment

Run `cd firebase && npm deploy:prod`