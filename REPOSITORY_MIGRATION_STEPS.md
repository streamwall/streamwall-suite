# Repository Migration Steps

## What I've Done ✅

1. **Updated all documentation** to reference `streamwall/streamwall-suite` instead of `sayhiben/streamwall-project`:
   - README.md
   - CONTRIBUTING.md
   - docs/DEPLOYMENT.md

2. **Created migration documentation**:
   - MIGRATION_GUIDE.md - Comprehensive guide for users
   - migrate-repo.sh - Automated migration script

3. **Verified submodules** - Already pointing to the correct `streamwall` organization

4. **Checked CI/CD** - No hardcoded repository references found

## What You Need to Do 🚀

### 1. Create the New Repository on GitHub

1. Go to https://github.com/organizations/streamwall/repositories/new
2. Name it `streamwall-suite`
3. Make it public
4. **Don't** initialize with README, .gitignore, or license

### 2. Push to the New Repository

```bash
# Add the new remote
git remote add new-origin https://github.com/streamwall/streamwall-suite.git

# Push all branches and tags
git push new-origin main
git push new-origin --tags

# Push all branches if you have more than main
git push new-origin --all
```

### 3. Update Your Local Repository

```bash
# Remove old origin
git remote remove origin

# Rename new-origin to origin
git remote rename new-origin origin

# Verify
git remote -v
```

### 4. Update the Old Repository

On `sayhiben/streamwall-project`:
1. Update the README with a migration notice:
   ```markdown
   # ⚠️ Repository Moved
   
   This repository has been moved to: https://github.com/streamwall/streamwall-suite
   
   Please update your bookmarks and git remotes. See the [Migration Guide](https://github.com/streamwall/streamwall-suite/blob/main/MIGRATION_GUIDE.md) for details.
   ```

2. Consider archiving the old repository (Settings → Archive this repository)

### 5. Update GitHub Settings

On the new repository:
1. Add repository description
2. Add topics (livestream, electron, rails, etc.)
3. Set up branch protection rules if needed
4. Enable GitHub Pages if used
5. Configure any webhooks or integrations

### 6. Notify Users (Optional)

If you have active users:
1. Create a GitHub Release on the old repo announcing the move
2. Pin an issue about the migration
3. Update any external documentation or links

## Verification Checklist

- [ ] New repository created at `streamwall/streamwall-suite`
- [ ] All code pushed to new repository
- [ ] Local remotes updated
- [ ] Old repository has migration notice
- [ ] Submodules still work (`git submodule update --init --recursive`)
- [ ] CI/CD workflows run successfully
- [ ] Documentation links work

## Quick Commands Summary

```bash
# For you (repository owner):
git remote add new-origin https://github.com/streamwall/streamwall-suite.git
git push new-origin --all
git push new-origin --tags
git remote remove origin
git remote rename new-origin origin

# For existing users:
./migrate-repo.sh
# or manually:
git remote set-url origin https://github.com/streamwall/streamwall-suite.git
```