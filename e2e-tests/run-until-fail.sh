#!/bin/bash

# Usage:
#   ./run-until-fail.sh [max_runs] [--headed]
#
# Examples:
#   ./run-until-fail.sh              # Run up to 3 times (default) in headless mode
#   ./run-until-fail.sh 50           # Run up to 50 times in headless mode
#   ./run-until-fail.sh --headed     # Run up to 25 times in headed mode (visible browser)
#   ./run-until-fail.sh 50 --headed  # Run up to 50 times in headed mode
#
# The script will stop on the first failure or after max_runs successful runs.
# In headed mode, workers are automatically set to 1 for better visibility.
#
# This script generates a Playwright trace file for each run, which can be
# used to analyze test performance. To view the trace, open the report in Chrome:
#   open -a "Google Chrome" "e2e-tests/playwright-output/ad-hoc/report/index.html"

# edit these to pick your test cases
TEST_FILE="src/__tests__/integration/expense-and-balance-lifecycle.e2e.test.ts"
TEST_FILTER="should edit settlements with comprehensive validation and form handling"

# Detect script location and set working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
E2E_TESTS_DIR="$SCRIPT_DIR"
AD_HOC_ROOT="$E2E_TESTS_DIR/playwright-output/ad-hoc"
AD_HOC_REPORT_DIR="$AD_HOC_ROOT/report"
AD_HOC_DATA_DIR="$AD_HOC_ROOT/data"

# Change to project root if we're not already there
if [ "$(pwd)" != "$PROJECT_ROOT" ]; then
    echo "📂 Changing working directory to project root: $PROJECT_ROOT"
    cd "$PROJECT_ROOT"
fi

# Parse command line arguments
MAX_SUCCESSES=3
HEADED_FLAG=""
WORKERS=1

for arg in "$@"; do
    if [[ "$arg" == "--headed" ]]; then
        HEADED_FLAG="--headed"
        WORKERS=1
    elif [[ "$arg" =~ ^[0-9]+$ ]]; then
        MAX_SUCCESSES=$arg
    fi
done

RUN_COUNT=0
SUCCESS_COUNT=0
START_TIME=$(date +%s)

# Display browser mode
if [ -n "$HEADED_FLAG" ]; then
    echo "🖥️ Browser mode: HEADED (visible browser window, workers=$WORKERS)"
else
    echo "🖥️ Browser mode: HEADLESS (background execution, workers=$WORKERS)"
fi

# Clean up any existing artifacts in the ad-hoc folders
rm -rf "$AD_HOC_REPORT_DIR" "$AD_HOC_DATA_DIR" 2>/dev/null
mkdir -p "$AD_HOC_REPORT_DIR" "$AD_HOC_DATA_DIR"

echo "🚀 Starting repeated test runs for: $TEST_FILE"
if [ -n "$TEST_FILTER" ]; then
    echo "🎯 Test filter: '$TEST_FILTER'"
fi
echo "📊 HTML report will be stored in: $AD_HOC_REPORT_DIR/"
echo "📸 Screenshots and artifacts: $AD_HOC_DATA_DIR/"
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
        PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_HTML_REPORT="$AD_HOC_REPORT_DIR" PLAYWRIGHT_TEST_OUTPUT_DIR="$AD_HOC_DATA_DIR" npx playwright test -c e2e-tests/playwright.config.ts --workers=$WORKERS $HEADED_FLAG --project=chromium --reporter=html --trace on "$TEST_FILE" --grep "$TEST_FILTER"
    else
        PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_HTML_REPORT="$AD_HOC_REPORT_DIR" PLAYWRIGHT_TEST_OUTPUT_DIR="$AD_HOC_DATA_DIR" npx playwright test -c e2e-tests/playwright.config.ts --workers=$WORKERS $HEADED_FLAG --project=chromium --reporter=html --trace on "$TEST_FILE"
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
        echo ""
        echo "To view the report and trace, run the following command:"
        echo "open -a \"Google Chrome\" \"$AD_HOC_REPORT_DIR/index.html\""
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
        echo ""
        echo "To view the report and trace of the last successful run, run the following command:"
        echo "open -a \"Google Chrome\" \"$AD_HOC_REPORT_DIR/index.html\""
        exit 0
    fi
    
    echo ""
    
    # Small delay to avoid overwhelming the system
    sleep 2
done
