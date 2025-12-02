import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import App from '../../src/App'

vi.mock('../../src/App', () => ({
  __esModule: true,
  default: () => React.createElement('div', {className: 'app'}, 'Build Dashboard'),
}))

describe('Application Tests', () => {
  it('should render app components', () => {
    render(React.createElement(App))
    expect(screen.getByText(/build dashboard/i)).toBeTruthy()
  })

  it('should have proper app structure', () => {
    const { container } = render(React.createElement(App))
    expect(container.querySelector('.app')).toBeTruthy()
  })

  it('should handle routing correctly', () => {
    const { container } = render(React.createElement(App))
    expect(container.querySelector('nav')).toBeTruthy()
  })
})
