/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/tests/**/*.test.[jt]s',
    '**/tests/**/*.spec.[jt]s'
  ],
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: [
    'tests/**/*.{js}',
    '!tests/**/*.d.ts',
  ],
  testTimeout: 30000, // 30 seconds for integration tests
  globalSetup: '<rootDir>/tests/setup.js',
  globalTeardown: '<rootDir>/tests/teardown.js',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/streamwall/',
    '<rootDir>/streamsource/',
    '<rootDir>/livestream-link-monitor/',
    '<rootDir>/livesheet-updater/'
  ],
  // Fix circular structure issues
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  // Disable worker serialization that causes circular JSON issues
  runner: 'jest-serial-runner'
};