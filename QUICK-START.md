# Streamwall Quick Start

## 1. Clone & Setup (2 minutes)
```bash
git clone --recursive https://github.com/sayhiben/streamwall.git
cd streamwall
./setup-wizard.sh
```

## 2. Start Services

### Option A: Start Everything
```bash
docker compose up -d
```

### Option B: Start Specific Services
```bash
# Just the API
docker compose up -d streamsource postgres redis

# API + Discord bot
docker compose up -d streamsource postgres redis livestream-link-monitor

# API + Google Sheets monitor
docker compose up -d streamsource postgres redis livesheet-checker
```

## 3. Verify It's Working
```bash
# Check services are running
docker compose ps

# View logs
docker compose logs -f

# Check API health
curl http://localhost:3000/health
```

## That's It! 🎉

Your services are now running:
- **StreamSource API**: http://localhost:3000
- **Admin Login**: Use credentials from setup wizard
- **Logs**: `docker compose logs -f [service-name]`

## Common Commands
```bash
docker compose stop          # Stop everything
docker compose restart       # Restart everything
docker compose down          # Stop and remove containers
./validate-config.sh         # Check configuration
```

## Need Help?
- Full docs: [SETUP-AND-OPS.md](SETUP-AND-OPS.md)
- Troubleshooting: `docker compose logs [service-name]`