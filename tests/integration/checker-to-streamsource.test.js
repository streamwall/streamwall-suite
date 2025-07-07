/**
 * Livesheet Checker to StreamSource Integration Tests
 * Tests the synchronization between livesheet-checker and StreamSource API
 */

const axios = require('axios');
const { delay } = require('../helpers/test-data');

// Mock Google Sheets data structure
class MockGoogleSheets {
  constructor() {
    this.sheets = {
      'main': {
        values: [
          ['URL', 'Platform', 'City', 'State', 'Status', 'Last Checked', 'Added By', 'Added Date'],
          // Initial data will be added by tests
        ]
      }
    };
  }
  
  getValues(sheetName = 'main') {
    return this.sheets[sheetName].values;
  }
  
  appendRow(sheetName = 'main', row) {
    this.sheets[sheetName].values.push(row);
  }
  
  updateRow(sheetName = 'main', rowIndex, row) {
    this.sheets[sheetName].values[rowIndex] = row;
  }
  
  findRowByUrl(url, sheetName = 'main') {
    const values = this.sheets[sheetName].values;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === url) {
        return { index: i, data: values[i] };
      }
    }
    return null;
  }
}

// Mock livesheet-checker that syncs with StreamSource
class MockLivesheetChecker {
  constructor(port = 3002, streamSourceUrl = 'http://localhost:3000/api/v1') {
    this.port = port;
    this.express = require('express');
    this.app = this.express();
    this.server = null;
    this.streamSourceUrl = streamSourceUrl;
    this.streamSourceApiKey = 'test-api-key';
    this.sheets = new MockGoogleSheets();
    this.checkInterval = null;
    this.syncEnabled = true;
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.use(this.express.json());
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        syncEnabled: this.syncEnabled,
        sheetsConnected: true
      });
    });
    
    // Get current sheet data
    this.app.get('/sheets/data', (req, res) => {
      res.json({
        values: this.sheets.getValues(),
        lastUpdated: new Date().toISOString()
      });
    });
    
    // Add stream to sheets
    this.app.post('/sheets/add', (req, res) => {
      const { url, platform, city, state, status = 'checking', addedBy = 'api' } = req.body;
      
      // Check if already exists
      const existing = this.sheets.findRowByUrl(url);
      if (existing) {
        return res.status(409).json({ error: 'Stream already exists', row: existing });
      }
      
      const row = [
        url,
        platform,
        city || '',
        state || '',
        status,
        new Date().toISOString(),
        addedBy,
        new Date().toISOString()
      ];
      
      this.sheets.appendRow('main', row);
      
      // Sync to StreamSource if enabled
      if (this.syncEnabled) {
        this.syncStreamToAPI({
          url, platform, city, state, status, posted_by: addedBy
        }).catch(err => console.error('Sync failed:', err.message));
      }
      
      res.json({ success: true, row });
    });
    
    // Update stream status
    this.app.post('/sheets/update-status', async (req, res) => {
      const { url, status } = req.body;
      
      const row = this.sheets.findRowByUrl(url);
      if (!row) {
        return res.status(404).json({ error: 'Stream not found' });
      }
      
      // Update status and last checked time
      row.data[4] = status;
      row.data[5] = new Date().toISOString();
      this.sheets.updateRow('main', row.index, row.data);
      
      // Sync to StreamSource
      if (this.syncEnabled) {
        try {
          await this.updateStreamInAPI(url, { status });
          res.json({ success: true, syncedToApi: true });
        } catch (error) {
          res.json({ success: true, syncedToApi: false, error: error.message });
        }
      } else {
        res.json({ success: true });
      }
    });
    
    // Check all streams
    this.app.post('/check-all', async (req, res) => {
      const values = this.sheets.getValues();
      const results = [];
      
      // Skip header row
      for (let i = 1; i < values.length; i++) {
        const [url, platform] = values[i];
        
        // Simulate checking stream status
        const isLive = Math.random() > 0.5; // Random for testing
        const newStatus = isLive ? 'live' : 'offline';
        
        // Update sheet
        values[i][4] = newStatus;
        values[i][5] = new Date().toISOString();
        
        // Sync to API
        if (this.syncEnabled) {
          try {
            await this.updateStreamInAPI(url, { status: newStatus });
            results.push({ url, status: newStatus, synced: true });
          } catch (error) {
            results.push({ url, status: newStatus, synced: false, error: error.message });
          }
        } else {
          results.push({ url, status: newStatus });
        }
      }
      
      res.json({ checked: results.length, results });
    });
    
    // Sync configuration
    this.app.post('/config/sync', (req, res) => {
      this.syncEnabled = req.body.enabled !== false;
      res.json({ syncEnabled: this.syncEnabled });
    });
    
    // Start/stop periodic checking
    this.app.post('/checking/start', (req, res) => {
      const interval = req.body.interval || 60000; // Default 1 minute
      
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }
      
      this.checkInterval = setInterval(async () => {
        try {
          await axios.post(`http://localhost:${this.port}/check-all`);
        } catch (error) {
          console.error('Check cycle failed:', error.message);
        }
      }, interval);
      
      res.json({ started: true, interval });
    });
    
    this.app.post('/checking/stop', (req, res) => {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      res.json({ stopped: true });
    });
    
    // Reset
    this.app.post('/reset', (req, res) => {
      this.sheets = new MockGoogleSheets();
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      res.json({ success: true });
    });
  }
  
  async syncStreamToAPI(streamData) {
    const response = await axios.post(
      `${this.streamSourceUrl}/streams`,
      streamData,
      {
        headers: {
          'Authorization': `Bearer ${this.streamSourceApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }
  
  async updateStreamInAPI(url, updates) {
    // First, find the stream by URL
    const searchResponse = await axios.get(
      `${this.streamSourceUrl}/streams`,
      {
        headers: { 'Authorization': `Bearer ${this.streamSourceApiKey}` }
      }
    );
    
    const stream = searchResponse.data.streams.find(s => s.url === url);
    if (!stream) {
      throw new Error('Stream not found in API');
    }
    
    // Update the stream
    const updateResponse = await axios.patch(
      `${this.streamSourceUrl}/streams/${stream.id}`,
      updates,
      {
        headers: {
          'Authorization': `Bearer ${this.streamSourceApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return updateResponse.data;
  }
  
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock livesheet-checker listening on port ${this.port}`);
        resolve();
      });
    });
  }
  
  async stop() {
    return new Promise((resolve) => {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }
      if (this.server) {
        this.server.close(() => {
          console.log('Mock livesheet-checker stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Simplified mock StreamSource for these tests
class MockStreamSourceForChecker {
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
      if (!this.checkAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const stream = {
        id: this.streams.length + 1,
        ...req.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      this.streams.push(stream);
      res.status(201).json(stream);
    });
    
    this.app.get('/api/v1/streams', (req, res) => {
      if (!this.checkAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      res.json({
        streams: this.streams,
        meta: { total_count: this.streams.length }
      });
    });
    
    this.app.patch('/api/v1/streams/:id', (req, res) => {
      if (!this.checkAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const id = parseInt(req.params.id);
      const stream = this.streams.find(s => s.id === id);
      
      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }
      
      Object.assign(stream, req.body, { updated_at: new Date().toISOString() });
      res.json(stream);
    });
    
    this.app.post('/api/v1/reset', (req, res) => {
      this.streams = [];
      res.json({ success: true });
    });
  }
  
  checkAuth(req) {
    const authHeader = req.headers['authorization'];
    return authHeader && authHeader.startsWith('Bearer ');
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

describe('Livesheet Checker to StreamSource Integration', () => {
  let mockChecker;
  let mockStreamSource;
  const checkerUrl = 'http://localhost:3002';
  const apiUrl = 'http://localhost:3000/api/v1';
  const authToken = 'test-api-key';
  
  beforeAll(async () => {
    mockStreamSource = new MockStreamSourceForChecker();
    await mockStreamSource.start();
    
    mockChecker = new MockLivesheetChecker();
    await mockChecker.start();
  });
  
  afterAll(async () => {
    await mockChecker?.stop();
    await mockStreamSource?.stop();
  });
  
  afterEach(async () => {
    await axios.post(`${checkerUrl}/reset`).catch(() => {});
    await axios.post(`${apiUrl}/reset`).catch(() => {});
  });
  
  describe('Stream Addition and Sync', () => {
    test('should add stream to sheets and sync to StreamSource', async () => {
      const streamData = {
        url: 'https://twitch.tv/teststream',
        platform: 'twitch',
        city: 'Austin',
        state: 'TX',
        status: 'checking',
        addedBy: 'test_user'
      };
      
      // Add to sheets
      const response = await axios.post(`${checkerUrl}/sheets/add`, streamData);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      // Verify in sheets
      const sheetData = await axios.get(`${checkerUrl}/sheets/data`);
      expect(sheetData.data.values.length).toBe(2); // Header + 1 stream
      expect(sheetData.data.values[1][0]).toBe(streamData.url);
      
      // Verify synced to StreamSource
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(apiStreams.data.streams.length).toBe(1);
      expect(apiStreams.data.streams[0].url).toBe(streamData.url);
      expect(apiStreams.data.streams[0].city).toBe(streamData.city);
    });
    
    test('should handle duplicate streams', async () => {
      const streamData = {
        url: 'https://youtube.com/watch?v=test123',
        platform: 'youtube',
        status: 'live'
      };
      
      // Add first time
      const response1 = await axios.post(`${checkerUrl}/sheets/add`, streamData);
      expect(response1.status).toBe(200);
      
      // Try to add duplicate
      const response2 = await axios.post(`${checkerUrl}/sheets/add`, streamData);
      expect(response2.status).toBe(409);
      expect(response2.data.error).toContain('already exists');
    });
  });
  
  describe('Status Updates', () => {
    test('should update stream status in sheets and API', async () => {
      // First add a stream
      const streamData = {
        url: 'https://kick.com/teststream',
        platform: 'kick',
        status: 'checking'
      };
      
      await axios.post(`${checkerUrl}/sheets/add`, streamData);
      
      // Update status
      const updateResponse = await axios.post(`${checkerUrl}/sheets/update-status`, {
        url: streamData.url,
        status: 'live'
      });
      
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.syncedToApi).toBe(true);
      
      // Verify in sheets
      const sheetData = await axios.get(`${checkerUrl}/sheets/data`);
      const streamRow = sheetData.data.values[1];
      expect(streamRow[4]).toBe('live'); // Status column
      expect(streamRow[5]).toBeDefined(); // Last checked timestamp
      
      // Verify in API
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(apiStreams.data.streams[0].status).toBe('live');
    });
    
    test('should handle API sync failures gracefully', async () => {
      // Add a stream
      await axios.post(`${checkerUrl}/sheets/add`, {
        url: 'https://tiktok.com/@test/live',
        platform: 'tiktok'
      });
      
      // Stop API to simulate failure
      await mockStreamSource.stop();
      
      // Update status
      const updateResponse = await axios.post(`${checkerUrl}/sheets/update-status`, {
        url: 'https://tiktok.com/@test/live',
        status: 'offline'
      });
      
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.success).toBe(true);
      expect(updateResponse.data.syncedToApi).toBe(false);
      
      // Verify sheet was still updated
      const sheetData = await axios.get(`${checkerUrl}/sheets/data`);
      expect(sheetData.data.values[1][4]).toBe('offline');
      
      // Restart API
      mockStreamSource = new MockStreamSourceForChecker();
      await mockStreamSource.start();
    });
  });
  
  describe('Bulk Checking', () => {
    test('should check all streams and sync status updates', async () => {
      // Add multiple streams
      const streams = [
        { url: 'https://twitch.tv/stream1', platform: 'twitch' },
        { url: 'https://youtube.com/stream2', platform: 'youtube' },
        { url: 'https://kick.com/stream3', platform: 'kick' }
      ];
      
      for (const stream of streams) {
        await axios.post(`${checkerUrl}/sheets/add`, stream);
      }
      
      // Check all streams
      const checkResponse = await axios.post(`${checkerUrl}/check-all`);
      expect(checkResponse.status).toBe(200);
      expect(checkResponse.data.checked).toBe(3);
      expect(checkResponse.data.results.every(r => r.synced)).toBe(true);
      
      // Verify all statuses updated in API
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(apiStreams.data.streams.length).toBe(3);
      for (const stream of apiStreams.data.streams) {
        expect(['live', 'offline']).toContain(stream.status);
        expect(stream.updated_at).toBeDefined();
      }
    });
  });
  
  describe('Periodic Checking', () => {
    test('should start and stop periodic checking', async () => {
      // Add a stream to check
      await axios.post(`${checkerUrl}/sheets/add`, {
        url: 'https://twitch.tv/periodictest',
        platform: 'twitch'
      });
      
      // Start periodic checking with short interval
      const startResponse = await axios.post(`${checkerUrl}/checking/start`, {
        interval: 100 // 100ms for testing
      });
      expect(startResponse.data.started).toBe(true);
      
      // Wait for at least one check cycle
      await delay(300);
      
      // Stop checking
      const stopResponse = await axios.post(`${checkerUrl}/checking/stop`);
      expect(stopResponse.data.stopped).toBe(true);
      
      // Verify stream was checked (status should be updated)
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const stream = apiStreams.data.streams[0];
      expect(['live', 'offline']).toContain(stream.status);
    });
  });
  
  describe('Sync Configuration', () => {
    test('should disable sync when configured', async () => {
      // Disable sync
      await axios.post(`${checkerUrl}/config/sync`, { enabled: false });
      
      // Add stream
      await axios.post(`${checkerUrl}/sheets/add`, {
        url: 'https://youtube.com/nosync',
        platform: 'youtube'
      });
      
      // Verify not synced to API
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      expect(apiStreams.data.streams.length).toBe(0);
      
      // Re-enable sync
      await axios.post(`${checkerUrl}/config/sync`, { enabled: true });
    });
  });
  
  describe('Data Consistency', () => {
    test('should maintain consistency between sheets and API', async () => {
      // Add multiple streams
      const testStreams = [
        { url: 'https://twitch.tv/consistency1', platform: 'twitch', city: 'Denver', state: 'CO' },
        { url: 'https://youtube.com/consistency2', platform: 'youtube', city: 'Miami', state: 'FL' }
      ];
      
      for (const stream of testStreams) {
        await axios.post(`${checkerUrl}/sheets/add`, stream);
      }
      
      // Update statuses
      await axios.post(`${checkerUrl}/sheets/update-status`, {
        url: testStreams[0].url,
        status: 'live'
      });
      
      await axios.post(`${checkerUrl}/sheets/update-status`, {
        url: testStreams[1].url,
        status: 'offline'
      });
      
      // Verify consistency
      const sheetData = await axios.get(`${checkerUrl}/sheets/data`);
      const apiStreams = await axios.get(`${apiUrl}/streams`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      // Sheet should have header + 2 streams
      expect(sheetData.data.values.length).toBe(3);
      
      // API should have same 2 streams
      expect(apiStreams.data.streams.length).toBe(2);
      
      // Verify data matches
      for (let i = 0; i < testStreams.length; i++) {
        const sheetRow = sheetData.data.values[i + 1];
        const apiStream = apiStreams.data.streams.find(s => s.url === testStreams[i].url);
        
        expect(apiStream).toBeDefined();
        expect(sheetRow[0]).toBe(apiStream.url); // URL
        expect(sheetRow[1]).toBe(apiStream.platform); // Platform
        expect(sheetRow[2]).toBe(apiStream.city || ''); // City
        expect(sheetRow[3]).toBe(apiStream.state || ''); // State
        expect(sheetRow[4]).toBe(apiStream.status); // Status
      }
    });
  });
});