# Testing the Setup Wizard

This directory contains comprehensive tests for the Streamwall setup wizard and related scripts.

## Test Suites

### 1. Basic Shell Tests (`test-setup-wizard.sh`)
A custom test framework that tests individual functions in isolation:
- Color output functions
- Secret generation
- Environment file creation
- Directory creation
- Command-line argument parsing
- Menu navigation
- Service configuration

### 2. BATS Tests (`setup-wizard.bats`)
Industry-standard Bash Automated Testing System tests:
- Help message display
- Invalid argument handling
- Environment setup
- Backup creation
- Service-specific configuration
- Integration configuration
- Email validation
- Discord setup flow
- Docker compose compatibility

### 3. ShellCheck Linting
Static analysis for shell scripts to catch common issues:
- Syntax errors
- Security issues
- Portability problems
- Best practice violations

## Running Tests Locally

### Quick Test
```bash
# Run all available tests
make test-setup-wizard
```

### Individual Test Suites

#### Basic Tests
```bash
./test-setup-wizard.sh
```

#### BATS Tests
```bash
# Install BATS first
npm install -g bats

# Run BATS tests
bats tests/setup-wizard.bats
```

#### ShellCheck
```bash
# Install ShellCheck
# macOS: brew install shellcheck
# Ubuntu: apt-get install shellcheck

# Run linting
shellcheck setup-wizard.sh validate-config.sh
```

## Writing New Tests

### BATS Test Structure
```bash
@test "description of what you're testing" {
    # Arrange - set up test conditions
    echo "TEST=value" > .env
    
    # Act - run the code being tested
    run bash setup-wizard.sh --validate
    
    # Assert - check the results
    [ "$status" -eq 0 ]
    [[ "$output" == *"expected text"* ]]
}
```

### Mocking External Commands
Tests use mocked versions of system commands to avoid side effects:

```bash
# Create mock docker command
cat > mocks/docker << 'EOF'
#!/bin/bash
echo "MOCK_DOCKER: $@" >&2
exit 0
EOF
chmod +x mocks/docker
```

## Test Coverage

The test suite covers:

1. **Argument Parsing**
   - Valid arguments (--full, --service, etc.)
   - Invalid arguments
   - Help display

2. **Environment Setup**
   - .env file creation
   - Secret generation
   - Backup on reconfigure
   - Directory creation

3. **User Interactions**
   - Menu navigation
   - Input validation
   - Email format checking
   - Discord setup flow

4. **Service Management**
   - Individual service configuration
   - Integration setup
   - Docker compose compatibility

5. **Error Handling**
   - Missing files
   - Invalid input
   - Failed commands

## CI/CD Integration

Tests run automatically on:
- Push to main branch
- Pull requests
- Changes to setup scripts

GitHub Actions workflow runs:
1. Basic shell tests
2. BATS tests
3. ShellCheck linting
4. Integration scenarios

## Common Test Patterns

### Testing Interactive Prompts
```bash
# Provide input via pipe
echo -e "y\n1\nadmin@test.com\n" | bash setup-wizard.sh

# Or use heredoc
run_with_input() {
    bash setup-wizard.sh <<EOF
$1
EOF
}
```

### Testing File Creation
```bash
@test "creates required files" {
    run bash setup-wizard.sh --full
    
    [ -f ".env" ]
    [ -f "admin-credentials.txt" ]
    [ -d "postgres-data" ]
}
```

### Testing Command Output
```bash
@test "shows correct message" {
    run bash setup-wizard.sh --help
    
    [[ "$output" == *"Streamwall Setup Wizard"* ]]
    [[ "$output" == *"Usage:"* ]]
}
```

## Debugging Tests

### Run with verbose output
```bash
# BATS verbose mode
bats -v tests/setup-wizard.bats

# Basic tests with debug
DEBUG=1 ./test-setup-wizard.sh
```

### Print variables in tests
```bash
@test "debug example" {
    echo "Variable value: $MY_VAR" >&3
    run my_command
    echo "Output: $output" >&3
    echo "Status: $status" >&3
}
```

## Test Maintenance

When modifying `setup-wizard.sh`:
1. Run the test suite to ensure nothing breaks
2. Add new tests for new functionality
3. Update mocks if new external commands are used
4. Check test coverage for untested code paths

## Known Limitations

1. **Docker Testing**: Tests use mocked Docker commands to avoid requiring Docker in CI
2. **Network Operations**: External API calls are mocked
3. **Time-based Operations**: Sleep commands are minimized or mocked
4. **TTY Operations**: Some interactive features can't be fully tested in CI

## Future Improvements

- [ ] Add code coverage reporting
- [ ] Test timeout handling
- [ ] Test signal handling (Ctrl+C)
- [ ] Add performance benchmarks
- [ ] Test concurrent execution scenarios