# Splitifyd

Splitifyd is a bill splitting app.

IT IS A WORK IN PROGRESS.

## Quick Start

### IMPORTANT: Environment Setup Required

This application requires environment variables to be configured before it will run. See [TECHNICAL_CONFIG.md](TECHNICAL_CONFIG.md) for detailed setup instructions.

## Features

All features and implementation details have been moved to [`webapp/FEATURES.md`](webapp/FEATURES.md) for better organization and tracking.

## Dev ethos

- assume all data coming into the system from external sources (like a user) is dangerous and needs careful _vetting_
- assume all data coming from internal sources (eg server to client) is perfect and does not need validating
- fail fast - we want to know if the app is broken
- do not code for _backward compatibility_
- in general, allow exceptions to bubble out
- check configuration and the environemnt on start up and fail quickly if it's not ok
- use the latest APIs available to us