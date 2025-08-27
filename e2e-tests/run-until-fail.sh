#!/bin/bash

# Detect script location and set working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root if we're not already there
if [ "$(pwd)" != "$PROJECT_ROOT" ]; then
    echo "📂 Changing working directory to project root: $PROJECT_ROOT"
    cd "$PROJECT_ROOT"
fi

TEST_FILE="e2e-tests/src/tests/normal-flow/comments-realtime.e2e.test.ts"
TEST_FILTER="should support real-time expense comments across multiple users"

# Make max runs configurable, default to 25
MAX_SUCCESSES=${1:-25}

RUN_COUNT=0
SUCCESS_COUNT=0
START_TIME=$(date +%s)

# Determine if we should run headed or headless
HEADED_FLAG="--headed"
if [[ " $* " == *" --headed "* ]] || [[ " $* " == *" headed "* ]]; then
    HEADED_FLAG="--headed"
    echo "🖥️ Browser mode: HEADED (visible browser window)"
else
    echo "🖥️ Browser mode: HEADLESS (background execution)"
fi

# Clean up any existing screenshots in the ad-hoc folder
echo "🧹 Cleaning up existing playwright-report/ad-hoc..."
rm -f e2e-tests/playwright-report/ad-hoc/*.png 2>/dev/null

echo "🚀 Starting repeated test runs for: $TEST_FILE"
if [ -n "$TEST_FILTER" ]; then
    echo "🎯 Test filter: '$TEST_FILTER'"
fi
echo "📍 Working directory: $(pwd)"
echo "📊 Results will be stored in: e2e-tests/playwright-report/ad-hoc/"
echo "📸 Screenshots on failure: e2e-tests/playwright-report/ad-hoc/data/"
echo "🔢 Will stop after: $MAX_SUCCESSES successful runs OR first failure"
echo "⚙️ Configuration: MAX_SUCCESSES=$MAX_SUCCESSES (pass a number as first argument to override)"
echo "⏰ Started at: $(date)"
echo ""

while [ $SUCCESS_COUNT -lt $MAX_SUCCESSES ]; do
    RUN_COUNT=$((RUN_COUNT + 1))
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 Run #$RUN_COUNT (${ELAPSED}s elapsed) - $(date '+%H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Run the test
    if [ -n "$TEST_FILTER" ]; then
        PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_HTML_REPORT=e2e-tests/playwright-report/ad-hoc npx playwright test -c e2e-tests/playwright.config.ts --workers=1 $HEADED_FLAG --project=chromium --reporter=html "$TEST_FILE" --grep "$TEST_FILTER"
    else
        PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_HTML_REPORT=e2e-tests/playwright-report/ad-hoc npx playwright test -c e2e-tests/playwright.config.ts --workers=1 $HEADED_FLAG --project=chromium --reporter=html "$TEST_FILE"
    fi
    
    # Check exit code
    if [ $? -ne 0 ]; then
        FINAL_TIME=$(date +%s)
        TOTAL_ELAPSED=$((FINAL_TIME - START_TIME))
        echo ""
        echo "💥 TEST FAILED on run #$RUN_COUNT!"
        echo "⏱️  Total time: ${TOTAL_ELAPSED}s"
        echo "📊 Average time per run: $((TOTAL_ELAPSED / RUN_COUNT))s"
        echo "🏁 Stopped at: $(date)"
        exit 1
    fi
    
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo "✅ Run #$RUN_COUNT completed successfully (${SUCCESS_COUNT}/${MAX_SUCCESSES} successes)"
    
    # Check if we've reached our success limit
    if [ $SUCCESS_COUNT -ge $MAX_SUCCESSES ]; then
        FINAL_TIME=$(date +%s)
        TOTAL_ELAPSED=$((FINAL_TIME - START_TIME))
        echo ""
        echo "🎉 SUCCESS LIMIT REACHED! Completed $MAX_SUCCESSES successful runs without failure"
        echo "⏱️  Total time: ${TOTAL_ELAPSED}s"
        echo "📊 Average time per run: $((TOTAL_ELAPSED / RUN_COUNT))s"
        echo "🏁 Stopped at: $(date)"
        exit 0
    fi
    
    echo ""
    
    # Small delay to avoid overwhelming the system
    sleep 2
done
