// Helper functions for managing services in tests
const { spawn, execSync } = require('child_process');
const axios = require('axios');

/**
 * Wait for a service to be healthy
 */
async function waitForService(url, maxAttempts = 30, delay = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(url);
      return true;
    } catch (error) {
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(`Service at ${url} failed to start after ${maxAttempts} attempts`);
}

/**
 * Start a service using docker-compose
 */
function startService(serviceName, composeFile = 'docker-compose.yml') {
  const serviceDir = getServiceDirectory(serviceName);
  return new Promise((resolve, reject) => {
    try {
      execSync(`cd ${serviceDir} && docker-compose -f ${composeFile} up -d`, {
        stdio: 'inherit'
      });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stop a service using docker-compose
 */
function stopService(serviceName, composeFile = 'docker-compose.yml') {
  const serviceDir = getServiceDirectory(serviceName);
  try {
    execSync(`cd ${serviceDir} && docker-compose -f ${composeFile} down`, {
      stdio: 'ignore'
    });
  } catch (error) {
    // Ignore errors during shutdown
  }
}

/**
 * Get the directory for a service
 */
function getServiceDirectory(serviceName) {
  const serviceMap = {
    'livestream-link-monitor': 'livestream-link-monitor',
    'livesheet-checker': 'livesheet-checker',
    'streamsource': 'streamsource',
    'streamwall': 'streamwall'
  };
  
  if (!serviceMap[serviceName]) {
    throw new Error(`Unknown service: ${serviceName}`);
  }
  
  return `${process.cwd()}/${serviceMap[serviceName]}`;
}

/**
 * Execute a command and return output
 */
function execCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      ...options
    });
    return output.trim();
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

/**
 * Check if a Docker container is running
 */
function isContainerRunning(containerName) {
  try {
    const output = execSync(`docker ps --format "{{.Names}}" | grep -E "${containerName}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return output.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get logs from a Docker container
 */
function getContainerLogs(containerName, lines = 50) {
  try {
    return execSync(`docker logs --tail ${lines} ${containerName}`, {
      encoding: 'utf8'
    });
  } catch (error) {
    return null;
  }
}

module.exports = {
  waitForService,
  startService,
  stopService,
  getServiceDirectory,
  execCommand,
  isContainerRunning,
  getContainerLogs
};