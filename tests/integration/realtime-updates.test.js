/**
 * Real-time Updates Integration Tests
 * Tests WebSocket/ActionCable real-time communication between services
 */

const axios = require('axios');
const WebSocket = require('ws');
const { delay } = require('../helpers/test-data');

// Mock WebSocket server for ActionCable simulation
class MockActionCableServer {
  constructor(port = 3100) {
    this.port = port;
    this.wss = null;
    this.clients = new Set();
    this.channels = {
      StreamsChannel: new Set(),
      StreamersChannel: new Set(),
      CollaborationChannel: new Set()
    };
  }
  
  start() {
    return new Promise((resolve) => {
      this.wss = new WebSocket.Server({ port: this.port }, () => {
        console.log(`Mock ActionCable server listening on port ${this.port}`);
        resolve();
      });
      
      this.wss.on('connection', (ws) => {
        this.handleConnection(ws);
      });
    });
  }
  
  handleConnection(ws) {
    this.clients.add(ws);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome'
    }));
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Invalid message:', error);
      }
    });
    
    ws.on('close', () => {
      this.clients.delete(ws);
      // Remove from all channels
      Object.values(this.channels).forEach(channel => {
        channel.delete(ws);
      });
    });
  }
  
  handleMessage(ws, message) {
    switch (message.command) {
      case 'subscribe':
        this.handleSubscribe(ws, message);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(ws, message);
        break;
      case 'message':
        this.handleChannelMessage(ws, message);
        break;
    }
  }
  
  handleSubscribe(ws, message) {
    const { identifier } = message;
    const { channel } = JSON.parse(identifier);
    
    if (this.channels[channel]) {
      this.channels[channel].add(ws);
      
      // Send subscription confirmation
      ws.send(JSON.stringify({
        identifier,
        type: 'confirm_subscription'
      }));
    } else {
      ws.send(JSON.stringify({
        identifier,
        type: 'reject_subscription'
      }));
    }
  }
  
  handleUnsubscribe(ws, message) {
    const { identifier } = message;
    const { channel } = JSON.parse(identifier);
    
    if (this.channels[channel]) {
      this.channels[channel].delete(ws);
    }
  }
  
  handleChannelMessage(ws, message) {
    const { identifier, data } = message;
    const { channel } = JSON.parse(identifier);
    
    // Broadcast to all subscribers
    this.broadcast(channel, {
      identifier,
      message: data
    });
  }
  
  broadcast(channel, data) {
    if (this.channels[channel]) {
      this.channels[channel].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    }
  }
  
  broadcastStreamUpdate(action, stream) {
    this.broadcast('StreamsChannel', {
      identifier: JSON.stringify({ channel: 'StreamsChannel' }),
      message: {
        action,
        stream
      }
    });
  }
  
  broadcastCollaborationUpdate(action, data) {
    this.broadcast('CollaborationChannel', {
      identifier: JSON.stringify({ channel: 'CollaborationChannel' }),
      message: {
        action,
        ...data
      }
    });
  }
  
  stop() {
    return new Promise((resolve) => {
      this.clients.forEach(client => client.close());
      if (this.wss) {
        this.wss.close(() => {
          console.log('Mock ActionCable server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Mock StreamSource with WebSocket support
class StreamSourceWithWebSocket {
  constructor(httpPort = 3000, wsPort = 3100) {
    this.httpPort = httpPort;
    this.wsPort = wsPort;
    this.express = require('express');
    this.app = this.express();
    this.httpServer = null;
    this.wsServer = null;
    this.streams = [];
    this.collaborationLocks = new Map();
  }
  
  setupRoutes() {
    this.app.use(this.express.json());
    
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', websocket: 'enabled' });
    });
    
    this.app.get('/cable', (req, res) => {
      res.json({
        websocket_url: `ws://localhost:${this.wsPort}`,
        channels: ['StreamsChannel', 'StreamersChannel', 'CollaborationChannel']
      });
    });
    
    this.app.post('/api/v1/streams', (req, res) => {
      if (!this.checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      
      const stream = {
        id: this.streams.length + 1,
        ...req.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      this.streams.push(stream);
      
      // Broadcast via WebSocket
      if (this.wsServer) {
        this.wsServer.broadcastStreamUpdate('created', stream);
      }
      
      res.status(201).json(stream);
    });
    
    this.app.patch('/api/v1/streams/:id', (req, res) => {
      if (!this.checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      
      const id = parseInt(req.params.id);
      const stream = this.streams.find(s => s.id === id);
      
      if (!stream) return res.status(404).json({ error: 'Stream not found' });
      
      Object.assign(stream, req.body, { updated_at: new Date().toISOString() });
      
      // Broadcast via WebSocket
      if (this.wsServer) {
        this.wsServer.broadcastStreamUpdate('updated', stream);
      }
      
      res.json(stream);
    });
    
    this.app.post('/api/v1/streams/:id/archive', (req, res) => {
      if (!this.checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      
      const id = parseInt(req.params.id);
      const stream = this.streams.find(s => s.id === id);
      
      if (!stream) return res.status(404).json({ error: 'Stream not found' });
      
      stream.status = 'archived';
      stream.archived_at = new Date().toISOString();
      stream.updated_at = new Date().toISOString();
      
      // Broadcast via WebSocket
      if (this.wsServer) {
        this.wsServer.broadcastStreamUpdate('archived', stream);
      }
      
      res.json(stream);
    });
    
    // Collaboration endpoints
    this.app.post('/api/v1/collaboration/lock', (req, res) => {
      if (!this.checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      
      const { resource_type, resource_id, field, user_id } = req.body;
      const lockKey = `${resource_type}:${resource_id}:${field}`;
      
      // Check if already locked
      const existingLock = this.collaborationLocks.get(lockKey);
      if (existingLock && existingLock.user_id !== user_id) {
        return res.status(409).json({ 
          error: 'Resource locked',
          locked_by: existingLock.user_id,
          locked_at: existingLock.locked_at
        });
      }
      
      // Create or update lock
      const lock = {
        user_id,
        locked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5000).toISOString() // 5 second timeout
      };
      
      this.collaborationLocks.set(lockKey, lock);
      
      // Broadcast lock event
      if (this.wsServer) {
        this.wsServer.broadcastCollaborationUpdate('locked', {
          resource_type,
          resource_id,
          field,
          user_id,
          locked_at: lock.locked_at
        });
      }
      
      res.json({ success: true, lock });
    });
    
    this.app.post('/api/v1/collaboration/unlock', (req, res) => {
      if (!this.checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      
      const { resource_type, resource_id, field, user_id } = req.body;
      const lockKey = `${resource_type}:${resource_id}:${field}`;
      
      const existingLock = this.collaborationLocks.get(lockKey);
      if (!existingLock || existingLock.user_id !== user_id) {
        return res.status(404).json({ error: 'Lock not found or not owned by user' });
      }
      
      this.collaborationLocks.delete(lockKey);
      
      // Broadcast unlock event
      if (this.wsServer) {
        this.wsServer.broadcastCollaborationUpdate('unlocked', {
          resource_type,
          resource_id,
          field,
          user_id
        });
      }
      
      res.json({ success: true });
    });
    
    this.app.get('/api/v1/streams', (req, res) => {
      if (!this.checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      res.json({ streams: this.streams });
    });
    
    this.app.post('/api/v1/reset', (req, res) => {
      this.streams = [];
      this.collaborationLocks.clear();
      res.json({ success: true });
    });
  }
  
  checkAuth(req) {
    const authHeader = req.headers['authorization'];
    return authHeader && authHeader.startsWith('Bearer ');
  }
  
  async start() {
    this.setupRoutes();
    
    // Start WebSocket server
    this.wsServer = new MockActionCableServer(this.wsPort);
    await this.wsServer.start();
    
    // Start HTTP server
    return new Promise((resolve) => {
      this.httpServer = this.app.listen(this.httpPort, () => {
        console.log(`StreamSource with WebSocket listening on port ${this.httpPort}`);
        resolve();
      });
    });
  }
  
  async stop() {
    await this.wsServer?.stop();
    
    return new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// WebSocket client helper
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.messages = [];
    this.subscriptions = new Set();
  }
  
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.on('open', () => {
        console.log('WebSocket connected');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        const message = JSON.parse(data);
        this.messages.push(message);
        console.log('Received:', message.type || message.identifier);
      });
      
      this.ws.on('error', reject);
    });
  }
  
  subscribe(channel) {
    const identifier = JSON.stringify({ channel });
    this.ws.send(JSON.stringify({
      command: 'subscribe',
      identifier
    }));
    this.subscriptions.add(identifier);
  }
  
  sendMessage(channel, data) {
    const identifier = JSON.stringify({ channel });
    this.ws.send(JSON.stringify({
      command: 'message',
      identifier,
      data
    }));
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
  
  waitForMessage(predicate, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkMessages = () => {
        const message = this.messages.find(predicate);
        if (message) {
          resolve(message);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for message'));
        } else {
          setTimeout(checkMessages, 100);
        }
      };
      
      checkMessages();
    });
  }
}

describe('Real-time Updates Integration', () => {
  let streamSource;
  let wsClient1;
  let wsClient2;
  const authHeader = { headers: { Authorization: 'Bearer test-token' } };
  
  beforeAll(async () => {
    streamSource = new StreamSourceWithWebSocket();
    await streamSource.start();
  });
  
  afterAll(async () => {
    wsClient1?.disconnect();
    wsClient2?.disconnect();
    await streamSource?.stop();
  });
  
  afterEach(async () => {
    await axios.post('http://localhost:3000/api/v1/reset').catch(() => {});
  });
  
  describe('WebSocket Connection', () => {
    test('should connect to ActionCable endpoint', async () => {
      // Get cable info
      const cableInfo = await axios.get('http://localhost:3000/cable');
      expect(cableInfo.data.websocket_url).toBe('ws://localhost:3100');
      expect(cableInfo.data.channels).toContain('StreamsChannel');
      
      // Connect WebSocket
      wsClient1 = new WebSocketClient('ws://localhost:3100');
      await wsClient1.connect();
      
      // Wait for welcome message
      const welcome = await wsClient1.waitForMessage(m => m.type === 'welcome');
      expect(welcome.type).toBe('welcome');
    });
    
    test('should subscribe to channels', async () => {
      wsClient1 = new WebSocketClient('ws://localhost:3100');
      await wsClient1.connect();
      
      // Subscribe to StreamsChannel
      wsClient1.subscribe('StreamsChannel');
      
      // Wait for subscription confirmation
      const confirmation = await wsClient1.waitForMessage(
        m => m.type === 'confirm_subscription'
      );
      expect(confirmation.type).toBe('confirm_subscription');
    });
  });
  
  describe('Stream Updates Broadcasting', () => {
    beforeEach(async () => {
      // Connect and subscribe clients
      wsClient1 = new WebSocketClient('ws://localhost:3100');
      wsClient2 = new WebSocketClient('ws://localhost:3100');
      
      await wsClient1.connect();
      await wsClient2.connect();
      
      wsClient1.subscribe('StreamsChannel');
      wsClient2.subscribe('StreamsChannel');
      
      // Wait for subscriptions
      await delay(500);
    });
    
    test('should broadcast when stream is created', async () => {
      // Create a stream via API
      const streamData = {
        url: 'https://twitch.tv/realtime',
        platform: 'twitch',
        status: 'live'
      };
      
      const createResponse = await axios.post(
        'http://localhost:3000/api/v1/streams',
        streamData,
        authHeader
      );
      
      expect(createResponse.status).toBe(201);
      
      // Both clients should receive the update
      const update1 = await wsClient1.waitForMessage(
        m => m.message?.action === 'created'
      );
      const update2 = await wsClient2.waitForMessage(
        m => m.message?.action === 'created'
      );
      
      expect(update1.message.action).toBe('created');
      expect(update1.message.stream.url).toBe(streamData.url);
      
      expect(update2.message.action).toBe('created');
      expect(update2.message.stream.url).toBe(streamData.url);
    });
    
    test('should broadcast when stream is updated', async () => {
      // Create a stream first
      const createResponse = await axios.post(
        'http://localhost:3000/api/v1/streams',
        { url: 'https://youtube.com/realtime', platform: 'youtube', status: 'checking' },
        authHeader
      );
      
      const streamId = createResponse.data.id;
      
      // Clear previous messages
      wsClient1.messages = [];
      wsClient2.messages = [];
      
      // Update the stream
      await axios.patch(
        `http://localhost:3000/api/v1/streams/${streamId}`,
        { status: 'live' },
        authHeader
      );
      
      // Check broadcasts
      const update1 = await wsClient1.waitForMessage(
        m => m.message?.action === 'updated'
      );
      
      expect(update1.message.action).toBe('updated');
      expect(update1.message.stream.id).toBe(streamId);
      expect(update1.message.stream.status).toBe('live');
    });
    
    test('should broadcast when stream is archived', async () => {
      // Create a stream
      const createResponse = await axios.post(
        'http://localhost:3000/api/v1/streams',
        { url: 'https://kick.com/archive-test', platform: 'kick', status: 'live' },
        authHeader
      );
      
      const streamId = createResponse.data.id;
      
      // Clear messages
      wsClient1.messages = [];
      
      // Archive the stream
      await axios.post(
        `http://localhost:3000/api/v1/streams/${streamId}/archive`,
        {},
        authHeader
      );
      
      // Check broadcast
      const update = await wsClient1.waitForMessage(
        m => m.message?.action === 'archived'
      );
      
      expect(update.message.action).toBe('archived');
      expect(update.message.stream.status).toBe('archived');
      expect(update.message.stream.archived_at).toBeDefined();
    });
  });
  
  describe('Collaborative Editing', () => {
    beforeEach(async () => {
      wsClient1 = new WebSocketClient('ws://localhost:3100');
      wsClient2 = new WebSocketClient('ws://localhost:3100');
      
      await wsClient1.connect();
      await wsClient2.connect();
      
      wsClient1.subscribe('CollaborationChannel');
      wsClient2.subscribe('CollaborationChannel');
      
      await delay(500);
    });
    
    test('should handle cell locking for collaborative editing', async () => {
      // User 1 locks a cell
      const lockResponse = await axios.post(
        'http://localhost:3000/api/v1/collaboration/lock',
        {
          resource_type: 'stream',
          resource_id: 1,
          field: 'title',
          user_id: 'user1'
        },
        authHeader
      );
      
      expect(lockResponse.status).toBe(200);
      
      // User 2 should receive lock notification
      const lockNotification = await wsClient2.waitForMessage(
        m => m.message?.action === 'locked'
      );
      
      expect(lockNotification.message.action).toBe('locked');
      expect(lockNotification.message.user_id).toBe('user1');
      expect(lockNotification.message.field).toBe('title');
      
      // User 2 tries to lock same cell
      const conflictResponse = await axios.post(
        'http://localhost:3000/api/v1/collaboration/lock',
        {
          resource_type: 'stream',
          resource_id: 1,
          field: 'title',
          user_id: 'user2'
        },
        authHeader
      ).catch(e => e.response);
      
      expect(conflictResponse.status).toBe(409);
      expect(conflictResponse.data.locked_by).toBe('user1');
    });
    
    test('should broadcast unlock events', async () => {
      // Lock a cell
      await axios.post(
        'http://localhost:3000/api/v1/collaboration/lock',
        {
          resource_type: 'stream',
          resource_id: 2,
          field: 'status',
          user_id: 'user1'
        },
        authHeader
      );
      
      // Clear messages
      wsClient2.messages = [];
      
      // Unlock the cell
      await axios.post(
        'http://localhost:3000/api/v1/collaboration/unlock',
        {
          resource_type: 'stream',
          resource_id: 2,
          field: 'status',
          user_id: 'user1'
        },
        authHeader
      );
      
      // Check unlock broadcast
      const unlockNotification = await wsClient2.waitForMessage(
        m => m.message?.action === 'unlocked'
      );
      
      expect(unlockNotification.message.action).toBe('unlocked');
      expect(unlockNotification.message.field).toBe('status');
    });
  });
  
  describe('Multi-Client Scenarios', () => {
    test('should handle multiple clients subscribing and unsubscribing', async () => {
      const clients = [];
      
      // Create 5 clients
      for (let i = 0; i < 5; i++) {
        const client = new WebSocketClient('ws://localhost:3100');
        await client.connect();
        client.subscribe('StreamsChannel');
        clients.push(client);
      }
      
      await delay(500);
      
      // Create a stream
      await axios.post(
        'http://localhost:3000/api/v1/streams',
        { url: 'https://twitch.tv/multicast', platform: 'twitch' },
        authHeader
      );
      
      // All clients should receive the update
      const updates = await Promise.all(
        clients.map(client => 
          client.waitForMessage(m => m.message?.action === 'created')
        )
      );
      
      expect(updates).toHaveLength(5);
      expect(updates.every(u => u.message.stream.url === 'https://twitch.tv/multicast')).toBe(true);
      
      // Cleanup
      clients.forEach(client => client.disconnect());
    });
  });
  
  describe('Connection Recovery', () => {
    test('should handle client disconnection and reconnection', async () => {
      wsClient1 = new WebSocketClient('ws://localhost:3100');
      await wsClient1.connect();
      wsClient1.subscribe('StreamsChannel');
      
      await delay(500);
      
      // Disconnect
      wsClient1.disconnect();
      
      // Create stream while disconnected
      await axios.post(
        'http://localhost:3000/api/v1/streams',
        { url: 'https://youtube.com/missed', platform: 'youtube' },
        authHeader
      );
      
      // Reconnect
      wsClient1 = new WebSocketClient('ws://localhost:3100');
      await wsClient1.connect();
      wsClient1.subscribe('StreamsChannel');
      
      await delay(500);
      
      // Create another stream
      await axios.post(
        'http://localhost:3000/api/v1/streams',
        { url: 'https://youtube.com/received', platform: 'youtube' },
        authHeader
      );
      
      // Should only receive the new stream update
      const update = await wsClient1.waitForMessage(
        m => m.message?.action === 'created'
      );
      
      expect(update.message.stream.url).toBe('https://youtube.com/received');
      
      // Should not have the missed update
      const missedUpdate = wsClient1.messages.find(
        m => m.message?.stream?.url === 'https://youtube.com/missed'
      );
      expect(missedUpdate).toBeUndefined();
    });
  });
});