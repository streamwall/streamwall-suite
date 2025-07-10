# Streamwall Technical Documentation

## Architecture

```
Discord/Twitch → Monitor → StreamSource API → Streamwall Display
                             ↑
                    Livesheet Updater
```

### Core Services

#### 1. **streamsource/** (Rails 8 API Backend)
- **Purpose**: Central data store and REST API for stream metadata
- **Technology**: Ruby on Rails 8, PostgreSQL, Redis, ActionCable
- **Role**: Authoritative source of truth for stream data, user management, and real-time updates
- **API**: RESTful endpoints with JWT authentication and WebSocket support
- **Features**: Real-time collaborative editing, feature flags, comprehensive security
- **Repository**: [github.com/streamwall/streamsource](https://github.com/streamwall/streamsource)

#### 2. **livestream-link-monitor/** (Node.js Service)
- **Purpose**: Monitors Discord channels and Twitch chat for livestream URLs
- **Technology**: Node.js, Discord.js, TMI.js, Google Sheets API
- **Role**: Automated stream discovery and validation from social platforms
- **Integration**: Dual backend support (Google Sheets + StreamSource API)
- **Features**: Platform detection, location parsing, rate limiting, deduplication
- **Repository**: [github.com/streamwall/livestream-link-monitor](https://github.com/streamwall/livestream-link-monitor)

#### 3. **livesheet-updater/** (Node.js Service)
- **Purpose**: Monitors Google Sheets for stream status and updates
- **Technology**: Node.js, Google Sheets API
- **Role**: Bridge between Google Sheets and stream monitoring
- **Integration**: Updates Google Sheets with live/offline status
- **Features**: HTTP-based stream checking, rate limiting, batch updates
- **Repository**: [github.com/streamwall/livesheet-updater](https://github.com/streamwall/livesheet-updater)
- **Note**: Also known as `livesheet-updater` - they are the same service

#### 4. **streamwall/** (Electron Application)
- **Purpose**: Desktop application for creating livestream mosaics
- **Technology**: Electron, TypeScript (v2.0), Node.js workspaces
- **Role**: Consumer of stream data, provides visual mosaic interface
- **Features**: Multi-stream display, audio control, hotkeys, web-based control
- **Repository**: [github.com/streamwall/streamwall](https://github.com/streamwall/streamwall)

## Integration Points

### Primary Integration Patterns

#### 1. **StreamSource API as Hub**
- All services can read/write to StreamSource via REST API
- JWT authentication for secure access
- Real-time updates via ActionCable WebSocket
- Feature flags control service behavior

#### 2. **Google Sheets as Backup/Legacy**
- livestream-link-monitor supports dual-write mode
- livesheet-updater provides Google Sheets monitoring
- Supports migration from Sheets-based to API-based workflows

#### 3. **Event-Driven Architecture**
- Services emit events when streams are discovered/updated
- Real-time notifications via ActionCable
- Potential for webhook integration

### Data Schema Compatibility

#### Stream Object Structure
```json
{
  "id": "unique_identifier",
  "title": "Stream Title",
  "url": "https://platform.com/stream",
  "platform": "twitch|youtube|tiktok|kick|facebook",
  "status": "live|offline|checking|error",
  "streamer": {
    "name": "Streamer Name",
    "platform_username": "username"
  },
  "location": {
    "id": 123,
    "city": "City Name",
    "state_province": "State Code",
    "country": "Country Code",
    "is_known_city": true,
    "normalized_name": "city name, state code"
  },
  "metadata": {
    "added_date": "2024-01-01T00:00:00Z",
    "posted_by": "discord_user#1234",
    "last_checked": "2024-01-01T00:00:00Z",
    "pinned": false
  }
}
```

#### Known Cities Feature
StreamSource now supports location validation through a "known cities" feature:
- Admins can mark locations as "known/verified" cities
- When `LOCATION_VALIDATION` feature flag is enabled, only known cities are accepted
- API endpoints: `/api/v1/locations/known_cities` for validated cities
- See `streamsource/docs/KNOWN_CITIES_INTEGRATION.md` for integration details

## Recommended Integration Tests

### Cross-Service Integration Tests

#### 1. **Stream Discovery to Display Pipeline**
```javascript
// Test: Discord message → StreamSource → Streamwall
describe('End-to-End Stream Discovery', () => {
  it('should discover stream from Discord and display in Streamwall', async () => {
    // 1. Post stream URL in monitored Discord channel
    // 2. Verify livestream-link-monitor detects and processes URL
    // 3. Verify StreamSource API receives and stores stream data
    // 4. Verify Streamwall can fetch and display the stream
    // 5. Verify real-time updates work across services
  });
});
```

#### 2. **Data Consistency Tests**
```javascript
describe('Data Consistency Across Services', () => {
  it('should maintain consistency between Google Sheets and StreamSource', async () => {
    // 1. Add stream via livestream-link-monitor (dual-write mode)
    // 2. Verify data exists in both Google Sheets and StreamSource
    // 3. Update stream status via livesheet-updater
    // 4. Verify updates propagate to StreamSource
    // 5. Verify Streamwall reflects updated status
  });
});
```

#### 3. **Service Health and Failover**
```javascript
describe('Service Resilience', () => {
  it('should handle service failures gracefully', async () => {
    // 1. Simulate StreamSource API downtime
    // 2. Verify livestream-link-monitor falls back to Sheets-only mode
    // 3. Verify Streamwall can still function with cached data
    // 4. Test recovery when services come back online
  });
});
```

#### 4. **Authentication and Authorization**
```javascript
describe('Security Integration', () => {
  it('should enforce consistent authentication across services', async () => {
    // 1. Obtain JWT token from StreamSource login
    // 2. Verify token works across all API endpoints
    // 3. Test token expiration and refresh
    // 4. Verify rate limiting works consistently
  });
});
```

### Service-Specific Integration Points

#### StreamSource → Streamwall
- **Test**: API endpoint data format compatibility
- **Test**: Real-time WebSocket updates
- **Test**: Feature flag behavior consistency

#### livestream-link-monitor → StreamSource
- **Test**: URL normalization and platform detection
- **Test**: Duplicate detection across backends
- **Test**: Rate limiting and spam protection

#### livesheet-updater → Google Sheets
- **Test**: Sheet format compatibility
- **Test**: Batch update performance
- **Test**: Error handling for invalid data

## Repository Management

### Git Submodules
All services are included as Git submodules, allowing:
- Independent versioning of each service
- Clean separation of concerns
- Easy updates and rollbacks
- Consistent deployment across environments

### Working with Submodules
```bash
# Clone with all submodules
git clone --recursive https://github.com/streamwall/streamwall-suite.git

# Initialize submodules in existing clone
git submodule update --init --recursive

# Update all submodules to latest
git submodule update --remote --merge

# Check submodule status
git submodule status

# Work on a specific service
cd streamsource
git checkout -b feature/new-feature
# make changes
git commit -m "Add new feature"
git push origin feature/new-feature
cd ..
git add streamsource
git commit -m "Update streamsource submodule"
```

## Development Workflow

### Service Dependencies
1. **StreamSource** (start first - provides API)
2. **Redis** (required for StreamSource WebSocket and caching)
3. **PostgreSQL** (required for StreamSource data storage)
4. **livestream-link-monitor** (optional - for automated discovery)
5. **livesheet-updater** (optional - for Sheets monitoring)
6. **Streamwall** (depends on stream data from other services)

### Development Environment Setup
```bash
# 1. Start core infrastructure
cd streamsource
docker compose up -d

# 2. Start monitoring services (optional)
cd ../livestream-link-monitor
docker compose up -d

cd ../livesheet-updater
docker compose up -d

# 3. Start Streamwall
cd ../streamwall
npm install
npm run start:app
```

### Integration Testing Strategy
```bash
# Run all service tests
make test-integration

# Test specific service interactions
make test-streamsource-api
make test-monitor-integration
make test-realtime-updates
```

## Configuration Management

### Environment Variables
Each service requires specific environment variables. Key integration points:

#### StreamSource API URL
```bash
# In livestream-link-monitor
STREAMSOURCE_API_URL=http://localhost:3000/api/v1

# In Streamwall
STREAM_API_URL=http://localhost:3000/api/v1
```

#### Authentication
```bash
# Shared JWT secret (development only)
JWT_SECRET=shared_secret_key

# Production: Each service has unique credentials
STREAMSOURCE_API_KEY=service_specific_key
```

#### Database Connections
```bash
# StreamSource
DATABASE_URL=postgresql://user:pass@localhost:5432/streamsource

# Shared Redis for caching and WebSocket
REDIS_URL=redis://localhost:6379/0
```

### Service Discovery
Services communicate via direct HTTP calls in development. For production:

- Consider service mesh (Istio, Linkerd)
- Use environment-based service discovery
- Implement health checks and circuit breakers

## Monitoring and Observability

### Key Metrics to Track

#### Cross-Service Metrics
- Stream discovery rate (streams/hour)
- API response times between services
- WebSocket connection stability
- Data consistency across backends

#### Service Health
- StreamSource API uptime and response times
- livestream-link-monitor processing rate
- livesheet-updater update frequency
- Streamwall connection success rate

### Logging Strategy
```bash
# Centralized logging format
{
  "timestamp": "2024-01-01T00:00:00Z",
  "service": "service_name",
  "level": "info|warn|error",
  "message": "Human readable message",
  "context": {
    "stream_id": "123",
    "user_id": "456",
    "correlation_id": "request_trace_id"
  }
}
```

## Deployment Considerations

### Container Orchestration
```yaml
# docker-compose.yml for full stack
version: '3.8'
services:
  streamsource:
    build: ./streamsource
    ports: ["3000:3000"]
    depends_on: [db, redis]

  livestream-monitor:
    build: ./livestream-link-monitor
    depends_on: [streamsource]

  livesheet-updater:
    build: ./livesheet-updater
    depends_on: [streamsource]

  streamwall:
    build: ./streamwall
    depends_on: [streamsource]

  db:
    image: postgres:17

  redis:
    image: redis:7-alpine
```

### Load Balancing
- StreamSource API can be horizontally scaled
- Use Redis for session sharing
- Consider read replicas for high traffic

### Security
- All inter-service communication should use HTTPS in production
- Implement service-to-service authentication
- Use secrets management for credentials
- Regular security audits of all services

## Future Enhancements

### Potential Integrations
1. **Notification Service**: Real-time alerts for stream events
2. **Analytics Service**: Stream performance and user behavior tracking
3. **CDN Integration**: Optimized stream delivery
4. **Mobile App**: Streamwall mobile companion
5. **Admin Dashboard**: Centralized management interface

### Service Evolution
- Migrate from Google Sheets to StreamSource API fully
- Add GraphQL endpoints for complex queries
- Implement message queues for better resilience
- Add automated testing for integration scenarios

## Common Integration Issues

### Authentication Failures
- Ensure JWT tokens are properly shared between services
- Check token expiration and refresh mechanisms
- Verify CORS settings for cross-origin requests

### Data Inconsistency
- Implement eventual consistency patterns
- Use correlation IDs for tracking data flow
- Add data validation at service boundaries

### Performance Issues
- Monitor API response times between services
- Implement caching strategies
- Use connection pooling for database connections

### WebSocket Connection Issues
- Ensure Redis is properly configured for ActionCable
- Check firewall settings for WebSocket traffic
- Implement reconnection logic in client applications

## Commands Reference

### Integration Testing
```bash
# Test all services together
make test-integration

# Test specific service pairs
make test-api-integration
make test-monitor-integration
make test-realtime-updates

# Load testing
make load-test-api
make load-test-websocket
```

### Service Management
```bash
# Start all services
make up

# Stop all services
make down

# View logs from all services
make logs-all

# Health check all services
make health-check-all
```

This architecture provides a robust, scalable foundation for livestream management while maintaining clear separation of concerns and integration points between services.