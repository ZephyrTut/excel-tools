#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'compare.js');

console.log('Starting comparison process...');
console.log('Script:', scriptPath);
console.log('---\n');

const proc = spawn('node', [scriptPath], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

proc.on('close', (code) => {
  console.log('\n---');
  console.log('Comparison completed with exit code:', code);
  process.exit(code);
});

proc.on('error', (err) => {
  console.error('Failed to start comparison:', err);
  process.exit(1);
});
