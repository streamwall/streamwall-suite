# Setup & Operations Guide

## Initial Setup

### Automated Setup (Recommended)
```bash
./setup-wizard.sh              # Interactive setup
./setup-wizard.sh --full        # Full setup with all services
```

### Manual Setup
```bash
cp .env.example .env
# Edit .env with your values
docker compose up -d
```

### Setup Options
- **Basic**: Just StreamSource API (for development)
- **Standard**: API + Discord/Twitch monitor + Google Sheets checker
- **Full**: All services including Streamwall desktop app

## Daily Operations

### Starting Services

**Default Services** (API + monitors):
```bash
docker compose up -d
```

**Specific Services Only**:
```bash
# Core API only
docker compose up -d streamsource postgres redis

# Add specific monitors
docker compose up -d livestream-monitor
docker compose up -d livesheet-checker

# Include desktop app
docker compose --profile desktop up -d
```

**Service Combinations**:
```bash
# API + Discord monitor only
docker compose up -d streamsource postgres redis livestream-monitor

# API + Google Sheets checker only  
docker compose up -d streamsource postgres redis livesheet-checker

# Everything
docker compose --profile full up -d
```

### Monitoring
```bash
docker compose ps                 # Service status
docker compose logs -f            # All logs
docker compose logs -f streamsource  # Service logs
./validate-config.sh              # Configuration check
```

### Maintenance
```bash
# Database migrations
docker compose exec streamsource rails db:migrate

# Backup database
docker compose exec postgres pg_dump -U streamwall > backup.sql

# Update services
git pull --recurse-submodules
docker compose build
docker compose up -d
```

## Configuration

### Environment Variables
All configuration is in `.env`. Key variables:

**Required:**
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `SECRET_KEY_BASE` - Rails secret (auto-generated)
- `JWT_SECRET` - JWT signing key (auto-generated)

**Optional:**
- `DISCORD_TOKEN` - Discord bot token
- `DISCORD_CHANNEL_ID` - Channel to monitor
- `TWITCH_CHANNEL` - Twitch channel name
- `GOOGLE_SHEET_ID` - Google Sheets ID

### Adding Integrations
```bash
./setup-wizard.sh --integration discord
./setup-wizard.sh --integration twitch
./setup-wizard.sh --integration admin
```

## Troubleshooting

### Common Issues

**Services won't start:**
```bash
./validate-config.sh
docker compose logs
```

**Port conflicts:**
Edit `.env` to change ports:
```
STREAMSOURCE_PORT=3001
POSTGRES_PORT=5433
```

**Database errors:**
```bash
docker compose exec streamsource rails db:create db:migrate
```

**Missing submodules:**
```bash
git submodule update --init --recursive
```

## Production Deployment

### Basic Production Setup
1. Set environment to production:
   ```bash
   NODE_ENV=production
   RAILS_ENV=production
   ```

2. Generate secure secrets:
   ```bash
   openssl rand -hex 64  # For each secret key
   ```

3. Configure reverse proxy (nginx example):
   ```nginx
   server {
       server_name api.example.com;
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

4. Start services:
   ```bash
   docker compose -f docker-compose.production.yml up -d
   ```

### Cloud Deployment

**DigitalOcean App Platform:**
See [streamsource/DEPLOYMENT.md](streamsource/DEPLOYMENT.md)

**Docker Swarm/Kubernetes:**
Use the provided docker-compose.yml as a base for your orchestration config.

## Development Workflow

### Running Tests
```bash
make test                    # All tests
make test-integration        # Integration tests
cd streamsource && rspec     # Service tests
```

### Adding Features
1. Create feature branch
2. Make changes with tests
3. Run `make test`
4. Submit PR

### Debugging
```bash
docker compose logs -f --tail=100 [service]
docker compose exec [service] bash
```

## Platform Compatibility

Tested and supported on:
- macOS 10.15+
- Ubuntu/Debian 18.04+
- Windows WSL2
- CentOS/RHEL 7+

See [COMPATIBILITY.md](COMPATIBILITY.md) for platform-specific notes.