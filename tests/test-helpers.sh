#!/bin/bash
# Test helpers for setup-wizard testing
# Source this file in your tests for common functionality

# Platform-agnostic way to exclude last line
exclude_last_line() {
    local total_lines=$(wc -l < "$1")
    local lines_to_show=$((total_lines - 1))
    head -n "$lines_to_show" "$1"
}

# Better function extraction for testing
extract_functions() {
    local script_file="$1"
    local stop_pattern="$2"
    
    awk "
        BEGIN { printing = 1 }
        /$stop_pattern/ { printing = 0 }
        printing { print }
    " "$script_file"
}

# Timeout wrapper for commands that might hang
with_timeout() {
    local timeout_seconds="$1"
    shift
    
    if command -v timeout >/dev/null 2>&1; then
        timeout "$timeout_seconds" "$@"
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout "$timeout_seconds" "$@"
    else
        # Fallback: run command in background and kill after timeout
        "$@" &
        local pid=$!
        
        (
            sleep "$timeout_seconds"
            kill -TERM $pid 2>/dev/null
        ) &
        
        local watcher=$!
        wait $pid
        local result=$?
        kill -TERM $watcher 2>/dev/null
        return $result
    fi
}

# Mock all external commands at once
setup_mocks() {
    local mock_dir="$1"
    mkdir -p "$mock_dir"
    
    # Create reusable mock template
    create_mock() {
        local cmd="$1"
        local response="$2"
        cat > "$mock_dir/$cmd" << EOF
#!/bin/bash
echo "MOCK_$(echo $cmd | tr '[:lower:]' '[:upper:]'): \$*" >&2
$response
EOF
        chmod +x "$mock_dir/$cmd"
    }
    
    # System commands
    create_mock "docker" 'exit 0'
    create_mock "docker-compose" 'exit 0'
    create_mock "git" 'exit 0'
    create_mock "curl" 'exit 0'
    create_mock "make" 'exit 0'
    create_mock "lsof" 'exit 1'  # Port is free
    create_mock "openssl" 'echo "mock_secret_$(date +%s)"'
    
    # Add mock directory to PATH
    export PATH="$mock_dir:$PATH"
}

# Simulate user input more reliably
simulate_input() {
    local input_file="$1"
    shift
    
    # Use a FIFO for more reliable input simulation
    local fifo=$(mktemp -u)
    mkfifo "$fifo"
    
    # Write input to FIFO in background
    (
        cat "$input_file" > "$fifo"
        rm -f "$fifo"
    ) &
    
    # Run command with input from FIFO
    "$@" < "$fifo"
    local result=$?
    
    # Cleanup
    rm -f "$fifo"
    return $result
}

# Extract and make functions available for testing
load_script_functions() {
    local script_path="$1"
    
    # Create a temporary file with extracted functions
    local temp_file=$(mktemp)
    
    # Extract everything before main execution
    extract_functions "$script_path" "^# Check if arguments were provided" > "$temp_file"
    
    # Add function exports
    cat >> "$temp_file" << 'EOF'

# Export all functions for testing
export -f print_color print_header check_prerequisites init_submodules
export -f generate_secret prompt_with_default setup_environment
export -f create_directories setup_streamsource setup_services
export -f start_services create_admin_account configure_discord_bot
export -f show_final_instructions show_main_menu full_setup
export -f reconfigure_all configure_specific_service add_integration
export -f validate_only configure_streamsource_only
export -f configure_livestream_monitor_only configure_livesheet_checker_only
export -f configure_streamwall_only configure_twitch_integration
export -f configure_google_sheets parse_args show_help
EOF
    
    # Source the file
    source "$temp_file"
    rm -f "$temp_file"
}

# Create a clean test environment
create_test_env() {
    local test_dir=$(mktemp -d)
    cd "$test_dir"
    
    # Create necessary files
    touch .gitmodules
    
    # Create mock submodules
    mkdir -p streamsource livestream-link-monitor livesheet-checker streamwall
    
    # Setup mocks
    setup_mocks "$test_dir/mocks"
    
    echo "$test_dir"
}

# Cleanup test environment
cleanup_test_env() {
    local test_dir="$1"
    cd /
    rm -rf "$test_dir"
}

# Assert with better error messages
assert_status() {
    local expected="$1"
    local actual="$2"
    local message="$3"
    
    if [ "$expected" -eq "$actual" ]; then
        return 0
    else
        echo "Status assertion failed: $message" >&2
        echo "Expected: $expected, Actual: $actual" >&2
        return 1
    fi
}

# Test a specific function in isolation
test_function() {
    local function_name="$1"
    shift
    
    # Run function in subshell to isolate effects
    (
        # Override any functions that might cause issues
        docker() { echo "MOCK: docker $*"; }
        git() { echo "MOCK: git $*"; }
        read() { echo ""; }  # Default to empty input
        
        # Run the function
        "$function_name" "$@"
    )
}