# Integration Tests

This directory contains comprehensive integration tests for the Streamwall ecosystem, ensuring all services work together correctly.

## Test Coverage

### Core Integration Tests (✅ All Passing)

1. **stream-discovery.test.js** - Tests stream discovery from Discord/Twitch
   - Discord message processing
   - Platform detection (Twitch, YouTube, TikTok, Kick, Facebook)
   - Location parsing
   - Google Sheets integration (mocked)
   - Error handling

2. **end-to-end.test.js** - Tests complete stream flow from discovery to display
   - Full pipeline from Discord message to stream availability
   - Multi-service coordination
   - Performance under load
   - Service interruption recovery

3. **service-communication.test.js** - Tests inter-service communication
   - Health check endpoints
   - Service discovery
   - API communication patterns
   - Data consistency across services

### Extended Integration Tests (New)

4. **streamsource-api.test.js** - Comprehensive StreamSource API tests
   - JWT authentication
   - Stream CRUD operations
   - Pagination and filtering
   - Service integration scenarios
   - Real-time update simulation

5. **monitor-to-streamsource.test.js** - Livestream Monitor ↔ StreamSource integration
   - Dual-write mode (Sheets + API)
   - Duplicate handling
   - Batch processing
   - Platform-specific handling
   - Sync status monitoring

6. **checker-to-streamsource.test.js** - Livesheet Checker ↔ StreamSource synchronization
   - Stream addition and sync
   - Status updates propagation
   - Bulk checking operations
   - Periodic checking
   - Data consistency

7. **cross-service-consistency.test.js** - Cross-service data consistency
   - Stream creation consistency
   - Duplicate handling across services
   - Status update propagation
   - Filtering and search consistency
   - Audit trail
   - Performance under concurrent operations

8. **realtime-updates.test.js** - WebSocket/ActionCable real-time updates
   - WebSocket connection management
   - Stream update broadcasting
   - Collaborative editing with cell locking
   - Multi-client scenarios
   - Connection recovery

## Running the Tests

### Run all integration tests
```bash
npm test tests/integration/
```

### Run specific test suite
```bash
npm test tests/integration/stream-discovery.test.js
```

### Run with coverage
```bash
npm test -- --coverage tests/integration/
```

### Run in watch mode
```bash
npm test -- --watch tests/integration/
```

## Test Architecture

### Mock Services

The tests use mock implementations of services to ensure:
- Fast execution
- No external dependencies
- Predictable behavior
- Easy debugging

Key mock services:
- `MockLivestreamMonitor` - Simulates livestream-link-monitor
- `MockStreamSourceAPI` - Simulates StreamSource Rails API
- `MockLivesheetChecker` - Simulates livesheet-checker
- `MockActionCableServer` - Simulates WebSocket server

### Test Helpers

Located in `tests/helpers/`:
- `test-data.js` - Test data generators and fixtures
- `services.js` - Service management utilities
- `mock-livestream-monitor.js` - Mock monitor implementation

## Best Practices

1. **Isolation**: Each test suite resets services between tests
2. **Async Handling**: Proper use of async/await for all operations
3. **Timeouts**: Reasonable timeouts for service operations
4. **Error Cases**: Tests include both success and failure scenarios
5. **Real-world Scenarios**: Tests simulate actual usage patterns

## Debugging Failed Tests

1. Check service logs:
   ```bash
   npm test -- --verbose tests/integration/failing-test.js
   ```

2. Run single test:
   ```bash
   npm test -- -t "should handle duplicate streams"
   ```

3. Increase timeouts for slow operations:
   ```javascript
   jest.setTimeout(30000); // 30 seconds
   ```

## Adding New Tests

1. Create test file following naming convention: `feature-name.test.js`
2. Import necessary helpers and mock services
3. Set up services in `beforeAll`
4. Clean up in `afterAll` and `afterEach`
5. Group related tests in `describe` blocks
6. Use descriptive test names with `test` or `it`

Example structure:
```javascript
describe('Feature Integration', () => {
  let mockService;
  
  beforeAll(async () => {
    mockService = new MockService();
    await mockService.start();
  });
  
  afterAll(async () => {
    await mockService?.stop();
  });
  
  afterEach(async () => {
    await mockService.reset();
  });
  
  test('should handle specific scenario', async () => {
    // Test implementation
  });
});
```

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:
- No external dependencies required
- Predictable execution time
- Clear pass/fail status
- Detailed error reporting

GitHub Actions example:
```yaml
- name: Run Integration Tests
  run: npm test tests/integration/
```