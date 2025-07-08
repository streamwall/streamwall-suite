# Streamwall Ecosystem Docker Compose

This directory contains a unified Docker Compose setup for running all Streamwall ecosystem services together.

## 🚀 Quick Start

1. **Copy environment configuration:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file with your configuration:**
   - Add your Discord bot token
   - Add your Twitch channel name
   - Configure Google Sheets credentials
   - Set database passwords if using StreamSource

3. **Ensure credential files exist:**
   - `livestream-link-monitor/credentials.json` - Google service account for link monitor
   - `livestream-link-monitor/.env` - Discord/Twitch configuration
   - `livesheet-updater/creds.json` - Google service account for status checker

4. **Start all services:**
   ```bash
   make up
   # or
   docker-compose up -d
   ```

5. **View logs:**
   ```bash
   make logs
   # or
   docker-compose logs -f
   ```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `make up` | Start all services in detached mode |
| `make down` | Stop all services |
| `make restart` | Restart all services |
| `make logs` | Show logs from all services |
| `make status` | Show status of all services |
| `make build` | Build all Docker images |

## 🏗️ Services

### Active Services

1. **livestream-monitor** (Port 3001)
   - Monitors Discord/Twitch for stream URLs
   - Requires Discord bot token and Google Sheets credentials
   - Health check endpoint: http://localhost:3001/health

2. **livesheet-updater**
   - Checks stream status (live/offline)
   - Updates Google Sheets with status
   - Requires Google Sheets credentials

### Optional Services (Commented Out)

3. **streamsource** (Port 3000)
   - Rails API backend
   - Requires PostgreSQL and Redis
   - Uncomment in docker-compose.yml to enable

4. **postgres** (Port 5432)
   - PostgreSQL database for StreamSource
   - Uncomment if using StreamSource

5. **redis** (Port 6379)
   - Redis for caching and ActionCable
   - Uncomment if using StreamSource

## 🔧 Configuration

### Environment Variables

Edit `.env` file to configure:

```env
# Service ports
LIVESTREAM_MONITOR_PORT=3001
STREAMSOURCE_PORT=3000

# Database (if using StreamSource)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=streamsource_dev

# Enable optional services
ENABLE_STREAMSOURCE=false
ENABLE_POSTGRES=false
ENABLE_REDIS=false
```

### Service-Specific Configuration

Each service has its own configuration:

- **livestream-monitor**: Configure in `livestream-link-monitor/.env`
- **livesheet-updater**: Uses `livesheet-updater/creds.json`
- **streamsource**: Configure in `.env` file

## 🐳 Docker Network

All services run on the `streamwall-network` bridge network, allowing them to communicate using service names:

- `livestream-monitor:3001`
- `livesheet-updater`
- `postgres:5432` (if enabled)
- `redis:6379` (if enabled)

## 📊 Resource Limits

Services are configured with appropriate resource limits:
- Log rotation (10MB max, 3 files)
- Health checks for critical services
- Restart policies for reliability

## 🔍 Troubleshooting

1. **Services won't start:**
   ```bash
   # Check logs
   docker-compose logs [service-name]
   
   # Check if ports are in use
   lsof -i :3001
   lsof -i :3000
   ```

2. **Permission issues:**
   ```bash
   # Ensure credential files are readable
   chmod 644 livestream-link-monitor/credentials.json
   chmod 644 livesheet-updater/creds.json
   ```

3. **Reset everything:**
   ```bash
   docker-compose down -v  # Remove volumes too
   docker-compose build --no-cache
   docker-compose up -d
   ```

## 🚀 Production Deployment

For production:

1. Use strong passwords in `.env`
2. Enable SSL/TLS for external access
3. Configure proper backup strategies
4. Monitor resource usage
5. Set up log aggregation

## 📝 Notes

- Streamwall desktop app runs separately (not in Docker)
- Services start in order based on dependencies
- Health checks ensure services are ready before marking as healthy
- Logs are JSON formatted for easy parsing