# Troubleshooting Guide

This guide helps diagnose and resolve common issues in the Streamwall ecosystem.

## Quick Diagnostics

Run the diagnostic command to check system health:
```bash
make doctor
```

This checks:
- Service directories exist
- Docker is running
- Required tools installed
- Environment files present
- Service health endpoints

## Common Issues

### Services Not Starting

#### Issue: Docker Compose services fail to start

**Symptoms:**
- `docker-compose up` fails
- Services exit immediately
- Port binding errors

**Solutions:**

1. **Check Docker daemon**
   ```bash
   docker info
   # If fails: Start Docker Desktop/daemon
   ```

2. **Check port conflicts**
   ```bash
   # Check if ports are in use
   lsof -i :3000  # StreamSource
   lsof -i :3001  # Monitor
   lsof -i :5432  # PostgreSQL
   lsof -i :6379  # Redis
   
   # Kill conflicting processes or change ports in .env
   ```

3. **Clean Docker resources**
   ```bash
   docker-compose down -v
   docker system prune -a
   docker-compose up --build
   ```

4. **Check logs**
   ```bash
   docker-compose logs streamsource
   docker-compose logs postgres
   ```

### Database Connection Issues

#### Issue: "could not connect to database"

**Solutions:**

1. **Verify PostgreSQL is running**
   ```bash
   docker-compose ps postgres
   docker-compose logs postgres
   ```

2. **Test connection**
   ```bash
   docker-compose exec postgres psql -U streamsource -d streamsource_development
   ```

3. **Check DATABASE_URL**
   ```bash
   # In Rails console
   docker-compose exec streamsource bin/rails console
   > puts ENV['DATABASE_URL']
   ```

4. **Reset database**
   ```bash
   docker-compose exec streamsource bin/rails db:drop db:create db:migrate
   ```

### Redis Connection Issues

#### Issue: "Redis connection refused"

**Solutions:**

1. **Check Redis status**
   ```bash
   docker-compose ps redis
   docker-compose exec redis redis-cli ping
   # Should return: PONG
   ```

2. **Test connection**
   ```bash
   docker-compose exec streamsource bin/rails console
   > Redis.new(url: ENV['REDIS_URL']).ping
   ```

3. **Clear Redis cache**
   ```bash
   docker-compose exec redis redis-cli FLUSHALL
   ```

### Authentication Failures

#### Issue: "401 Unauthorized" errors

**Solutions:**

1. **Generate new JWT token**
   ```bash
   docker-compose exec streamsource bin/rails console
   > user = User.find_by(email: 'user@example.com')
   > token = JsonWebToken.encode(user_id: user.id)
   > puts token
   ```

2. **Verify API key**
   ```bash
   # Check environment
   echo $STREAMSOURCE_API_KEY
   
   # Test with curl
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        http://localhost:3000/api/v1/streams
   ```

3. **Reset user password**
   ```bash
   docker-compose exec streamsource bin/rails console
   > user = User.find_by(email: 'user@example.com')
   > user.password = 'newpassword123'
   > user.save!
   ```

### Stream Discovery Issues

#### Issue: Discord bot not detecting streams

**Solutions:**

1. **Check bot permissions**
   - Ensure bot has "Read Messages" permission
   - Verify channel ID is correct
   - Check bot is in the server

2. **Test Discord connection**
   ```bash
   docker-compose logs livestream-monitor | grep "Discord"
   ```

3. **Verify webhook**
   ```bash
   # Test webhook manually
   curl -X POST http://localhost:3001/webhook/discord \
     -H "Content-Type: application/json" \
     -d '{
       "type": "MESSAGE_CREATE",
       "data": {
         "content": "Test stream: https://twitch.tv/test",
         "author": {"username": "testuser"}
       }
     }'
   ```

#### Issue: Twitch integration not working

**Solutions:**

1. **Verify credentials**
   ```bash
   # Check environment
   echo $TWITCH_OAUTH_TOKEN
   echo $TWITCH_CHANNEL
   ```

2. **Test Twitch connection**
   ```bash
   docker-compose exec livestream-monitor npm run test:twitch
   ```

### Google Sheets Issues

#### Issue: "Invalid credentials" for Google Sheets

**Solutions:**

1. **Check service account file**
   ```bash
   # Verify file exists
   ls livestream-link-monitor/credentials.json
   ls livesheet-updater/creds.json
   
   # Validate JSON
   jq . livestream-link-monitor/credentials.json
   ```

2. **Verify permissions**
   - Service account email has edit access to sheet
   - Sheet ID is correct
   - API is enabled in Google Cloud Console

3. **Test connection**
   ```javascript
   // In Node.js
   const { google } = require('googleapis');
   const auth = new google.auth.GoogleAuth({
     keyFile: 'credentials.json',
     scopes: ['https://www.googleapis.com/auth/spreadsheets']
   });
   const sheets = google.sheets({ version: 'v4', auth });
   ```

### Performance Issues

#### Issue: Slow API responses

**Solutions:**

1. **Check database queries**
   ```ruby
   # Enable query logging
   ActiveRecord::Base.logger = Logger.new(STDOUT)
   
   # In Rails console
   Stream.all.explain
   ```

2. **Add indexes**
   ```ruby
   # Create migration
   class AddIndexesToStreams < ActiveRecord::Migration[7.0]
     def change
       add_index :streams, :status
       add_index :streams, :platform
       add_index :streams, [:status, :platform]
     end
   end
   ```

3. **Enable caching**
   ```ruby
   # In controller
   def index
     @streams = Rails.cache.fetch("streams/#{params}", expires_in: 5.minutes) do
       Stream.filter(params).to_a
     end
   end
   ```

4. **Monitor memory usage**
   ```bash
   docker stats
   ```

### WebSocket Connection Issues

#### Issue: Real-time updates not working

**Solutions:**

1. **Check ActionCable configuration**
   ```yaml
   # config/cable.yml
   development:
     adapter: redis
     url: <%= ENV['REDIS_URL'] %>
   ```

2. **Test WebSocket connection**
   ```javascript
   // In browser console
   const cable = ActionCable.createConsumer('ws://localhost:3000/cable')
   const channel = cable.subscriptions.create('StreamsChannel', {
     received(data) { console.log(data) }
   })
   ```

3. **Check CORS settings**
   ```ruby
   # config/initializers/cors.rb
   Rails.application.config.middleware.insert_before 0, Rack::Cors do
     allow do
       origins '*'
       resource '*', headers: :any, methods: [:get, :post, :put, :patch, :delete, :options, :head]
     end
   end
   ```

### Integration Test Failures

#### Issue: Tests failing with connection errors

**Solutions:**

1. **Use test environment**
   ```bash
   NODE_ENV=test npm test
   ```

2. **Mock external services**
   ```javascript
   // Use mock services instead of real ones
   const mockMonitor = new MockLivestreamMonitor();
   await mockMonitor.start();
   ```

3. **Reset between tests**
   ```javascript
   afterEach(async () => {
     await axios.post('http://localhost:3001/reset');
   });
   ```

## Service-Specific Issues

### StreamSource (Rails API)

#### Asset compilation errors
```bash
# Clear cache and recompile
docker-compose exec streamsource bin/rails tmp:clear
docker-compose exec streamsource bin/rails assets:precompile
```

#### Migration errors
```bash
# Check migration status
docker-compose exec streamsource bin/rails db:migrate:status

# Rollback if needed
docker-compose exec streamsource bin/rails db:rollback
```

### Livestream Monitor

#### High memory usage
```javascript
// Add memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
}, 60000);
```

#### Rate limiting
```javascript
// Implement backoff
async function retryWithBackoff(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}
```

### Streamwall (Electron)

#### App won't start
```bash
# Clear Electron cache
rm -rf ~/.config/streamwall
rm -rf ~/.cache/streamwall

# Rebuild
cd streamwall
npm run rebuild
npm run start:app
```

#### Stream not loading
- Check browser console for errors
- Verify stream URL is valid
- Check network tab for failed requests
- Try different stream platform

## Debugging Tools

### Logs

```bash
# View all logs
make logs

# Specific service
docker-compose logs -f streamsource

# Filter logs
docker-compose logs streamsource | grep ERROR

# Save logs
docker-compose logs > debug.log
```

### Rails Console

```bash
# Access console
docker-compose exec streamsource bin/rails console

# Useful commands
> Stream.count
> Stream.where(status: 'error').pluck(:url)
> User.find_by(email: 'admin@example.com')
> Rails.cache.clear
```

### Database Queries

```bash
# Access PostgreSQL
docker-compose exec postgres psql -U streamsource

# Useful queries
\dt                    -- List tables
\d streams            -- Describe table
SELECT COUNT(*) FROM streams;
SELECT * FROM streams WHERE status = 'error';
```

### Network Debugging

```bash
# Test internal connectivity
docker-compose exec livestream-monitor ping streamsource

# Check DNS resolution
docker-compose exec livestream-monitor nslookup streamsource

# Test API endpoint
docker-compose exec livestream-monitor curl http://streamsource:3000/health
```

## Recovery Procedures

### Full System Reset

```bash
# Stop everything
docker-compose down -v

# Clean Docker
docker system prune -a

# Remove data
rm -rf postgres_data redis_data

# Fresh start
docker-compose up --build
```

### Database Recovery

```bash
# From backup
gunzip < backup.sql.gz | docker-compose exec -T postgres psql -U streamsource

# Export current data
docker-compose exec postgres pg_dump -U streamsource streamsource_development > backup.sql
```

### Service Recovery

```bash
# Restart single service
docker-compose restart streamsource

# Rebuild single service
docker-compose up -d --build streamsource

# Force recreate
docker-compose up -d --force-recreate streamsource
```

## Getting Help

### Collect Debug Information

```bash
# System info
make doctor > debug-info.txt

# Service versions
docker-compose exec streamsource bin/rails --version >> debug-info.txt
docker-compose exec livestream-monitor node --version >> debug-info.txt

# Environment (sanitized)
env | grep -E "(RAILS|NODE|POSTGRES|REDIS)" | sed 's/=.*/=***/' >> debug-info.txt

# Recent logs
docker-compose logs --tail=100 >> debug-info.txt
```

### Report Issues

When reporting issues, include:
1. Debug information from above
2. Steps to reproduce
3. Expected vs actual behavior
4. Error messages/screenshots
5. Environment (OS, Docker version)

### Community Support

- GitHub Issues: Report bugs and feature requests
- GitHub Discussions: Ask questions and share tips
- Wiki: Community-maintained documentation