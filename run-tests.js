/**
 * Test runner that starts the server and runs tests
 * This ensures the server is running before tests execute
 */

'use strict';

const { spawn } = require('child_process');

async function runTests() {
  console.log('Starting test server...');

  // Start the server
  const server = spawn('node', ['testserver.js'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Wait for server to start
  await new Promise((resolve, reject) => {
    const timeoutId = global.setTimeout(() => {
      reject(new Error('Server startup timeout'));
    }, 5000);

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Test server starting')) {
        global.clearTimeout(timeoutId);
        console.log('✓ Server started successfully\n');
        resolve();
      }
    });

    server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    server.on('error', (err) => {
      global.clearTimeout(timeoutId);
      reject(err);
    });
  });

  // Give the server a moment to fully initialize
  await new Promise(resolve => global.setTimeout(resolve, 500));

  // Run the tests
  console.log('Running tests...\n');
  const testProcess = spawn('node', ['test-request.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  await new Promise((resolve, reject) => {
    testProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Tests failed with code ${code}`));
      }
    });

    testProcess.on('error', reject);
  });

  // Clean up
  console.log('\nShutting down test server...');
  server.kill();

  // Wait for server to shut down
  await new Promise((resolve) => {
    server.on('close', () => {
      console.log('✓ Test server stopped');
      resolve();
    });
  });
}

runTests()
  .then(() => {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  });
