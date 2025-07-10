# Streamwall

A comprehensive livestream management platform that automatically discovers, monitors, and displays multiple livestreams in a customizable grid layout.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Development](#development)
- [Services](#services)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

Streamwall helps communities track and display multiple livestreams from protests, events, and breaking news. It consists of:

- **Automated Discovery** - Bots monitor Discord channels and Twitch chat for stream links
- **Real-time Monitoring** - Continuously checks stream status and updates metadata
- **Flexible Display** - Desktop app shows multiple streams in a customizable grid
- **Centralized API** - REST API with real-time updates via WebSockets

### Key Features

- 🔍 Auto-discovers streams from Discord/Twitch chat
- 📊 Real-time stream status monitoring
- 🖥️ Multi-stream grid display with audio control
- 🔄 Automatic stream rotation for large collections
- 📍 Location tracking and mapping
- 👥 Multi-user support with admin controls
- 🔌 Extensible plugin architecture

## Quick Start

### Instant Demo (Recommended First Step)

```bash
git clone --recursive https://github.com/streamwall/streamwall-suite.git
cd streamwall-suite
make              # Interactive setup - just follow the prompts!
```

The Makefile will detect if you're new and offer:
- **Demo mode** - Try it out with sample data and mock integrations
- **Setup mode** - Configure for real use with your Discord/Twitch accounts

### Essential Commands

```bash
make              # Start here - smart mode detection
make demo         # Quick demo with sample data
make up           # Start all services
make down         # Stop all services
make logs         # View logs (or logs SERVICE=name)
make status       # Check what's running
make shell        # Open container shell
make help         # See all available commands
```

## Architecture

### System Overview

```mermaid
graph TB
    %% External Sources
    Discord["💬 Discord<br/>Channels"]
    Twitch["📺 Twitch<br/>Chat"]
    Users["👥 Users<br/>(Web/Mobile)"]
    
    %% Core Services
    Monitor["🤖 Livestream Link Monitor<br/>(Node.js Bot)"]
    API["🔧 StreamSource API<br/>(Rails + ActionCable)"]
    Updater["🔄 Livesheet Updater<br/>(Status Checker)"]
    Display["🖥️ Streamwall Desktop<br/>(Electron + React)"]
    
    %% Data Stores
    DB[(PostgreSQL<br/>Database)]
    Redis[(Redis<br/>Cache/PubSub)]
    
    %% Stream Platforms
    Platforms["📹 Stream Platforms<br/>Twitch • YouTube<br/>Facebook • Kick • TikTok"]
    
    %% Data Flow
    Discord --> Monitor
    Twitch --> Monitor
    Monitor -->|"Discovers & Validates<br/>Stream URLs"| API
    
    API <-->|"Stores/Retrieves"| DB
    API <-->|"Cache & PubSub"| Redis
    API -->|"WebSocket<br/>Updates"| Display
    API -->|"REST API"| Users
    
    Updater -->|"Checks Status"| Platforms
    Updater -->|"Updates Status"| API
    
    Display -->|"Fetches Streams"| API
    Display -->|"Embeds Players"| Platforms
    
    %% Styling
    classDef service fill:#4A90E2,stroke:#2E5C8A,color:#fff
    classDef external fill:#50C878,stroke:#3A9B5C,color:#fff
    classDef storage fill:#FF6B6B,stroke:#C54545,color:#fff
    classDef platform fill:#9B59B6,stroke:#7D3C98,color:#fff
    
    class Monitor,API,Updater,Display service
    class Discord,Twitch,Users external
    class DB,Redis storage
    class Platforms platform
```

### Core Services

1. **StreamSource** (Rails API)
   - Central data store and REST API
   - Real-time updates via ActionCable WebSockets
   - User authentication and authorization
   - Stream metadata management

2. **Livestream Link Monitor** (Node.js)
   - Discord bot that watches for stream URLs
   - Twitch chat monitor for stream discovery
   - Intelligent deduplication and validation
   - Posts discovered streams to API

3. **Livesheet Updater** (Node.js)
   - Monitors stream health and status
   - Updates live/offline state
   - Batch processing for efficiency

4. **Streamwall** (Electron + React)
   - Desktop application for display
   - Customizable grid layouts
   - Per-stream audio control
   - Keyboard shortcuts for power users

### Data Flow

1. Users post stream links in Discord/Twitch
2. Monitor bot detects and validates URLs
3. Validated streams posted to StreamSource API
4. Livesheet Updater checks stream health
5. Streamwall desktop app fetches and displays streams
6. Real-time updates flow via WebSockets

## Development

### Prerequisites

- Docker & Docker Compose
- Git
- Node.js 18+ (for Streamwall desktop app)
- 8GB RAM recommended
- Ports 3000, 5432, 6379 available

### Development Setup

```bash
# Clone with submodules
git clone --recursive https://github.com/streamwall/streamwall-suite.git
cd streamwall

# Interactive setup
make setup

# Start in development mode
make up

# View logs
make logs

# Open a service shell
make shell SERVICE=streamsource
```

### Development Workflow

1. **Making Changes**
   ```bash
   # Create feature branch
   git checkout -b feature/my-feature

   # Make changes, test locally
   make up
   make logs

   # Run tests
   cd streamsource && bundle exec rspec
   cd livestream-link-monitor && npm test
   ```

2. **Database Changes**
   ```bash
   # Create migration
   make shell SERVICE=streamsource
   rails generate migration AddFieldToStreams field:type
   rails db:migrate
   ```

3. **Debugging**
   ```bash
   # Check service health
   make status

   # View specific service logs
   make logs SERVICE=streamsource

   # Access Rails console
   make shell SERVICE=streamsource
   rails console
   ```

### Code Style

- **Ruby**: Follow Ruby Style Guide, use RuboCop
- **JavaScript**: ESLint with Airbnb config
- **React**: Functional components with hooks
- **Git**: Conventional commits (feat:, fix:, docs:)

## Services

### StreamSource API

The central Rails API that manages all stream data.

**Key Endpoints:**
- `GET /api/v1/streams` - List all streams
- `POST /api/v1/streams` - Create stream
- `GET /api/v1/streams/:id` - Get stream details
- `PATCH /api/v1/streams/:id` - Update stream
- `DELETE /api/v1/streams/:id` - Delete stream

**WebSocket Channels:**
- `StreamsChannel` - Real-time stream updates
- `PresenceChannel` - User presence tracking

**Authentication:**
- JWT-based authentication
- Bearer token in Authorization header
- Admin role for privileged operations

### Livestream Link Monitor

Discord/Twitch bot for automated stream discovery.

**Features:**
- Multi-server Discord support
- Twitch chat monitoring
- URL validation and deduplication
- Location extraction from messages
- Rate limiting and spam protection

**Supported Platforms:**
- Twitch (twitch.tv)
- YouTube (youtube.com, youtu.be)
- Facebook (facebook.com/*/videos)
- Kick (kick.com)
- TikTok (tiktok.com)

### Livesheet Updater

Monitors stream health and updates status.

**Features:**
- Parallel stream checking
- Retry logic for transient failures
- Batch updates for efficiency
- Configurable check intervals

### Streamwall Desktop

Electron app for displaying multiple streams.

**Features:**
- Drag-and-drop grid layout
- Per-stream audio control
- Fullscreen mode
- Keyboard shortcuts
- Stream rotation
- Layout persistence

**Keyboard Shortcuts:**
- `Space` - Toggle selected stream audio
- `M` - Mute all streams
- `F` - Fullscreen mode
- `R` - Rotate streams
- `1-9` - Quick switch layouts

## Configuration

### Environment Variables

Create a `.env` file from `.env.example`:

```bash
# Core Settings
NODE_ENV=production
RAILS_ENV=production

# Database
POSTGRES_USER=streamwall
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=streamwall_production
DATABASE_URL=postgresql://streamwall:secure_password@postgres:5432/streamwall_production

# Redis
REDIS_URL=redis://redis:6379/0

# Security (generate with: openssl rand -hex 32)
SECRET_KEY_BASE=your_secret_key_base
JWT_SECRET=your_jwt_secret
STREAMSOURCE_API_KEY=your_api_key

# Discord Bot (optional)
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=channel_to_monitor

# Twitch Bot (optional)
TWITCH_CHANNEL=channel_to_monitor
TWITCH_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_token
```

### Service Configuration

Each service can be configured through environment variables:

**StreamSource:**
- `RAILS_MAX_THREADS` - Puma thread count
- `WEB_CONCURRENCY` - Puma worker count
- `RAILS_LOG_LEVEL` - Logging verbosity

**Monitor Bot:**
- `BACKEND_TYPE` - 'streamsource' (API backend)
- `CHECK_INTERVAL` - How often to process messages
- `LOCATION_MAPPING` - Enable location detection

**Updater:**
- `UPDATE_INTERVAL` - Check frequency in seconds
- `CONCURRENT_CHECKS` - Parallel check limit
- `TIMEOUT` - HTTP request timeout

## API Reference

### Authentication

```bash
# Login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# Returns
{
  "token": "jwt_token",
  "user": { "id": 1, "email": "user@example.com" }
}

# Use token in headers
Authorization: Bearer jwt_token
```

### Streams API

```bash
# List streams with filters
GET /api/v1/streams?status=live&location=Seattle&platform=twitch

# Create stream
POST /api/v1/streams
{
  "url": "https://twitch.tv/example",
  "title": "Seattle Protest",
  "location": "Seattle, WA"
}

# Update stream
PATCH /api/v1/streams/123
{
  "status": "offline",
  "notes": "Stream ended at 10pm"
}
```

### WebSocket Subscriptions

```javascript
// Connect to ActionCable
const cable = ActionCable.createConsumer('ws://localhost:3000/cable');

// Subscribe to streams channel
const subscription = cable.subscriptions.create('StreamsChannel', {
  received(data) {
    console.log('Stream update:', data);
  }
});
```

## Deployment

### Production with Docker

1. **Prepare Environment**
   ```bash
   # Copy and edit production env
   cp .env.example .env.production
   # Edit with production values

   # Set secure passwords and keys
   openssl rand -hex 32  # For SECRET_KEY_BASE
   openssl rand -hex 32  # For JWT_SECRET
   ```

2. **Deploy with Docker Compose**
   ```bash
   # Use production compose file
   docker compose -f docker-compose.production.yml up -d

   # Run migrations
   docker compose exec streamsource rails db:migrate

   # Create admin user
   docker compose exec streamsource rails console
   > User.create!(email: "admin@example.com", password: "secure_password", admin: true)
   ```

3. **Configure Reverse Proxy (nginx)**
   ```nginx
   server {
     listen 80;
     server_name streamwall.example.com;

     location / {
       proxy_pass http://localhost:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }

     location /cable {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
     }
   }
   ```

### SSL/TLS Setup

```bash
# Using Let's Encrypt
certbot --nginx -d streamwall.example.com

# Update nginx config for SSL
# Certbot will handle this automatically
```

### Monitoring

- Use `make status` to check service health
- Monitor logs with `make logs`
- Set up alerts for service failures
- Track API response times
- Monitor disk usage for PostgreSQL

## Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check Docker
docker info

# Check ports
lsof -i :3000  # Should be free

# Reset everything
make clean
make up
```

**Can't connect to API:**
```bash
# Check service health
curl http://localhost:3000/health

# Check logs
make logs SERVICE=streamsource

# Verify database
make shell SERVICE=postgres
psql -U streamwall -d streamwall_production
```

**Discord bot not working:**
```bash
# Verify token
echo $DISCORD_TOKEN

# Check bot permissions in Discord
# Needs: Read Messages, Send Messages, Read Message History

# Check logs
make logs SERVICE=livestream-monitor
```

**Streams not updating:**
```bash
# Check updater service
make logs SERVICE=livesheet-updater

# Verify API connectivity
curl http://localhost:3000/api/v1/streams

# Check Redis
make shell SERVICE=redis
redis-cli ping
```

### Debug Mode

Enable debug logging:
```bash
# In .env
LOG_LEVEL=debug
RAILS_LOG_LEVEL=debug

# Restart services
make restart
```

## Contributing

### Getting Started

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contribution Guidelines

- Write tests for new features
- Update documentation
- Follow existing code style
- Add entries to CHANGELOG
- Keep commits atomic and descriptive

### Testing

```bash
# Run all tests
make test

# Service-specific tests
cd streamsource && bundle exec rspec
cd livestream-link-monitor && npm test
cd streamwall && npm test
```

### Reporting Issues

- Use GitHub Issues
- Include reproduction steps
- Provide error messages and logs
- Specify your environment

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built for activists and journalists covering protests
- Inspired by the need for better real-time stream aggregation
- Thanks to all contributors and testers

---

For more details on specific services, see their README files in each service directory.