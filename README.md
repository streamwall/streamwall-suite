# Streamwall

Livestream management platform with automated discovery, monitoring, and display.

**✨ All services integrate automatically** - StreamSource API is the default backend for all components.

## Quick Start

### 🚀 For Developers (2 minutes to running code!)
```bash
git clone --recursive https://github.com/sayhiben/streamwall.git
cd streamwall
./dev-start.sh      # Interactive setup with demo mode option
```

### 🎮 Try Demo Mode First
```bash
make demo           # Instant setup with sample data
```

### ⚡ Production-Ready Setup
```bash
./setup-wizard.sh   # Full interactive configuration
docker compose up -d
```

### Starting Specific Services

```bash
# Just the API backend
docker compose up -d streamsource postgres redis

# Add Discord/Twitch monitor
docker compose up -d livestream-monitor

# Add Google Sheets checker
docker compose up -d livesheet-checker

# Everything including desktop app
docker compose --profile desktop up -d
```

## What It Does

- **Discovers** streams from Discord and Twitch
- **Monitors** stream status in real-time  
- **Displays** multiple streams in a grid

## Services

| Service | Purpose | Port |
|---------|---------|------|
| StreamSource | API backend | 3000 |
| Monitor | Discord/Twitch bot | 3001 |
| Checker | Status updates | - |
| Streamwall | Desktop display | 8080 |

## Development

```bash
# Start everything
docker compose up

# View logs
docker compose logs -f

# Run tests
make test
```

## Configuration

See `.env.example` - it has working defaults.

Key settings:
- `DISCORD_TOKEN` - Bot token
- `GOOGLE_SHEET_ID` - Sheets ID
- `DATABASE_URL` - Auto-configured

## Deployment

1. Set `NODE_ENV=production`
2. Generate secure keys
3. Configure reverse proxy
4. Run `docker compose -f docker-compose.production.yml up -d`

## Documentation

- **[Developer Guide](DEVELOPER.md)** - 🚀 Start here if you're coding
- [Quick Start Guide](QUICK-START.md) - Get running in 2 minutes
- [Setup & Operations](SETUP-AND-OPS.md) - Detailed setup and daily operations
- [Technical Details](CLAUDE.md) - Architecture and integration details
- [Compatibility](COMPATIBILITY.md) - Platform-specific notes

## Quick Commands

```bash
# Status & Monitoring
docker compose ps                    # Show running services
docker compose logs -f [service]     # View logs (omit service for all)
./validate-config.sh                 # Check configuration

# Service Control
docker compose restart [service]     # Restart a service
docker compose stop [service]        # Stop a service
docker compose down                  # Stop everything

# Updates & Maintenance
git pull --recurse-submodules       # Update code
docker compose build                # Rebuild after updates
docker compose up -d                # Start updated services
```

## License

MIT - See individual services for specific licenses.