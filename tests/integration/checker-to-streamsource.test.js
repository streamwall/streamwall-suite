/**
 * Checker to StreamSource Integration Test
 * Tests the integration between livesheet-updater and StreamSource API
 * Flow: Google Sheets → livesheet-updater → StreamSource API
 */

const axios = require('axios');
const { delay, TEST_URLS } = require('../helpers/test-data');

// Mock Google Sheets API responses
class MockGoogleSheetsAPI {
  constructor(port = 3301) {
    this.port = port;
    this.app = require('express')();
    this.server = null;
    this.sheets = {
      streams: []
    };
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.use(require('express').json());
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    
    // Get spreadsheet values (simulate Google Sheets API)
    this.app.get('/v4/spreadsheets/:spreadsheetId/values/:range', (req, res) => {
      // Return mock sheet data
      const values = [
        ['URL', 'Platform', 'Status', 'City', 'State', 'Last Checked'],
        ...this.sheets.streams.map(s => [
          s.url,
          s.platform,
          s.status,
          s.city || '',
          s.state || '',
          s.lastChecked || ''
        ])
      ];
      
      res.json({
        range: req.params.range,
        majorDimension: 'ROWS',
        values
      });
    });
    
    // Update spreadsheet values (batch update)
    this.app.post('/v4/spreadsheets/:spreadsheetId/values:batchUpdate', (req, res) => {
      // Process batch updates
      const { data } = req.body;
      data.forEach(update => {
        const row = parseInt(update.range.match(/(\d+)/)[1]) - 2; // Adjust for header
        if (this.sheets.streams[row]) {
          // Update status column (index 2)
          this.sheets.streams[row].status = update.values[0][0];
          this.sheets.streams[row].lastChecked = new Date().toISOString();
        }
      });
      
      res.json({
        spreadsheetId: req.params.spreadsheetId,
        updatedCells: data.length,
        replies: data.map(() => ({ updatedCells: 1 }))
      });
    });
    
    // Add stream (for testing)
    this.app.post('/test/add-stream', (req, res) => {
      this.sheets.streams.push(req.body);
      res.json({ success: true });
    });
    
    // Reset
    this.app.post('/test/reset', (req, res) => {
      this.sheets.streams = [];
      res.json({ success: true });
    });
  }
  
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock Google Sheets API listening on port ${this.port}`);
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

// Mock livesheet-updater service
class MockLivesheetUpdater {
  constructor(port = 3302, options = {}) {
    this.port = port;
    this.app = require('express')();
    this.server = null;
    this.options = {
      sheetsApiUrl: options.sheetsApiUrl || 'http://localhost:3301',
      streamSourceUrl: options.streamSourceUrl || 'http://localhost:3200',
      spreadsheetId: options.spreadsheetId || 'test-sheet-123',
      ...options
    };
    
    this.checkInterval = null;
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.use(require('express').json());
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        checking: !!this.checkInterval,
        config: {
          spreadsheetId: this.options.spreadsheetId,
          streamSourceEnabled: !!this.options.streamSourceUrl
        }
      });
    });
    
    // Manual trigger for checking
    this.app.post('/check', async (req, res) => {
      try {
        const results = await this.checkStreams();
        res.json({ success: true, results });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Start/stop automatic checking
    this.app.post('/start-checking', (req, res) => {
      const interval = req.body.interval || 30000;
      this.startChecking(interval);
      res.json({ success: true, interval });
    });
    
    this.app.post('/stop-checking', (req, res) => {
      this.stopChecking();
      res.json({ success: true });
    });
    
    // Configure StreamSource auth
    this.app.post('/auth/streamsource', (req, res) => {
      this.options.authToken = req.body.token;
      res.json({ success: true });
    });
  }
  
  async checkStreams() {
    // Fetch streams from Google Sheets
    const sheetsResponse = await axios.get(
      `${this.options.sheetsApiUrl}/v4/spreadsheets/${this.options.spreadsheetId}/values/Sheet1!A:F`
    );
    
    const rows = sheetsResponse.data.values.slice(1); // Skip header
    const results = [];
    
    for (let i = 0; i < rows.length; i++) {
      const [url, platform, currentStatus, city, state] = rows[i];
      
      // Simulate stream checking logic
      const isLive = Math.random() > 0.5; // Random for testing
      const newStatus = isLive ? 'live' : 'offline';
      
      // Update Google Sheets if status changed
      if (newStatus !== currentStatus) {
        await this.updateSheetStatus(i + 2, newStatus); // +2 for header and 1-based index
      }
      
      // Sync to StreamSource if enabled
      if (this.options.streamSourceUrl && this.options.authToken) {
        const syncResult = await this.syncToStreamSource({
          url,
          platform,
          status: newStatus,
          city,
          state,
          lastChecked: new Date().toISOString()
        });
        
        results.push({
          url,
          oldStatus: currentStatus,
          newStatus,
          synced: syncResult.success,
          error: syncResult.error
        });
      } else {
        results.push({
          url,
          oldStatus: currentStatus,
          newStatus,
          synced: false,
          reason: 'StreamSource not configured'
        });
      }
    }
    
    return results;
  }
  
  async updateSheetStatus(row, status) {
    await axios.post(
      `${this.options.sheetsApiUrl}/v4/spreadsheets/${this.options.spreadsheetId}/values:batchUpdate`,
      {
        data: [{
          range: `Sheet1!C${row}`,
          values: [[status]]
        }]
      }
    );
  }
  
  async syncToStreamSource(streamData) {
    try {
      // Check if stream exists
      const existingResponse = await axios.get(
        `${this.options.streamSourceUrl}/api/v1/streams`,
        {
          headers: { Authorization: `Bearer ${this.options.authToken}` },
          params: { url: streamData.url }
        }
      ).catch(() => null);
      
      if (existingResponse && existingResponse.data.streams.length > 0) {
        // Update existing stream
        const stream = existingResponse.data.streams[0];
        await axios.patch(
          `${this.options.streamSourceUrl}/api/v1/streams/${stream.id}`,
          { status: streamData.status, last_checked: streamData.lastChecked },
          { headers: { Authorization: `Bearer ${this.options.authToken}` } }
        );
      } else {
        // Create new stream
        await axios.post(
          `${this.options.streamSourceUrl}/api/v1/streams`,
          {
            link: streamData.url,
            platform: streamData.platform,
            status: streamData.status,
            city: streamData.city,
            state: streamData.state
          },
          { headers: { Authorization: `Bearer ${this.options.authToken}` } }
        );
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  startChecking(interval) {
    this.stopChecking();
    this.checkInterval = setInterval(() => {
      this.checkStreams().catch(console.error);
    }, interval);
  }
  
  stopChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock livesheet-updater listening on port ${this.port}`);
        resolve();
      });
    });
  }
  
  async stop() {
    this.stopChecking();
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// Enhanced Mock StreamSource API with update support
class MockStreamSourceAPIWithUpdates {
  constructor(port = 3200) {
    this.port = port;
    this.app = require('express')();
    this.server = null;
    this.streams = [];
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.use(require('express').json());
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    
    // Create stream
    this.app.post('/api/v1/streams', (req, res) => {
      if (!req.headers.authorization || !req.headers.authorization.includes('Bearer')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const { link, platform, city, state, status } = req.body;
      if (!link || !platform) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const existing = this.streams.find(s => s.link === link);
      if (existing) {
        return res.status(409).json({ error: 'Stream already exists', stream: existing });
      }
      
      const stream = {
        id: this.streams.length + 1,
        link,
        platform,
        city: city || null,
        state: state || null,
        status: status || 'offline',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_checked: null
      };
      
      this.streams.push(stream);
      res.status(201).json(stream);
    });
    
    // Get streams with filtering
    this.app.get('/api/v1/streams', (req, res) => {
      if (!req.headers.authorization || !req.headers.authorization.includes('Bearer')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      let streams = [...this.streams];
      
      // Filter by URL if provided
      if (req.query.url) {
        streams = streams.filter(s => s.link === req.query.url);
      }
      
      res.json({ streams, meta: { total_count: streams.length } });
    });
    
    // Update stream
    this.app.patch('/api/v1/streams/:id', (req, res) => {
      if (!req.headers.authorization || !req.headers.authorization.includes('Bearer')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const stream = this.streams.find(s => s.id === parseInt(req.params.id));
      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }
      
      // Update allowed fields
      if (req.body.status !== undefined) stream.status = req.body.status;
      if (req.body.last_checked !== undefined) stream.last_checked = req.body.last_checked;
      if (req.body.city !== undefined) stream.city = req.body.city;
      if (req.body.state !== undefined) stream.state = req.body.state;
      
      stream.updated_at = new Date().toISOString();
      
      res.json(stream);
    });
    
    // Get status summary
    this.app.get('/api/v1/streams/status-summary', (req, res) => {
      if (!req.headers.authorization || !req.headers.authorization.includes('Bearer')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const summary = {
        total: this.streams.length,
        live: this.streams.filter(s => s.status === 'live').length,
        offline: this.streams.filter(s => s.status === 'offline').length,
        unknown: this.streams.filter(s => !['live', 'offline'].includes(s.status)).length
      };
      
      res.json(summary);
    });
    
    // Reset
    this.app.post('/api/v1/reset', (req, res) => {
      this.streams = [];
      res.json({ success: true });
    });
  }
  
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock StreamSource API with updates listening on port ${this.port}`);
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

describe('Livesheet Updater to StreamSource Integration', () => {
  let mockSheets;
  let mockUpdater;
  let mockStreamSource;
  const sheetsPort = 3301;
  const updaterPort = 3302;
  const streamSourcePort = 3200;
  const authToken = 'test-updater-token';

  beforeAll(async () => {
    // Start all mock services
    mockSheets = new MockGoogleSheetsAPI(sheetsPort);
    await mockSheets.start();
    
    mockStreamSource = new MockStreamSourceAPIWithUpdates(streamSourcePort);
    await mockStreamSource.start();
    
    mockUpdater = new MockLivesheetUpdater(updaterPort, {
      sheetsApiUrl: `http://localhost:${sheetsPort}`,
      streamSourceUrl: `http://localhost:${streamSourcePort}`,
      spreadsheetId: 'test-sheet-123'
    });
    await mockUpdater.start();
    
    // Configure auth
    await axios.post(`http://localhost:${updaterPort}/auth/streamsource`, {
      token: authToken
    });
  });

  afterAll(async () => {
    await mockUpdater?.stop();
    await mockStreamSource?.stop();
    await mockSheets?.stop();
  });

  afterEach(async () => {
    // Reset all services
    await axios.post(`http://localhost:${sheetsPort}/test/reset`).catch(() => {});
    await axios.post(`http://localhost:${streamSourcePort}/api/v1/reset`).catch(() => {});
  });

  test('should sync new streams from Google Sheets to StreamSource', async () => {
    // Arrange: Add streams to Google Sheets
    const testStreams = [
      { url: TEST_URLS.twitch[0], platform: 'twitch', status: 'offline', city: 'Seattle', state: 'WA' },
      { url: TEST_URLS.youtube[0], platform: 'youtube', status: 'offline', city: 'Portland', state: 'OR' }
    ];
    
    for (const stream of testStreams) {
      await axios.post(`http://localhost:${sheetsPort}/test/add-stream`, stream);
    }
    
    // Act: Trigger checking
    const checkResponse = await axios.post(`http://localhost:${updaterPort}/check`);
    
    // Assert: Check was successful
    expect(checkResponse.status).toBe(200);
    expect(checkResponse.data.success).toBe(true);
    expect(checkResponse.data.results).toHaveLength(2);
    
    // Assert: Streams were synced to StreamSource
    const streamsResponse = await axios.get(`http://localhost:${streamSourcePort}/api/v1/streams`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    expect(streamsResponse.data.streams).toHaveLength(2);
    
    // Verify stream data
    const syncedStreams = streamsResponse.data.streams;
    expect(syncedStreams[0].link).toBe(TEST_URLS.twitch[0]);
    expect(syncedStreams[0].platform).toBe('twitch');
    expect(syncedStreams[0].city).toBe('Seattle');
    expect(syncedStreams[0].state).toBe('WA');
    
    expect(syncedStreams[1].link).toBe(TEST_URLS.youtube[0]);
    expect(syncedStreams[1].platform).toBe('youtube');
    expect(syncedStreams[1].city).toBe('Portland');
    expect(syncedStreams[1].state).toBe('OR');
  });

  test('should update stream status in both Google Sheets and StreamSource', async () => {
    // Arrange: Add a stream that's initially offline
    const testStream = {
      url: TEST_URLS.kick[0],
      platform: 'kick',
      status: 'offline',
      city: 'Austin',
      state: 'TX'
    };
    
    await axios.post(`http://localhost:${sheetsPort}/test/add-stream`, testStream);
    
    // First check to sync to StreamSource
    await axios.post(`http://localhost:${updaterPort}/check`);
    
    // Act: Trigger another check (will randomly change status)
    const checkResponse = await axios.post(`http://localhost:${updaterPort}/check`);
    
    // Assert: Status was checked
    expect(checkResponse.data.success).toBe(true);
    expect(checkResponse.data.results[0].url).toBe(TEST_URLS.kick[0]);
    
    // Get updated status from StreamSource
    const streamsResponse = await axios.get(`http://localhost:${streamSourcePort}/api/v1/streams`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const updatedStream = streamsResponse.data.streams[0];
    expect(updatedStream.last_checked).toBeTruthy();
    expect(['live', 'offline']).toContain(updatedStream.status);
  });

  test('should handle bulk checking operations efficiently', async () => {
    // Arrange: Add multiple streams
    const bulkStreams = [];
    for (let i = 0; i < 10; i++) {
      bulkStreams.push({
        url: `https://twitch.tv/bulk_test_${i}`,
        platform: 'twitch',
        status: 'offline',
        city: 'Test City',
        state: 'TS'
      });
    }
    
    // Add all streams to Google Sheets
    for (const stream of bulkStreams) {
      await axios.post(`http://localhost:${sheetsPort}/test/add-stream`, stream);
    }
    
    // Act: Trigger bulk check
    const startTime = Date.now();
    const checkResponse = await axios.post(`http://localhost:${updaterPort}/check`);
    const duration = Date.now() - startTime;
    
    // Assert: All streams were checked
    expect(checkResponse.data.success).toBe(true);
    expect(checkResponse.data.results).toHaveLength(10);
    
    // Assert: Bulk operation completed in reasonable time
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    
    // Verify all streams in StreamSource
    const streamsResponse = await axios.get(`http://localhost:${streamSourcePort}/api/v1/streams`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    expect(streamsResponse.data.streams).toHaveLength(10);
  });

  test('should maintain data consistency between Google Sheets and StreamSource', async () => {
    // Arrange: Add stream with specific data
    const testStream = {
      url: TEST_URLS.facebook[0],
      platform: 'facebook',
      status: 'live',
      city: 'New York',
      state: 'NY'
    };
    
    await axios.post(`http://localhost:${sheetsPort}/test/add-stream`, testStream);
    
    // Act: Multiple check cycles
    for (let i = 0; i < 3; i++) {
      await axios.post(`http://localhost:${updaterPort}/check`);
      await delay(500);
    }
    
    // Assert: Data remains consistent
    const sheetsData = await axios.get(
      `http://localhost:${sheetsPort}/v4/spreadsheets/test-sheet-123/values/Sheet1!A:F`
    );
    
    const streamsResponse = await axios.get(`http://localhost:${streamSourcePort}/api/v1/streams`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    // Compare data
    const sheetRow = sheetsData.data.values[1]; // First data row
    const streamSourceData = streamsResponse.data.streams[0];
    
    expect(sheetRow[0]).toBe(streamSourceData.link); // URL
    expect(sheetRow[1]).toBe(streamSourceData.platform); // Platform
    expect(sheetRow[2]).toBe(streamSourceData.status); // Status
    expect(sheetRow[3]).toBe(streamSourceData.city || ''); // City
    expect(sheetRow[4]).toBe(streamSourceData.state || ''); // State
  });

  test('should handle periodic checking with proper intervals', async () => {
    // Arrange: Add a stream
    await axios.post(`http://localhost:${sheetsPort}/test/add-stream`, {
      url: TEST_URLS.tiktok[0],
      platform: 'tiktok',
      status: 'offline'
    });
    
    // Act: Start periodic checking with short interval
    await axios.post(`http://localhost:${updaterPort}/start-checking`, {
      interval: 1000 // 1 second for testing
    });
    
    // Wait for multiple check cycles
    await delay(3500);
    
    // Stop checking
    await axios.post(`http://localhost:${updaterPort}/stop-checking`);
    
    // Assert: Stream was checked multiple times
    const streamsResponse = await axios.get(`http://localhost:${streamSourcePort}/api/v1/streams`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const stream = streamsResponse.data.streams[0];
    expect(stream.last_checked).toBeTruthy();
    
    // Verify health endpoint shows checking status
    const healthResponse = await axios.get(`http://localhost:${updaterPort}/health`);
    expect(healthResponse.data.checking).toBe(false); // Should be stopped now
  });

  test('should handle StreamSource API failures gracefully', async () => {
    // Arrange: Add stream to Google Sheets
    await axios.post(`http://localhost:${sheetsPort}/test/add-stream`, {
      url: TEST_URLS.twitch[2],
      platform: 'twitch',
      status: 'offline'
    });
    
    // Stop StreamSource to simulate failure
    await mockStreamSource.stop();
    
    // Act: Try to check streams
    const checkResponse = await axios.post(`http://localhost:${updaterPort}/check`);
    
    // Assert: Check completes but sync fails
    expect(checkResponse.data.success).toBe(true);
    expect(checkResponse.data.results[0].synced).toBe(false);
    expect(checkResponse.data.results[0].error).toBeTruthy();
    
    // Restart StreamSource for cleanup
    mockStreamSource = new MockStreamSourceAPIWithUpdates(streamSourcePort);
    await mockStreamSource.start();
  });

  test('should get status summary from StreamSource', async () => {
    // Arrange: Add streams with different statuses
    const streams = [
      { url: 'https://twitch.tv/live1', platform: 'twitch', status: 'live' },
      { url: 'https://twitch.tv/live2', platform: 'twitch', status: 'live' },
      { url: 'https://youtube.com/offline1', platform: 'youtube', status: 'offline' },
      { url: 'https://kick.com/unknown1', platform: 'kick', status: 'checking' }
    ];
    
    for (const stream of streams) {
      await axios.post(`http://localhost:${sheetsPort}/test/add-stream`, stream);
    }
    
    // Sync to StreamSource
    await axios.post(`http://localhost:${updaterPort}/check`);
    
    // Act: Get status summary
    const summaryResponse = await axios.get(
      `http://localhost:${streamSourcePort}/api/v1/streams/status-summary`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    // Assert: Summary is correct
    expect(summaryResponse.data.total).toBe(4);
    expect(summaryResponse.data.live).toBeGreaterThanOrEqual(0);
    expect(summaryResponse.data.offline).toBeGreaterThanOrEqual(0);
    expect(summaryResponse.data.unknown).toBeGreaterThanOrEqual(0);
    expect(summaryResponse.data.live + summaryResponse.data.offline + summaryResponse.data.unknown).toBe(4);
  });

  test('should update existing streams without creating duplicates', async () => {
    // Arrange: Add stream and sync it
    const testStream = {
      url: TEST_URLS.youtube[2],
      platform: 'youtube',
      status: 'offline',
      city: 'Los Angeles',
      state: 'CA'
    };
    
    await axios.post(`http://localhost:${sheetsPort}/test/add-stream`, testStream);
    await axios.post(`http://localhost:${updaterPort}/check`);
    
    // Verify initial sync
    let streamsResponse = await axios.get(`http://localhost:${streamSourcePort}/api/v1/streams`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(streamsResponse.data.streams).toHaveLength(1);
    const initialId = streamsResponse.data.streams[0].id;
    
    // Act: Check again (should update, not create new)
    await axios.post(`http://localhost:${updaterPort}/check`);
    
    // Assert: Still only one stream, but updated
    streamsResponse = await axios.get(`http://localhost:${streamSourcePort}/api/v1/streams`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    expect(streamsResponse.data.streams).toHaveLength(1);
    expect(streamsResponse.data.streams[0].id).toBe(initialId);
    expect(streamsResponse.data.streams[0].last_checked).toBeTruthy();
  });
});