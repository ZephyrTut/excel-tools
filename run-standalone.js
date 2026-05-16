// Direct execution - no shell, just spawn node
const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'standalone-compare.js');

try {
  console.log('Command: node "' + scriptPath + '"\n');
  const output = execSync('node "' + scriptPath + '"', {
    encoding: 'utf8',
    stdio: 'inherit',
    cwd: __dirname
  });
} catch (error) {
  // Exit code is preserved
  process.exit(error.code || 1);
}
