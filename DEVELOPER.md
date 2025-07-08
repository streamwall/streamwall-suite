# Streamwall Developer Guide

## 🚀 Quick Start for Developers

### One Command Setup
```bash
git clone --recursive https://github.com/sayhiben/streamwall.git
cd streamwall
./dev-start.sh
```

This will:
- ✅ Check all prerequisites
- ✅ Fix common issues automatically
- ✅ Offer demo mode with sample data
- ✅ Generate secure keys
- ✅ Start all services
- ✅ **Automatically integrate all services with StreamSource**

**Time to first success: ~2 minutes** 🎉

### Service Integration (Automatic!)

All services are **pre-configured to work together** out of the box:
- **livestream-monitor** → Sends discovered streams to StreamSource API
- **livesheet-checker** → Updates stream status in StreamSource API  
- **Streamwall desktop** → Fetches and displays streams from StreamSource API

No manual configuration needed - it just works! 🎊

## 🎮 Development Modes

### 1. Demo Mode (Recommended for First Time)
Perfect for exploring features without any setup:
```bash
./dev-start.sh
# Choose option 1
```

**Features:**
- Pre-configured credentials
- Sample stream data
- Mock Discord/Twitch connections
- No external dependencies needed

**Demo Credentials:**
- Email: `admin@streamwall.local`
- Password: `streamwall123`

### 2. Development Mode
Real services with developer-friendly defaults:
```bash
./dev-start.sh
# Choose option 2
```

**Features:**
- Secure key generation
- Debug logging enabled
- Hot-reload support
- Real service connections

### 3. Custom Mode
Full control over configuration:
```bash
./setup-wizard.sh
```

## 🛠️ Developer Commands

### Essential Commands
```bash
# Start everything (fully integrated)
make dev

# Start with integration verification
./start-integrated.sh

# Quick start with demo
make demo

# View logs
make logs

# Run tests
make test

# Check health
make health

# Clean restart
make clean-restart
```

### Service-Specific Commands
```bash
# Start only API
docker compose up -d streamsource postgres redis

# Start with monitors
docker compose up -d streamsource postgres redis livestream-link-monitor

# Include desktop app
docker compose --profile desktop up -d
```

### Debugging Commands
```bash
# Check what's wrong
./scripts/preflight-check.sh

# Validate configuration
./validate-config.sh

# Run diagnostics
make doctor

# Shell into service
docker compose exec streamsource bash
```

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Discord/Twitch  │────▶│ Monitor Service │────▶│ StreamSource API│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
┌─────────────────┐     ┌─────────────────┐              │
│  Google Sheets  │────▶│ Checker Service │──────────────┘
└─────────────────┘     └─────────────────┘              │
                                                          ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │ Streamwall App  │────▶│   PostgreSQL    │
                        └─────────────────┘     └─────────────────┘
```

## 🔧 Configuration

### Environment Variables
Three levels of configuration:

1. **`.env.example`** - Template with all options
2. **`.env.development`** - Developer defaults (auto-used)
3. **`.env`** - Your local configuration (git-ignored)

### Key Configuration Files
```
.env                    # Your local config
docker-compose.yml      # Service definitions
.env.development        # Dev defaults
scripts/               # Helper scripts
```

### Security in Development
- **Auto-generated keys**: Secure by default, even in dev
- **Isolated networking**: Services communicate internally
- **No hardcoded secrets**: Everything configurable
- **Permission checks**: Automatic file permission fixes

## 🧪 Testing

### Run All Tests
```bash
make test
```

### Test Specific Services
```bash
# StreamSource API tests
cd streamsource && bundle exec rspec

# Monitor service tests
cd livestream-link-monitor && npm test

# Integration tests
make test-integration
```

### Test Coverage
```bash
# Generate coverage report
make coverage

# View in browser
open coverage/index.html
```

## 🐛 Debugging

### Common Issues & Solutions

#### Port Conflicts
```bash
# Auto-fix with preflight check
./scripts/preflight-check.sh

# Or manually change ports
echo "STREAMSOURCE_PORT=3010" >> .env
```

#### Docker Not Running
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

#### Database Connection Issues
```bash
# Reset database
docker compose down -v
docker compose up -d

# Check logs
docker compose logs postgres
```

#### Service Won't Start
```bash
# Check service logs
docker compose logs [service-name]

# Rebuild service
docker compose build [service-name]

# Full reset
make clean-restart
```

### Debug Mode
Enable verbose logging:
```bash
echo "LOG_LEVEL=debug" >> .env
echo "VERBOSE_LOGGING=true" >> .env
docker compose restart
```

## 📦 Adding Features

### 1. Create Feature Branch
```bash
git checkout -b feature/my-feature
```

### 2. Make Changes
Follow existing patterns in the codebase.

### 3. Test Your Changes
```bash
# Run tests
make test

# Manual testing in demo mode
make demo
```

### 4. Update Documentation
Update relevant docs if needed.

### 5. Submit PR
Include:
- Clear description
- Test results
- Screenshots if UI changes

## 🔄 Development Workflow

### Daily Workflow
```bash
# Morning: Pull latest changes
git pull --recurse-submodules

# Start services
make dev

# View logs while developing
make logs

# Run tests before committing
make test

# End of day: Clean shutdown
make down
```

### Resetting Everything
```bash
# Full reset (preserves .env)
make clean-restart

# Nuclear option (removes everything)
docker compose down -v
rm -rf postgres_data redis_data
rm .env
```

## 🚢 Deployment

### Local Production Test
```bash
# Use production compose file
docker compose -f docker-compose.production.yml up -d
```

### Environment Differences
| Feature | Development | Production |
|---------|------------|------------|
| Debug logging | ✅ Enabled | ❌ Disabled |
| CORS | ✅ Open | 🔒 Restricted |
| SSL | ❌ Optional | ✅ Required |
| Rate limiting | ❌ Disabled | ✅ Enabled |
| Error details | ✅ Full | 🔒 Hidden |

## 🤝 Contributing

### Code Style
- **Ruby**: Follow Rails conventions
- **JavaScript**: ESLint + Prettier
- **Bash**: ShellCheck compliant

### Commit Messages
```
feat: Add stream analytics
fix: Resolve Discord connection issue
docs: Update API documentation
test: Add monitor service tests
```

### PR Guidelines
1. Keep PRs focused and small
2. Include tests for new features
3. Update documentation
4. Ensure all checks pass

## 📚 Resources

### Documentation
- [API Reference](./streamsource/API.md)
- [Architecture](./CLAUDE.md)
- [Setup Guide](./SETUP-AND-OPS.md)

### External Links
- [Discord Developer Portal](https://discord.com/developers)
- [Twitch Dev Console](https://dev.twitch.tv/console)
- [Google Cloud Console](https://console.cloud.google.com)

## 💡 Tips & Tricks

### Speed Up Development
```bash
# Skip health checks
COMPOSE_HTTP_TIMEOUT=5 docker compose up -d

# Use local node_modules (faster)
docker compose run --rm livestream-link-monitor npm install
```

### Useful Aliases
Add to your shell profile:
```bash
alias streamwall='cd ~/streamwall'
alias swup='docker compose up -d'
alias swdown='docker compose down'
alias swlogs='docker compose logs -f'
alias swtest='make test'
```

### VS Code Integration
Recommended extensions:
- Docker
- Remote - Containers
- Ruby
- ESLint
- Prettier

### Performance Monitoring
```bash
# Check resource usage
docker stats

# Profile Rails
cd streamsource
bundle exec rails runner 'puts Benchmark.measure { 1000.times { Stream.first } }'
```

## 🆘 Getting Help

1. **Check logs first**: `docker compose logs [service]`
2. **Run diagnostics**: `make doctor`
3. **Search issues**: [GitHub Issues](https://github.com/sayhiben/streamwall/issues)
4. **Ask in Discord**: [Streamwall Discord](#)

---

**Remember**: The goal is to get you coding quickly! If something takes more than 5 minutes to fix, reach out for help. 🚀