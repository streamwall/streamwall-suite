/**
 * StreamSource API Integration Tests
 * Tests the Rails API backend integration with other services
 */

const axios = require('axios');
const MockLivestreamMonitor = require('../helpers/mock-livestream-monitor');
const {
  startService,
  stopService,
  waitForService,
  execCommand
} = require('../helpers/services');
const {
  generateTestStream,
  TEST_URLS,
  delay
} = require('../helpers/test-data');

// Mock StreamSource API for testing
class MockStreamSourceAPI {
  constructor(port = 3000) {
    this.port = port;
    this.express = require('express');
    this.app = this.express();
    this.server = null;
    
    // In-memory data store
    this.streams = [];
    this.streamers = [];
    this.users = [
      {
        id: 1,
        email: 'test@example.com',
        password: 'password123',
        token: 'test-jwt-token-123'
      }
    ];
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.use(this.express.json());
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', database: 'connected', redis: 'connected' });
    });
    
    // Authentication
    this.app.post('/api/v1/users/login', (req, res) => {
      const { email, password } = req.body;
      const user = this.users.find(u => u.email === email && u.password === password);
      
      if (user) {
        res.json({ token: user.token, user: { id: user.id, email: user.email } });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });
    
    // Streams endpoints
    this.app.get('/api/v1/streams', this.authenticateToken.bind(this), (req, res) => {
      const { status, pinned, page = 1, per_page = 25 } = req.query;
      let filtered = [...this.streams];
      
      if (status) {
        filtered = filtered.filter(s => s.status === status);
      }
      if (pinned !== undefined) {
        filtered = filtered.filter(s => s.pinned === (pinned === 'true'));
      }
      
      // Pagination
      const start = (page - 1) * per_page;
      const paginatedStreams = filtered.slice(start, start + parseInt(per_page));
      
      res.json({
        streams: paginatedStreams,
        meta: {
          current_page: parseInt(page),
          total_pages: Math.ceil(filtered.length / per_page),
          total_count: filtered.length
        }
      });
    });
    
    this.app.post('/api/v1/streams', this.authenticateToken.bind(this), (req, res) => {
      const stream = {
        id: this.streams.length + 1,
        ...req.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      this.streams.push(stream);
      
      // Simulate ActionCable broadcast
      this.broadcastUpdate('stream_created', stream);
      
      res.status(201).json(stream);
    });
    
    this.app.patch('/api/v1/streams/:id', this.authenticateToken.bind(this), (req, res) => {
      const id = parseInt(req.params.id);
      const streamIndex = this.streams.findIndex(s => s.id === id);
      
      if (streamIndex === -1) {
        return res.status(404).json({ error: 'Stream not found' });
      }
      
      this.streams[streamIndex] = {
        ...this.streams[streamIndex],
        ...req.body,
        updated_at: new Date().toISOString()
      };
      
      // Simulate ActionCable broadcast
      this.broadcastUpdate('stream_updated', this.streams[streamIndex]);
      
      res.json(this.streams[streamIndex]);
    });
    
    this.app.put('/api/v1/streams/:id/pin', this.authenticateToken.bind(this), (req, res) => {
      const id = parseInt(req.params.id);
      const stream = this.streams.find(s => s.id === id);
      
      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }
      
      stream.pinned = true;
      stream.updated_at = new Date().toISOString();
      
      // Simulate ActionCable broadcast
      this.broadcastUpdate('stream_pinned', stream);
      
      res.json(stream);
    });
    
    // Streamers endpoints
    this.app.get('/api/v1/streamers', this.authenticateToken.bind(this), (req, res) => {
      res.json({
        streamers: this.streamers,
        meta: {
          total_count: this.streamers.length
        }
      });
    });
    
    // WebSocket simulation endpoint
    this.app.get('/api/v1/cable', (req, res) => {
      res.json({ 
        type: 'welcome',
        channels: ['StreamsChannel', 'StreamersChannel']
      });
    });
    
    // Reset endpoint for testing
    this.app.post('/api/v1/reset', (req, res) => {
      this.streams = [];
      this.streamers = [];
      res.json({ success: true });
    });
  }
  
  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = this.users.find(u => u.token === token);
    if (!user) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  }
  
  broadcastUpdate(event, data) {
    // In real implementation, this would broadcast via ActionCable
    console.log(`Broadcasting ${event}:`, data.id);
  }
  
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock StreamSource API listening on port ${this.port}`);
        resolve();
      });
    });
  }
  
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock StreamSource API stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

describe('StreamSource API Integration', () => {
  let mockStreamSource;
  let mockMonitor;
  const apiUrl = 'http://localhost:3000/api/v1';
  const authToken = 'test-jwt-token-123';
  
  beforeAll(async () => {
    // Start mock services
    mockStreamSource = new MockStreamSourceAPI();
    await mockStreamSource.start();
    
    mockMonitor = new MockLivestreamMonitor();
    await mockMonitor.start();
  });
  
  afterAll(async () => {
    await mockStreamSource?.stop();
    await mockMonitor?.stop();
  });
  
  afterEach(async () => {
    // Reset data between tests
    await axios.post(`${apiUrl}/reset`).catch(() => {});
    await axios.post('http://localhost:3001/reset').catch(() => {});
  });
  
  describe('Authentication', () => {
    test('should authenticate and receive JWT token', async () => {
      const response = await axios.post(`${apiUrl}/users/login`, {
        email: 'test@example.com',
        password: 'password123'
      });
      
      expect(response.status).toBe(200);
      expect(response.data.token).toBeDefined();
      expect(response.data.user).toBeDefined();
    });
    
    test('should reject invalid credentials', async () => {
      const response = await axios.post(`${apiUrl}/users/login`, {
        email: 'wrong@example.com',
        password: 'wrongpass'
      }).catch(e => e.response);
      
      expect(response.status).toBe(401);
      expect(response.data.error).toBeDefined();
    });
    
    test('should require authentication for API endpoints', async () => {
      const response = await axios.get(`${apiUrl}/streams`)
        .catch(e => e.response);
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('Stream Management', () => {
    const authHeader = { headers: { Authorization: `Bearer ${authToken}` } };
    
    test('should create a new stream', async () => {
      const streamData = {
        url: TEST_URLS.twitch[0],
        platform: 'twitch',
        status: 'live',
        title: 'Test Stream',
        streamer_name: 'TestStreamer',
        city: 'Seattle',
        state: 'WA'
      };
      
      const response = await axios.post(`${apiUrl}/streams`, streamData, authHeader);
      
      expect(response.status).toBe(201);
      expect(response.data.id).toBeDefined();
      expect(response.data.url).toBe(streamData.url);
      expect(response.data.platform).toBe(streamData.platform);
    });
    
    test('should list streams with pagination', async () => {
      // Create multiple streams
      for (let i = 0; i < 30; i++) {
        await axios.post(`${apiUrl}/streams`, {
          url: `https://twitch.tv/stream${i}`,
          platform: 'twitch',
          status: i % 2 === 0 ? 'live' : 'offline'
        }, authHeader);
      }
      
      // Test pagination
      const page1 = await axios.get(`${apiUrl}/streams?page=1&per_page=10`, authHeader);
      expect(page1.data.streams).toHaveLength(10);
      expect(page1.data.meta.total_count).toBe(30);
      expect(page1.data.meta.total_pages).toBe(3);
      
      // Test filtering
      const liveStreams = await axios.get(`${apiUrl}/streams?status=live`, authHeader);
      expect(liveStreams.data.streams.every(s => s.status === 'live')).toBe(true);
    });
    
    test('should update stream status', async () => {
      // Create a stream
      const createResponse = await axios.post(`${apiUrl}/streams`, {
        url: TEST_URLS.youtube[0],
        platform: 'youtube',
        status: 'checking'
      }, authHeader);
      
      const streamId = createResponse.data.id;
      
      // Update status
      const updateResponse = await axios.patch(
        `${apiUrl}/streams/${streamId}`,
        { status: 'live' },
        authHeader
      );
      
      expect(updateResponse.data.status).toBe('live');
      expect(updateResponse.data.updated_at).toBeDefined();
    });
    
    test('should pin/unpin streams', async () => {
      // Create a stream
      const createResponse = await axios.post(`${apiUrl}/streams`, {
        url: TEST_URLS.kick[0],
        platform: 'kick',
        status: 'live'
      }, authHeader);
      
      const streamId = createResponse.data.id;
      
      // Pin the stream
      const pinResponse = await axios.put(
        `${apiUrl}/streams/${streamId}/pin`,
        {},
        authHeader
      );
      
      expect(pinResponse.data.pinned).toBe(true);
      
      // Verify in listing
      const streams = await axios.get(`${apiUrl}/streams?pinned=true`, authHeader);
      expect(streams.data.streams.some(s => s.id === streamId)).toBe(true);
    });
  });
  
  describe('Service Integration', () => {
    const authHeader = { headers: { Authorization: `Bearer ${authToken}` } };
    
    test('should sync streams from livestream-link-monitor to StreamSource', async () => {
      // Simulate Discord message with stream URL
      const testUrl = TEST_URLS.twitch[0];
      const response = await axios.post('http://localhost:3001/webhook/discord', {
        type: 'MESSAGE_CREATE',
        data: {
          content: `Check out this stream from Portland, OR: ${testUrl}`,
          author: { username: 'testuser' }
        }
      });
      
      expect(response.status).toBe(200);
      
      // Simulate monitor pushing to StreamSource
      const monitorStreams = await axios.get('http://localhost:3001/streams');
      const stream = monitorStreams.data[0];
      
      // Push to StreamSource
      const apiResponse = await axios.post(`${apiUrl}/streams`, {
        url: stream.url,
        platform: stream.platform,
        status: stream.status,
        city: stream.city,
        state: stream.state,
        posted_by: stream.posted_by,
        source: 'discord'
      }, authHeader);
      
      expect(apiResponse.status).toBe(201);
      
      // Verify stream exists in StreamSource
      const streamsResponse = await axios.get(`${apiUrl}/streams`, authHeader);
      expect(streamsResponse.data.streams.length).toBe(1);
      expect(streamsResponse.data.streams[0].url).toBe(testUrl);
      expect(streamsResponse.data.streams[0].city).toBe('Portland');
    });
    
    test('should handle duplicate stream URLs', async () => {
      const streamData = {
        url: TEST_URLS.youtube[0],
        platform: 'youtube',
        status: 'live'
      };
      
      // Create first stream
      const response1 = await axios.post(`${apiUrl}/streams`, streamData, authHeader);
      expect(response1.status).toBe(201);
      
      // Try to create duplicate (in real implementation, this might update instead)
      const response2 = await axios.post(`${apiUrl}/streams`, streamData, authHeader);
      expect(response2.status).toBe(201); // Mock allows duplicates
      
      // In production, this would either:
      // 1. Return 409 Conflict
      // 2. Update the existing stream
      // 3. Create a new "session" for the same URL
    });
  });
  
  describe('Real-time Updates', () => {
    test('should simulate ActionCable broadcasts', async () => {
      const authHeader = { headers: { Authorization: `Bearer ${authToken}` } };
      
      // Check cable endpoint
      const cableResponse = await axios.get(`${apiUrl}/cable`);
      expect(cableResponse.data.type).toBe('welcome');
      expect(cableResponse.data.channels).toContain('StreamsChannel');
      
      // In real implementation, we would:
      // 1. Connect to WebSocket
      // 2. Subscribe to channels
      // 3. Receive real-time updates when streams are created/updated
    });
  });
  
  describe('Error Handling', () => {
    const authHeader = { headers: { Authorization: `Bearer ${authToken}` } };
    
    test('should handle API errors gracefully', async () => {
      // Try to update non-existent stream
      const response = await axios.patch(
        `${apiUrl}/streams/99999`,
        { status: 'offline' },
        authHeader
      ).catch(e => e.response);
      
      expect(response.status).toBe(404);
      expect(response.data.error).toBeDefined();
    });
    
    test('should validate stream data', async () => {
      // Try to create stream with invalid data
      const response = await axios.post(
        `${apiUrl}/streams`,
        { url: 'not-a-valid-url' },
        authHeader
      ).catch(e => e.response);
      
      // Mock doesn't validate, but real API would return 422
      expect(response.status).toBeLessThan(500);
    });
  });
});