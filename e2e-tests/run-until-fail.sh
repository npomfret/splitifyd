#!/bin/bash

TEST_FILE="src/tests/normal-flow/expense-datetime.e2e.test.ts:8:3"
TEST_FILTER=""

RUN_COUNT=0
SUCCESS_COUNT=0
MAX_SUCCESSES=10
START_TIME=$(date +%s)

# Determine if we should run headed or headless
HEADED_FLAG=""
if [[ " $* " == *" --headed "* ]] || [[ " $* " == *" headed "* ]]; then
    HEADED_FLAG="--headed"
    echo "🖥️  Browser mode: HEADED (visible browser window)"
else
    echo "🖥️  Browser mode: HEADLESS (background execution)"
fi

# Clean up any existing screenshots in the ad-hoc folder
echo "🧹 Cleaning up existing screenshots in playwright-report/ad-hoc..."
rm -f playwright-report/ad-hoc/*.png 2>/dev/null

echo "🚀 Starting repeated test runs for: $TEST_FILE"
if [ -n "$TEST_FILTER" ]; then
    echo "🎯 Test filter: '$TEST_FILTER'"
fi
echo "📍 Working directory: $(pwd)"
echo "📊 Results will be stored in: playwright-report/ad-hoc/"
echo "📸 Screenshots on failure: playwright-report/ad-hoc/data/"
echo "🔢 Will stop after: $MAX_SUCCESSES successful runs OR first failure"
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
        npm run build && PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_HTML_REPORT=playwright-report/ad-hoc npx playwright test --workers=1 $HEADED_FLAG --project=chromium --reporter=html "$TEST_FILE" --grep "$TEST_FILTER"
    else
        npm run build && PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_HTML_REPORT=playwright-report/ad-hoc npx playwright test --workers=1 $HEADED_FLAG --project=chromium --reporter=html "$TEST_FILE"
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
