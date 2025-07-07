# Migration Guide: Moving to streamwall/streamwall-suite

This guide helps existing users migrate from the old repository location (`sayhiben/streamwall-project`) to the new location (`streamwall/streamwall-suite`).

## For Existing Clones

If you have already cloned the repository from the old location, follow these steps:

### 1. Update Your Remote URL

```bash
# Navigate to your project directory
cd streamwall-project  # or wherever you cloned it

# Update the origin remote to the new location
git remote set-url origin https://github.com/streamwall/streamwall-suite.git

# Verify the change
git remote -v
# Should show:
# origin  https://github.com/streamwall/streamwall-suite.git (fetch)
# origin  https://github.com/streamwall/streamwall-suite.git (push)
```

### 2. Update Your Local Directory Name (Optional)

```bash
# Go to parent directory
cd ..

# Rename the directory
mv streamwall-project streamwall-suite

# Enter the renamed directory
cd streamwall-suite
```

### 3. Pull Latest Changes

```bash
# Fetch and pull any new changes
git fetch origin
git pull origin main
```

### 4. Update Submodules

The submodules are already pointing to the correct `streamwall` organization, but ensure they're up to date:

```bash
# Update all submodules
git submodule update --init --recursive
```

## For Forks

If you have forked the repository:

1. **Update your fork's upstream**:
   ```bash
   # Remove old upstream
   git remote remove upstream
   
   # Add new upstream
   git remote add upstream https://github.com/streamwall/streamwall-suite.git
   
   # Verify
   git remote -v
   ```

2. **Update your fork on GitHub**:
   - Go to your fork's settings on GitHub
   - Update the repository name if desired
   - The fork relationship will be maintained

3. **Sync your fork**:
   ```bash
   # Fetch from new upstream
   git fetch upstream
   
   # Merge or rebase as needed
   git merge upstream/main
   # or
   git rebase upstream/main
   ```

## For CI/CD Pipelines

Update any CI/CD configurations that reference the old repository:

### GitHub Actions
Update any workflow files that clone or reference the repository:

```yaml
# Old
- uses: actions/checkout@v3
  with:
    repository: sayhiben/streamwall-project

# New
- uses: actions/checkout@v3
  with:
    repository: streamwall/streamwall-suite
```

### Docker Builds
Update any Dockerfiles or build scripts:

```dockerfile
# Old
RUN git clone https://github.com/sayhiben/streamwall-project.git

# New
RUN git clone https://github.com/streamwall/streamwall-suite.git
```

### Deployment Scripts
Update any deployment scripts that reference the repository:

```bash
# Old
git clone https://github.com/sayhiben/streamwall-project.git

# New
git clone https://github.com/streamwall/streamwall-suite.git
```

## For New Users

Simply clone from the new location:

```bash
git clone --recursive https://github.com/streamwall/streamwall-suite.git
cd streamwall-suite
./setup-ecosystem.sh
```

## Troubleshooting

### Permission Denied Errors

If you get permission errors when pushing:
1. Ensure you have access to the new repository
2. Update your SSH keys if needed
3. Check your GitHub personal access tokens

### Submodule Issues

If submodules aren't working:
```bash
# Reset submodules
git submodule deinit -f .
git submodule update --init --recursive
```

### Old References

Search for any remaining old references:
```bash
# Find files with old repository references
grep -r "sayhiben/streamwall-project" .
```

## Questions?

If you encounter any issues during migration:
1. Check the [Issues](https://github.com/streamwall/streamwall-suite/issues) page
2. Open a new issue if your problem isn't already reported
3. Join the [Discussions](https://github.com/streamwall/streamwall-suite/discussions) for help

## Summary

The repository has moved from:
- **Old**: `https://github.com/sayhiben/streamwall-project`
- **New**: `https://github.com/streamwall/streamwall-suite`

All submodules remain under the `streamwall` organization and don't require changes.