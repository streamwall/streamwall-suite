#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration for submodule repositories
const SUBMODULES = {
  'streamsource': 'https://github.com/streamwall/streamsource',
  'livestream-link-monitor': 'https://github.com/streamwall/livestream-link-monitor',
  'livesheet-updater': 'https://github.com/streamwall/livesheet-updater',
  'streamwall': 'https://github.com/streamwall/streamwall'
};

const MAIN_REPO = 'https://github.com/sayhiben/streamwall-suite';
const DEFAULT_BRANCH = 'main';

function convertToGitHubUrl(relativePath, currentFile) {
  // Remove any ./ prefix
  relativePath = relativePath.replace(/^\.\//, '');
  
  // Handle parent directory references
  const currentDir = path.dirname(currentFile);
  let resolvedPath = path.resolve(currentDir, relativePath);
  
  // Make path relative to repo root
  resolvedPath = path.relative(process.cwd(), resolvedPath);
  
  // Normalize path separators
  resolvedPath = resolvedPath.replace(/\\/g, '/');
  
  // Check if path goes into a submodule
  for (const [submodule, repoUrl] of Object.entries(SUBMODULES)) {
    if (resolvedPath.startsWith(submodule + '/')) {
      const subPath = resolvedPath.substring(submodule.length + 1);
      return `${repoUrl}/blob/${DEFAULT_BRANCH}/${subPath}`;
    }
  }
  
  // Otherwise, it's in the main repo
  return `${MAIN_REPO}/blob/${DEFAULT_BRANCH}/${resolvedPath}`;
}

function processMarkdownFile(filePath) {
  console.log(`Processing: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Match markdown links: [text](path)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  content = content.replace(linkRegex, (match, text, url) => {
    // Skip if already an absolute URL
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('#')) {
      return match;
    }
    
    // Skip if it's an anchor link
    if (url.startsWith('#')) {
      return match;
    }
    
    // Check if it's a relative path that might cross submodule boundaries
    if (url.includes('../') || url.includes('./') || SUBMODULES.hasOwnProperty(url.split('/')[0])) {
      const absoluteUrl = convertToGitHubUrl(url, filePath);
      console.log(`  Converting: ${url} -> ${absoluteUrl}`);
      modified = true;
      return `[${text}](${absoluteUrl})`;
    }
    
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✓ Updated ${filePath}`);
  }
  
  return modified;
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  let files = [];
  
  if (args.length > 0) {
    // Process specific files
    files = args;
  } else {
    // Find all markdown files
    files = glob.sync('**/*.md', {
      ignore: ['node_modules/**', '**/node_modules/**', '.git/**']
    });
  }
  
  console.log(`Found ${files.length} markdown files to process\n`);
  
  let updatedCount = 0;
  files.forEach(file => {
    if (processMarkdownFile(file)) {
      updatedCount++;
    }
  });
  
  console.log(`\nUpdated ${updatedCount} files`);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { convertToGitHubUrl, processMarkdownFile };