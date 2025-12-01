# Vitest Setup and "App" Environment Addition - Summary

## Overview

Successfully set up Vitest for automated testing and added "app" as a third environment alongside "dev" and "prod" throughout the codebase.

## ✅ Completed Tasks

### 1. Vitest Configuration

- **Installed dependencies**:
  - `vitest` - Testing framework
  - `@vitest/ui` - Test UI for interactive testing
  - `@testing-library/react` - React component testing
  - `@testing-library/jest-dom` - DOM matchers
  - `@testing-library/user-event` - User interaction testing
  - `jsdom` - Browser-like test environment
  - `cross-env` - Cross-platform environment variable support

- **Created configuration files**:
  - `web/vite.config.ts` - Unified Vite/Vitest configuration with environment support
  - `web/src/test/setup.ts` - Global test setup with mocks and configurations

- **Added test scripts** to `web/package.json`:
  - `npm run test` - Run tests in watch mode
  - `npm run test:ui` - Run tests with UI
  - `npm run test:run` - Run tests once
  - `npm run test:coverage` - Generate coverage reports
  - `npm run test:app` - Run tests for app environment
  - `npm run test:dev` - Run tests for dev environment
  - `npm run test:prod` - Run tests for prod environment

### 2. "App" Environment Addition

#### Backend Configuration (`api/`)

- **Updated `api/config.py`**:
  - Added `APP_DIR` setting: `/var/www/dintrafikskolax_app`
  - Added `PM2_APP_APP` setting: `"dintrafikskolax-app"`
  - Created helper functions:
    - `get_environment_directory(environment)` - Get directory for dev/prod/app
    - `get_pm2_app_name(environment)` - Get PM2 app name for environment

- **Updated `api/settings_ops.py`**:
  - Added "app" environment to `DEFAULT_SETTINGS`
  - Added app database configuration
  - Added app build script configuration
  - Added app PM2 configuration
  - Added app nginx configuration (port 3002, server: app.dintrafikskolahlm.se)

- **Updated `api/models.py`**:
  - Extended `EnvironmentHealthResponse` to include:
    - `app_env_exists: bool`
    - `pm2_app_running: bool`

- **Updated `api/health.py`**:
  - Modified `get_environment_health()` to check app environment
  - Added app directory existence check
  - Added PM2 app process check

- **Updated `api/main.py`**:
  - Updated all endpoints to accept "app" in addition to "dev" and "prod"
  - Changed environment validation from `("dev", "prod")` to `("dev", "prod", "app")`
  - Replaced hardcoded directory lookups with `get_environment_directory()` helper
  - Updated 28+ endpoints to support app environment

#### Frontend Configuration (`web/`)

- **Updated `web/src/pages/Health.tsx`**:
  - Added display for "App Environment" status
  - Added display for "PM2 App" status

- **Updated `web/tsconfig.json`**:
  - Added test file patterns to include

### 3. Example Test Files

Created example test files to demonstrate testing patterns:

- **`web/src/services/api.test.ts`** - API service testing example
- **`web/src/utils/format.test.ts`** - Utility function testing (formatBytes, formatUptime)
- **`web/src/components/Layout.test.tsx`** - Component testing example

### 4. Documentation

- **Created `web/README_TESTING.md`** - Comprehensive testing guide with:
  - Installation instructions
  - Test command reference
  - Environment-specific testing
  - Example test patterns
  - Configuration details

## Environment Configuration

### App Environment Details

- **Directory**: `/var/www/dintrafikskolax_app`
- **PM2 App Name**: `dintrafikskolax-app`
- **Nginx Server**: `app.dintrafikskolahlm.se`
- **Port**: 3002
- **PM2 Mode**: fork (single instance)
- **Database**: `dintrafikskolax_app`

## Testing Commands

### Quick Start

```bash
cd web
npm install  # Install new dependencies
npm run test  # Run tests in watch mode
```

### Environment-Specific Testing

```bash
npm run test:app   # Test app environment
npm run test:dev   # Test dev environment  
npm run test:prod  # Test prod environment
```

## Next Steps

1. **Install dependencies**:
   ```bash
   cd web
   npm install
   ```

2. **Run tests** to verify setup:
   ```bash
   npm run test:run
   ```

3. **Add more tests** as you develop features

4. **Update backend environment variables** on the server if needed:
   - Add `APP_DIR` to `.env` if different from default
   - Add `PM2_APP_APP` if different from default

## Notes

- Vitest configuration is integrated with Vite configuration in `vite.config.ts`
- Tests can access environment via `process.env.TEST_ENV`
- All API endpoints now support "app", "dev", and "prod" environments
- Health monitoring now tracks app environment status
- Frontend Health page displays app environment status

## References

- [Vitest Documentation](https://vitest.dev/guide/)
- [Testing Library Documentation](https://testing-library.com/)
- [Vitest API Reference](https://vitest.dev/api/)

