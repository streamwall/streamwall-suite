/**
 * Basic End-to-End Test
 * Tests the complete user workflow: Discord → Monitor → StreamSource → Available for Streamwall
 */

const axios = require('axios');
const MockLivestreamMonitor = require('../helpers/mock-livestream-monitor');
const { generateDiscordMessage, TEST_URLS, delay } = require('../helpers/test-data');

// Minimal StreamSource API mock
class StreamSourceAPI {
  constructor(port = 3300) {
    this.port = port;
    this.app = require('express')();
    this.server = null;
    this.streams = [];
    
    this.app.use(require('express').json());
    
    this.app.post('/api/v1/streams', (req, res) => {
      if (!req.headers.authorization?.includes('Bearer')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const stream = {
        id: this.streams.length + 1,
        ...req.body,
        created_at: new Date().toISOString()
      };
      
      this.streams.push(stream);
      res.status(201).json(stream);
    });
    
    // Streamwall consumption endpoint
    this.app.get('/api/v1/streams', (req, res) => {
      if (!req.headers.authorization?.includes('Bearer')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const { status, platform } = req.query;
      let filtered = [...this.streams];
      
      if (status) filtered = filtered.filter(s => s.status === status);
      if (platform) filtered = filtered.filter(s => s.platform === platform);
      
      res.json({
        streams: filtered,
        meta: { total_count: filtered.length }
      });
    });
    
    this.app.post('/api/v1/reset', (req, res) => {
      this.streams = [];
      res.json({ success: true });
    });
  }
  
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => resolve());
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

describe('Basic End-to-End Workflow', () => {
  let monitor;
  let streamSource;
  const authToken = 'e2e-test-token';

  beforeAll(async () => {
    // Start StreamSource API
    streamSource = new StreamSourceAPI(3300);
    await streamSource.start();
    
    // Start Monitor with StreamSource integration
    monitor = new MockLivestreamMonitor(3103, {
      streamSourceUrl: 'http://localhost:3300/api/v1'
    });
    await monitor.start();
    
    // Configure authentication
    await axios.post('http://localhost:3103/auth/streamsource', {
      token: authToken
    });
  });

  afterAll(async () => {
    await monitor?.stop();
    await streamSource?.stop();
  });

  afterEach(async () => {
    await axios.post('http://localhost:3103/reset').catch(() => {});
    await axios.post('http://localhost:3300/api/v1/reset').catch(() => {});
  });

  test('complete workflow: Discord post → StreamSource storage → Streamwall consumption', async () => {
    // Step 1: User posts stream URL in Discord
    const streamUrl = TEST_URLS.twitch[0];
    const location = 'Seattle, WA';
    const username = 'teststreamer';
    
    const discordMessage = generateDiscordMessage(
      `🔴 LIVE from ${location}: ${streamUrl} - Come watch!`,
      username
    );

    console.log('Step 1: Posting stream URL to Discord webhook...');
    const webhookResponse = await axios.post('http://localhost:3103/webhook/discord', {
      type: 'MESSAGE_CREATE',
      data: discordMessage
    });

    expect(webhookResponse.status).toBe(200);
    expect(webhookResponse.data.success).toBe(true);
    console.log('✓ Discord webhook processed successfully');

    // Step 2: Verify monitor processed and synced to StreamSource
    await delay(1000); // Allow async processing
    
    console.log('Step 2: Verifying data synced to StreamSource...');
    const streamsResponse = await axios.get('http://localhost:3300/api/v1/streams', {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(streamsResponse.status).toBe(200);
    expect(streamsResponse.data.streams).toHaveLength(1);
    
    const stream = streamsResponse.data.streams[0];
    expect(stream.link).toBe(streamUrl);
    expect(stream.platform).toBe('twitch');
    expect(stream.city).toBe('Seattle');
    expect(stream.state).toBe('WA');
    expect(stream.source).toBe(username);
    console.log('✓ Stream data correctly stored in StreamSource');

    // Step 3: Simulate Streamwall fetching streams for display
    console.log('Step 3: Simulating Streamwall fetching streams...');
    const streamwallRequest = await axios.get('http://localhost:3300/api/v1/streams?status=offline', {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(streamwallRequest.status).toBe(200);
    expect(streamwallRequest.data.streams).toHaveLength(1);
    expect(streamwallRequest.data.meta.total_count).toBe(1);
    
    const streamForDisplay = streamwallRequest.data.streams[0];
    expect(streamForDisplay).toHaveProperty('id');
    expect(streamForDisplay).toHaveProperty('link');
    expect(streamForDisplay).toHaveProperty('platform');
    expect(streamForDisplay).toHaveProperty('created_at');
    console.log('✓ Streamwall can fetch and display stream data');

    console.log('🎉 Complete workflow test passed!');
  });

  test('multiple streams workflow with filtering', async () => {
    // Post multiple streams from different platforms
    const testStreams = [
      { url: TEST_URLS.twitch[1], location: 'New York, NY', platform: 'twitch' },
      { url: TEST_URLS.youtube[1], location: 'Los Angeles, CA', platform: 'youtube' }
    ];

    console.log('Posting multiple streams...');
    for (const { url, location } of testStreams) {
      const message = generateDiscordMessage(`Live from ${location}: ${url}`);
      await axios.post('http://localhost:3103/webhook/discord', {
        type: 'MESSAGE_CREATE',
        data: message
      });
      await delay(500); // Space out requests
    }

    await delay(1500);

    // Verify streams stored
    const allStreams = await axios.get('http://localhost:3300/api/v1/streams', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(allStreams.data.streams.length).toBeGreaterThanOrEqual(2);

    // Test platform filtering (Streamwall use case)
    const twitchStreams = await axios.get('http://localhost:3300/api/v1/streams?platform=twitch', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(twitchStreams.data.streams.length).toBeGreaterThanOrEqual(1);
    expect(twitchStreams.data.streams[0].platform).toBe('twitch');

    console.log('✓ Multiple streams and filtering works correctly');
  });

  test('error handling in workflow', async () => {
    // Test with invalid Discord message
    const invalidMessage = {
      type: 'INVALID_TYPE',
      data: null
    };

    const response = await axios.post('http://localhost:3103/webhook/discord', invalidMessage)
      .catch(e => e.response);

    expect(response.status).toBe(400);

    // Verify no streams were created
    const streams = await axios.get('http://localhost:3300/api/v1/streams', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(streams.data.streams).toHaveLength(0);

    console.log('✓ Error handling works correctly');
  });
});