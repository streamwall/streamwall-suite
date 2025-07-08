# API Interfaces Documentation

This document details all API endpoints and interfaces between services in the Streamwall ecosystem.

## Table of Contents
- [StreamSource API](#streamsource-api)
- [Livestream Monitor API](#livestream-monitor-api)
- [Livesheet Updater API](#livesheet-updater-api)
- [WebSocket/ActionCable Interfaces](#websocketactioncable-interfaces)
- [Authentication](#authentication)
- [Error Handling](#error-handling)

## StreamSource API

Base URL: `http://localhost:3000/api/v1`

### Authentication

#### Login
```http
POST /users/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "editor"
  }
}
```

All subsequent requests require the JWT token:
```http
Authorization: Bearer YOUR_JWT_TOKEN
```

### Streams

#### List Streams
```http
GET /streams?status=live&platform=twitch&page=1&per_page=25

Response:
{
  "streams": [
    {
      "id": 1,
      "url": "https://twitch.tv/example",
      "platform": "twitch",
      "status": "live",
      "title": "Example Stream",
      "streamer_name": "ExampleStreamer",
      "city": "Seattle",
      "state": "WA",
      "pinned": false,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "total_pages": 5,
    "total_count": 123,
    "per_page": 25
  }
}
```

Query Parameters:
- `status`: Filter by status (live, offline, checking, error, archived)
- `platform`: Filter by platform (twitch, youtube, tiktok, kick, facebook)
- `pinned`: Filter by pinned status (true/false)
- `city`: Filter by city name
- `state`: Filter by state code
- `search`: Search in title and streamer name
- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 25, max: 100)

#### Get Single Stream
```http
GET /streams/:id

Response:
{
  "id": 1,
  "url": "https://twitch.tv/example",
  "platform": "twitch",
  "status": "live",
  "title": "Example Stream",
  "streamer": {
    "id": 1,
    "name": "ExampleStreamer",
    "platform_username": "example"
  },
  "location": {
    "city": "Seattle",
    "state": "WA"
  },
  "metadata": {
    "added_date": "2024-01-01T00:00:00Z",
    "posted_by": "discord_user#1234",
    "last_checked": "2024-01-01T00:00:00Z",
    "pinned": false,
    "source": "discord"
  }
}
```

#### Create Stream
```http
POST /streams
Content-Type: application/json

{
  "url": "https://twitch.tv/newstream",
  "platform": "twitch",
  "status": "checking",
  "title": "New Stream",
  "streamer_name": "NewStreamer",
  "city": "Portland",
  "state": "OR",
  "posted_by": "api_user",
  "source": "manual"
}

Response: 201 Created
{
  "id": 2,
  "url": "https://twitch.tv/newstream",
  ...
}
```

#### Update Stream
```http
PATCH /streams/:id
Content-Type: application/json

{
  "status": "offline",
  "title": "Updated Title"
}

Response:
{
  "id": 1,
  "status": "offline",
  "title": "Updated Title",
  ...
}
```

#### Pin/Unpin Stream
```http
PUT /streams/:id/pin
PUT /streams/:id/unpin

Response:
{
  "id": 1,
  "pinned": true,
  ...
}
```

#### Archive Stream
```http
POST /streams/:id/archive

Response:
{
  "id": 1,
  "status": "archived",
  "archived_at": "2024-01-01T00:00:00Z",
  ...
}
```

#### Delete Stream
```http
DELETE /streams/:id

Response: 204 No Content
```

### Streamers

#### List Streamers
```http
GET /streamers?search=gaming&page=1

Response:
{
  "streamers": [
    {
      "id": 1,
      "name": "Gaming Streamer",
      "created_at": "2024-01-01T00:00:00Z",
      "streamer_accounts": [
        {
          "id": 1,
          "platform": "twitch",
          "username": "gamingstreamer",
          "profile_url": "https://twitch.tv/gamingstreamer"
        }
      ],
      "stream_count": 15
    }
  ],
  "meta": {
    "total_count": 50
  }
}
```

#### Get Single Streamer
```http
GET /streamers/:id

Response:
{
  "id": 1,
  "name": "Gaming Streamer",
  "streamer_accounts": [...],
  "recent_streams": [...],
  "statistics": {
    "total_streams": 150,
    "platforms": ["twitch", "youtube"],
    "first_stream": "2023-01-01T00:00:00Z",
    "last_stream": "2024-01-01T00:00:00Z"
  }
}
```

### Collaboration

#### Lock Resource
```http
POST /collaboration/lock
Content-Type: application/json

{
  "resource_type": "stream",
  "resource_id": 1,
  "field": "title",
  "user_id": 1
}

Response:
{
  "success": true,
  "lock": {
    "user_id": 1,
    "locked_at": "2024-01-01T00:00:00Z",
    "expires_at": "2024-01-01T00:05:00Z"
  }
}

Error Response (409 Conflict):
{
  "error": "Resource locked",
  "locked_by": 2,
  "locked_at": "2024-01-01T00:00:00Z"
}
```

#### Unlock Resource
```http
POST /collaboration/unlock
Content-Type: application/json

{
  "resource_type": "stream",
  "resource_id": 1,
  "field": "title",
  "user_id": 1
}

Response:
{
  "success": true
}
```

## Livestream Monitor API

Base URL: `http://localhost:3001`

### Health Check
```http
GET /health

Response:
{
  "status": "healthy",
  "services": {
    "discord": true,
    "twitch": true
  },
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Discord Webhook (Internal)
```http
POST /webhook/discord
Content-Type: application/json

{
  "type": "MESSAGE_CREATE",
  "data": {
    "content": "Check out this stream: https://twitch.tv/example",
    "author": {
      "username": "discord_user",
      "discriminator": "1234",
      "id": "123456789"
    },
    "channel": {
      "id": "987654321",
      "name": "stream-links"
    }
  }
}

Response:
{
  "success": true,
  "results": [
    {
      "url": "https://twitch.tv/example",
      "success": true,
      "syncedToApi": true,
      "platform": "twitch",
      "location": {
        "city": null,
        "state": null
      }
    }
  ]
}
```

### List Processed Streams
```http
GET /streams

Response:
[
  {
    "id": "abc123",
    "url": "https://twitch.tv/example",
    "platform": "twitch",
    "source": "Discord",
    "posted_by": "discord_user",
    "added_date": "2024-01-01T00:00:00Z",
    "city": "Seattle",
    "state": "WA",
    "status": "Live"
  }
]
```

### Configuration

#### Toggle Dual-Write Mode
```http
POST /config/dual-write
Content-Type: application/json

{
  "enabled": true
}

Response:
{
  "dualWriteMode": true
}
```

#### Get Sync Status
```http
GET /sync-status

Response:
{
  "dualWriteMode": true,
  "streamSourceUrl": "http://localhost:3000/api/v1",
  "processedCount": 150,
  "processedUrls": [
    "https://twitch.tv/stream1",
    "https://youtube.com/stream2"
  ]
}
```

## Livesheet Updater API

Base URL: `http://localhost:3002`

### Health Check
```http
GET /health

Response:
{
  "status": "healthy",
  "syncEnabled": true,
  "sheetsConnected": true
}
```

### Sheet Operations

#### Get Sheet Data
```http
GET /sheets/data

Response:
{
  "values": [
    {
      "url": "https://twitch.tv/example",
      "platform": "twitch",
      "city": "Seattle",
      "state": "WA",
      "status": "live",
      "last_checked": "2024-01-01T00:00:00Z",
      "added_by": "discord_user",
      "added_date": "2024-01-01T00:00:00Z"
    }
  ],
  "lastUpdated": "2024-01-01T00:00:00Z"
}
```

#### Add Stream to Sheet
```http
POST /sheets/add
Content-Type: application/json

{
  "url": "https://twitch.tv/newstream",
  "platform": "twitch",
  "city": "Portland",
  "state": "OR",
  "status": "checking",
  "addedBy": "api"
}

Response:
{
  "success": true,
  "row": [
    "https://twitch.tv/newstream",
    "twitch",
    "Portland",
    "OR",
    "checking",
    "2024-01-01T00:00:00Z",
    "api",
    "2024-01-01T00:00:00Z"
  ]
}
```

#### Update Stream Status
```http
POST /sheets/update-status
Content-Type: application/json

{
  "url": "https://twitch.tv/example",
  "status": "offline"
}

Response:
{
  "success": true,
  "syncedToApi": true
}
```

#### Check All Streams
```http
POST /check-all

Response:
{
  "checked": 50,
  "results": [
    {
      "url": "https://twitch.tv/stream1",
      "status": "live",
      "synced": true
    },
    {
      "url": "https://youtube.com/stream2",
      "status": "offline",
      "synced": true
    }
  ]
}
```

### Periodic Checking

#### Start Checking
```http
POST /checking/start
Content-Type: application/json

{
  "interval": 60000
}

Response:
{
  "started": true,
  "interval": 60000
}
```

#### Stop Checking
```http
POST /checking/stop

Response:
{
  "stopped": true
}
```

### Configuration

#### Toggle Sync
```http
POST /config/sync
Content-Type: application/json

{
  "enabled": true
}

Response:
{
  "syncEnabled": true
}
```

## WebSocket/ActionCable Interfaces

### Connection
```javascript
// Connect to WebSocket
const cable = ActionCable.createConsumer('ws://localhost:3000/cable')

// Subscribe to channels
const streamsChannel = cable.subscriptions.create('StreamsChannel', {
  received(data) {
    console.log('Stream update:', data)
  }
})
```

### Stream Updates
```javascript
// Broadcast format for stream events
{
  "identifier": "{\"channel\":\"StreamsChannel\"}",
  "message": {
    "action": "created|updated|archived",
    "stream": {
      "id": 1,
      "url": "https://twitch.tv/example",
      "status": "live",
      ...
    }
  }
}
```

### Collaboration Events
```javascript
// Subscribe to collaboration channel
const collabChannel = cable.subscriptions.create('CollaborationChannel', {
  received(data) {
    console.log('Collaboration event:', data)
  }
})

// Lock/unlock events
{
  "identifier": "{\"channel\":\"CollaborationChannel\"}",
  "message": {
    "action": "locked|unlocked",
    "resource_type": "stream",
    "resource_id": 1,
    "field": "title",
    "user_id": 1,
    "locked_at": "2024-01-01T00:00:00Z"
  }
}
```

## Authentication

### JWT Token Structure
```json
{
  "sub": 1,
  "email": "user@example.com",
  "role": "editor",
  "exp": 1704067200,
  "iat": 1703980800
}
```

### API Key Authentication (Service-to-Service)
```http
Authorization: Bearer SERVICE_API_KEY
```

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "details": {
    "field": ["validation error"]
  }
}
```

### HTTP Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success with no response body
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate, locked)
- `422 Unprocessable Entity` - Validation errors
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Rate Limiting
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067200
```

## Data Formats

### Timestamps
All timestamps use ISO 8601 format in UTC:
```
2024-01-01T00:00:00Z
```

### Platforms
Valid platform values:
- `twitch`
- `youtube`
- `tiktok`
- `kick`
- `facebook`

### Stream Status
Valid status values:
- `checking` - Initial state, checking if live
- `live` - Currently streaming
- `offline` - Not currently streaming
- `error` - Error checking status
- `archived` - Manually archived

### User Roles
- `default` - Basic user, read-only access
- `editor` - Can create and edit streams
- `admin` - Full access to all features