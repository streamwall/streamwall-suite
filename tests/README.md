# Streamwall Ecosystem Integration Tests

This directory contains integration and end-to-end tests for the Streamwall ecosystem.

## Test Structure

```
tests/
├── integration/          # Integration tests between services
│   ├── stream-discovery.test.js    # Discord → Monitor → Storage
│   ├── service-communication.test.js # Inter-service communication
│   └── end-to-end.test.js         # Complete flow tests
├── e2e/                 # End-to-end tests (future)
├── helpers/             # Test utilities
│   ├── services.js      # Service management helpers
│   └── test-data.js     # Test data generators
├── setup.js             # Global test setup
└── teardown.js          # Global test teardown
```

## Running Tests

### Prerequisites

1. Docker must be installed and running
2. Node.js 18+ required
3. Services should have their `.env` files configured

### Setup

```bash
# Install dependencies
npm install

# Or use Make
make setup-integration
```

### Running All Tests

```bash
# Using npm
npm test

# Using Make
make test-integration

# With coverage
npm run test:coverage
```

### Running Specific Test Suites

```bash
# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Watch mode for development
npm run test:watch
```

### Running Individual Tests

```bash
# Run a specific test file
npm test stream-discovery

# Run tests matching a pattern
npm test -- --testNamePattern="Discord"
```

## Test Categories

### 1. Stream Discovery Tests
Tests the flow of stream URL discovery from Discord/Twitch through the livestream-link-monitor service.

**What it tests:**
- URL detection from messages
- Platform identification
- Location parsing
- Duplicate detection
- Rate limiting
- Error handling

### 2. Service Communication Tests
Tests how services communicate and maintain data consistency.

**What it tests:**
- Data consistency across backends
- WebSocket real-time updates
- Service failover and recovery
- Authentication and authorization
- Rate limiting across services

### 3. End-to-End Tests
Tests the complete flow from stream discovery to display.

**What it tests:**
- Full pipeline from Discord to Streamwall
- Multi-service coordination
- Performance under load
- Error recovery
- System resilience

## Environment Variables

Tests use the following environment variables:

```bash
# Service URLs
MONITOR_HEALTH_URL=http://localhost:3001/health
DISCORD_WEBHOOK_URL=http://localhost:3001/webhook/discord
STREAMSOURCE_API_URL=http://localhost:3000/api/v1

# Test configuration
INTEGRATION_TEST=true
NODE_ENV=test
```

## Writing New Tests

### Test Structure

```javascript
describe('Feature Being Tested', () => {
  beforeAll(async () => {
    // Start required services
    await startService('service-name');
    await waitForService('http://localhost:port/health');
  });

  afterAll(async () => {
    // Clean up
    await stopService('service-name');
  });

  test('should do something specific', async () => {
    // Arrange
    const testData = generateTestData();

    // Act
    const result = await performAction(testData);

    // Assert
    expect(result).toMatchExpectedBehavior();
  });
});
```

### Using Test Helpers

```javascript
const { startService, waitForService } = require('../helpers/services');
const { generateTestStream, delay } = require('../helpers/test-data');

// Start a service
await startService('livestream-link-monitor');

// Wait for it to be ready
await waitForService('http://localhost:3001/health');

// Generate test data
const stream = generateTestStream({
  platform: 'youtube',
  status: 'live'
});

// Wait for async operations
await delay(2000);
```

## Debugging Tests

### View Service Logs

```bash
# During test execution
make logs-monitor
make logs-checker

# Or check container logs directly
docker logs livestream-link-monitor
```

### Run in Debug Mode

```bash
# With Node.js debugging
node --inspect-brk ./node_modules/.bin/jest --runInBand

# With verbose output
npm test -- --verbose
```

### Common Issues

1. **Services not starting**: Check Docker is running and ports are available
2. **Timeouts**: Increase test timeout in jest.config.js
3. **Port conflicts**: Ensure ports 3000, 3001, etc. are not in use
4. **Missing credentials**: Check service .env files and Google credentials

## CI/CD Integration

To run tests in CI:

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  run: |
    docker-compose up -d
    npm test
    docker-compose down
```

## Best Practices

1. **Isolate tests**: Each test should be independent
2. **Clean up**: Always stop services in afterAll()
3. **Use helpers**: Leverage test utilities for common operations
4. **Mock external services**: When testing specific components
5. **Descriptive names**: Test names should clearly state what they verify
6. **Timeouts**: Set appropriate timeouts for async operations
7. **Error handling**: Test both success and failure scenarios