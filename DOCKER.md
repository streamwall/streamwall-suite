# Streamwall Suite - Zero Configuration Setup

Just download and run. No configuration needed.

## Quick Start

```bash
# Start everything
docker compose up

# That's it! Access at http://localhost:3000
```

## What You Get

- **StreamSource API** at http://localhost:3000
- **PostgreSQL** database (automatic setup)
- **Redis** cache (automatic setup)
- **Stream Monitor** (works without Discord/Twitch tokens)
- **Status Updater** (automatic stream checking)

## Connecting External Apps

For apps running outside Docker (like Streamwall desktop):
- API URL: `http://localhost:3000/api/v1`
- No hosts file changes needed!

## Optional: Enable Discord/Twitch

Want to monitor Discord or Twitch for streams?

```bash
# 1. Copy the example file
cp .env.example .env

# 2. Add your tokens to .env
# 3. Restart
docker compose restart
```

## That's It

No environments. No profiles. No complex configuration.
Just `docker compose up` and go.