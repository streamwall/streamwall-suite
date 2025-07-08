# Service Communication Patterns

This document describes how services in the Streamwall ecosystem communicate with each other, including protocols, data formats, and integration patterns.

## Communication Overview

```
┌─────────────────────┐     HTTP/REST      ┌─────────────────────┐
│  livestream-link-   │ ─────────────────► │    StreamSource     │
│     monitor         │                     │       API           │
└─────────────────────┘                     └──────────┬──────────┘
                                                       │
┌─────────────────────┐     HTTP/REST                  │ WebSocket
│  livesheet-updater  │ ─────────────────►             │ ActionCable
└─────────────────────┘                                │
                                                       ▼
┌─────────────────────┐     HTTP/REST      ┌─────────────────────┐
│     Streamwall      │ ◄───────────────── │   Connected         │
│   (Electron App)    │     WebSocket       │    Clients          │
└─────────────────────┘                     └─────────────────────┘
```

## Service-to-Service Communication

### 1. Livestream Monitor → StreamSource

**Protocol**: HTTP/REST  
**Authentication**: Bearer token (API key)  
**Content-Type**: application/json

#### Stream Discovery Flow

```sequence
Discord/Twitch -> Monitor: Stream URL posted
Monitor -> Monitor: Parse URL & metadata
Monitor -> StreamSource: POST /api/v1/streams
StreamSource -> Monitor: 201 Created
Monitor -> Sheets: Optional write
```

**Request Example**:
```http
POST http://streamsource:3000/api/v1/streams
Authorization: Bearer API_KEY_HERE
Content-Type: application/json

{
  "url": "https://twitch.tv/example",
  "platform": "twitch",
  "status": "checking",
  "city": "Seattle",
  "state": "WA",
  "posted_by": "discord_user#1234",
  "source": "discord",
  "external_id": "monitor_abc123"
}
```

**Response**:
```json
{
  "id": 1,
  "url": "https://twitch.tv/example",
  "platform": "twitch",
  "status": "checking",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Duplicate Handling

When the monitor detects a URL that already exists:

1. **Monitor checks local cache first**
2. **If not in cache, attempts to create in StreamSource**
3. **StreamSource returns existing stream or creates new**
4. **Monitor updates local cache**

### 2. Livesheet Updater → StreamSource

**Protocol**: HTTP/REST  
**Authentication**: Bearer token (API key)  
**Content-Type**: application/json

#### Status Update Flow

```sequence
Checker -> Platform: Check stream status
Platform -> Checker: Live/Offline status
Checker -> Sheets: Update status
Checker -> StreamSource: PATCH /api/v1/streams/:id
StreamSource -> Clients: Broadcast update
```

**Finding Stream by URL**:
```http
GET http://streamsource:3000/api/v1/streams?url=https://twitch.tv/example
Authorization: Bearer API_KEY_HERE
```

**Updating Status**:
```http
PATCH http://streamsource:3000/api/v1/streams/123
Authorization: Bearer API_KEY_HERE
Content-Type: application/json

{
  "status": "live",
  "last_checked": "2024-01-01T00:00:00Z"
}
```

### 3. Streamwall → StreamSource

**Protocol**: HTTP/REST + WebSocket  
**Authentication**: JWT token (user auth)  
**Content-Type**: application/json

#### Initial Data Load

```http
GET http://streamsource:3000/api/v1/streams?status=live&pinned=true
Authorization: Bearer JWT_TOKEN_HERE
```

#### Real-time Updates

```javascript
// WebSocket connection
const cable = ActionCable.createConsumer('ws://streamsource:3000/cable')

// Subscribe to streams channel
const subscription = cable.subscriptions.create('StreamsChannel', {
  received(data) {
    // Handle stream updates
    switch(data.action) {
      case 'created':
        addStream(data.stream)
        break
      case 'updated':
        updateStream(data.stream)
        break
      case 'archived':
        removeStream(data.stream.id)
        break
    }
  }
})
```

## Data Synchronization Patterns

### Dual-Write Pattern (Monitor → Sheets + API)

```
                    ┌─────────────┐
                    │   Monitor   │
                    └──────┬──────┘
                           │
                 ┌─────────┴─────────┐
                 │                   │
                 ▼                   ▼
          ┌──────────┐        ┌──────────┐
          │  Sheets  │        │   API    │
          └──────────┘        └──────────┘
```

**Implementation**:
```javascript
async function processStream(streamData) {
  const results = await Promise.allSettled([
    writeToSheets(streamData),
    writeToAPI(streamData)
  ])
  
  return {
    sheets: results[0].status === 'fulfilled',
    api: results[1].status === 'fulfilled'
  }
}
```

### Eventually Consistent Pattern

Services maintain their own state and synchronize asynchronously:

1. **Local State**: Each service maintains local cache
2. **Periodic Sync**: Background jobs sync data
3. **Conflict Resolution**: Last-write-wins or merge strategies

## Real-time Communication

### ActionCable WebSocket Protocol

**Connection Flow**:
```
1. Client connects to /cable endpoint
2. Server sends welcome message
3. Client subscribes to channels
4. Server confirms subscriptions
5. Bidirectional message flow begins
```

**Message Format**:
```json
{
  "identifier": "{\"channel\":\"StreamsChannel\"}",
  "command": "subscribe|unsubscribe|message",
  "data": {}
}
```

### Event Broadcasting

**Stream Events**:
```ruby
# In StreamSource
ActionCable.server.broadcast('streams', {
  action: 'updated',
  stream: {
    id: stream.id,
    status: stream.status,
    updated_at: stream.updated_at
  }
})
```

**Collaboration Events**:
```ruby
ActionCable.server.broadcast('collaboration', {
  action: 'cell_locked',
  user: current_user.id,
  resource: 'stream',
  resource_id: stream.id,
  field: 'title'
})
```

## Error Handling and Resilience

### Retry Strategies

#### Exponential Backoff
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      
      const delay = Math.pow(2, i) * 1000 // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

#### Circuit Breaker Pattern
```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failures = 0
    this.threshold = threshold
    this.timeout = timeout
    this.state = 'closed' // closed, open, half-open
  }
  
  async call(fn) {
    if (this.state === 'open') {
      throw new Error('Circuit breaker is open')
    }
    
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
}
```

### Graceful Degradation

When StreamSource API is unavailable:

1. **Monitor**: Falls back to Sheets-only mode
2. **Checker**: Continues checking, queues updates
3. **Streamwall**: Uses cached data, shows stale indicator

## Message Queue Integration (Future)

### Proposed Architecture

```
Producer → Message Queue → Consumer
    │          │              │
    │      ┌───┴───┐         │
    │      │ Redis │         │
    │      │ Pub/Sub│        │
    │      └───────┘         │
    │                        │
    └─ Stream Events         └─ Event Processors
```

### Event Types

```json
{
  "event_type": "stream.discovered",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "url": "https://twitch.tv/example",
    "source": "discord",
    "user": "discord_user#1234"
  }
}
```

## Service Discovery

### Development Environment
Services use Docker Compose networking:
```yaml
services:
  streamsource:
    networks:
      - streamwall-network
  
  livestream-monitor:
    environment:
      - STREAMSOURCE_URL=http://streamsource:3000
    networks:
      - streamwall-network
```

### Production Environment
Services use environment variables:
```bash
STREAMSOURCE_API_URL=https://api.streamwall.com
LIVESTREAM_MONITOR_URL=https://monitor.streamwall.com
```

## API Versioning

### Version in URL
```
/api/v1/streams  # Version 1
/api/v2/streams  # Version 2 (future)
```

### Version in Header
```http
Accept: application/vnd.streamwall.v1+json
```

### Backward Compatibility
- Deprecated fields marked but not removed
- New fields optional with defaults
- Migration period for breaking changes

## Rate Limiting

### Per-Service Limits
```
StreamSource API:
- Default: 60 requests/minute
- Authenticated: 600 requests/minute
- Service accounts: 6000 requests/minute

External APIs:
- Discord: 50 requests/second
- Twitch: 800 requests/minute
- Google Sheets: 100 requests/100 seconds
```

### Rate Limit Headers
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067200
```

## Security Considerations

### Service-to-Service Authentication
```
1. API Key in environment variable
2. Key rotation every 90 days
3. Separate keys per service
4. Keys never in version control
```

### Data Encryption
```
In Transit: TLS 1.3 for all HTTP traffic
At Rest: Database encryption
Secrets: Environment variables or vault
```

### Network Isolation
```
┌─────────────────────────────────┐
│         Public Network          │
└─────────────────┬───────────────┘
                  │
            ┌─────▼─────┐
            │   Nginx   │
            │  Firewall │
            └─────┬─────┘
                  │
┌─────────────────┼───────────────┐
│    Private Network (Docker)     │
│                                 │
│  ┌──────────┐  ┌─────────────┐ │
│  │ Services │  │  Databases  │ │
│  └──────────┘  └─────────────┘ │
└─────────────────────────────────┘
```

## Performance Optimization

### Connection Pooling
```javascript
// HTTP connection pooling
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 10
})

// Database connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000
})
```

### Caching Strategies
```
1. Service-level caching (in-memory)
2. Redis shared cache
3. HTTP caching headers
4. CDN for static assets
```

### Batch Operations
```javascript
// Batch status updates
const updates = streams.map(stream => ({
  url: stream.url,
  status: checkStatus(stream.url)
}))

await api.batchUpdate('/streams/batch', updates)
```

## Monitoring Integration

### Health Check Endpoints
Every service exposes:
```
GET /health
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0",
  "dependencies": {
    "database": "ok",
    "redis": "ok",
    "external_api": "ok"
  }
}
```

### Distributed Tracing
```
Request → Service A → Service B → Response
   │         │           │          │
   └─────────┴───────────┴──────────┘
            Trace ID: abc123
```

### Metrics Collection
```
service_name_requests_total{method="POST", endpoint="/streams", status="200"} 1234
service_name_request_duration_seconds{method="POST", endpoint="/streams"} 0.123
service_name_active_connections 42
```