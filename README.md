# Streamwall

Livestream management platform with automated discovery, monitoring, and display.

## Quick Start

```bash
git clone --recursive https://github.com/sayhiben/streamwall.git
cd streamwall
make                # Just run this - it'll guide you!
```

That's it! The Makefile will detect if you're new and offer:
- **Demo mode** - Try it out with sample data
- **Setup mode** - Configure for real use

## Essential Commands

```bash
make              # Start here - smart mode detection
make demo         # Quick demo with sample data  
make up           # Start all services
make down         # Stop all services
make logs         # View logs (or logs SERVICE=name)
make status       # Check what's running
make shell        # Open container shell
make help         # See all commands
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

## Configuration

See `.env.example` for all options. Key settings:
- `DISCORD_TOKEN` - Bot token
- `GOOGLE_SHEET_ID` - Sheets ID  
- `DATABASE_URL` - Auto-configured

## Documentation

- **[Developer Guide](DEVELOPER.md)** - Architecture and integration details
- [Technical Details](CLAUDE.md) - Service documentation
- [Compatibility](COMPATIBILITY.md) - Platform-specific notes

## License

MIT