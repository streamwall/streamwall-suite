/**
 * Simplified Integration Tests
 * Basic tests to verify core functionality without complex mocking
 */

const axios = require('axios');
const MockLivestreamMonitor = require('../helpers/mock-livestream-monitor');

describe('Simple Integration Tests', () => {
  let mockMonitor;
  const testPort = 3101; // Use different port to avoid conflicts
  
  beforeAll(async () => {
    mockMonitor = new MockLivestreamMonitor(testPort);
    await mockMonitor.start();
  });
  
  afterAll(async () => {
    if (mockMonitor) {
      await mockMonitor.stop();
    }
  });
  
  afterEach(async () => {
    // Reset between tests
    try {
      await axios.post(`http://localhost:${testPort}/reset`);
    } catch (error) {
      // Ignore reset errors
    }
  });

  test('should start mock service successfully', async () => {
    const response = await axios.get(`http://localhost:${testPort}/health`);
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('healthy');
  });

  test('should process Discord webhook with stream URL', async () => {
    const testMessage = {
      type: 'MESSAGE_CREATE',
      data: {
        content: 'Check out this stream: https://twitch.tv/testuser',
        author: {
          username: 'testuser#1234'
        }
      }
    };

    const response = await axios.post(`http://localhost:${testPort}/webhook/discord`, testMessage);
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.results).toHaveLength(1);
    expect(response.data.results[0].url).toBe('https://twitch.tv/testuser');
  });

  test('should detect different platforms correctly', async () => {
    const platforms = [
      { url: 'https://twitch.tv/test', platform: 'twitch' },
      { url: 'https://youtube.com/watch?v=test', platform: 'youtube' },
      { url: 'https://tiktok.com/@test/live', platform: 'tiktok' },
      { url: 'https://kick.com/test', platform: 'kick' },
      { url: 'https://facebook.com/test/live', platform: 'facebook' }
    ];

    for (const { url, platform } of platforms) {
      const testMessage = {
        type: 'MESSAGE_CREATE',
        data: {
          content: `Live stream: ${url}`,
          author: { username: 'testuser' }
        }
      };

      await axios.post(`http://localhost:${testPort}/webhook/discord`, testMessage);
    }

    const streams = await axios.get(`http://localhost:${testPort}/streams`);
    expect(streams.data).toHaveLength(platforms.length);
    
    for (const { url, platform } of platforms) {
      const stream = streams.data.find(s => s.url === url);
      expect(stream).toBeDefined();
      expect(stream.platform).toBe(platform);
    }
  });

  test('should extract location from message', async () => {
    const testMessage = {
      type: 'MESSAGE_CREATE',
      data: {
        content: 'Live from Seattle, WA: https://twitch.tv/seattlestream',
        author: { username: 'testuser' }
      }
    };

    await axios.post(`http://localhost:${testPort}/webhook/discord`, testMessage);
    
    const streams = await axios.get(`http://localhost:${testPort}/streams`);
    expect(streams.data).toHaveLength(1);
    expect(streams.data[0].city).toBe('Seattle');
    expect(streams.data[0].state).toBe('WA');
  });

  test('should handle duplicate URLs correctly', async () => {
    const url = 'https://twitch.tv/duplicate';
    
    // Send same URL twice
    for (let i = 0; i < 2; i++) {
      const testMessage = {
        type: 'MESSAGE_CREATE',
        data: {
          content: `Stream: ${url}`,
          author: { username: `user${i}` }
        }
      };
      await axios.post(`http://localhost:${testPort}/webhook/discord`, testMessage);
    }

    const streams = await axios.get(`http://localhost:${testPort}/streams`);
    expect(streams.data).toHaveLength(1); // Only one stream should be stored
  });

  test('should handle invalid webhook data', async () => {
    const invalidData = {
      type: 'INVALID_TYPE',
      data: null
    };

    const response = await axios.post(`http://localhost:${testPort}/webhook/discord`, invalidData)
      .catch(e => e.response);

    expect(response.status).toBe(400);
    expect(response.data.error).toBe('Invalid webhook data');
  });

  test('should provide sync status endpoint', async () => {
    const response = await axios.get(`http://localhost:${testPort}/sync-status`);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('dualWriteMode');
    expect(response.data).toHaveProperty('processedCount');
    expect(response.data).toHaveProperty('syncedCount');
  });
});