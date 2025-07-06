// Global setup for integration tests
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('\n🚀 Setting up integration test environment...\n');

  // Load test environment variables
  const testEnvPath = path.join(__dirname, '..', '.env.test');
  if (fs.existsSync(testEnvPath)) {
    const envContent = fs.readFileSync(testEnvPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    });
  }

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