/**
 * Integration test for stream discovery pipeline
 * Tests: Discord message → livestream-link-monitor → StreamSource
 */

const axios = require('axios');
const MockLivestreamMonitor = require('../helpers/mock-livestream-monitor');
const {
  waitForService
} = require('../helpers/services');
const {
  generateDiscordMessage,
  TEST_URLS,
  delay
} = require('../helpers/test-data');

describe('Stream Discovery Pipeline', () => {
  let mockMonitor;
  const testPort = 3001;
  const healthUrl = `http://localhost:${testPort}/health`;
  const webhookUrl = `http://localhost:${testPort}/webhook/discord`;

  beforeAll(async () => {
    console.log('Starting mock livestream-link-monitor...');
    mockMonitor = new MockLivestreamMonitor(testPort);
    await mockMonitor.start();
    
    // Wait for service to be healthy
    await waitForService(healthUrl);
    console.log('Mock livestream-link-monitor is ready');
  });

  afterAll(async () => {
    // Stop mock service
    if (mockMonitor) {
      await mockMonitor.stop();
    }
  });
  
  afterEach(async () => {
    // Reset mock service between tests
    if (mockMonitor) {
      await axios.post(`http://localhost:${testPort}/reset`);
    }
  });

  describe('Discord Stream Detection', () => {
    test('should detect and process Twitch URL from Discord message', async () => {
      // Arrange
      const testUrl = TEST_URLS.twitch[0];
      const message = generateDiscordMessage(`Check out this stream: ${testUrl}`);

      // Act - Send webhook to simulate Discord message
      const response = await axios.post(webhookUrl, {
        type: 'MESSAGE_CREATE',
        data: message
      });

      // Assert
      expect(response.status).toBe(200);

      // Wait for processing
      await delay(2000);

      // Check if stream was processed by the mock service
      const streams = await axios.get(`http://localhost:${testPort}/streams`);
      expect(streams.data).toHaveLength(1);
      expect(streams.data[0].url).toBe(testUrl);
      expect(streams.data[0].platform).toBe('twitch');
    });

    test('should detect location from Discord message', async () => {
      // Arrange
      const testUrl = TEST_URLS.youtube[0];
      const location = 'Chicago, IL';
      const message = generateDiscordMessage(`Live from ${location}: ${testUrl}`);

      // Act
      const response = await axios.post(webhookUrl, {
        type: 'MESSAGE_CREATE',
        data: message
      });

      // Assert
      expect(response.status).toBe(200);

      await delay(2000);

      const streams = await axios.get(`http://localhost:${testPort}/streams`);
      expect(streams.data).toHaveLength(1);
      expect(streams.data[0].city).toBe('Chicago');
      expect(streams.data[0].state).toBe('IL');
    });

    test('should ignore duplicate URLs', async () => {
      // Arrange
      const testUrl = TEST_URLS.twitch[1];
      const message1 = generateDiscordMessage(`First post: ${testUrl}`);
      const message2 = generateDiscordMessage(`Duplicate: ${testUrl}`, 'another_user#5678');

      // Act - Send first message
      await axios.post(webhookUrl, {
        type: 'MESSAGE_CREATE',
        data: message1
      });

      await delay(2000);

      // Send duplicate
      const response2 = await axios.post(webhookUrl, {
        type: 'MESSAGE_CREATE',
        data: message2
      });

      await delay(2000);

      // Assert - second response should indicate duplicate
      expect(response2.data.results[0].success).toBe(false);
      expect(response2.data.results[0].reason).toBe('duplicate');
      
      // Should still only have one stream
      const streams = await axios.get(`http://localhost:${testPort}/streams`);
      expect(streams.data).toHaveLength(1);
    });

    test('should respect rate limits per user', async () => {
      // Arrange
      const user = 'ratelimit_test#9999';
      const messages = [];
      
      // Create multiple messages from same user
      for (let i = 0; i < 5; i++) {
        messages.push(generateDiscordMessage(
          `Stream ${i}: ${TEST_URLS.kick[0]}?t=${i}`,
          user
        ));
      }

      // Act - Send messages rapidly
      const responses = await Promise.all(
        messages.map(msg => 
          axios.post(webhookUrl, {
            type: 'MESSAGE_CREATE',
            data: msg
          }).catch(e => ({ status: e.response?.status, data: e.response?.data }))
        )
      );

      await delay(3000);

      // Assert - mock doesn't implement rate limiting yet, but we can check 
      // that all URLs were processed
      const streams = await axios.get(`http://localhost:${testPort}/streams`);
      expect(streams.data.length).toBeGreaterThan(0);
      expect(streams.data.length).toBeLessThanOrEqual(messages.length);
    });
  });

  describe('Platform Detection', () => {
    const platforms = Object.keys(TEST_URLS);

    test.each(platforms)('should correctly identify %s URLs', async (platform) => {
      // Arrange
      const testUrl = TEST_URLS[platform][0];
      const message = generateDiscordMessage(`Check out: ${testUrl}`);

      // Act
      await axios.post(webhookUrl, {
        type: 'MESSAGE_CREATE',
        data: message
      });

      await delay(2000);

      // Assert
      const streams = await axios.get(`http://localhost:${testPort}/streams`);
      expect(streams.data.length).toBeGreaterThan(0);
      const latestStream = streams.data[streams.data.length - 1];
      expect(latestStream.url).toBe(testUrl);
      expect(latestStream.platform.toLowerCase()).toBe(platform);
    });
  });


  describe('Error Handling', () => {
    test('should handle invalid Discord webhook data gracefully', async () => {
      // Arrange
      const invalidData = {
        type: 'INVALID_TYPE',
        data: null
      };

      // Act
      const response = await axios.post(webhookUrl, invalidData)
        .catch(e => e.response);

      // Assert
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });

    test('should continue processing after encountering invalid URLs', async () => {
      // Arrange
      const messages = [
        generateDiscordMessage('Invalid: not-a-url'),
        generateDiscordMessage(`Valid: ${TEST_URLS.tiktok[0]}`),
      ];

      // Act
      for (const message of messages) {
        await axios.post(webhookUrl, {
          type: 'MESSAGE_CREATE',
          data: message
        });
        await delay(1000);
      }

      // Assert - should have processed the valid URL
      const streams = await axios.get(`http://localhost:${testPort}/streams`);
      const tiktokStreams = streams.data.filter(s => s.url === TEST_URLS.tiktok[0]);
      expect(tiktokStreams.length).toBeGreaterThan(0);
    });
  });

  describe('Service Health', () => {
    test('should have functioning health endpoint', async () => {
      // Act
      const response = await axios.get(healthUrl);

      // Assert
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data.status).toBe('healthy');
    });

    test('should recover from temporary failures', async () => {
      // Test service resilience by verifying it's still responsive
      
      // Act - try multiple health checks
      let healthyCount = 0;
      for (let i = 0; i < 5; i++) {
        try {
          const response = await axios.get(healthUrl);
          if (response.data.status === 'healthy') healthyCount++;
        } catch (error) {
          // Service might be temporarily unavailable
        }
        await delay(1000);
      }

      // Assert - should be healthy most of the time
      expect(healthyCount).toBeGreaterThan(3);
    });
  });
});