import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authService } from './auth'
import api from './api'

// Mock the API module
vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
  },
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('requestOTP', () => {
    it('should call API with correct email', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'OTP sent successfully',
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const result = await authService.requestOTP('test@example.com')

      expect(api.post).toHaveBeenCalledWith('/auth/request-otp', {
        email: 'test@example.com',
      })
      expect(result).toEqual({
        success: true,
        message: 'OTP sent successfully',
      })
    })

    it('should handle API errors', async () => {
      const mockError = {
        response: {
          data: {
            detail: 'Email not authorized',
          },
        },
      }
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(authService.requestOTP('unauthorized@example.com')).rejects.toEqual(mockError)
    })
  })

  describe('verifyOTP', () => {
    it('should call API with correct email and OTP code', async () => {
      const mockResponse = {
        data: {
          success: true,
          session_token: 'test-token-123',
          expires_at: '2024-12-31T23:59:59',
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const result = await authService.verifyOTP('test@example.com', '123456')

      expect(api.post).toHaveBeenCalledWith('/auth/verify-otp', {
        email: 'test@example.com',
        otp_code: '123456',
      })
      expect(result).toEqual({
        success: true,
        session_token: 'test-token-123',
        expires_at: '2024-12-31T23:59:59',
      })
    })

    it('should store session token in localStorage when verification succeeds', async () => {
      const mockResponse = {
        data: {
          success: true,
          session_token: 'test-session-token',
          expires_at: '2024-12-31T23:59:59',
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      await authService.verifyOTP('test@example.com', '123456')

      expect(localStorage.setItem).toHaveBeenCalledWith('session_token', 'test-session-token')
    })

    it('should not store token if verification fails', async () => {
      const mockResponse = {
        data: {
          success: false,
          message: 'Invalid OTP',
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      await authService.verifyOTP('test@example.com', '000000')

      expect(localStorage.setItem).not.toHaveBeenCalled()
    })

    it('should not store token if no session_token is provided', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'OTP verified but no token',
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      await authService.verifyOTP('test@example.com', '123456')

      expect(localStorage.setItem).not.toHaveBeenCalled()
    })

    it('should handle API errors during verification', async () => {
      const mockError = {
        response: {
          data: {
            detail: 'Invalid OTP code',
          },
        },
      }
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(authService.verifyOTP('test@example.com', '000000')).rejects.toEqual(mockError)
      expect(localStorage.setItem).not.toHaveBeenCalled()
    })
  })

  describe('logout', () => {
    it('should remove session token from localStorage', () => {
      // Mock window.location.href
      delete (window as any).location
      window.location = { href: '' } as any

      authService.logout()

      expect(localStorage.removeItem).toHaveBeenCalledWith('session_token')
    })

    it('should redirect to login page', () => {
      delete (window as any).location
      window.location = { href: '' } as any

      authService.logout()

      expect(window.location.href).toBe('/login')
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when session token exists', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('existing-token')

      expect(authService.isAuthenticated()).toBe(true)
      expect(localStorage.getItem).toHaveBeenCalledWith('session_token')
    })

    it('should return false when session token does not exist', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)

      expect(authService.isAuthenticated()).toBe(false)
    })

    it('should return false when session token is empty string', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('')

      expect(authService.isAuthenticated()).toBe(false)
    })
  })
})

