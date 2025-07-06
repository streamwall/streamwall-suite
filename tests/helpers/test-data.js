// Test data generators and fixtures

/**
 * Generate a test stream object
 */
function generateTestStream(overrides = {}) {
  const defaults = {
    id: `test-stream-${Date.now()}`,
    title: 'Test Stream',
    url: 'https://twitch.tv/teststreamer',
    platform: 'twitch',
    status: 'live',
    streamer: {
      name: 'Test Streamer',
      platform_username: 'teststreamer'
    },
    location: {
      city: 'Test City',
      state: 'TC'
    },
    metadata: {
      added_date: new Date().toISOString(),
      posted_by: 'test_user#1234',
      last_checked: new Date().toISOString(),
      pinned: false
    }
  };

  return { ...defaults, ...overrides };
}

/**
 * Generate test Discord message
 */
function generateDiscordMessage(content, author = 'test_user#1234') {
  return {
    content,
    author: {
      username: author.split('#')[0],
      discriminator: author.split('#')[1],
      id: `${Date.now()}`
    },
    channel: {
      id: 'test-channel-id',
      name: 'test-channel'
    },
    guild: {
      id: 'test-guild-id',
      name: 'Test Server'
    },
    createdTimestamp: Date.now()
  };
}

/**
 * Generate test Twitch message
 */
function generateTwitchMessage(content, username = 'testuser') {
  return {
    content,
    username,
    'user-id': `${Date.now()}`,
    'room-id': 'test-room-id',
    'tmi-sent-ts': `${Date.now()}`
  };
}

/**
 * Test URLs for different platforms
 */
const TEST_URLS = {
  twitch: [
    'https://www.twitch.tv/teststreamer',
    'https://twitch.tv/anothertest',
    'twitch.tv/shorturl'
  ],
  youtube: [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/live/abcd1234',
    'https://youtu.be/dQw4w9WgXcQ'
  ],
  tiktok: [
    'https://www.tiktok.com/@testuser/live',
    'https://tiktok.com/@anotheruser/live'
  ],
  kick: [
    'https://kick.com/teststreamer',
    'kick.com/anothertest'
  ],
  facebook: [
    'https://www.facebook.com/testpage/live',
    'https://fb.watch/abcd1234/'
  ]
};

/**
 * Test locations
 */
const TEST_LOCATIONS = [
  { city: 'New York', state: 'NY' },
  { city: 'Los Angeles', state: 'CA' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Houston', state: 'TX' },
  { city: 'Phoenix', state: 'AZ' }
];

/**
 * Wait for a condition to be true
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Timeout waiting for condition');
}

/**
 * Create a delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateTestStream,
  generateDiscordMessage,
  generateTwitchMessage,
  TEST_URLS,
  TEST_LOCATIONS,
  waitFor,
  delay
};