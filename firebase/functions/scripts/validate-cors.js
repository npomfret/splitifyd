#!/usr/bin/env node

/**
 * CORS Configuration Validation Script
 * 
 * This script validates that CORS is configured correctly and prevents
 * common mistakes that can break local development or compromise security.
 * 
 * Run this before committing changes to CORS configuration.
 */

const fs = require('fs');
const path = require('path');

const MIDDLEWARE_FILE = path.join(__dirname, '../src/utils/middleware.ts');
const CONFIG_FILE = path.join(__dirname, '../src/config.ts');

function validateCorsConfiguration() {
  console.log('🔍 Validating CORS configuration...');
  
  const errors = [];
  const warnings = [];
  
  // Check middleware file
  if (!fs.existsSync(MIDDLEWARE_FILE)) {
    errors.push(`Middleware file not found: ${MIDDLEWARE_FILE}`);
    return { errors, warnings };
  }
  
  const middlewareContent = fs.readFileSync(MIDDLEWARE_FILE, 'utf8');
  
  // Check for dangerous CORS patterns
  if (middlewareContent.includes('origin: true')) {
    errors.push('SECURITY RISK: Found "origin: true" in middleware.ts - this allows ALL origins!');
  }
  
  if (middlewareContent.includes('cors({})')) {
    errors.push('SECURITY RISK: Found empty cors({}) configuration - this allows ALL origins!');
  }
  
  if (middlewareContent.match(/cors\(\s*\{[^}]*origin:\s*["']?\*["']?/)) {
    errors.push('SECURITY RISK: Found origin: "*" in CORS config - this allows ALL origins!');
  }
  
  // Check for proper CONFIG usage
  if (!middlewareContent.includes('CONFIG.corsOptions')) {
    warnings.push('CORS configuration should use CONFIG.corsOptions for environment-specific settings');
  }
  
  // Check config file
  if (!fs.existsSync(CONFIG_FILE)) {
    errors.push(`Config file not found: ${CONFIG_FILE}`);
    return { errors, warnings };
  }
  
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
  
  // Validate that development origins include necessary localhost variants
  const devOriginsMatch = configContent.match(/localhost:\$\{PORTS\.LOCAL_(\d+)\}/g);
  if (!devOriginsMatch || !devOriginsMatch.some(match => match.includes('5002'))) {
    warnings.push('Development CORS should include localhost:5002 for frontend');
  }
  
  // Check for 127.0.0.1 variants (some browsers/tools prefer this)
  if (!configContent.includes('127.0.0.1')) {
    warnings.push('Consider adding 127.0.0.1 variants for broader localhost compatibility');
  }
  
  return { errors, warnings };
}

function main() {
  const { errors, warnings } = validateCorsConfiguration();
  
  if (warnings.length > 0) {
    console.log('\n⚠️  CORS Warnings:');
    warnings.forEach(warning => console.log(`   • ${warning}`));
  }
  
  if (errors.length > 0) {
    console.log('\n❌ CORS Validation Failed:');
    errors.forEach(error => console.log(`   • ${error}`));
    console.log('\n💡 Common fixes:');
    console.log('   • Remove "origin: true" and use CONFIG.corsOptions');
    console.log('   • Ensure development environment includes all necessary localhost origins');
    console.log('   • Use environment-specific origin lists instead of wildcard origins');
    process.exit(1);
  }
  
  console.log('\n✅ CORS configuration looks good!');
  console.log('\n💡 Tips to prevent CORS issues:');
  console.log('   • Never use "origin: true" in production code');
  console.log('   • Always test locally before committing CORS changes');
  console.log('   • Use the fallback mechanism for development debugging only');
}

if (require.main === module) {
  main();
}

module.exports = { validateCorsConfiguration };