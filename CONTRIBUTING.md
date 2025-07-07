# Contributing to Streamwall

Thank you for your interest in contributing to Streamwall! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## How to Contribute

### Reporting Issues

1. **Check existing issues** to avoid duplicates
2. **Use issue templates** when available
3. **Provide details**:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, versions)
   - Error messages and logs

### Suggesting Features

1. **Check the roadmap** and existing feature requests
2. **Describe the use case** and benefits
3. **Consider implementation** complexity
4. **Be open to discussion** and alternative solutions

### Contributing Code

#### Getting Started

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then:
   git clone --recursive https://github.com/YOUR_USERNAME/streamwall-suite.git
   cd streamwall-suite
   git remote add upstream https://github.com/streamwall/streamwall-suite.git
   ```

2. **Set up development environment**
   ```bash
   # Initialize submodules if needed
   git submodule update --init --recursive
   
   # Run setup
   make setup
   cp .env.example .env
   # Configure your .env file
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Working with Submodules

If you need to make changes to a service (submodule):

1. **Navigate to the service directory**
   ```bash
   cd streamsource  # or livestream-link-monitor, etc.
   ```

2. **Create a feature branch in the submodule**
   ```bash
   git checkout -b feature/your-feature
   ```

3. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: your changes"
   ```

4. **Push to your fork of the service**
   ```bash
   git push origin feature/your-feature
   ```

5. **Update the parent repository**
   ```bash
   cd ..
   git add streamsource
   git commit -m "Update streamsource submodule"
   ```

#### Development Process

1. **Write tests first** (TDD approach)
2. **Make your changes**
3. **Follow coding standards**
4. **Run tests**
   ```bash
   make test
   make test-integration
   ```

5. **Update documentation**
6. **Commit with clear messages**

#### Commit Guidelines

Follow conventional commits format:
```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or auxiliary tool changes

Examples:
```bash
git commit -m "feat(monitor): add support for Kick platform"
git commit -m "fix(api): handle null values in stream status"
git commit -m "docs: update API documentation for v2 endpoints"
```

#### Pull Request Process

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create Pull Request**
   - Use PR template
   - Link related issues
   - Describe changes clearly
   - Include screenshots if UI changes

4. **Code Review**
   - Address feedback promptly
   - Be open to suggestions
   - Keep discussions professional

## Coding Standards

### General Guidelines

- Write clear, self-documenting code
- Keep functions small and focused
- Use meaningful variable names
- Add comments for complex logic
- Follow DRY (Don't Repeat Yourself)
- YAGNI (You Aren't Gonna Need It)

### Language-Specific Standards

#### Ruby (StreamSource)

Follow Ruby Style Guide and use RuboCop:
```ruby
# Good
def calculate_stream_duration(start_time, end_time)
  return 0 if start_time.nil? || end_time.nil?
  
  (end_time - start_time).to_i
end

# Bad
def calc_dur(s, e)
  (e - s).to_i rescue 0
end
```

Run RuboCop:
```bash
docker-compose exec streamsource bundle exec rubocop -A
```

#### JavaScript/TypeScript

Follow ESLint rules:
```javascript
// Good
async function fetchStreamData(streamId) {
  try {
    const response = await api.get(`/streams/${streamId}`);
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch stream', { streamId, error });
    throw new StreamNotFoundError(streamId);
  }
}

// Bad
async function getData(id) {
  const res = await api.get('/streams/' + id);
  return res.data;
}
```

Run ESLint:
```bash
npm run lint
npm run lint:fix
```

### Testing Standards

#### Test Coverage
- Maintain >80% code coverage
- Write unit tests for all new code
- Include integration tests for API changes
- Test error cases and edge conditions

#### Test Structure
```javascript
describe('StreamService', () => {
  describe('createStream', () => {
    it('should create a new stream with valid data', async () => {
      // Arrange
      const streamData = { url: 'https://twitch.tv/test' };
      
      // Act
      const stream = await streamService.createStream(streamData);
      
      // Assert
      expect(stream).toHaveProperty('id');
      expect(stream.url).toBe(streamData.url);
    });
    
    it('should throw error for invalid URL', async () => {
      // Test error case
    });
  });
});
```

## Documentation

### Code Documentation

#### Ruby
```ruby
# Processes a stream URL and extracts metadata
#
# @param url [String] the stream URL to process
# @param options [Hash] processing options
# @option options [Boolean] :validate (true) whether to validate the URL
# @return [Stream] the created or updated stream object
# @raise [InvalidUrlError] if the URL is invalid
def process_stream_url(url, options = {})
  # Implementation
end
```

#### JavaScript
```javascript
/**
 * Processes a stream URL and extracts metadata
 * @param {string} url - The stream URL to process
 * @param {Object} options - Processing options
 * @param {boolean} options.validate - Whether to validate the URL
 * @returns {Promise<Stream>} The created or updated stream object
 * @throws {InvalidUrlError} If the URL is invalid
 */
async function processStreamUrl(url, options = {}) {
  // Implementation
}
```

### API Documentation

Update OpenAPI/Swagger specs when changing APIs:
```yaml
paths:
  /api/v1/streams:
    post:
      summary: Create a new stream
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/StreamInput'
      responses:
        '201':
          description: Stream created successfully
```

## Service-Specific Guidelines

### StreamSource (Rails)

1. Follow Rails conventions
2. Use strong parameters
3. Write request specs for controllers
4. Use service objects for complex logic
5. Keep controllers thin

### Livestream Monitor

1. Handle rate limits gracefully
2. Implement exponential backoff
3. Log all external API calls
4. Cache platform responses
5. Validate URLs before processing

### Streamwall (Electron)

1. Separate main/renderer concerns
2. Use IPC for communication
3. Handle offline scenarios
4. Optimize for performance
5. Test on multiple platforms

## Release Process

### Version Numbering

Follow Semantic Versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped
- [ ] Migration guide (if breaking changes)
- [ ] Release notes drafted

## Getting Help

### Resources

- [Architecture Documentation](docs/ARCHITECTURE.md)
- [API Documentation](docs/API_INTERFACES.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- [Development Setup](README.md#development)

### Communication Channels

- GitHub Issues: Bug reports and features
- GitHub Discussions: Questions and ideas
- Pull Request: Code contributions

## Recognition

Contributors are recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project documentation

Thank you for contributing to Streamwall! 🎉