# Deployment Guide

This guide covers deployment options for the Streamwall ecosystem, from development to production environments.

## Deployment Options Overview

| Environment | Use Case | Infrastructure | Complexity |
|-------------|----------|----------------|------------|
| Docker Compose | Development, Small teams | Single server | Low |
| DigitalOcean Droplet | Small-Medium production | VPS | Medium |
| Kubernetes | Large scale production | Cloud/On-premise | High |
| Cloud PaaS | Rapid deployment | Heroku, Railway | Low |

## Docker Compose Deployment

### Development Environment

1. **Clone repository**
   ```bash
   git clone https://github.com/sayhiben/streamwall.git
   cd streamwall
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Initialize database**
   ```bash
   docker-compose exec streamsource bin/rails db:create db:migrate db:seed
   ```

### Production Docker Compose

1. **Create production compose file**
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
       build:
         context: ./streamsource
         args:
           RAILS_ENV: production
       environment:
         - RAILS_ENV=production
         - RAILS_SERVE_STATIC_FILES=true
       command: bundle exec puma -C config/puma.rb
   ```

2. **Deploy**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d
   ```

## DigitalOcean Deployment

See [streamsource/DIGITALOCEAN_DEPLOYMENT_GUIDE.md](../streamsource/DIGITALOCEAN_DEPLOYMENT_GUIDE.md) for detailed instructions.

### Quick Setup

1. **Create Droplet**
   - Ubuntu 22.04 LTS
   - 2GB RAM minimum (4GB recommended)
   - SSH keys configured

2. **Initial Server Setup**
   ```bash
   ssh root@your-droplet-ip
   
   # Create deploy user
   adduser deploy
   usermod -aG sudo deploy
   
   # Install Docker
   curl -fsSL https://get.docker.com | sh
   usermod -aG docker deploy
   ```

3. **Deploy Application**
   ```bash
   # As deploy user
   git clone https://github.com/sayhiben/streamwall.git
   cd streamwall
   
   # Configure
   cp .env.example .env.production
   # Edit .env.production
   
   # Deploy
   docker-compose -f docker-compose.production.yml up -d
   ```

4. **Setup SSL with Let's Encrypt**
   ```bash
   # Install Certbot
   sudo snap install certbot --classic
   
   # Generate certificate
   sudo certbot certonly --standalone -d yourdomain.com
   
   # Configure Nginx to use certificates
   ```

## Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (1.24+)
- kubectl configured
- Helm 3 installed

### Deployment Steps

1. **Create namespace**
   ```bash
   kubectl create namespace streamwall
   ```

2. **Create secrets**
   ```bash
   kubectl create secret generic streamwall-secrets \
     --from-literal=database-url=postgresql://... \
     --from-literal=jwt-secret=... \
     --from-literal=api-key=... \
     -n streamwall
   ```

3. **Deploy PostgreSQL**
   ```bash
   helm repo add bitnami https://charts.bitnami.com/bitnami
   helm install postgres bitnami/postgresql \
     --set auth.postgresPassword=yourpassword \
     --set auth.database=streamsource \
     -n streamwall
   ```

4. **Deploy Redis**
   ```bash
   helm install redis bitnami/redis \
     --set auth.password=yourredispassword \
     -n streamwall
   ```

5. **Deploy applications**
   ```yaml
   # streamsource-deployment.yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: streamsource
     namespace: streamwall
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: streamsource
     template:
       metadata:
         labels:
           app: streamsource
       spec:
         containers:
         - name: streamsource
           image: streamwall/streamsource:latest
           ports:
           - containerPort: 3000
           env:
           - name: DATABASE_URL
             valueFrom:
               secretKeyRef:
                 name: streamwall-secrets
                 key: database-url
           - name: REDIS_URL
             value: redis://redis-master:6379
   ```

6. **Create services**
   ```yaml
   # streamsource-service.yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: streamsource
     namespace: streamwall
   spec:
     selector:
       app: streamsource
     ports:
     - port: 3000
       targetPort: 3000
   ```

7. **Setup ingress**
   ```yaml
   # ingress.yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: streamwall-ingress
     namespace: streamwall
     annotations:
       cert-manager.io/cluster-issuer: letsencrypt-prod
   spec:
     tls:
     - hosts:
       - api.streamwall.com
       secretName: streamwall-tls
     rules:
     - host: api.streamwall.com
       http:
         paths:
         - path: /
           pathType: Prefix
           backend:
             service:
               name: streamsource
               port:
                 number: 3000
   ```

## Cloud Platform Deployments

### Heroku

1. **Install Heroku CLI**
   ```bash
   brew install heroku/brew/heroku
   ```

2. **Create apps**
   ```bash
   heroku create streamwall-api
   heroku create streamwall-monitor
   ```

3. **Add buildpacks**
   ```bash
   heroku buildpacks:set heroku/ruby -a streamwall-api
   heroku buildpacks:set heroku/nodejs -a streamwall-monitor
   ```

4. **Add addons**
   ```bash
   heroku addons:create heroku-postgresql:mini -a streamwall-api
   heroku addons:create heroku-redis:mini -a streamwall-api
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

### Railway

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Initialize project**
   ```bash
   railway login
   railway init
   ```

3. **Add services**
   ```bash
   railway add postgresql
   railway add redis
   ```

4. **Deploy**
   ```bash
   railway up
   ```

### AWS ECS

1. **Build and push images**
   ```bash
   aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
   
   docker build -t streamwall/streamsource ./streamsource
   docker tag streamwall/streamsource:latest $ECR_URI/streamwall/streamsource:latest
   docker push $ECR_URI/streamwall/streamsource:latest
   ```

2. **Create task definition**
   ```json
   {
     "family": "streamwall",
     "taskRoleArn": "arn:aws:iam::123456789:role/ecsTaskRole",
     "executionRoleArn": "arn:aws:iam::123456789:role/ecsExecutionRole",
     "networkMode": "awsvpc",
     "containerDefinitions": [
       {
         "name": "streamsource",
         "image": "123456789.dkr.ecr.us-west-2.amazonaws.com/streamwall/streamsource:latest",
         "memory": 512,
         "cpu": 256,
         "essential": true,
         "portMappings": [
           {
             "containerPort": 3000,
             "protocol": "tcp"
           }
         ]
       }
     ]
   }
   ```

3. **Create service**
   ```bash
   aws ecs create-service \
     --cluster streamwall \
     --service-name streamsource \
     --task-definition streamwall:1 \
     --desired-count 2
   ```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Run tests
      run: make test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Build and push Docker images
      env:
        DOCKER_REGISTRY: ${{ secrets.DOCKER_REGISTRY }}
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        make build-production
        make push-production
    
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.DEPLOY_HOST }}
        username: ${{ secrets.DEPLOY_USER }}
        key: ${{ secrets.DEPLOY_KEY }}
        script: |
          cd /opt/streamwall
          git pull
          docker-compose -f docker-compose.production.yml pull
          docker-compose -f docker-compose.production.yml up -d
          docker-compose exec -T streamsource bin/rails db:migrate
```

## Monitoring and Maintenance

### Health Checks

1. **Setup monitoring endpoints**
   ```nginx
   location /health {
     access_log off;
     proxy_pass http://streamsource:3000/health;
   }
   ```

2. **External monitoring**
   - UptimeRobot
   - Pingdom
   - StatusCake

### Backup Strategy

1. **Database backups**
   ```bash
   # Daily backup script
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   docker-compose exec -T postgres pg_dump -U streamsource streamsource_production | gzip > backup_$DATE.sql.gz
   
   # Upload to S3
   aws s3 cp backup_$DATE.sql.gz s3://streamwall-backups/
   
   # Keep only last 30 days
   find . -name "backup_*.sql.gz" -mtime +30 -delete
   ```

2. **Application data**
   ```bash
   # Backup uploads and configurations
   tar -czf streamwall_data_$DATE.tar.gz uploads/ config/
   ```

### Log Management

1. **Centralized logging**
   ```yaml
   # docker-compose.yml
   services:
     app:
       logging:
         driver: "json-file"
         options:
           max-size: "10m"
           max-file: "3"
   ```

2. **Log aggregation**
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Datadog
   - New Relic

### Performance Optimization

1. **Enable caching**
   ```ruby
   # config/environments/production.rb
   config.cache_store = :redis_cache_store, { url: ENV['REDIS_URL'] }
   ```

2. **Asset optimization**
   ```bash
   # Precompile assets
   docker-compose exec streamsource bin/rails assets:precompile
   ```

3. **Database optimization**
   ```sql
   -- Add indexes
   CREATE INDEX idx_streams_status ON streams(status);
   CREATE INDEX idx_streams_platform ON streams(platform);
   ```

## Security Hardening

### SSL/TLS Configuration

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;
```

### Firewall Rules

```bash
# UFW firewall setup
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Environment Isolation

```bash
# Use Docker secrets
docker secret create jwt_secret jwt_secret.txt
docker service update --secret-add jwt_secret streamwall_api
```

## Rollback Procedures

### Quick Rollback

```bash
# Tag before deployment
docker tag streamwall/streamsource:latest streamwall/streamsource:rollback

# Rollback if needed
docker-compose stop streamsource
docker tag streamwall/streamsource:rollback streamwall/streamsource:latest
docker-compose up -d streamsource
```

### Database Rollback

```bash
# Rollback migration
docker-compose exec streamsource bin/rails db:rollback

# Restore from backup
docker-compose exec -T postgres psql -U streamsource streamsource_production < backup.sql
```

## Scaling Strategies

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  streamsource:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

### Load Balancing

```nginx
upstream streamsource {
  least_conn;
  server streamsource1:3000;
  server streamsource2:3000;
  server streamsource3:3000;
}
```

### Auto-scaling

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: streamsource-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: streamsource
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```