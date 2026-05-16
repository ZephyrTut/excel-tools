#!/usr/bin/env node
// Temporary runner script for comparison
const path = require('path');
const { execFileSync } = require('child_process');

const scriptPath = path.join(__dirname, 'compare.js');
console.log('Running comparison script:', scriptPath);

try {
  const result = execFileSync('node', [scriptPath], {
    cwd: __dirname,
    encoding: 'utf8',
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Error running comparison:', error.message);
  process.exit(1);
}
