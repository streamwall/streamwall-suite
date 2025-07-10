// Mock livestream-link-monitor service for testing
const express = require('express');
const axios = require('axios');

class MockLivestreamMonitor {
  constructor(port = 3001, options = {}) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.streams = [];
    this.processedUrls = new Set();
    
    // StreamSource integration options
    this.dualWriteMode = options.dualWriteMode !== false;
    this.streamSourceUrl = options.streamSourceUrl || 'http://localhost:3000/api/v1';
    this.streamSourceToken = null;
    this.syncedStreams = new Set();
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        services: {
          discord: true,
          twitch: true
        }
      });
    });
    
    // Discord webhook endpoint for testing
    this.app.post('/webhook/discord', async (req, res) => {
      const { type, data } = req.body;
      
      if (type === 'MESSAGE_CREATE' && data) {
        // Extract URLs from message content - more comprehensive regex
        const urlRegex = /https?:\/\/(www\.)?(twitch\.tv|youtube\.com|tiktok\.com|kick\.com|facebook\.com)(\/[^\s]*)?/gi;
        const urls = data.content.match(urlRegex) || [];
        
        const results = [];
        for (let url of urls) {
          // Ensure URL ends properly (remove trailing punctuation)
          url = url.replace(/[.,!?;:]$/, '');
          
          if (!this.processedUrls.has(url)) {
            this.processedUrls.add(url);
            
            // Extract location from message - improved regex
            const locationMatch = data.content.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2})\b/);
            const city = locationMatch ? locationMatch[1] : null;
            const state = locationMatch ? locationMatch[2] : null;
            
            const stream = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              url,
              platform: this.detectPlatform(url),
              source: 'Discord',
              posted_by: data.author?.username || 'test_user',
              added_date: new Date().toISOString(),
              city,
              state,
              status: 'Live'
            };
            
            this.streams.push(stream);
            
            // Sync to StreamSource if enabled
            let syncedToApi = false;
            if (this.dualWriteMode && this.streamSourceToken) {
              try {
                const response = await axios.post(`${this.streamSourceUrl}/streams`, {
                  source: stream.posted_by,
                  link: stream.url,
                  platform: stream.platform,
                  city: stream.city,
                  state: stream.state,
                  status: 'offline'
                }, {
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.streamSourceToken}`
                  }
                });
                
                if (response.status === 200 || response.status === 201) {
                  syncedToApi = true;
                  this.syncedStreams.add(url);
                }
              } catch (error) {
                // Sync failed, continue with local storage
              }
            }
            
            const result = { url, success: true };
            if (this.dualWriteMode) {
              result.syncedToApi = syncedToApi;
            }
            results.push(result);
          } else {
            results.push({ url, success: false, reason: 'duplicate' });
          }
        }
        
        res.json({ success: true, results });
      } else {
        res.status(400).json({ error: 'Invalid webhook data' });
      }
    });
    
    // Get all processed streams
    this.app.get('/streams', (req, res) => {
      res.json(this.streams);
    });
    
    // Reset for testing
    this.app.post('/reset', (req, res) => {
      this.streams = [];
      this.processedUrls.clear();
      this.syncedStreams.clear();
      res.json({ success: true });
    });
    
    // Set StreamSource token
    this.app.post('/auth/streamsource', (req, res) => {
      this.streamSourceToken = req.body.token;
      res.json({ success: true });
    });
    
    // Set dual-write mode
    this.app.post('/config/dual-write', (req, res) => {
      this.dualWriteMode = req.body.enabled;
      res.json({ success: true, dualWriteMode: this.dualWriteMode });
    });
    
    // Get sync status
    this.app.get('/sync-status', (req, res) => {
      res.json({
        dualWriteMode: this.dualWriteMode,
        streamSourceUrl: this.streamSourceUrl,
        hasToken: !!this.streamSourceToken,
        processedCount: this.processedUrls.size,
        syncedCount: this.syncedStreams.size,
        processedUrls: Array.from(this.processedUrls),
        syncedUrls: Array.from(this.syncedStreams)
      });
    });
  }
  
  detectPlatform(url) {
    if (url.includes('twitch.tv')) return 'twitch';
    if (url.includes('youtube.com')) return 'youtube';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('kick.com')) return 'kick';
    if (url.includes('facebook.com')) return 'facebook';
    return 'unknown';
  }
  
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock livestream-link-monitor listening on port ${this.port}`);
        resolve();
      });
    });
  }
  
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock livestream-link-monitor stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = MockLivestreamMonitor;