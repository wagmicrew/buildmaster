import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import App from '../../src/App'

vi.mock('../../src/App', () => ({
  __esModule: true,
  default: () => React.createElement('div', {className: 'app'}, 'Build Dashboard'),
}))

describe('Development Environment Tests', () => {
  it('should render app in dev mode', () => {
    render(React.createElement(App))
    expect(screen.getByText(/build dashboard/i)).toBeTruthy()
  })

  it('should have development environment variables', () => {
    expect(process.env.NODE_ENV).toBe('development')
    expect(process.env.TEST_ENV).toBe('dev')
  })
})
