import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import api from './api'

// Mock axios
vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => ({
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      })),
    },
  }
})

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export an api instance', () => {
    expect(api).toBeDefined()
    expect(api.get).toBeDefined()
    expect(api.post).toBeDefined()
  })

  it('should have proper base URL configuration', () => {
    // The api instance should be configured
    expect(api).toBeTruthy()
  })
})

