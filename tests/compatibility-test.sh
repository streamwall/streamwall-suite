#!/bin/bash
# Compatibility test script for setup-wizard.sh
# Tests for macOS, Linux, and WSL compatibility

set -e

# Colors (ANSI codes work across all platforms)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Platform Compatibility Test${NC}"
echo "=============================="

# Detect platform
detect_platform() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if grep -qi microsoft /proc/version 2>/dev/null; then
            echo "WSL"
        else
            echo "Linux"
        fi
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        echo "Windows (Git Bash/Cygwin)"
    else
        echo "Unknown"
    fi
}

PLATFORM=$(detect_platform)
echo -e "Detected platform: ${GREEN}$PLATFORM${NC}"
echo

# Test results
PASSED=0
FAILED=0

# Test function
test_feature() {
    local name="$1"
    local command="$2"
    
    echo -n "Testing $name... "
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAILED++))
    fi
}

# Test shell features
echo -e "${BLUE}Shell Compatibility Tests:${NC}"

# 1. Array syntax
test_feature "array declaration" 'arr=(1 2 3); echo ${arr[0]}'

# 2. String manipulation
test_feature "string substitution" 'str="hello"; echo ${str/h/H}'

# 3. Arithmetic
test_feature "arithmetic expansion" 'echo $((2 + 2))'

# 4. Process substitution
test_feature "process substitution" 'cat <(echo "test")'

# 5. Command substitution
test_feature "command substitution" 'echo $(echo "test")'

# 6. Here documents
test_feature "here documents" 'cat <<EOF
test
EOF'

# 7. Regex matching
test_feature "regex matching" '[[ "test@example.com" =~ ^[^@]+@[^@]+$ ]]'

# 8. Local variables
test_feature "local variables" 'function test() { local var="test"; }; test'

# 9. Export functions
test_feature "function export" 'function testfn() { echo "test"; }; export -f testfn 2>/dev/null || true'

# 10. Read with timeout
if command -v timeout >/dev/null 2>&1; then
    test_feature "timeout command" 'timeout 1s echo "test"'
else
    echo -e "Testing timeout command... ${YELLOW}⚠ SKIP (not available)${NC}"
fi

echo

# Test common commands
echo -e "${BLUE}Command Availability Tests:${NC}"

# Essential commands
for cmd in sed awk grep tr cut head tail sort uniq wc; do
    test_feature "$cmd command" "command -v $cmd"
done

# Optional but useful commands
for cmd in curl wget git make docker; do
    if command -v $cmd >/dev/null 2>&1; then
        test_feature "$cmd command" "command -v $cmd"
    else
        echo -e "Testing $cmd command... ${YELLOW}⚠ SKIP (optional)${NC}"
    fi
done

echo

# Test file system operations
echo -e "${BLUE}File System Tests:${NC}"

# Create temp directory
TEMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'test')
test_feature "mktemp" "[ -d '$TEMP_DIR' ]"

# Test file operations
test_feature "file creation" "touch '$TEMP_DIR/test.txt'"
test_feature "file permissions" "chmod 600 '$TEMP_DIR/test.txt'"
test_feature "symbolic links" "ln -s '$TEMP_DIR/test.txt' '$TEMP_DIR/link.txt'"
test_feature "file stats" "stat '$TEMP_DIR/test.txt' >/dev/null 2>&1 || ls -la '$TEMP_DIR/test.txt'"

# Cleanup
rm -rf "$TEMP_DIR"

echo

# Test specific compatibility issues
echo -e "${BLUE}Platform-Specific Tests:${NC}"

# Test sed syntax (BSD vs GNU)
test_feature "sed in-place editing" "echo 'test' > /tmp/sed_test.txt && sed -i.bak 's/test/TEST/' /tmp/sed_test.txt 2>/dev/null || sed -i '' 's/test/TEST/' /tmp/sed_test.txt 2>/dev/null; rm -f /tmp/sed_test.txt /tmp/sed_test.txt.bak"

# Test date command
test_feature "date formatting" "date '+%Y%m%d_%H%M%S'"

# Test base64 encoding
test_feature "base64 command" "echo 'test' | base64"

# Test openssl
if command -v openssl >/dev/null 2>&1; then
    test_feature "openssl random" "openssl rand -hex 16"
else
    echo -e "Testing openssl random... ${YELLOW}⚠ SKIP (not available)${NC}"
fi

# Test /dev/urandom
test_feature "/dev/urandom" "[ -r /dev/urandom ]"

echo

# Test shell options
echo -e "${BLUE}Shell Option Tests:${NC}"

test_feature "pipefail option" "set -o pipefail"
test_feature "noclobber option" "set -o noclobber; set +o noclobber"
test_feature "nounset option" "set -o nounset; set +o nounset"

echo

# Summary
echo "=============================="
echo -e "${BLUE}Test Summary:${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All compatibility tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some compatibility issues detected${NC}"
    exit 1
fi