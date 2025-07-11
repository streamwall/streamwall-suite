# Production Deployment Guide

This guide covers deploying Streamwall to production environments.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Monitoring](#monitoring)
8. [Backup & Recovery](#backup--recovery)
9. [Scaling](#scaling)
10. [Troubleshooting](#troubleshooting)

## Overview

The production deployment uses:
- Docker Compose with production-specific overrides
- Nginx as reverse proxy
- PostgreSQL with optimized settings
- Redis for caching and ActionCable
- Optional monitoring stack (Prometheus + Grafana)
- Automated backups
- Secret management

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2+
- Domain names pointing to your server
- SSL certificates (or use Let's Encrypt)
- At least 4GB RAM and 2 CPU cores
- 20GB+ available disk space

## Initial Setup

### 1. Clone the Repository

```bash
git clone --recursive https://github.com/streamwall/streamwall-suite.git
cd streamwall-suite
```

### 2. Run Production Setup

```bash
make prod-setup
```

This will:
- Create the `secrets/` directory
- Generate secure passwords for all services
- Create `.env.production` from the example

### 3. Configure Secrets

Add your Discord token (if using Discord monitoring):
```bash
echo "your-discord-bot-token" > secrets/discord_token.txt
```

### 4. Configure Environment

Edit `.env.production`:
```bash
# Update these values
DOMAIN=your-domain.com
DISCORD_CHANNEL_ID=your-channel-id
STREAMSOURCE_EMAIL=service@your-domain.com
STREAMSOURCE_PASSWORD=secure-password-here
```

## Configuration

### Database Optimization

The production compose file includes PostgreSQL optimizations:
- Connection pooling
- Memory tuning
- Checkpoint optimization
- WAL configuration

Adjust based on your server resources in `docker-compose.prod.yml`.

### Redis Configuration

Redis is configured with:
- Memory limits (256MB default)
- LRU eviction policy
- Persistence with RDB snapshots

### Application Tuning

StreamSource Rails app:
```bash
# In .env.production
WEB_CONCURRENCY=3        # Number of Puma workers
RAILS_MAX_THREADS=5      # Threads per worker
```

Node.js services:
```bash
# Automatically configured in docker-compose.prod.yml
NODE_OPTIONS=--max-old-space-size=1024
UV_THREADPOOL_SIZE=8
```

## Deployment

### First Deployment

```bash
# Deploy all services
make prod-deploy

# Or deploy step by step:
ENV=production make up
```

### Updating Services

```bash
# Pull latest images
ENV=production make update

# Restart services
ENV=production make restart
```

### Rolling Updates

For zero-downtime updates:
```bash
# Update one service at a time
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps streamsource
```

## SSL/TLS Setup

### Using Let's Encrypt

1. Install certbot:
```bash
apt-get install certbot
```

2. Generate certificates:
```bash
certbot certonly --standalone -d your-domain.com -d admin.your-domain.com
```

3. Update nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # ... rest of config
}
```

### Using Custom Certificates

Place certificates in the nginx container:
```bash
cp your-cert.pem nginx/certs/
cp your-key.pem nginx/certs/
```

## Monitoring

### Enable Monitoring Stack

```bash
COMPOSE_PROFILES=production,monitoring docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Access Dashboards

- Prometheus: http://your-server:9090
- Grafana: http://your-server:3001

Default Grafana credentials:
- Username: admin
- Password: Check `secrets/grafana_password.txt`

### Key Metrics to Monitor

1. **System Metrics**
   - CPU and memory usage
   - Disk I/O and space
   - Network traffic

2. **Application Metrics**
   - Request latency
   - Error rates
   - Active connections
   - Background job queues

3. **Database Metrics**
   - Connection pool usage
   - Query performance
   - Replication lag (if applicable)

## Backup & Recovery

### Automated Backups

Set up a cron job for regular backups:
```bash
# Add to crontab
0 3 * * * cd /path/to/streamwall-suite && make prod-backup
```

### Manual Backup

```bash
make prod-backup
```

Backups are stored in `backups/` with timestamps.

### Restore from Backup

```bash
# List available backups
ls -la backups/

# Restore specific backup
make prod-restore BACKUP=backups/streamwall_prod_20240101_030000.sql.gz
```

### Backup to S3

For offsite backups:
```bash
# After backup
aws s3 cp backups/streamwall_prod_$(date +%Y%m%d).sql.gz s3://your-bucket/backups/
```

## Scaling

### Horizontal Scaling

1. **StreamSource API**
   ```yaml
   # docker-compose.prod.yml
   streamsource:
     deploy:
       replicas: 3
   ```

2. **Load Balancing**
   - Use nginx upstream configuration
   - Or deploy behind a cloud load balancer

3. **Database Scaling**
   - Set up read replicas
   - Use connection pooling (PgBouncer)

### Vertical Scaling

Adjust resource limits in `docker-compose.prod.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
```

## Troubleshooting

### Check Service Status

```bash
make prod-status
```

### View Logs

```bash
# All services
make prod-logs

# Specific service
make prod-logs SERVICE=streamsource

# Last 100 lines
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 streamsource
```

### Common Issues

1. **Database Connection Errors**
   - Check PostgreSQL is running
   - Verify credentials in secrets
   - Check network connectivity

2. **Memory Issues**
   - Monitor with `docker stats`
   - Adjust memory limits
   - Check for memory leaks

3. **SSL Certificate Issues**
   - Verify certificate paths
   - Check certificate expiration
   - Ensure proper permissions

### Emergency Procedures

1. **Rollback Deployment**
   ```bash
   # Stop current deployment
   make prod-down
   
   # Restore from backup
   make prod-restore BACKUP=last-known-good.sql.gz
   
   # Deploy previous version
   STREAMSOURCE_VERSION=v1.2.3 make prod-deploy
   ```

2. **Emergency Maintenance Mode**
   ```bash
   # Create maintenance page
   echo "Under maintenance" > nginx/maintenance.html
   
   # Update nginx config to serve maintenance page
   ```

## Security Considerations

1. **Firewall Rules**
   - Only expose ports 80 and 443
   - Restrict database access
   - Use VPN for admin access

2. **Regular Updates**
   ```bash
   # Update base images
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
   
   # Update application
   git pull
   git submodule update --remote
   ```

3. **Security Scanning**
   ```bash
   # Scan images for vulnerabilities
   docker scan streamsource:latest
   ```

4. **Access Control**
   - Use strong passwords
   - Enable 2FA for admin accounts
   - Rotate API keys regularly

## Performance Optimization

1. **Enable Caching**
   - Redis for Rails cache
   - Nginx proxy cache
   - CDN for static assets

2. **Database Optimization**
   - Regular VACUUM and ANALYZE
   - Index optimization
   - Query monitoring

3. **Application Optimization**
   - Enable bootsnap
   - Precompile assets
   - Use eager loading

## Health Checks

Production services include health checks:
- StreamSource: `/health` endpoint
- Monitor/Updater: Process checks
- PostgreSQL: Connection test
- Redis: PING command

Failed health checks trigger automatic restarts.

## Logs Management

1. **Log Rotation**
   Docker handles via json-file driver with size limits

2. **Centralized Logging**
   Consider using:
   - ELK stack
   - Datadog
   - CloudWatch (AWS)

3. **Log Analysis**
   ```bash
   # Search for errors
   docker compose logs | grep ERROR
   
   # Monitor real-time
   make prod-logs | grep -E "(ERROR|WARN)"
   ```

## Compliance & Regulations

1. **Data Protection**
   - Encrypt data at rest
   - Use SSL/TLS for transit
   - Regular security audits

2. **Backup Retention**
   - Follow data retention policies
   - Secure backup storage
   - Test restore procedures

3. **Access Logging**
   - Log all admin actions
   - Monitor suspicious activity
   - Regular access reviews