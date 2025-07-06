// Global setup for integration tests
const { execSync } = require('child_process');

module.exports = async () => {
  console.log('\n🚀 Setting up integration test environment...\n');

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.INTEGRATION_TEST = 'true';

  // Check if Docker is running
  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Docker is not running. Please start Docker and try again.');
    process.exit(1);
  }

  // Store original env
  global.__ORIGINAL_ENV = { ...process.env };

  console.log('✅ Test environment ready\n');
};