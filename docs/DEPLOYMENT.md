# Deployment Guide

This guide covers deployment options for the Streamwall ecosystem.

## Deployment Options

| Method | Use Case | Complexity |
|--------|----------|------------|
| Docker Compose | Development & Small Production | Low |
| DigitalOcean | Scalable Production | Medium |

## Docker Compose Deployment

### Development Environment

The setup script creates everything you need with working defaults:

```bash
# Clone and setup
git clone --recursive https://github.com/streamwall/streamwall-suite.git
cd streamwall-suite
./setup-ecosystem.sh

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

Default services will be available at:
- StreamSource API: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Production Docker Compose

1. **Create production environment file**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production values:
   # - Set RAILS_ENV=production
   # - Use strong passwords
   # - Configure real Google credentials
   # - Set production API keys
   ```

2. **Create production compose file**
   ```yaml
   # docker-compose.production.yml
   version: '3.8'
   
   services:
     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf
         - ./ssl:/etc/nginx/ssl
       depends_on:
         - streamsource
     
     streamsource:
       environment:
         - RAILS_ENV=production
         - RAILS_SERVE_STATIC_FILES=true
       command: bundle exec puma -C config/puma.rb
     
     postgres:
       volumes:
         - postgres_data:/var/lib/postgresql/data
     
     redis:
       volumes:
         - redis_data:/data

   volumes:
     postgres_data:
     redis_data:
   ```

3. **Deploy**
   ```bash
   # Build and start
   docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d
   
   # Initialize database
   docker-compose exec streamsource bin/rails db:create db:migrate db:seed
   
   # Precompile assets
   docker-compose exec streamsource bin/rails assets:precompile
   ```

4. **SSL Setup (Optional)**
   ```bash
   # Install Certbot
   sudo apt-get update
   sudo apt-get install certbot
   
   # Generate certificate
   sudo certbot certonly --standalone -d yourdomain.com
   
   # Update nginx.conf to use certificates
   ```

## DigitalOcean Deployment

For detailed DigitalOcean deployment instructions, see [streamsource/DIGITALOCEAN_DEPLOYMENT_GUIDE.md](../streamsource/DIGITALOCEAN_DEPLOYMENT_GUIDE.md).

### Quick DigitalOcean Setup

1. **Create Droplet**
   - Ubuntu 22.04 LTS
   - 2GB RAM minimum (4GB recommended)
   - Add your SSH key

2. **Initial Server Setup**
   ```bash
   # Connect to your droplet
   ssh root@your-droplet-ip
   
   # Create deploy user
   adduser deploy
   usermod -aG sudo deploy
   
   # Install Docker
   curl -fsSL https://get.docker.com | sh
   usermod -aG docker deploy
   
   # Setup firewall
   ufw allow OpenSSH
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```

3. **Deploy Application**
   ```bash
   # Switch to deploy user
   su - deploy
   
   # Clone repository
   git clone --recursive https://github.com/streamwall/streamwall-suite.git
   cd streamwall-suite
   
   # Setup production environment
   cp .env.example .env.production
   # Edit .env.production with your production values
   
   # Start services
   docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d
   ```

4. **Configure Domain**
   - Point your domain to the droplet IP
   - Setup SSL with Let's Encrypt:
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com
   ```

## Environment Variables

### Required for Production

```bash
# Rails
RAILS_ENV=production
SECRET_KEY_BASE=<generate with: openssl rand -hex 64>
RAILS_MASTER_KEY=<from config/master.key>

# Database
DATABASE_URL=postgresql://streamsource:password@postgres:5432/streamsource_production

# Redis
REDIS_URL=redis://redis:6379/0

# JWT Auth
JWT_SECRET=<generate with: openssl rand -hex 32>

# Google Sheets Integration
GOOGLE_SHEET_ID=<your-sheet-id>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account@project.iam.gserviceaccount.com>

# Discord Bot
DISCORD_TOKEN=<your-bot-token>
DISCORD_WEBHOOK_URL=<your-webhook-url>
```

## Monitoring

### Health Checks

All services expose health endpoints:
- StreamSource: `GET /health`
- Livestream Monitor: `GET /health`

### Logs

View logs for all services:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f streamsource
```

### Backup

Create automated backups:
```bash
# Backup database
docker-compose exec postgres pg_dump -U streamsource streamsource_production > backup.sql

# Backup Redis
docker-compose exec redis redis-cli SAVE
docker cp streamwall-redis-1:/data/dump.rdb ./redis-backup.rdb
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs

# Verify environment variables
docker-compose config

# Check disk space
df -h
```

### Database connection errors
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U streamsource -d streamsource_production
```

### Memory issues
```bash
# Check memory usage
free -h

# Restart services
docker-compose restart
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable firewall (ufw)
- [ ] Setup SSL certificates
- [ ] Restrict database access
- [ ] Enable rate limiting
- [ ] Regular security updates
- [ ] Backup strategy in place

## Next Steps

1. Configure monitoring (UptimeRobot, Pingdom)
2. Setup automated backups
3. Configure log rotation
4. Plan for scaling (add more droplets, load balancer)