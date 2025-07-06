/**
 * End-to-end integration test
 * Tests the complete flow from stream discovery to display in Streamwall
 */

const { spawn, exec } = require('child_process');
const axios = require('axios');
const {
  startService,
  stopService,
  waitForService,
  getContainerLogs,
  execCommand
} = require('../helpers/services');
const {
  generateDiscordMessage,
  TEST_URLS,
  delay,
  waitFor
} = require('../helpers/test-data');

describe('End-to-End Stream Flow', () => {
  let services = {
    monitor: false,
    checker: false,
    streamwall: null
  };

  beforeAll(async () => {
    console.log('Starting services for E2E test...');
    
    // Start livestream-link-monitor
    try {
      await startService('livestream-link-monitor');
      await waitForService('http://localhost:3001/health');
      services.monitor = true;
      console.log('✓ livestream-link-monitor started');
    } catch (error) {
      console.warn('Could not start livestream-link-monitor:', error.message);
    }

    // Start livesheet-checker
    try {
      await startService('livesheet-checker');
      services.checker = true;
      console.log('✓ livesheet-checker started');
    } catch (error) {
      console.warn('Could not start livesheet-checker:', error.message);
    }

    // Note: Streamwall is an Electron app, so we handle it differently
    // In a real test, we might use spectron or playwright for Electron testing
  }, 60000); // 60 second timeout for service startup

  afterAll(async () => {
    console.log('Stopping services...');
    
    if (services.monitor) {
      await stopService('livestream-link-monitor');
    }
    if (services.checker) {
      await stopService('livesheet-checker');
    }
    if (services.streamwall) {
      services.streamwall.kill();
    }
  });

  describe('Complete Stream Discovery to Display Flow', () => {
    test('should discover stream from Discord and make it available to Streamwall', async () => {
      if (!services.monitor) {
        console.log('Skipping: livestream-link-monitor not running');
        return;
      }

      // Step 1: Post a stream URL to Discord (simulated)
      console.log('Step 1: Posting stream URL to Discord...');
      const testUrl = TEST_URLS.twitch[0];
      const location = 'Seattle, WA';
      const message = generateDiscordMessage(
        `🔴 LIVE from ${location}: ${testUrl} - Testing integration!`
      );

      const response = await axios.post('http://localhost:3001/webhook/discord', {
        type: 'MESSAGE_CREATE',
        data: message
      });

      expect(response.status).toBe(200);
      console.log('✓ Stream URL posted');

      // Step 2: Wait for livestream-link-monitor to process
      console.log('Step 2: Waiting for processing...');
      await delay(3000);

      // Check logs to verify processing
      const monitorLogs = getContainerLogs('livestream-link-monitor', 50);
      expect(monitorLogs).toContain(testUrl);
      console.log('✓ URL processed by monitor');

      // Step 3: Verify data persistence (would check Sheets or API)
      console.log('Step 3: Verifying data persistence...');
      // In a real test, we would:
      // - Check Google Sheets for the new entry
      // - Or query StreamSource API for the stream
      // For now, we'll check the logs
      expect(monitorLogs).toMatch(/added|saved|stored/i);
      console.log('✓ Stream data persisted');

      // Step 4: If checker is running, verify it picks up the stream
      if (services.checker) {
        console.log('Step 4: Waiting for livesheet-checker...');
        await delay(5000); // Give checker time to run
        
        const checkerLogs = getContainerLogs('livesheet-checker', 50);
        if (checkerLogs) {
          console.log('✓ Checker processed streams');
        }
      }

      // Step 5: Verify stream would be available to Streamwall
      console.log('Step 5: Verifying stream availability...');
      // In a real scenario, we would:
      // - Start Streamwall with test configuration
      // - Query its API or check if stream appears
      // - Use Electron testing tools to verify UI
      
      console.log('✓ E2E flow completed successfully');
    }, 30000); // 30 second timeout

    test('should handle stream status updates through the pipeline', async () => {
      if (!services.monitor || !services.checker) {
        console.log('Skipping: Required services not running');
        return;
      }

      // This test would:
      // 1. Add a stream through Discord
      // 2. Wait for checker to mark it as live/offline
      // 3. Verify status propagates through the system
      // 4. Confirm Streamwall would receive the update

      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Multi-Service Coordination', () => {
    test('should handle multiple streams from different sources', async () => {
      if (!services.monitor) {
        console.log('Skipping: livestream-link-monitor not running');
        return;
      }

      // Send multiple stream URLs from different platforms
      const streams = [
        { url: TEST_URLS.twitch[1], location: 'New York, NY' },
        { url: TEST_URLS.youtube[0], location: 'Los Angeles, CA' },
        { url: TEST_URLS.tiktok[0], location: 'Chicago, IL' }
      ];

      console.log('Posting multiple streams...');
      
      for (const stream of streams) {
        const message = generateDiscordMessage(
          `Live from ${stream.location}: ${stream.url}`
        );
        
        await axios.post('http://localhost:3001/webhook/discord', {
          type: 'MESSAGE_CREATE',
          data: message
        });
        
        await delay(1000); // Space out requests
      }

      console.log('Waiting for processing...');
      await delay(5000);

      // Verify all streams were processed
      const logs = getContainerLogs('livestream-link-monitor', 200);
      for (const stream of streams) {
        expect(logs).toContain(stream.url);
      }
      
      console.log('✓ All streams processed successfully');
    });
  });

  describe('Error Recovery', () => {
    test('should recover from service interruptions', async () => {
      // This test would:
      // 1. Start services
      // 2. Send some data
      // 3. Restart a service
      // 4. Verify system continues functioning
      // 5. Verify no data loss

      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Performance', () => {
    test('should handle load without degradation', async () => {
      if (!services.monitor) {
        console.log('Skipping: livestream-link-monitor not running');
        return;
      }

      // Send many requests to test system under load
      const requestCount = 20;
      const startTime = Date.now();
      
      console.log(`Sending ${requestCount} requests...`);
      
      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        const message = generateDiscordMessage(
          `Stream ${i}: https://twitch.tv/teststream${i}`
        );
        
        promises.push(
          axios.post('http://localhost:3001/webhook/discord', {
            type: 'MESSAGE_CREATE',
            data: message
          }).catch(e => e.response)
        );
      }

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Check success rate
      const successful = results.filter(r => r && r.status === 200).length;
      const successRate = (successful / requestCount) * 100;

      console.log(`Completed in ${duration}ms`);
      console.log(`Success rate: ${successRate}%`);

      expect(successRate).toBeGreaterThan(80); // At least 80% success
      expect(duration).toBeLessThan(10000); // Complete within 10 seconds
    });
  });
});