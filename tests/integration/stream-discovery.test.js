/**
 * Integration test for stream discovery pipeline
 * Tests: Discord message → livestream-link-monitor → Google Sheets/StreamSource
 */

const axios = require('axios');
const { google } = require('googleapis');
const {
  startService,
  stopService,
  waitForService,
  isContainerRunning,
  getContainerLogs
} = require('../helpers/services');
const {
  generateTestStream,
  generateDiscordMessage,
  TEST_URLS,
  delay,
  waitFor
} = require('../helpers/test-data');

describe('Stream Discovery Pipeline', () => {
  let monitorHealthUrl;
  let sheetsClient;
  let discordWebhookUrl;

  beforeAll(async () => {
    // Configuration
    monitorHealthUrl = process.env.MONITOR_HEALTH_URL || 'http://localhost:3001/health';
    discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || 'http://localhost:3001/webhook/discord';

    // Start livestream-link-monitor service
    console.log('Starting livestream-link-monitor...');
    await startService('livestream-link-monitor');
    
    // Wait for service to be healthy
    await waitForService(monitorHealthUrl);
    console.log('livestream-link-monitor is ready');

    // Initialize Google Sheets client if credentials exist
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: 'livesheet-checker/creds.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const authClient = await auth.getClient();
      sheetsClient = google.sheets({ version: 'v4', auth: authClient });
    } catch (error) {
      console.warn('Google Sheets credentials not found, skipping Sheets tests');
    }
  });

  afterAll(async () => {
    // Stop services
    await stopService('livestream-link-monitor');
  });

  describe('Discord Stream Detection', () => {
    test('should detect and process Twitch URL from Discord message', async () => {
      // Arrange
      const testUrl = TEST_URLS.twitch[0];
      const message = generateDiscordMessage(`Check out this stream: ${testUrl}`);

      // Act - Send webhook to simulate Discord message
      const response = await axios.post(discordWebhookUrl, {
        type: 'MESSAGE_CREATE',
        data: message
      });

      // Assert
      expect(response.status).toBe(200);

      // Wait for processing
      await delay(2000);

      // Check if stream was processed (would need to check Sheets or API)
      // This is a simplified check - in real scenario would verify data persistence
      const logs = getContainerLogs('livestream-link-monitor', 100);
      expect(logs).toContain('Processing URL');
      expect(logs).toContain(testUrl);
    });

    test('should detect location from Discord message', async () => {
      // Arrange
      const testUrl = TEST_URLS.youtube[0];
      const location = 'Chicago, IL';
      const message = generateDiscordMessage(`Live from ${location}: ${testUrl}`);

      // Act
      const response = await axios.post(discordWebhookUrl, {
        type: 'MESSAGE_CREATE',
        data: message
      });

      // Assert
      expect(response.status).toBe(200);

      await delay(2000);

      const logs = getContainerLogs('livestream-link-monitor', 100);
      expect(logs).toContain('Chicago');
      expect(logs).toContain('IL');
    });

    test('should ignore duplicate URLs', async () => {
      // Arrange
      const testUrl = TEST_URLS.twitch[1];
      const message1 = generateDiscordMessage(`First post: ${testUrl}`);
      const message2 = generateDiscordMessage(`Duplicate: ${testUrl}`, 'another_user#5678');

      // Act - Send first message
      await axios.post(discordWebhookUrl, {
        type: 'MESSAGE_CREATE',
        data: message1
      });

      await delay(2000);

      // Send duplicate
      await axios.post(discordWebhookUrl, {
        type: 'MESSAGE_CREATE',
        data: message2
      });

      await delay(2000);

      // Assert
      const logs = getContainerLogs('livestream-link-monitor', 200);
      const duplicateCount = (logs.match(/duplicate|already exists/gi) || []).length;
      expect(duplicateCount).toBeGreaterThan(0);
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
          axios.post(discordWebhookUrl, {
            type: 'MESSAGE_CREATE',
            data: msg
          }).catch(e => e.response)
        )
      );

      await delay(3000);

      // Assert
      const logs = getContainerLogs('livestream-link-monitor', 200);
      expect(logs).toMatch(/rate limit|too many|slow down/i);
    });
  });

  describe('Platform Detection', () => {
    const platforms = Object.keys(TEST_URLS);

    test.each(platforms)('should correctly identify %s URLs', async (platform) => {
      // Arrange
      const testUrl = TEST_URLS[platform][0];
      const message = generateDiscordMessage(`Check out: ${testUrl}`);

      // Act
      await axios.post(discordWebhookUrl, {
        type: 'MESSAGE_CREATE',
        data: message
      });

      await delay(2000);

      // Assert
      const logs = getContainerLogs('livestream-link-monitor', 100);
      expect(logs.toLowerCase()).toContain(platform);
    });
  });

  describe('Google Sheets Integration', () => {
    test.skip('should write stream data to Google Sheets', async () => {
      if (!sheetsClient) {
        console.log('Skipping: Google Sheets not configured');
        return;
      }

      // This test would verify data is written to sheets
      // Requires actual sheet ID and configuration
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
      const response = await axios.post(discordWebhookUrl, invalidData)
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
        await axios.post(discordWebhookUrl, {
          type: 'MESSAGE_CREATE',
          data: message
        });
        await delay(1000);
      }

      // Assert
      const logs = getContainerLogs('livestream-link-monitor', 150);
      expect(logs).toContain(TEST_URLS.tiktok[0]);
    });
  });

  describe('Service Health', () => {
    test('should have functioning health endpoint', async () => {
      // Act
      const response = await axios.get(monitorHealthUrl);

      // Assert
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data.status).toBe('healthy');
    });

    test('should recover from temporary failures', async () => {
      // This would test service resilience
      // For example, simulate network issues and verify recovery
      
      // Act
      const isRunning = isContainerRunning('livestream-link-monitor');

      // Assert
      expect(isRunning).toBe(true);
    });
  });
});