// Mock livestream-link-monitor service for testing
const express = require('express');

class MockLivestreamMonitor {
  constructor(port = 3001) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.streams = [];
    this.processedUrls = new Set();
    
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
    this.app.post('/webhook/discord', (req, res) => {
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
            results.push({ url, success: true });
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
      res.json({ success: true });
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