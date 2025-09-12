#!/usr/bin/env node

/**
 * Analyze Vitest JSON test results and report slowest tests
 * Usage: node analyze-test-performance.js <json-file-path>
 */

const fs = require('fs');
const path = require('path');

function formatDuration(ms) {
    if (ms >= 1000) {
        return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${Math.round(ms)}ms`;
}

function analyzeTestResults(jsonFilePath) {
    try {
        if (!fs.existsSync(jsonFilePath)) {
            console.log('⚠️  No test results file found. Performance analysis skipped.');
            console.log('💡 To generate test results, run: npm run test:integration');
            console.log('   (Performance analysis runs automatically after integration tests complete)');
            return;
        }

        const rawData = fs.readFileSync(jsonFilePath, 'utf8');
        const testResults = JSON.parse(rawData);
        
        if (!testResults.testResults || testResults.testResults.length === 0) {
            console.log('⚠️  No test results found in JSON file.');
            return;
        }

        // Collect all individual tests with their durations
        const allTests = [];
        const fileStats = [];

        testResults.testResults.forEach(testFile => {
            const filePath = testFile.name || testFile.filepath || 'unknown';
            const relativePath = filePath.replace(process.cwd(), '').replace(/^\//, '');
            
            let fileTotalTime = 0;
            let testCount = 0;

            if (testFile.assertionResults) {
                testFile.assertionResults.forEach(test => {
                    const duration = test.duration || 0;
                    fileTotalTime += duration;
                    testCount++;

                    allTests.push({
                        name: test.title || test.ancestorTitles?.join(' > ') + ' > ' + test.title || 'unknown test',
                        file: relativePath,
                        duration: duration
                    });
                });
            }

            fileStats.push({
                file: relativePath,
                totalTime: fileTotalTime,
                testCount: testCount,
                avgTime: testCount > 0 ? fileTotalTime / testCount : 0
            });
        });

        // Sort tests by duration (slowest first)
        allTests.sort((a, b) => b.duration - a.duration);
        
        // Sort files by total time (slowest first)
        fileStats.sort((a, b) => b.totalTime - a.totalTime);

        // Calculate statistics
        const totalTests = allTests.length;
        const totalTime = allTests.reduce((sum, test) => sum + test.duration, 0);
        const avgTime = totalTests > 0 ? totalTime / totalTests : 0;
        const slowTests = allTests.filter(test => test.duration > 500);
        const verySlowTests = allTests.filter(test => test.duration > 1000);

        // Print the performance report
        console.log('\n' + '='.repeat(60));
        console.log('🔍 INTEGRATION TEST PERFORMANCE REPORT');
        console.log('='.repeat(60));

        // Show slowest individual tests
        console.log('\n⏱️  SLOWEST INDIVIDUAL TESTS:');
        const topSlowTests = allTests.slice(0, Math.min(15, totalTests));
        topSlowTests.forEach((test, index) => {
            const emoji = index < 3 ? '🚨' : index < 10 ? '⚠️ ' : '📝';
            console.log(`${(index + 1).toString().padStart(2)}. ${emoji} ${formatDuration(test.duration).padStart(8)} - ${test.name}`);
            console.log(`    📁 ${test.file}`);
        });

        // Show slowest test files
        if (fileStats.length > 0) {
            console.log('\n📁 SLOWEST TEST FILES:');
            const topSlowFiles = fileStats.slice(0, Math.min(10, fileStats.length));
            topSlowFiles.forEach((file, index) => {
                const emoji = index < 3 ? '🚨' : index < 5 ? '⚠️ ' : '📝';
                console.log(`${(index + 1).toString().padStart(2)}. ${emoji} ${formatDuration(file.totalTime).padStart(8)} - ${file.file}`);
                console.log(`    ${file.testCount} tests, avg: ${formatDuration(file.avgTime)}`);
                
                // Find and show the slowest test in this file
                const testsInFile = allTests.filter(test => test.file === file.file);
                if (testsInFile.length > 0) {
                    const slowestInFile = testsInFile.reduce((slowest, current) => 
                        current.duration > slowest.duration ? current : slowest
                    );
                    console.log(`    🔸 Slowest test: ${formatDuration(slowestInFile.duration)} - ${slowestInFile.name}`);
                }
            });
        }

        // Show overall statistics
        console.log('\n📊 OVERALL STATISTICS:');
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Total Time: ${formatDuration(totalTime)}`);
        console.log(`   Average Time: ${formatDuration(avgTime)}`);
        console.log(`   Tests > 500ms: ${slowTests.length} (${((slowTests.length / totalTests) * 100).toFixed(1)}%)`);
        console.log(`   Tests > 1000ms: ${verySlowTests.length} (${((verySlowTests.length / totalTests) * 100).toFixed(1)}%)`);

        // Performance warnings
        if (verySlowTests.length > 0) {
            console.log('\n🚨 PERFORMANCE WARNINGS:');
            console.log(`   ${verySlowTests.length} tests are taking longer than 1 second!`);
            console.log('   Consider optimizing these tests to improve overall test suite speed.');
        } else if (slowTests.length > totalTests * 0.1) {
            console.log('\n⚠️  PERFORMANCE NOTE:');
            console.log(`   ${slowTests.length} tests (${((slowTests.length / totalTests) * 100).toFixed(1)}%) are taking longer than 500ms.`);
            console.log('   Consider reviewing these tests for optimization opportunities.');
        } else {
            console.log('\n✅ PERFORMANCE: Good! Most tests are running efficiently.');
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('❌ Error analyzing test results:', error.message);
    }
}

// Main execution
const jsonFilePath = process.argv[2];

if (!jsonFilePath) {
    console.error('Usage: node analyze-test-performance.js <json-file-path>');
    process.exit(1);
}

// Convert relative path to absolute path based on where the script is called from
const absolutePath = path.isAbsolute(jsonFilePath) 
    ? jsonFilePath 
    : path.resolve(process.cwd(), jsonFilePath);

analyzeTestResults(absolutePath);