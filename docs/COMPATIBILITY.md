# Cross-Platform Compatibility Guide

The Streamwall setup wizard has been designed to work seamlessly across macOS, Linux, and Windows WSL.

## Supported Platforms

| Platform | Version | Status | Notes |
|----------|---------|--------|-------|
| macOS | 10.15+ | ✅ Fully Supported | BSD tools handled |
| Ubuntu/Debian | 18.04+ | ✅ Fully Supported | Native support |
| CentOS/RHEL | 7+ | ✅ Fully Supported | Native support |
| Windows WSL2 | Ubuntu 20.04+ | ✅ Fully Supported | Requires Docker Desktop |
| Windows Git Bash | Latest | ⚠️ Partial | Some features limited |
| Windows Cygwin | Latest | ⚠️ Partial | Not recommended |

## Compatibility Features Implemented

### 1. Platform Detection
```bash
detect_platform() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if grep -qi microsoft /proc/version 2>/dev/null; then
            echo "wsl"
        else
            echo "linux"
        fi
    fi
}
```

### 2. Cross-Platform sed
The script handles differences between BSD sed (macOS) and GNU sed (Linux):
```bash
sed_inplace() {
    local file="$1"
    shift
    if [[ "$PLATFORM" == "macos" ]]; then
        sed -i '' "$@" "$file"
    else
        sed -i "$@" "$file"
    fi
}
```

### 3. Cross-Platform mktemp
Handles different mktemp implementations:
```bash
mktemp_compat() {
    if [[ "$PLATFORM" == "macos" ]]; then
        mktemp -t streamwall.XXXXXX
    else
        mktemp
    fi
}
```

### 4. POSIX Compliance
- All scripts use `#!/bin/bash` for consistency
- POSIX-compliant command options where possible
- Avoided platform-specific features like `${var^^}`

### 5. Color Output
ANSI color codes work across all platforms:
```bash
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
```

## Platform-Specific Considerations

### macOS
- Uses BSD versions of tools (sed, grep, etc.)
- Requires explicit empty string for sed -i: `sed -i ''`
- mktemp requires template: `mktemp -t template.XXXXXX`
- No timeout command by default (handled with fallback)

### Linux
- Uses GNU versions of tools
- Standard sed -i syntax works
- Has timeout command available
- Better /proc filesystem support

### Windows WSL
- Requires WSL2 for Docker support
- File permissions may behave differently
- Line endings must be LF, not CRLF
- Docker Desktop integration must be enabled

## Testing for Compatibility

### Quick Test
```bash
./test-compatibility.sh
```

### Manual Testing
1. **Platform Detection**:
   ```bash
   bash -c 'source setup-wizard.sh; detect_platform'
   ```

2. **Core Functions**:
   ```bash
   bash setup-wizard.sh --help
   ```

3. **Full Setup Test**:
   ```bash
   bash setup-wizard.sh --validate
   ```

## Common Issues and Solutions

### Issue: sed command fails on macOS
**Solution**: Use the `sed_inplace` function instead of `sed -i`

### Issue: Script fails with "bad interpreter"
**Solution**: Ensure line endings are LF, not CRLF:
```bash
dos2unix setup-wizard.sh
```

### Issue: Permission denied on WSL
**Solution**: Docker Desktop must be running with WSL integration enabled

### Issue: mktemp fails
**Solution**: Use the `mktemp_compat` function

### Issue: Colors not showing
**Solution**: Ensure terminal supports ANSI colors (most modern terminals do)

## Best Practices for Maintaining Compatibility

1. **Always test on multiple platforms** before releasing
2. **Use shellcheck** to catch portability issues
3. **Avoid platform-specific commands** when possible
4. **Provide fallbacks** for optional commands
5. **Document platform requirements** clearly

## Compatibility Testing Matrix

| Feature | macOS | Linux | WSL2 | Notes |
|---------|-------|-------|------|-------|
| Platform Detection | ✅ | ✅ | ✅ | Automatic |
| sed Operations | ✅ | ✅ | ✅ | Using sed_inplace |
| File Operations | ✅ | ✅ | ✅ | Standard POSIX |
| Docker Integration | ✅ | ✅ | ✅ | Requires Docker |
| Color Output | ✅ | ✅ | ✅ | ANSI codes |
| User Input | ✅ | ✅ | ✅ | read -r |
| Secret Generation | ✅ | ✅ | ✅ | openssl/urandom |
| Process Management | ✅ | ✅ | ✅ | Standard |

## Future Improvements

1. **Add PowerShell support** for native Windows
2. **Create installer packages** for each platform
3. **Add automatic platform-specific optimizations**
4. **Improve WSL1 compatibility** (currently WSL2 only)
5. **Add FreeBSD support**

## Contributing

When contributing to the setup wizard:

1. Test your changes on at least two platforms
2. Run `shellcheck` on your changes
3. Update this compatibility guide if needed
4. Add platform-specific tests if introducing new features

## Resources

- [POSIX Specification](https://pubs.opengroup.org/onlinepubs/9699919799/)
- [Bash Pitfalls](http://mywiki.wooledge.org/BashPitfalls)
- [ShellCheck Wiki](https://www.shellcheck.net/wiki/)
- [BSD vs GNU Command Differences](https://ponderthebits.com/2017/01/know-your-tools-linux-gnu-vs-mac-bsd-command-line-utilities-grep-strings-sed-and-find/)