# Internal Tools Directory

This directory contains internal tools used by the Makefile. 

**⚠️ Do not run these scripts directly!** Always use the Makefile commands instead:

- `make setup` - Runs the setup wizard
- `make validate` - Validates configuration
- `make help` - Shows all available commands

## Scripts

### streamwall-setup-wizard
The interactive setup wizard for configuring all Streamwall services. This handles:
- Environment configuration
- Service setup
- Integration configuration (Discord, Twitch, etc.)
- Admin account creation

Called by: `make setup`

### streamwall-validate
Configuration validator that checks:
- Environment variables
- Port availability
- Docker status
- File permissions
- Service health

Called by: `make validate`


### seed-demo-data.sh
Seeds demo/test data into a running StreamSource instance. Creates:
- Sample streams
- Test users
- Example configurations

Not currently called by Makefile (can be run manually if needed)

## Why These Exist

These scripts contain complex logic that would make the Makefile unwieldy if inlined:
- The setup wizard has ~1000 lines of interactive prompts and configuration logic
- The validator has detailed checks for every service and dependency

By keeping them as separate scripts in `bin/`, we:
1. Keep the Makefile focused and readable
2. Allow for more complex bash scripting
3. Make testing easier
4. Maintain clear separation of concerns