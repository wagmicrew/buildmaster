# Testing with Vitest

This project uses [Vitest](https://vitest.dev/) for automated testing. Tests can be run in different environments (app, dev, prod) to ensure compatibility across all deployment targets.

## Installation

Dependencies are already installed in `package.json`. If you need to reinstall:

```bash
cd web
npm install
```

## Running Tests

### Basic Test Commands

```bash
# Run tests in watch mode (default)
npm run test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Environment-Specific Tests

Run tests targeting specific environments:

```bash
# Test in app environment
npm run test:app

# Test in dev environment (default)
npm run test:dev

# Test in prod environment
npm run test:prod
```

## Test Structure

- Test files should be named `*.test.ts` or `*.test.tsx`
- Test files can be placed next to the code they test or in a `__tests__` directory
- Setup file: `src/test/setup.ts` - Contains global test configuration

## Example Tests

### Component Test

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Utility Function Test

```typescript
import { describe, it, expect } from 'vitest'
import { formatBytes } from './utils'

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.00 KB')
  })
})
```

## Configuration

- **Config file**: `vite.config.ts` - Contains Vitest configuration
- **Test environment**: jsdom (browser-like environment)
- **Coverage provider**: v8

## Writing Tests

1. Import testing utilities from `vitest` and `@testing-library/react`
2. Use `describe` blocks to group related tests
3. Use `it` or `test` for individual test cases
4. Use `expect` for assertions

## Environment Variables

Tests can access environment variables:
- `TEST_ENV`: Current test environment (app, dev, prod)
- `NODE_ENV`: Set to 'production' for prod tests, 'development' otherwise

## Coverage

Generate coverage reports with:

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory.

## Tips

- Use `vi.mock()` to mock modules
- Use `@testing-library/react` for component testing
- Use `@testing-library/user-event` for user interaction testing
- Check the [Vitest documentation](https://vitest.dev/guide/) for more details

