# Streamwall Architecture

## Overview

The Streamwall ecosystem follows a microservices architecture pattern where each service has a specific responsibility and communicates with others through well-defined interfaces.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Interfaces                                  │
│                                                                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │  Streamwall      │  │  Admin Interface │  │  API Clients              │  │
│  │  (Electron App)  │  │  (Web UI)        │  │  (Third-party apps)       │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬──────────────┘  │
│           │                      │                          │                 │
└───────────┼──────────────────────┼─────────────────────────┼─────────────────┘
            │                      │                          │
            │                      ▼                          │
            │         ┌──────────────────────┐               │
            │         │    StreamSource      │◄──────────────┘
            │         │    (Rails 8 API)     │
            │         │                      │
            │         │  • REST API          │
            │         │  • ActionCable WS    │
            │         │  • Authentication    │
            │         │  • Admin Interface  │
            │         └──────────┬──────────┘
            │                      │
            │         ┌───────────┴───────────┐
            │         │                       │
            ▼         ▼                       ▼
┌───────────────────────┐          ┌────────────────────────┐
│   PostgreSQL 17       │          │   Redis 7              │
│                       │          │                        │
│  • Stream data        │          │  • Caching             │
│  • User accounts      │          │  • ActionCable pubsub  │
│  • Feature flags      │          │  • Session storage     │
└───────────────────────┘          └────────────────────────┘

                    ▲                           ▲
                    │                           │
        ┌───────────┴────────────┬──────────────┴──────────────┐
        │                        │                              │
┌───────┴──────────────┐ ┌──────┴──────────────┐  ┌───────────┴───────────┐
│ livestream-link-     │ │  livesheet-updater  │  │  External Services    │
│ monitor              │ │                     │  │                       │
│                      │ │ • Status checking   │  │  • Discord API        │
│ • Discord bot        │ │ • Google Sheets     │  │  • Twitch API         │
│ • Twitch monitor     │ │ • Sync to API       │  │  • Google Sheets API  │
│ • URL detection      │ └─────────────────────┘  │  • Platform APIs      │
│ • Dual-write mode    │                           └───────────────────────┘
└──────────────────────┘
```

## Service Responsibilities

### 1. StreamSource (Core API)

**Technology**: Ruby on Rails 8, PostgreSQL, Redis

**Responsibilities**:
- Central data store for all stream metadata
- RESTful API with JWT authentication
- Real-time updates via ActionCable WebSocket
- Admin interface for stream management
- Feature flag management
- User authentication and authorization
- Audit logging

**Key Components**:
```
streamsource/
├── app/
│   ├── controllers/
│   │   ├── api/v1/         # API endpoints
│   │   └── admin/          # Admin interface
│   ├── models/             # Data models
│   ├── channels/           # ActionCable channels
│   └── services/           # Business logic
├── config/                 # Configuration
└── db/                     # Database schema
```

### 2. Livestream Link Monitor

**Technology**: Node.js, Discord.js, TMI.js

**Responsibilities**:
- Monitor Discord channels for stream URLs
- Monitor Twitch chat for stream announcements
- Detect streaming platform from URLs
- Extract location information from messages
- Push discovered streams to StreamSource API
- Optional dual-write to Google Sheets

**Key Components**:
```
livestream-link-monitor/
├── src/
│   ├── bot/               # Discord/Twitch bot logic
│   ├── parsers/           # URL and location parsing
│   ├── clients/           # API clients
│   └── services/          # Core services
└── config/                # Configuration files
```

### 3. Livesheet Updater

**Technology**: Node.js, Google Sheets API

**Responsibilities**:
- Check stream status (live/offline)
- Update Google Sheets with current status
- Sync status changes to StreamSource API
- Periodic checking with configurable intervals
- Batch processing for efficiency

**Key Components**:
```
livesheet-updater/
├── src/
│   ├── checker/           # Stream checking logic
│   ├── sheets/            # Google Sheets integration
│   ├── api/               # StreamSource API client
│   └── scheduler/         # Periodic check scheduler
└── config/                # Configuration
```

### 4. Streamwall (Desktop Application)

**Technology**: Electron, TypeScript, React

**Responsibilities**:
- Display multiple streams in mosaic layout
- Per-stream audio controls
- Keyboard shortcuts for navigation
- Web-based control interface
- Stream layout management
- Local preferences storage

**Key Components**:
```
streamwall/
├── packages/
│   ├── app/               # Electron main process
│   ├── web/               # React UI
│   └── shared/            # Shared types/utilities
└── config/                # Build configuration
```

## Data Flow

### Stream Discovery Flow

```
1. User posts stream URL in Discord/Twitch
   ↓
2. livestream-link-monitor detects URL
   ↓
3. Parse platform and metadata
   ↓
4. Push to StreamSource API
   ↓
5. Optionally write to Google Sheets
   ↓
6. Broadcast via ActionCable
   ↓
7. Streamwall receives update
```

### Status Update Flow

```
1. livesheet-updater periodic check triggered
   ↓
2. Check stream status via platform API
   ↓
3. Update Google Sheets
   ↓
4. Sync to StreamSource API
   ↓
5. Broadcast status change
   ↓
6. All connected clients updated
```

## Communication Patterns

### Synchronous Communication

**REST API** (HTTP/HTTPS):
- Client → StreamSource API
- livestream-link-monitor → StreamSource API
- livesheet-updater → StreamSource API
- Streamwall → StreamSource API

### Asynchronous Communication

**WebSocket** (ActionCable):
- StreamSource → Connected clients
- Real-time stream updates
- Collaborative editing events

**Background Jobs**:
- Periodic status checking
- Batch processing
- Data synchronization

## Security Architecture

### Authentication Layers

1. **User Authentication**
   - Email/password login
   - JWT tokens (24-hour expiration)
   - Role-based access control (RBAC)

2. **Service Authentication**
   - API keys for service-to-service
   - Environment-based secrets
   - Rate limiting per service

3. **External Service Auth**
   - Discord bot token
   - Google service accounts
   - Platform API keys

### Security Measures

```
┌─────────────────────────────────────────┐
│           Internet                       │
└────────────────┬────────────────────────┘
                 │
         ┌───────▼───────┐
         │   Nginx       │
         │  (SSL/TLS)    │
         │  Rate Limit   │
         └───────┬───────┘
                 │
         ┌───────▼───────┐
         │ StreamSource  │
         │               │
         │ • JWT Auth    │
         │ • CORS        │
         │ • CSRF        │
         │ • Input Val.  │
         └───────────────┘
```

## Scalability Considerations

### Horizontal Scaling

**Stateless Services**:
- StreamSource API (multiple instances)
- livestream-link-monitor (multiple bots)
- livesheet-updater (distributed checking)

**Load Balancing**:
```
        Load Balancer
             │
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
  API-1    API-2    API-3
```

### Caching Strategy

1. **Redis Caching**:
   - API responses (5-minute TTL)
   - User sessions
   - Feature flags
   - Rate limit counters

2. **Database Query Optimization**:
   - Indexed queries
   - Eager loading associations
   - Query result caching

### Message Queue (Future)

```
Producer → Redis/RabbitMQ → Consumer
                │
         ┌──────┴──────┐
         │             │
    Stream Events  Status Updates
```

## Deployment Architecture

### Development Environment

```
docker-compose.yml
├── postgres:17
├── redis:7
├── streamsource
├── livestream-monitor
└── livesheet-updater
```

### Production Environment

```
┌─────────────────┐
│   DigitalOcean  │
│     Droplet     │
│                 │
│  ┌───────────┐  │
│  │  Docker    │  │
│  │  Compose   │  │
│  └───────────┘  │
│                 │
│  ┌───────────┐  │
│  │   Nginx    │  │
│  │  SSL/TLS   │  │
│  └───────────┘  │
└─────────────────┘
```

### Kubernetes Architecture (Future)

```
┌─────────────────────────────────────┐
│         Kubernetes Cluster          │
│                                     │
│  ┌─────────┐  ┌─────────┐         │
│  │  Pods   │  │  Pods   │         │
│  │ (API)   │  │(Workers)│         │
│  └─────────┘  └─────────┘         │
│                                     │
│  ┌─────────┐  ┌─────────┐         │
│  │Services │  │ Ingress │         │
│  └─────────┘  └─────────┘         │
│                                     │
│  ┌─────────┐  ┌─────────┐         │
│  │ConfigMap│  │ Secrets │         │
│  └─────────┘  └─────────┘         │
└─────────────────────────────────────┘
```

## Monitoring and Observability

### Metrics Collection

```
Services → Prometheus → Grafana
    │
    └─→ Application Metrics
        • Response times
        • Error rates
        • Stream discovery rate
        • Active connections
```

### Logging Architecture

```
Services → JSON Logs → Log Aggregator → Elasticsearch → Kibana
                          │
                          └─→ CloudWatch/Datadog
```

### Health Monitoring

```
Health Checks → Monitoring Service → Alerts
    │                                   │
    ├─ /health endpoints               ├─ Email
    ├─ Database connectivity           ├─ Slack
    └─ External service status         └─ PagerDuty
```

## Disaster Recovery

### Backup Strategy

1. **Database Backups**:
   - Daily automated backups
   - Point-in-time recovery
   - Geographic replication

2. **Configuration Backups**:
   - Git version control
   - Environment variables in secure storage
   - Infrastructure as Code

### Recovery Procedures

```
Failure Detection → Automatic Failover → Manual Intervention
        │                    │                    │
        └─ Health checks     └─ Load balancer    └─ Ops team
```

## Performance Optimization

### Database Optimization
- Connection pooling
- Query optimization
- Proper indexing
- Materialized views for complex queries

### API Optimization
- Response compression
- Pagination for large datasets
- GraphQL for complex queries (future)
- CDN for static assets

### Real-time Optimization
- WebSocket connection pooling
- Message batching
- Selective broadcasting
- Client-side caching

## Future Architecture Considerations

### Microservice Mesh
```
Service A ←→ Sidecar ←→ Service Mesh ←→ Sidecar ←→ Service B
```

### Event-Driven Architecture
```
Events → Event Bus → Event Processors → State Changes
           │
           └─→ Event Store (audit log)
```

### API Gateway
```
Clients → API Gateway → Service Discovery → Microservices
              │
              └─→ Auth, Rate Limit, Transform
```