# Streamwall Project

This repository serves as the integration point for all Streamwall-related services and applications. It orchestrates the entire ecosystem for livestream discovery, monitoring, and display.

## Architecture Overview

```
streamwall-project/
├── livestream-link-monitor/     # Discord/Twitch bot for stream discovery
├── livesheet-checker/          # Google Sheets status updater
├── streamsource/              # Rails API backend (central data store)
├── streamwall/                # Electron desktop application
├── Makefile                   # Orchestration commands
├── tests/                     # Integration tests
└── docs/                      # Shared documentation
```

## Repository Structure Options

### Option 1: Meta-Repository with Submodules (Recommended)

This approach keeps each service in its own repository while this repo orchestrates them:

```bash
# Initial setup
git clone https://github.com/sayhiben/streamwall-project.git
cd streamwall-project
cp .gitmodules.example .gitmodules
# Edit .gitmodules with your repository URLs
./setup-submodules.sh
```

**Pros:**
- Clean separation of concerns
- Each service can be developed independently
- Easy to version each service separately
- Can mix public and private repos

**Cons:**
- Submodules can be tricky for newcomers
- Need to manage multiple repositories

### Option 2: Monorepo

Keep everything in a single repository:

```bash
streamwall-monorepo/
├── services/
│   ├── livestream-link-monitor/
│   ├── livesheet-checker/
│   ├── streamsource/
│   └── streamwall/
├── shared/
│   ├── configs/
│   └── types/
└── integration/
    ├── tests/
    └── docker-compose.yml
```

**Pros:**
- Simpler to manage
- Atomic commits across services
- Easier CI/CD

**Cons:**
- Larger repository
- Can't easily mix access permissions

### Option 3: Integration Repository Only

Keep this as a thin orchestration layer:

```bash
streamwall-integration/
├── Makefile
├── docker-compose.yml
├── tests/
├── scripts/
└── docs/
```

Services are expected to be cloned as siblings:
```
parent-directory/
├── streamwall-integration/
├── livestream-link-monitor/
├── livesheet-checker/
├── streamsource/
└── streamwall/
```

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Git
- Make

### Quick Start

```bash
# Clone this repository
git clone https://github.com/sayhiben/streamwall-project.git
cd streamwall-project

# Setup (choose based on your structure)
make setup

# Start all services
make dev

# Check status
make status

# View logs
make logs
```

### Development Workflow

1. **Feature Development**
   ```bash
   # Work on individual service
   cd livestream-link-monitor
   git checkout -b feature/new-platform-support
   # Make changes
   git commit -m "Add support for new platform"
   git push origin feature/new-platform-support
   ```

2. **Integration Testing**
   ```bash
   # From ecosystem root
   make test-integration
   ```

3. **Update Ecosystem**
   ```bash
   # Update submodules to latest
   git submodule update --remote --merge
   git commit -m "Update services to latest versions"
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
      with:
        submodules: recursive
    
    - name: Setup
      run: make setup
    
    - name: Run Integration Tests
      run: make test-integration
    
    - name: E2E Tests
      run: make test-e2e
```

## Environment Configuration

### Development

Create `.env` files for each service:

```bash
# Copy example configs
cp livestream-link-monitor/.env.example livestream-link-monitor/.env
cp streamsource/.env.example streamsource/.env

# Edit with your values
```

### Production

Use secrets management:
- GitHub Secrets for GitHub Actions
- Docker Swarm secrets
- Kubernetes secrets
- AWS Secrets Manager

## Contributing

### Working with Submodules

```bash
# Clone with submodules
git clone --recursive https://github.com/yourusername/streamwall-ecosystem.git

# Update submodules
git submodule update --remote --merge

# Make changes in a submodule
cd livestream-link-monitor
git checkout -b my-feature
# ... make changes ...
git commit -m "My changes"
git push origin my-feature

# Update ecosystem to use new commit
cd ..
git add livestream-link-monitor
git commit -m "Update livestream-link-monitor to include my-feature"
```

### Testing Changes

```bash
# Test individual service
make test-monitor

# Test integration
make test-integration

# Full test suite
make test
```

## Deployment

### Docker Swarm

```bash
# Deploy stack
docker stack deploy -c docker-compose.production.yml streamwall

# Update service
docker service update streamwall_livestream-link-monitor
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Update deployment
kubectl set image deployment/livestream-link-monitor \
  livestream-link-monitor=myregistry/livestream-link-monitor:v2.0
```

## Versioning Strategy

### Semantic Versioning

- Each service maintains its own version
- Ecosystem version tracks compatibility

### Version Matrix

| Ecosystem | Monitor | Checker | Source | Streamwall |
|-----------|---------|---------|--------|------------|
| 1.0.0     | 1.2.3   | 1.0.1   | 2.1.0  | 0.9.5      |
| 1.1.0     | 1.3.0   | 1.0.1   | 2.2.0  | 1.0.0      |

## Monitoring

### Health Checks

```bash
# Check all services
make health

# Individual service
curl http://localhost:3001/health
```

### Metrics

- Prometheus endpoints
- Application logs
- Performance metrics

## Troubleshooting

```bash
# Diagnostic tool
make doctor

# Check configurations
make env-check

# View specific service logs
make logs-monitor
make logs-checker
```

## License

Each service may have its own license. See individual repositories for details.

## Contact

- Issues: [GitHub Issues](https://github.com/yourusername/streamwall-project/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/streamwall-project/discussions)