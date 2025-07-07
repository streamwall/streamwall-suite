# Environment Variables Configuration

This document lists all environment variables used across the Streamwall ecosystem services.

## Global Configuration

These environment variables are used across multiple services:

| Variable | Description | Default | Required | Services |
|----------|-------------|---------|----------|----------|
| `NODE_ENV` | Node environment (development/production) | `development` | No | All Node.js services |
| `TZ` | Timezone | `America/Los_Angeles` | No | All services |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` | No | All services |

## StreamSource (Rails API)

### Database Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `POSTGRES_USER` | PostgreSQL username | `streamsource` | Yes |
| `POSTGRES_PASSWORD` | PostgreSQL password | - | Yes |
| `POSTGRES_DB` | PostgreSQL database name | `streamsource_development` | Yes |
| `POSTGRES_HOST` | PostgreSQL host | `postgres` | No |
| `POSTGRES_PORT` | PostgreSQL port | `5432` | No |

### Redis Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` | Yes |
| `REDIS_HOST` | Redis host | `redis` | No |
| `REDIS_PORT` | Redis port | `6379` | No |

### Rails Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RAILS_ENV` | Rails environment | `development` | Yes |
| `SECRET_KEY_BASE` | Rails secret key (generate with `rails secret`) | - | Yes |
| `RAILS_LOG_TO_STDOUT` | Log to stdout | `true` | No |
| `RAILS_SERVE_STATIC_FILES` | Serve static files | `true` | No |
| `BUNDLE_WITHOUT` | Bundler groups to skip | `""` | No |

### Authentication

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_EXPIRATION` | JWT token expiration (seconds) | `86400` | No |
| `DEVISE_SECRET_KEY` | Devise secret key | - | Yes |

### API Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `STREAMSOURCE_API_KEY` | Master API key for service auth | - | Yes |
| `CORS_ORIGINS` | Allowed CORS origins | `*` | No |
| `API_RATE_LIMIT` | Requests per minute | `60` | No |

### Feature Flags

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `FLIPPER_CLOUD_TOKEN` | Flipper Cloud token | - | No |
| `FEATURE_ANALYTICS` | Enable analytics | `false` | No |
| `FEATURE_WEBHOOKS` | Enable webhooks | `false` | No |
| `FEATURE_BULK_IMPORT` | Enable bulk import | `false` | No |

## Livestream Link Monitor

### Discord Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DISCORD_TOKEN` | Discord bot token | - | Yes |
| `DISCORD_CHANNEL_ID` | Discord channel ID to monitor | - | Yes |
| `DISCORD_GUILD_ID` | Discord server ID | - | No |
| `DISCORD_COMMAND_PREFIX` | Bot command prefix | `!` | No |

### Twitch Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TWITCH_CHANNEL` | Twitch channel name (without #) | - | Yes |
| `TWITCH_USERNAME` | Twitch bot username | - | Yes |
| `TWITCH_OAUTH_TOKEN` | Twitch OAuth token | - | Yes |
| `TWITCH_CLIENT_ID` | Twitch client ID | - | No |

### Google Sheets Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GOOGLE_SHEET_ID` | Google Sheets document ID | - | Yes |
| `GOOGLE_CREDENTIALS_PATH` | Path to service account JSON | `/app/credentials.json` | Yes |
| `GOOGLE_SHEET_NAME` | Sheet name within document | `Sheet1` | No |

### StreamSource Integration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `STREAMSOURCE_API_URL` | StreamSource API base URL | `http://streamsource:3000/api/v1` | Yes |
| `STREAMSOURCE_API_KEY` | API key for StreamSource | - | Yes |
| `DUAL_WRITE_MODE` | Write to both Sheets and API | `true` | No |

### Service Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP port for health checks | `3001` | No |
| `HEALTH_CHECK_PATH` | Health check endpoint path | `/health` | No |
| `PROCESS_BATCH_SIZE` | URLs to process per batch | `10` | No |
| `PROCESS_DELAY_MS` | Delay between batches (ms) | `1000` | No |

## Livesheet Checker

### Google Sheets Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GOOGLE_SHEET_ID` | Google Sheets document ID | - | Yes |
| `GOOGLE_CREDENTIALS_PATH` | Path to service account JSON | `/app/creds.json` | Yes |
| `SHEET_NAME` | Sheet name to update | `Sheet1` | No |

### Checking Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CHECK_INTERVAL_MS` | Check interval (milliseconds) | `300000` | No |
| `CHECK_BATCH_SIZE` | Streams to check per batch | `10` | No |
| `CHECK_TIMEOUT_MS` | Timeout per stream check | `5000` | No |
| `RETRY_ATTEMPTS` | Retry attempts for failed checks | `3` | No |

### StreamSource Integration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `STREAMSOURCE_API_URL` | StreamSource API base URL | `http://streamsource:3000/api/v1` | No |
| `STREAMSOURCE_API_KEY` | API key for StreamSource | - | No |
| `SYNC_TO_API` | Sync status to StreamSource | `true` | No |

### Platform API Keys

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TWITCH_CLIENT_ID` | Twitch API client ID | - | No |
| `TWITCH_CLIENT_SECRET` | Twitch API client secret | - | No |
| `YOUTUBE_API_KEY` | YouTube Data API key | - | No |

## Streamwall (Electron App)

### Application Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `STREAMWALL_ENV` | App environment | `development` | No |
| `STREAMWALL_PORT` | Web interface port | `3030` | No |
| `STREAMWALL_HOST` | Web interface host | `localhost` | No |

### StreamSource Integration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `STREAM_API_URL` | StreamSource API URL | `http://localhost:3000/api/v1` | Yes |
| `STREAM_API_TOKEN` | User JWT token | - | No |
| `WEBSOCKET_URL` | ActionCable WebSocket URL | `ws://localhost:3000/cable` | No |

### Display Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DEFAULT_LAYOUT` | Default grid layout | `2x2` | No |
| `MAX_STREAMS` | Maximum concurrent streams | `16` | No |
| `AUDIO_FADE_TIME` | Audio fade time (ms) | `500` | No |
| `REFRESH_INTERVAL` | Stream list refresh (ms) | `30000` | No |

## Docker Compose Configuration

### Network Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `COMPOSE_PROJECT_NAME` | Docker Compose project name | `streamwall` | No |
| `DOCKER_NETWORK` | Docker network name | `streamwall-network` | No |

### Port Mapping

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_PORT` | PostgreSQL external port | `5432` | No |
| `REDIS_PORT` | Redis external port | `6379` | No |
| `STREAMSOURCE_PORT` | StreamSource external port | `3000` | No |
| `LIVESTREAM_MONITOR_PORT` | Monitor external port | `3001` | No |

## Production Environment

### SSL/TLS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SSL_CERT_PATH` | SSL certificate path | - | Yes (prod) |
| `SSL_KEY_PATH` | SSL private key path | - | Yes (prod) |
| `FORCE_SSL` | Force HTTPS redirect | `true` | No |

### Monitoring

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SENTRY_DSN` | Sentry error tracking DSN | - | No |
| `NEW_RELIC_LICENSE_KEY` | New Relic license key | - | No |
| `DATADOG_API_KEY` | Datadog API key | - | No |

### Scaling

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WEB_CONCURRENCY` | Number of worker processes | `2` | No |
| `RAILS_MAX_THREADS` | Max threads per worker | `5` | No |
| `CONNECTION_POOL_SIZE` | Database connection pool | `10` | No |

## Security Best Practices

### Required in Production

1. **Generate secure secrets**:
   ```bash
   # Rails secret
   rails secret
   
   # JWT secret
   openssl rand -hex 32
   
   # API keys
   openssl rand -hex 16
   ```

2. **Never commit secrets**:
   - Use `.env` files (git ignored)
   - Use environment-specific configs
   - Use secret management services

3. **Rotate regularly**:
   - API keys: Every 90 days
   - JWT secrets: Every 6 months
   - Database passwords: Every year

### Environment-Specific Files

```
.env.development      # Development settings
.env.test            # Test settings
.env.production      # Production settings (never commit)
.env.example         # Template with descriptions
```

## Loading Environment Variables

### Docker Compose
```yaml
services:
  app:
    env_file:
      - .env
    environment:
      - DATABASE_URL=${DATABASE_URL}
```

### Node.js (dotenv)
```javascript
require('dotenv').config()
const apiKey = process.env.API_KEY
```

### Rails
```ruby
# config/application.rb
Dotenv::Railtie.load if defined?(Dotenv::Railtie)

# Usage
Rails.application.credentials.secret_key_base
ENV['DATABASE_URL']
```

### Systemd
```ini
[Service]
EnvironmentFile=/etc/streamwall/env
Environment="RAILS_ENV=production"
```

## Validation

### Required Variables Check
```bash
#!/bin/bash
# check-env.sh

required_vars=(
  "DATABASE_URL"
  "REDIS_URL"
  "SECRET_KEY_BASE"
  "JWT_SECRET"
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo "Error: $var is not set"
    exit 1
  fi
done
```

### Type Validation
```javascript
// Validate numeric values
const port = parseInt(process.env.PORT) || 3000
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error('Invalid PORT value')
}

// Validate URLs
try {
  new URL(process.env.DATABASE_URL)
} catch {
  throw new Error('Invalid DATABASE_URL')
}
```

## Debugging

### List all environment variables
```bash
# In container
docker-compose exec service_name env

# Local
printenv | grep STREAM
```

### Check specific variable
```bash
echo $DATABASE_URL
```

### Rails console
```ruby
ENV.select { |k, v| k.start_with?('RAILS') }
```

### Node.js
```javascript
console.log(process.env)
```