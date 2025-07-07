/**
 * Livestream Monitor to StreamSource Integration Tests
 * Tests the communication between livestream-link-monitor and StreamSource API
 */

const axios = require('axios');
const MockLivestreamMonitor = require('../helpers/mock-livestream-monitor');
const {
  generateDiscordMessage,
  generateTwitchMessage,
  TEST_URLS,
  TEST_LOCATIONS,
  delay
} = require('../helpers/test-data');

// Mock StreamSource API (simplified)
class SimpleMockStreamSource {
  constructor(port = 3000) {
    this.port = port;
    this.express = require('express');
    this.app = this.express();
    this.server = null;
    this.streams = [];
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.use(this.express.json());
    
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    
    this.app.post('/api/v1/streams', (req, res) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('StreamSource API: Unauthorized request');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      console.log('StreamSource API: Received stream creation request:', JSON.stringify(req.body));
      
      const stream = {
        id: this.streams.length + 1,
        ...req.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Check for duplicates by 'link' field (which is what the mock sends)
      const existing = this.streams.find(s => s.link === stream.link || s.url === stream.link);
      if (existing) {
        // Update existing stream
        Object.assign(existing, req.body, { updated_at: new Date().toISOString() });
        return res.json(existing);
      }
      
      // Normalize the URL field
      if (stream.link && !stream.url) {
        stream.url = stream.link;
      }
      
      this.streams.push(stream);
      res.status(201).json(stream);
    });
    
    this.app.get('/api/v1/streams', (req, res) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      res.json({
        streams: this.streams,
        meta: { total_count: this.streams.length }
      });
    });
    
    this.app.post('/api/v1/reset', (req, res) => {
      this.streams = [];
      res.json({ success: true });
    });
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

describe('Livestream Monitor to StreamSource Integration', () => {
  let mockMonitor;
  let mockStreamSource;
  const monitorUrl = 'http://localhost:3001';
  const apiUrl = 'http://localhost:3000/api/v1';
  const authToken = 'test-api-key';
  
  // Remove the EnhancedMockMonitor class since we'll use the updated base mock
  
  beforeAll(async () => {
    mockStreamSource = new SimpleMockStreamSource();
    await mockStreamSource.start();
    
    mockMonitor = new MockLivestreamMonitor(3001, {
      dualWriteMode: true,
      streamSourceUrl: 'http://localhost:3000/api/v1'
    });
    await mockMonitor.start();
    
    // Set the auth token
    await axios.post(`${monitorUrl}/auth/streamsource`, { token: authToken });
  });
  
  afterAll(async () => {
    await mockMonitor?.stop();
    await mockStreamSource?.stop();
  });
  
  afterEach(async () => {
    await axios.post(`${monitorUrl}/reset`).catch(() => {});
    await axios.post(`${apiUrl}/reset`).catch(() => {});
  });
  
  describe('Dual Write Mode', () => {
    test('should push streams to both local storage and StreamSource API', async () => {
      // Ensure dual-write mode is enabled
      await axios.post(`${monitorUrl}/config/dual-write`, { enabled: true });
      
      // Verify auth token is set
      const syncStatus = await axios.get(`${monitorUrl}/sync-status`);
      console.log('Sync status before test:', syncStatus.data);
      
      // Send Discord message with stream
      const testUrl = TEST_URLS.twitch[0];
      const location = TEST_LOCATIONS[0];
      const message = generateDiscordMessage(
        `🔴 LIVE from ${location.city}, ${location.state}: ${testUrl}`
      );
      
      const response = await axios.post(`${monitorUrl}/webhook/discord`, {
        type: 'MESSAGE_CREATE',
        data: message
      });
      
      expect(response.status).toBe(200);
      expect(response.data.results[0].syncedToApi).toBe(true);
      
      // Verify stream exists in monitor's local storage
      const monitorStreams = await axios.get(`${monitorUrl}/streams`);
      expect(monitorStreams.data.length).toBe(1);
      expect(monitorStreams.data[0].url).toBe(testUrl);
      
      // Verify stream was pushed to StreamSource
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(apiStreams.data.streams.length).toBe(1);
      expect(apiStreams.data.streams[0].url).toBe(testUrl);
      expect(apiStreams.data.streams[0].city).toBe(location.city);
      expect(apiStreams.data.streams[0].state).toBe(location.state);
    });
    
    test('should handle StreamSource API failures gracefully', async () => {
      // Stop StreamSource to simulate failure
      await mockStreamSource.stop();
      
      const testUrl = TEST_URLS.youtube[0];
      const message = generateDiscordMessage(`Check out: ${testUrl}`);
      
      const response = await axios.post(`${monitorUrl}/webhook/discord`, {
        type: 'MESSAGE_CREATE',
        data: message
      });
      
      expect(response.status).toBe(200);
      expect(response.data.results[0].success).toBe(true);
      expect(response.data.results[0].syncedToApi).toBe(false);
      
      // Stream should still be saved locally
      const monitorStreams = await axios.get(`${monitorUrl}/streams`);
      expect(monitorStreams.data.length).toBe(1);
      
      // Restart StreamSource for other tests
      mockStreamSource = new SimpleMockStreamSource();
      await mockStreamSource.start();
      
      // Re-enable dual-write mode
      await axios.post(`${monitorUrl}/config/dual-write`, { enabled: true });
    });
    
    test('should disable dual-write mode when configured', async () => {
      // Disable dual-write mode
      await axios.post(`${monitorUrl}/config/dual-write`, { enabled: false });
      
      const testUrl = TEST_URLS.kick[0];
      const message = generateDiscordMessage(`Stream: ${testUrl}`);
      
      const response = await axios.post(`${monitorUrl}/webhook/discord`, {
        type: 'MESSAGE_CREATE',
        data: message
      });
      
      expect(response.status).toBe(200);
      expect(response.data.results[0].syncedToApi).toBeUndefined();
      
      // Verify stream exists locally
      const monitorStreams = await axios.get(`${monitorUrl}/streams`);
      expect(monitorStreams.data.length).toBe(1);
      
      // Verify stream was NOT pushed to StreamSource
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(apiStreams.data.streams.length).toBe(0);
      
      // Re-enable for other tests
      await axios.post(`${monitorUrl}/config/dual-write`, { enabled: true });
    });
  });
  
  describe('Duplicate Handling', () => {
    test('should handle duplicate URLs across services', async () => {
      const testUrl = TEST_URLS.tiktok[0];
      const message = generateDiscordMessage(`Live: ${testUrl}`);
      
      // Send first time
      const response1 = await axios.post(`${monitorUrl}/webhook/discord`, {
        type: 'MESSAGE_CREATE',
        data: message
      });
      expect(response1.data.results[0].success).toBe(true);
      
      // Send duplicate
      const response2 = await axios.post(`${monitorUrl}/webhook/discord`, {
        type: 'MESSAGE_CREATE',
        data: message
      });
      expect(response2.data.results[0].success).toBe(false);
      expect(response2.data.results[0].reason).toBe('duplicate');
      
      // Verify only one stream in each service
      const monitorStreams = await axios.get(`${monitorUrl}/streams`);
      expect(monitorStreams.data.length).toBe(1);
      
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(apiStreams.data.streams.length).toBe(1);
    });
  });
  
  describe('Batch Processing', () => {
    test('should handle multiple streams in a single message', async () => {
      const urls = [
        TEST_URLS.twitch[0],
        TEST_URLS.youtube[0],
        TEST_URLS.kick[0]
      ];
      
      const message = generateDiscordMessage(
        `Multiple streams today!
        Stream 1 from Seattle, WA: ${urls[0]}
        Stream 2 from Portland, OR: ${urls[1]}
        Stream 3 from San Francisco, CA: ${urls[2]}`
      );
      
      const response = await axios.post(`${monitorUrl}/webhook/discord`, {
        type: 'MESSAGE_CREATE',
        data: message
      });
      
      expect(response.status).toBe(200);
      expect(response.data.results).toHaveLength(3);
      expect(response.data.results.every(r => r.success && r.syncedToApi)).toBe(true);
      
      // Verify all streams in both services
      const monitorStreams = await axios.get(`${monitorUrl}/streams`);
      expect(monitorStreams.data.length).toBe(3);
      
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(apiStreams.data.streams.length).toBe(3);
      
      // Verify locations were parsed correctly
      const seattleStream = apiStreams.data.streams.find(s => s.url === urls[0]);
      expect(seattleStream.city).toBe('Seattle');
      expect(seattleStream.state).toBe('WA');
    });
  });
  
  describe('Sync Status', () => {
    test('should provide sync status information', async () => {
      // Add some streams
      const urls = [TEST_URLS.twitch[0], TEST_URLS.youtube[0]];
      for (const url of urls) {
        await axios.post(`${monitorUrl}/webhook/discord`, {
          type: 'MESSAGE_CREATE',
          data: generateDiscordMessage(`Stream: ${url}`)
        });
      }
      
      // Check sync status
      const status = await axios.get(`${monitorUrl}/sync-status`);
      expect(status.data.dualWriteMode).toBe(true);
      expect(status.data.streamSourceUrl).toContain('api/v1');
      expect(status.data.processedCount).toBe(2);
      expect(status.data.processedUrls).toHaveLength(2);
    });
  });
  
  describe('Platform-Specific Handling', () => {
    test('should correctly identify and sync different platforms', async () => {
      const platforms = Object.keys(TEST_URLS);
      
      for (const platform of platforms) {
        const url = TEST_URLS[platform][0];
        const message = generateDiscordMessage(`${platform} stream: ${url}`);
        
        const response = await axios.post(`${monitorUrl}/webhook/discord`, {
          type: 'MESSAGE_CREATE',
          data: message
        });
        
        expect(response.status).toBe(200);
      }
      
      // Verify all platforms in StreamSource
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(apiStreams.data.streams.length).toBe(platforms.length);
      
      // Check each platform
      for (const platform of platforms) {
        const stream = apiStreams.data.streams.find(s => s.platform === platform);
        expect(stream).toBeDefined();
        expect(stream.url).toBe(TEST_URLS[platform][0]);
      }
    });
  });
});