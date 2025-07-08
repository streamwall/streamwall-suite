#!/usr/bin/env bats
# Improved BATS test suite for setup-wizard.sh

# Load test helpers
load() {
    source "${BATS_TEST_DIRNAME}/test-helpers.sh"
}

setup() {
    load
    export TEST_ENV=$(create_test_env)
    export ORIG_DIR="${BATS_TEST_DIRNAME}/.."
    cd "$TEST_ENV"
    
    # Load the setup wizard functions
    load_script_functions "$ORIG_DIR/setup-wizard.sh"
}

teardown() {
    cleanup_test_env "$TEST_ENV"
}

# Test: Help message
@test "setup-wizard shows help with --help flag" {
    run bash "$ORIG_DIR/setup-wizard.sh" --help
    assert_status 0 "$status" "Help should exit with status 0"
    [[ "$output" == *"Streamwall Setup Wizard"* ]]
    [[ "$output" == *"Usage:"* ]]
}

# Test: Generate secret function
@test "generate_secret creates non-empty string" {
    # Function should be available after load_script_functions
    run bash -c "source $BATS_TEST_DIRNAME/test-helpers.sh; load_script_functions '$ORIG_DIR/setup-wizard.sh'; generate_secret"
    assert_status 0 "$status" "generate_secret should succeed"
    [ -n "$output" ]
    [[ "$output" == "mock_secret_"* ]]
}

# Test: Directory creation function
@test "create_directories creates required directories" {
    # Run in isolated environment
    run bash -c "
        cd '$TEST_ENV'
        source '$BATS_TEST_DIRNAME/test-helpers.sh'
        load_script_functions '$ORIG_DIR/setup-wizard.sh'
        create_directories
        ls -la
    "
    
    assert_status 0 "$status" "create_directories should succeed"
    [[ "$output" == *"postgres-data"* ]]
    [[ "$output" == *"redis-data"* ]]
    [[ "$output" == *"logs"* ]]
}

# Test: Environment file creation with input simulation
@test "setup creates .env file with secure defaults" {
    # Create .env.example
    cat > .env.example << 'EOF'
NODE_ENV=development
SECRET_KEY_BASE=change_me
JWT_SECRET=change_me
STREAMSOURCE_API_KEY=change_me
EOF
    
    # Create input file
    cat > test_input << 'EOF'
y
1
EOF
    
    # Run setup with timeout
    run with_timeout 5s bash "$ORIG_DIR/setup-wizard.sh" --full < test_input
    
    # Check .env was created
    [ -f ".env" ]
    
    # Verify secrets were generated
    grep -q "SECRET_KEY_BASE=mock_secret_" .env
    grep -q "JWT_SECRET=mock_secret_" .env
}

# Test: Backup functionality
@test "reconfigure backs up existing .env" {
    # Create existing .env
    echo "TEST=value" > .env
    touch .setup-complete
    
    # Create input for reconfigure
    echo -e "2\nY\nn\n" > test_input
    
    # Run with timeout
    run with_timeout 5s bash "$ORIG_DIR/setup-wizard.sh" < test_input
    
    # Check backup exists
    ls .env.backup.* >/dev/null 2>&1
    assert_status 0 $? "Backup file should exist"
}

# Test: Service configuration
@test "can configure specific service non-interactively" {
    run with_timeout 5s bash "$ORIG_DIR/setup-wizard.sh" --service streamsource < /dev/null
    
    # Should not hang or fail catastrophically
    [[ "$output" == *"Configure StreamSource"* ]]
}

# Test: Validation script execution
@test "validation command runs validation script" {
    # Create mock validation script
    cat > validate-config.sh << 'EOF'
#!/bin/bash
echo "Validation successful"
exit 0
EOF
    chmod +x validate-config.sh
    
    run bash "$ORIG_DIR/setup-wizard.sh" --validate
    assert_status 0 "$status" "Validation should succeed"
    [[ "$output" == *"Validation successful"* ]]
}

# Test: Email validation regex
@test "email validation accepts valid emails" {
    run bash -c "
        source '$BATS_TEST_DIRNAME/test-helpers.sh'
        load_script_functions '$ORIG_DIR/setup-wizard.sh'
        
        # Override functions
        docker() { return 0; }
        read() { 
            case \"\$*\" in
                *email*) echo 'test@example.com' ;;
                *) echo '' ;;
            esac
        }
        chmod() { return 0; }
        
        # Capture output
        create_admin_account 2>&1 | grep -q 'test@example.com' && echo 'Email accepted'
    "
    
    [[ "$output" == *"Email accepted"* ]]
}

# Test: Port checking in validator
@test "validate-config checks configuration" {
    # Create a simple .env
    cat > .env << 'EOF'
NODE_ENV=development
SECRET_KEY_BASE=test_key_long_enough_for_validation
JWT_SECRET=test_jwt_long_enough_for_validation
STREAMSOURCE_API_KEY=test_api_key
POSTGRES_USER=test
POSTGRES_PASSWORD=test
POSTGRES_DB=test
EOF
    
    # Run validator if it exists
    if [ -f "$ORIG_DIR/validate-config.sh" ]; then
        run bash "$ORIG_DIR/validate-config.sh"
        # Should at least run without crashing
        [[ "$output" == *"Configuration"* ]]
    else
        skip "validate-config.sh not found"
    fi
}

# Test: Discord configuration flow with proper input
@test "discord integration can be configured" {
    echo "STREAMSOURCE_API_KEY=test" > .env
    
    # Create input for Discord config
    cat > discord_input << 'EOF'
n
EOF
    
    run with_timeout 5s bash "$ORIG_DIR/setup-wizard.sh" --integration discord < discord_input
    
    [[ "$output" == *"Discord Bot Configuration"* ]]
    [[ "$output" == *"Skipping Discord configuration"* ]]
}

# Test: First run detection
@test "detects first run vs subsequent runs" {
    # First run (no .env or .setup-complete)
    rm -f .env .setup-complete
    
    echo "6" > exit_input
    run with_timeout 5s bash "$ORIG_DIR/setup-wizard.sh" < exit_input
    
    [[ "$output" == *"No previous setup detected"* ]]
}

# Test: Menu display on subsequent runs
@test "shows menu when setup already complete" {
    # Create markers for completed setup
    touch .env .setup-complete
    
    echo "6" > exit_input
    run with_timeout 5s bash "$ORIG_DIR/setup-wizard.sh" < exit_input
    
    [[ "$output" == *"Choose setup mode:"* ]]
}

# Test: Argument parsing for all options
@test "all command line arguments are recognized" {
    # Test each argument
    run bash "$ORIG_DIR/setup-wizard.sh" --full < /dev/null
    [[ "$output" == *"Full Setup Mode"* ]]
    
    touch .env .setup-complete
    run bash "$ORIG_DIR/setup-wizard.sh" --reconfigure < /dev/null
    [[ "$output" == *"Reconfigure All Services"* ]]
    
    run bash "$ORIG_DIR/setup-wizard.sh" --service invalid-service
    [ "$status" -ne 0 ]
    [[ "$output" == *"Unknown service"* ]]
}

# Test: Submodule initialization
@test "initializes git submodules when present" {
    # Create .gitmodules file
    cat > .gitmodules << 'EOF'
[submodule "test"]
    path = test
    url = https://example.com/test.git
EOF
    
    echo -e "y\n1\n" > input
    run with_timeout 10s bash "$ORIG_DIR/setup-wizard.sh" --full < input
    
    [[ "$output" == *"Initializing Git Submodules"* ]]
    # Should see git mock output
    [[ "$output" == *"MOCK"* ]]
}

# Test: Function exports work correctly
@test "all major functions are accessible after loading" {
    run bash -c "
        source '$BATS_TEST_DIRNAME/test-helpers.sh'
        load_script_functions '$ORIG_DIR/setup-wizard.sh'
        
        # Check if functions exist
        type -t print_color >/dev/null && echo 'print_color exists'
        type -t generate_secret >/dev/null && echo 'generate_secret exists'
        type -t create_directories >/dev/null && echo 'create_directories exists'
    "
    
    [[ "$output" == *"print_color exists"* ]]
    [[ "$output" == *"generate_secret exists"* ]]
    [[ "$output" == *"create_directories exists"* ]]
}