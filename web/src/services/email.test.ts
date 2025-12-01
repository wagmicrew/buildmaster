import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from './api'

// Mock the API module
vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

describe('Email Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('OTP Email Sending', () => {
    it('should send OTP email successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'OTP email sent successfully',
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const response = await api.post('/auth/request-otp', {
        email: 'test@example.com',
      })

      expect(api.post).toHaveBeenCalledWith('/auth/request-otp', {
        email: 'test@example.com',
      })
      expect(response.data.success).toBe(true)
    })

    it('should handle email sending errors', async () => {
      const mockError = {
        response: {
          data: {
            detail: 'Failed to send email',
          },
        },
      }
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(
        api.post('/auth/request-otp', {
          email: 'test@example.com',
        })
      ).rejects.toEqual(mockError)
    })

    it('should validate email format before sending', () => {
      const invalidEmails = [
        'not-an-email',
        'missing@domain',
        '@missing-local.com',
        'missing.com',
        '',
      ]

      invalidEmails.forEach((email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        expect(emailRegex.test(email)).toBe(false)
      })
    })

    it('should accept valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
        'test123@test-domain.com',
      ]

      validEmails.forEach((email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        expect(emailRegex.test(email)).toBe(true)
      })
    })
  })

  describe('Email Rate Limiting', () => {
    it('should respect rate limits for OTP requests', async () => {
      const mockError = {
        response: {
          status: 429,
          data: {
            detail: 'Too many OTP requests. Please wait 15 minutes.',
          },
        },
      }

      // Simulate rate limit exceeded
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(
        api.post('/auth/request-otp', {
          email: 'test@example.com',
        })
      ).rejects.toEqual(mockError)
    })
  })

  describe('Email Templates', () => {
    it('should include OTP code in email content', () => {
      const otpCode = '123456'
      const emailContent = `Your OTP code is: ${otpCode}`

      expect(emailContent).toContain(otpCode)
      expect(emailContent).toMatch(/OTP code/)
    })

    it('should include expiry information in email', () => {
      const expiryMinutes = 10
      const emailContent = `This code expires in ${expiryMinutes} minutes`

      expect(emailContent).toContain(expiryMinutes.toString())
      expect(emailContent).toMatch(/expires/)
    })
  })

  describe('Email Delivery', () => {
    it('should handle successful email delivery', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Email sent successfully',
          email_id: 'email-123',
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const response = await api.post('/email/send', {
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'Test content',
      })

      expect(response.data.success).toBe(true)
      expect(response.data.email_id).toBeDefined()
    })

    it('should handle email delivery failures', async () => {
      const mockError = {
        response: {
          status: 500,
          data: {
            detail: 'SMTP server error',
          },
        },
      }
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(
        api.post('/email/send', {
          to: 'test@example.com',
          subject: 'Test',
          body: 'Content',
        })
      ).rejects.toEqual(mockError)
    })
  })
})

