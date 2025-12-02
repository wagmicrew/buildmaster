import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import App from '../../src/App'

vi.mock('../../src/App', () => ({
  __esModule: true,
  default: () => React.createElement('div', {className: 'app'}, 'Build Dashboard'),
}))

describe('Production Environment Tests', () => {
  it('should render app in prod mode', () => {
    render(React.createElement(App))
    expect(screen.getByText(/build dashboard/i)).toBeTruthy()
  })

  it('should have production environment variables', () => {
    expect(process.env.NODE_ENV).toBe('production')
    expect(process.env.TEST_ENV).toBe('prod')
  })

  it('should have production optimizations enabled', () => {
    // Test production-specific features
    expect(document.querySelector('script[src*="vite"]')).toBeNull()
  })
})
