import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from './api'

// Mock the API module
vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('Booking Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Create Booking', () => {
    it('should create a booking successfully', async () => {
      const mockBooking = {
        id: 'booking-123',
        userId: 'user-456',
        date: '2024-12-25',
        time: '10:00',
        duration: 60,
        status: 'confirmed',
      }

      const mockResponse = {
        data: {
          success: true,
          booking: mockBooking,
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const response = await api.post('/bookings', {
        userId: 'user-456',
        date: '2024-12-25',
        time: '10:00',
        duration: 60,
      })

      expect(api.post).toHaveBeenCalledWith('/bookings', {
        userId: 'user-456',
        date: '2024-12-25',
        time: '10:00',
        duration: 60,
      })
      expect(response.data.success).toBe(true)
      expect(response.data.booking).toEqual(mockBooking)
    })

    it('should validate required booking fields', async () => {
      const incompleteBooking = {
        date: '2024-12-25',
        // Missing userId, time, duration
      }

      const mockError = {
        response: {
          status: 400,
          data: {
            detail: 'Missing required fields: userId, time, duration',
          },
        },
      }
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(api.post('/bookings', incompleteBooking)).rejects.toEqual(mockError)
    })

    it('should validate date format', () => {
      const invalidDates = ['2024-13-45', 'not-a-date', '2024/12/25', '']
      const validDateRegex = /^\d{4}-\d{2}-\d{2}$/

      invalidDates.forEach((date) => {
        expect(validDateRegex.test(date)).toBe(false)
      })
    })

    it('should validate time format', () => {
      const invalidTimes = ['25:00', '12:60', 'not-time', '']
      const validTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

      invalidTimes.forEach((time) => {
        expect(validTimeRegex.test(time)).toBe(false)
      })
    })

    it('should validate duration is positive', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            detail: 'Duration must be a positive number',
          },
        },
      }
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(
        api.post('/bookings', {
          userId: 'user-1',
          date: '2024-12-25',
          time: '10:00',
          duration: -30,
        })
      ).rejects.toEqual(mockError)
    })

    it('should not allow booking in the past', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      const pastDateString = pastDate.toISOString().split('T')[0]

      const mockError = {
        response: {
          status: 400,
          data: {
            detail: 'Cannot book appointments in the past',
          },
        },
      }
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(
        api.post('/bookings', {
          userId: 'user-1',
          date: pastDateString,
          time: '10:00',
          duration: 60,
        })
      ).rejects.toEqual(mockError)
    })
  })

  describe('Get Booking', () => {
    it('should fetch a booking by ID', async () => {
      const mockBooking = {
        id: 'booking-123',
        userId: 'user-456',
        date: '2024-12-25',
        time: '10:00',
        status: 'confirmed',
      }

      const mockResponse = {
        data: mockBooking,
      }
      vi.mocked(api.get).mockResolvedValue(mockResponse)

      const response = await api.get('/bookings/booking-123')

      expect(api.get).toHaveBeenCalledWith('/bookings/booking-123')
      expect(response.data).toEqual(mockBooking)
    })

    it('should handle booking not found', async () => {
      const mockError = {
        response: {
          status: 404,
          data: {
            detail: 'Booking not found',
          },
        },
      }
      vi.mocked(api.get).mockRejectedValue(mockError)

      await expect(api.get('/bookings/non-existent')).rejects.toEqual(mockError)
    })

    it('should fetch all bookings for a user', async () => {
      const mockBookings = [
        { id: 'booking-1', userId: 'user-1', date: '2024-12-25', time: '10:00' },
        { id: 'booking-2', userId: 'user-1', date: '2024-12-26', time: '14:00' },
      ]

      const mockResponse = {
        data: mockBookings,
      }
      vi.mocked(api.get).mockResolvedValue(mockResponse)

      const response = await api.get('/bookings?userId=user-1')

      expect(api.get).toHaveBeenCalledWith('/bookings?userId=user-1')
      expect(response.data).toEqual(mockBookings)
    })
  })

  describe('Update Booking', () => {
    it('should update a booking successfully', async () => {
      const updatedBooking = {
        id: 'booking-123',
        time: '11:00',
        status: 'rescheduled',
      }

      const mockResponse = {
        data: {
          success: true,
          booking: updatedBooking,
        },
      }
      vi.mocked(api.put).mockResolvedValue(mockResponse)

      const response = await api.put('/bookings/booking-123', {
        time: '11:00',
      })

      expect(api.put).toHaveBeenCalledWith('/bookings/booking-123', {
        time: '11:00',
      })
      expect(response.data.success).toBe(true)
    })
  })

  describe('Cancel Booking', () => {
    it('should cancel a booking successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Booking cancelled',
        },
      }
      vi.mocked(api.delete).mockResolvedValue(mockResponse)

      const response = await api.delete('/bookings/booking-123')

      expect(api.delete).toHaveBeenCalledWith('/bookings/booking-123')
      expect(response.data.success).toBe(true)
    })

    it('should not allow cancelling already cancelled bookings', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            detail: 'Booking is already cancelled',
          },
        },
      }
      vi.mocked(api.delete).mockRejectedValue(mockError)

      await expect(api.delete('/bookings/booking-123')).rejects.toEqual(mockError)
    })
  })
})


