/**
 * Cross-Service Data Consistency Tests
 * Tests data consistency across all services in the Streamwall ecosystem
 */

const axios = require('axios');
const {
  generateDiscordMessage,
  TEST_URLS,
  TEST_LOCATIONS,
  delay
} = require('../helpers/test-data');

// Import mock services
const MockLivestreamMonitor = require('../helpers/mock-livestream-monitor');

// Enhanced mock services with full integration capabilities
class IntegratedMockMonitor extends MockLivestreamMonitor {
  constructor(port = 3001, streamSourceUrl = 'http://localhost:3000/api/v1', sheetsUrl = 'http://localhost:3002') {
    super(port);
    this.streamSourceUrl = streamSourceUrl;
    this.sheetsUrl = sheetsUrl;
    this.apiKey = 'test-api-key';
  }
  
  async processStream(stream) {
    // Save locally
    this.streams.push(stream);
    
    // Push to StreamSource
    try {
      await axios.post(
        `${this.streamSourceUrl}/streams`,
        {
          ...stream,
          source: 'discord'
        },
        {
          headers: { Authorization: `Bearer ${this.apiKey}` }
        }
      );
    } catch (error) {
      console.error('Failed to push to StreamSource:', error.message);
    }
    
    // Push to Sheets via checker
    try {
      await axios.post(`${this.sheetsUrl}/sheets/add`, {
        ...stream,
        addedBy: stream.posted_by
      });
    } catch (error) {
      console.error('Failed to push to Sheets:', error.message);
    }
  }
}

// Mock StreamSource with full features
class FullMockStreamSource {
  constructor(port = 3000) {
    this.port = port;
    this.express = require('express');
    this.app = this.express();
    this.server = null;
    this.streams = [];
    this.updates = [];
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.use(this.express.json());
    
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    
    this.app.post('/api/v1/streams', (req, res) => {
      if (!this.checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      
      // Check for duplicate URL
      const existing = this.streams.find(s => s.url === req.body.url);
      if (existing) {
        // Update existing
        Object.assign(existing, req.body, { updated_at: new Date().toISOString() });
        this.logUpdate('updated', existing);
        return res.json(existing);
      }
      
      const stream = {
        id: this.streams.length + 1,
        ...req.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      this.streams.push(stream);
      this.logUpdate('created', stream);
      res.status(201).json(stream);
    });
    
    this.app.get('/api/v1/streams', (req, res) => {
      if (!this.checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      
      let filtered = [...this.streams];
      
      // Apply filters
      if (req.query.status) {
        filtered = filtered.filter(s => s.status === req.query.status);
      }
      if (req.query.platform) {
        filtered = filtered.filter(s => s.platform === req.query.platform);
      }
      if (req.query.city) {
        filtered = filtered.filter(s => s.city === req.query.city);
      }
      
      res.json({
        streams: filtered,
        meta: { total_count: filtered.length }
      });
    });
    
    this.app.patch('/api/v1/streams/:id', (req, res) => {
      if (!this.checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      
      const id = parseInt(req.params.id);
      const stream = this.streams.find(s => s.id === id);
      
      if (!stream) return res.status(404).json({ error: 'Stream not found' });
      
      Object.assign(stream, req.body, { updated_at: new Date().toISOString() });
      this.logUpdate('updated', stream);
      res.json(stream);
    });
    
    this.app.get('/api/v1/updates', (req, res) => {
      if (!this.checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      res.json(this.updates);
    });
    
    this.app.post('/api/v1/reset', (req, res) => {
      this.streams = [];
      this.updates = [];
      res.json({ success: true });
    });
  }
  
  checkAuth(req) {
    const authHeader = req.headers['authorization'];
    return authHeader && authHeader.startsWith('Bearer ');
  }
  
  logUpdate(action, stream) {
    this.updates.push({
      action,
      stream_id: stream.id,
      url: stream.url,
      timestamp: new Date().toISOString()
    });
  }
  
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Full Mock StreamSource API listening on port ${this.port}`);
        resolve();
      });
    });
  }
  
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// Mock livesheet-checker with full integration
class FullMockChecker {
  constructor(port = 3002) {
    this.port = port;
    this.express = require('express');
    this.app = this.express();
    this.server = null;
    this.sheets = [];
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.use(this.express.json());
    
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });
    
    this.app.post('/sheets/add', (req, res) => {
      const existing = this.sheets.find(s => s.url === req.body.url);
      if (existing) {
        return res.status(409).json({ error: 'Already exists' });
      }
      
      this.sheets.push({
        ...req.body,
        added_at: new Date().toISOString()
      });
      
      res.json({ success: true });
    });
    
    this.app.get('/sheets/data', (req, res) => {
      res.json({ values: this.sheets });
    });
    
    this.app.post('/sheets/update-status', (req, res) => {
      const sheet = this.sheets.find(s => s.url === req.body.url);
      if (sheet) {
        sheet.status = req.body.status;
        sheet.last_checked = new Date().toISOString();
      }
      res.json({ success: true });
    });
    
    this.app.post('/reset', (req, res) => {
      this.sheets = [];
      res.json({ success: true });
    });
  }
  
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Full Mock Checker listening on port ${this.port}`);
        resolve();
      });
    });
  }
  
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

describe('Cross-Service Data Consistency', () => {
  let mockMonitor;
  let mockStreamSource;
  let mockChecker;
  const authHeader = { headers: { Authorization: 'Bearer test-api-key' } };
  
  beforeAll(async () => {
    // Start all services
    mockStreamSource = new FullMockStreamSource();
    await mockStreamSource.start();
    
    mockChecker = new FullMockChecker();
    await mockChecker.start();
    
    mockMonitor = new IntegratedMockMonitor();
    await mockMonitor.start();
  });
  
  afterAll(async () => {
    await mockMonitor?.stop();
    await mockChecker?.stop();
    await mockStreamSource?.stop();
  });
  
  afterEach(async () => {
    // Reset all services
    await axios.post('http://localhost:3001/reset').catch(() => {});
    await axios.post('http://localhost:3002/reset').catch(() => {});
    await axios.post('http://localhost:3000/api/v1/reset').catch(() => {});
  });
  
  describe('Stream Creation Consistency', () => {
    test('should maintain consistency when stream is added via Discord', async () => {
      const testUrl = TEST_URLS.twitch[0];
      const location = TEST_LOCATIONS[0];
      
      // Add stream via Discord webhook
      const message = generateDiscordMessage(
        `🔴 LIVE from ${location.city}, ${location.state}: ${testUrl}`
      );
      
      await mockMonitor.processStream({
        url: testUrl,
        platform: 'twitch',
        city: location.city,
        state: location.state,
        status: 'checking',
        posted_by: message.author.username
      });
      
      await delay(1000); // Allow propagation
      
      // Verify in all three services
      // 1. Monitor local storage
      const monitorStreams = await axios.get('http://localhost:3001/streams');
      expect(monitorStreams.data.length).toBe(1);
      expect(monitorStreams.data[0].url).toBe(testUrl);
      
      // 2. StreamSource API
      const apiStreams = await axios.get('http://localhost:3000/api/v1/streams', authHeader);
      expect(apiStreams.data.streams.length).toBe(1);
      expect(apiStreams.data.streams[0].url).toBe(testUrl);
      expect(apiStreams.data.streams[0].city).toBe(location.city);
      
      // 3. Sheets (via checker)
      const sheetData = await axios.get('http://localhost:3002/sheets/data');
      expect(sheetData.data.values.length).toBe(1);
      expect(sheetData.data.values[0].url).toBe(testUrl);
    });
    
    test('should handle duplicate streams consistently across services', async () => {
      const testUrl = TEST_URLS.youtube[0];
      
      // Add stream multiple times
      for (let i = 0; i < 3; i++) {
        await mockMonitor.processStream({
          url: testUrl,
          platform: 'youtube',
          status: 'live',
          posted_by: `user${i}`
        });
        await delay(500);
      }
      
      // Each service should have only one entry
      const monitorStreams = await axios.get('http://localhost:3001/streams');
      const apiStreams = await axios.get('http://localhost:3000/api/v1/streams', authHeader);
      const sheetData = await axios.get('http://localhost:3002/sheets/data');
      
      // Monitor allows duplicates in this mock
      expect(monitorStreams.data.filter(s => s.url === testUrl).length).toBe(3);
      
      // API should deduplicate
      expect(apiStreams.data.streams.filter(s => s.url === testUrl).length).toBe(1);
      
      // Sheets should reject duplicates
      expect(sheetData.data.values.filter(s => s.url === testUrl).length).toBe(1);
    });
  });
  
  describe('Status Update Consistency', () => {
    test('should propagate status updates across all services', async () => {
      const testUrl = TEST_URLS.kick[0];
      
      // Add stream
      await mockMonitor.processStream({
        url: testUrl,
        platform: 'kick',
        status: 'checking',
        posted_by: 'testuser'
      });
      
      await delay(1000);
      
      // Update status in StreamSource
      const apiStreams = await axios.get('http://localhost:3000/api/v1/streams', authHeader);
      const stream = apiStreams.data.streams[0];
      
      await axios.patch(
        `http://localhost:3000/api/v1/streams/${stream.id}`,
        { status: 'live' },
        authHeader
      );
      
      // Update in sheets
      await axios.post('http://localhost:3002/sheets/update-status', {
        url: testUrl,
        status: 'live'
      });
      
      // Verify consistency
      const updatedApiStreams = await axios.get('http://localhost:3000/api/v1/streams', authHeader);
      const sheetData = await axios.get('http://localhost:3002/sheets/data');
      
      expect(updatedApiStreams.data.streams[0].status).toBe('live');
      expect(sheetData.data.values[0].status).toBe('live');
    });
  });
  
  describe('Filtering and Search Consistency', () => {
    test('should return consistent results when filtering by platform', async () => {
      // Add streams from different platforms
      const streams = [
        { url: TEST_URLS.twitch[0], platform: 'twitch', status: 'live' },
        { url: TEST_URLS.twitch[1], platform: 'twitch', status: 'offline' },
        { url: TEST_URLS.youtube[0], platform: 'youtube', status: 'live' },
        { url: TEST_URLS.kick[0], platform: 'kick', status: 'live' }
      ];
      
      for (const stream of streams) {
        await mockMonitor.processStream({
          ...stream,
          posted_by: 'testuser'
        });
      }
      
      await delay(1500);
      
      // Filter by platform in API
      const twitchStreams = await axios.get(
        'http://localhost:3000/api/v1/streams?platform=twitch',
        authHeader
      );
      
      expect(twitchStreams.data.streams.length).toBe(2);
      expect(twitchStreams.data.streams.every(s => s.platform === 'twitch')).toBe(true);
      
      // Filter by status
      const liveStreams = await axios.get(
        'http://localhost:3000/api/v1/streams?status=live',
        authHeader
      );
      
      expect(liveStreams.data.streams.length).toBe(3);
      expect(liveStreams.data.streams.every(s => s.status === 'live')).toBe(true);
    });
    
    test('should return consistent results when filtering by location', async () => {
      // Add streams from different locations
      const streams = [
        { url: TEST_URLS.twitch[0], platform: 'twitch', city: 'Seattle', state: 'WA' },
        { url: TEST_URLS.youtube[0], platform: 'youtube', city: 'Seattle', state: 'WA' },
        { url: TEST_URLS.kick[0], platform: 'kick', city: 'Portland', state: 'OR' }
      ];
      
      for (const stream of streams) {
        await mockMonitor.processStream({
          ...stream,
          status: 'live',
          posted_by: 'testuser'
        });
      }
      
      await delay(1500);
      
      // Filter by city
      const seattleStreams = await axios.get(
        'http://localhost:3000/api/v1/streams?city=Seattle',
        authHeader
      );
      
      expect(seattleStreams.data.streams.length).toBe(2);
      expect(seattleStreams.data.streams.every(s => s.city === 'Seattle')).toBe(true);
    });
  });
  
  describe('Audit Trail', () => {
    test('should maintain audit trail of all changes', async () => {
      const testUrl = TEST_URLS.facebook[0];
      
      // Create stream
      await mockMonitor.processStream({
        url: testUrl,
        platform: 'facebook',
        status: 'checking',
        posted_by: 'user1'
      });
      
      await delay(1000);
      
      // Update stream
      const apiStreams = await axios.get('http://localhost:3000/api/v1/streams', authHeader);
      const stream = apiStreams.data.streams[0];
      
      await axios.patch(
        `http://localhost:3000/api/v1/streams/${stream.id}`,
        { status: 'live' },
        authHeader
      );
      
      // Check audit trail
      const updates = await axios.get('http://localhost:3000/api/v1/updates', authHeader);
      
      expect(updates.data.length).toBe(2); // create + update
      expect(updates.data[0].action).toBe('created');
      expect(updates.data[1].action).toBe('updated');
      expect(updates.data[1].stream_id).toBe(stream.id);
    });
  });
  
  describe('Data Recovery', () => {
    test('should be able to reconstruct data from any service', async () => {
      // Add multiple streams
      const testStreams = [
        { url: TEST_URLS.twitch[0], platform: 'twitch', city: 'Denver', state: 'CO' },
        { url: TEST_URLS.youtube[0], platform: 'youtube', city: 'Austin', state: 'TX' },
        { url: TEST_URLS.kick[0], platform: 'kick', city: 'Miami', state: 'FL' }
      ];
      
      for (const stream of testStreams) {
        await mockMonitor.processStream({
          ...stream,
          status: 'live',
          posted_by: 'testuser'
        });
      }
      
      await delay(2000);
      
      // Get data from each service
      const monitorData = await axios.get('http://localhost:3001/streams');
      const apiData = await axios.get('http://localhost:3000/api/v1/streams', authHeader);
      const sheetData = await axios.get('http://localhost:3002/sheets/data');
      
      // Verify all services have the data
      expect(monitorData.data.length).toBe(3);
      expect(apiData.data.streams.length).toBe(3);
      expect(sheetData.data.values.length).toBe(3);
      
      // Verify data integrity
      for (const testStream of testStreams) {
        // Check in API
        const apiStream = apiData.data.streams.find(s => s.url === testStream.url);
        expect(apiStream).toBeDefined();
        expect(apiStream.platform).toBe(testStream.platform);
        expect(apiStream.city).toBe(testStream.city);
        expect(apiStream.state).toBe(testStream.state);
        
        // Check in sheets
        const sheetStream = sheetData.data.values.find(s => s.url === testStream.url);
        expect(sheetStream).toBeDefined();
        expect(sheetStream.platform).toBe(testStream.platform);
      }
    });
  });
  
  describe('Performance Under Load', () => {
    test('should maintain consistency under concurrent operations', async () => {
      const operations = [];
      
      // Add 10 streams concurrently
      for (let i = 0; i < 10; i++) {
        operations.push(
          mockMonitor.processStream({
            url: `https://twitch.tv/stream${i}`,
            platform: 'twitch',
            status: 'live',
            posted_by: `user${i}`,
            city: TEST_LOCATIONS[i % TEST_LOCATIONS.length].city,
            state: TEST_LOCATIONS[i % TEST_LOCATIONS.length].state
          })
        );
      }
      
      await Promise.all(operations);
      await delay(2000);
      
      // Verify all services have all streams
      const apiData = await axios.get('http://localhost:3000/api/v1/streams', authHeader);
      const sheetData = await axios.get('http://localhost:3002/sheets/data');
      
      expect(apiData.data.streams.length).toBe(10);
      expect(sheetData.data.values.length).toBe(10);
      
      // Verify no data corruption
      const urls = new Set();
      for (const stream of apiData.data.streams) {
        expect(stream.url).toMatch(/^https:\/\/twitch\.tv\/stream\d$/);
        expect(stream.platform).toBe('twitch');
        expect(stream.city).toBeDefined();
        expect(stream.state).toBeDefined();
        urls.add(stream.url);
      }
      
      // All URLs should be unique
      expect(urls.size).toBe(10);
    });
  });
});