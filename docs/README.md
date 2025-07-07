# Streamwall Documentation

Welcome to the Streamwall ecosystem documentation. This directory contains comprehensive guides and references for developers, operators, and contributors.

## 📚 Documentation Index

### Getting Started
- [Main README](../README.md) - Project overview and quick start guide
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute to the project
- [Architecture Overview](ARCHITECTURE.md) - System design and components

### Development Guides
- [API Interfaces](API_INTERFACES.md) - Complete API documentation for all services
- [Service Communication](SERVICE_COMMUNICATION.md) - How services interact with each other
- [Environment Variables](ENVIRONMENT_VARIABLES.md) - Configuration reference for all services
- [Integration Tests](../tests/integration/README.md) - Testing guide and best practices

### Deployment & Operations
- [Deployment Guide](DEPLOYMENT.md) - Deployment options from development to production
- [Docker Compose Guide](../DOCKER-COMPOSE.md) - Using Docker Compose for the ecosystem
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions

### Service-Specific Documentation

#### StreamSource (Rails API)
- [StreamSource README](../streamsource/README.md) - Rails API documentation
- [StreamSource CLAUDE.md](../streamsource/CLAUDE.md) - AI assistant context
- [API Documentation](../streamsource/API_DOCUMENTATION.md) - Detailed API specs
- [Admin Interface](../streamsource/ADMIN_INTERFACE.md) - Admin UI guide
- [DigitalOcean Deployment](../streamsource/DIGITALOCEAN_DEPLOYMENT_GUIDE.md) - Production deployment

#### Livestream Link Monitor
- [Monitor README](../livestream-link-monitor/README.md) - Discord/Twitch bot documentation
- [Monitor CLAUDE.md](../livestream-link-monitor/CLAUDE.md) - Service-specific AI context

#### Livesheet Checker
- [Checker README](../livesheet-checker/README.md) - Stream status checker documentation

#### Streamwall Desktop
- [Streamwall README](../streamwall/README.md) - Electron app documentation

## 🗺️ Documentation Map

```
Project Documentation Structure
├── Overview & Getting Started
│   ├── README.md (main)
│   ├── CONTRIBUTING.md
│   └── CLAUDE.md (AI context)
│
├── Architecture & Design
│   ├── docs/ARCHITECTURE.md
│   ├── docs/API_INTERFACES.md
│   └── docs/SERVICE_COMMUNICATION.md
│
├── Configuration & Setup
│   ├── docs/ENVIRONMENT_VARIABLES.md
│   ├── .env.example
│   └── DOCKER-COMPOSE.md
│
├── Development
│   ├── tests/integration/README.md
│   ├── tests/README.md
│   └── Service-specific guides
│
└── Operations
    ├── docs/DEPLOYMENT.md
    ├── docs/TROUBLESHOOTING.md
    └── Service deployment guides
```

## 🔍 Quick Links by Topic

### For New Contributors
1. Start with [CONTRIBUTING.md](../CONTRIBUTING.md)
2. Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system
3. Set up development environment using [README.md](../README.md)
4. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if you encounter issues

### For API Development
1. [API_INTERFACES.md](API_INTERFACES.md) - API endpoint reference
2. [SERVICE_COMMUNICATION.md](SERVICE_COMMUNICATION.md) - Integration patterns
3. [StreamSource API Docs](../streamsource/API_DOCUMENTATION.md) - Detailed Rails API

### For DevOps/Deployment
1. [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment strategies
2. [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - Configuration reference
3. [DOCKER-COMPOSE.md](../DOCKER-COMPOSE.md) - Container orchestration
4. [DigitalOcean Guide](../streamsource/DIGITALOCEAN_DEPLOYMENT_GUIDE.md) - Cloud deployment

### For Testing
1. [Integration Test Guide](../tests/integration/README.md) - Testing between services
2. [Test README](../tests/README.md) - General testing guide
3. Service-specific test documentation

## 📝 Documentation Standards

### Writing Documentation
- Use clear, concise language
- Include code examples where relevant
- Keep documentation up-to-date with code changes
- Use markdown formatting consistently
- Add diagrams for complex concepts

### Documentation Structure
```markdown
# Title

Brief description of the document's purpose.

## Table of Contents (for long docs)

## Overview

High-level explanation of the topic.

## Detailed Sections

### Subsection with Examples

```code
// Code examples with syntax highlighting
```

## Troubleshooting (if applicable)

## Related Documentation
```

### Updating Documentation
1. Documentation changes should be included with code changes
2. Review documentation during code reviews
3. Test code examples to ensure they work
4. Update the index when adding new documents

## 🤝 Contributing to Documentation

We welcome documentation improvements! To contribute:

1. Fork the repository
2. Create a branch: `git checkout -b docs/your-improvement`
3. Make your changes
4. Test any code examples
5. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for more details.

## 📞 Getting Help

If you can't find what you need:

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Search existing [GitHub Issues](https://github.com/sayhiben/streamwall/issues)
3. Ask in [GitHub Discussions](https://github.com/sayhiben/streamwall/discussions)
4. Create an issue for documentation improvements

## 🔄 Documentation Versions

- Current version: 1.0.0
- Last updated: January 2024
- Major changes are noted in service CHANGELOG files

---

*This documentation is maintained by the Streamwall community. Contributions are welcome!*