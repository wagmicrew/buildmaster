import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Layout from './Layout'

// Mock NavigationBar
vi.mock('./NavigationBar', () => ({
  default: () => <nav data-testid="navigation">Navigation</nav>,
}))

describe('Layout Component', () => {
  it('should render children', () => {
    render(
      <BrowserRouter>
        <Layout>
          <div data-testid="child">Test Content</div>
        </Layout>
      </BrowserRouter>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render navigation', () => {
    render(
      <BrowserRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </BrowserRouter>
    )

    expect(screen.getByTestId('navigation')).toBeInTheDocument()
  })
})

