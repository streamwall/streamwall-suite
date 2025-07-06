// Global teardown for integration tests
const { execSync } = require('child_process');

module.exports = async () => {
  console.log('\n🧹 Cleaning up integration test environment...\n');

  // Restore original environment
  if (global.__ORIGINAL_ENV) {
    process.env = global.__ORIGINAL_ENV;
  }

  // Stop any running test containers
  try {
    execSync('docker-compose -f docker-compose.test.yml down 2>/dev/null', { stdio: 'ignore' });
  } catch (error) {
    // Ignore errors, containers might not be running
  }

  console.log('✅ Cleanup complete\n');
};