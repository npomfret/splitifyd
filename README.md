# Splitifyd

A bill splitting app.

View the [docs](docs) for details on features, todo, dev stuff etc.

## Browser Testing with MCP

This project uses automated browser testing via [Microsoft's Playwright MCP server](https://github.com/microsoft/playwright-mcp). Install it:

```shell
claude mcp add playwright npx @playwright/mcp@latest
```

This enables Claude Code to automatically navigate pages, take screenshots, and check for console errors during development.

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

### Testing the Webapp

Once MCP is configured, Claude can automatically:

- Navigate to webapp routes (served at Firebase emulator root)
- Take screenshots at different viewport sizes
- Check for console errors
- Verify page elements and functionality

Run the integrated development server first:

```bash
npm run dev  # Starts Firebase emulator + webapp
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

To stop the emulator, just hit `ctrl-c`, but if it doesn't stop cleanly run `./scripts/kill-emulators.js`

## Webapp Architecture

The webapp is a modern Preact-based SPA located in the `webapp-v2` directory. It's served directly from the Firebase emulator and provides a responsive, single-page application experience.

### Development

```bash
# Start the full development environment (Firebase emulator + webapp)
npm run dev

# Build webapp only
npm run webapp-v2:build
```

The webapp is served from the Firebase emulator's hosting service.

## Deployment

Run `cd firebase && npm deploy:prod`
