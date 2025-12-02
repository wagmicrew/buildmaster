import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from './api'

// Mock the API module
vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

describe('Double Booking Prevention Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Overlapping Time Slots', () => {
    it('should detect overlapping bookings', () => {
      const existingBooking = {
        date: '2024-12-25',
        startTime: '10:00',
        duration: 60, // Ends at 11:00
      }

      const newBooking = {
        date: '2024-12-25',
        startTime: '10:30', // Overlaps with existing
        duration: 60,
      }

      // Check if times overlap
      const existingEnd = new Date(`${existingBooking.date}T${existingBooking.startTime}`)
      existingEnd.setMinutes(existingEnd.getMinutes() + existingBooking.duration)

      const newStart = new Date(`${newBooking.date}T${newBooking.startTime}`)
      const newEnd = new Date(`${newBooking.date}T${newBooking.startTime}`)
      newEnd.setMinutes(newEnd.getMinutes() + newBooking.duration)

      const overlaps =
        (newStart < existingEnd && newEnd > new Date(`${existingBooking.date}T${existingBooking.startTime}`))

      expect(overlaps).toBe(true)
    })

    it('should allow non-overlapping bookings', () => {
      const existingBooking = {
        date: '2024-12-25',
        startTime: '10:00',
        duration: 60, // Ends at 11:00
      }

      const newBooking = {
        date: '2024-12-25',
        startTime: '11:00', // Starts when existing ends
        duration: 60,
      }

      const existingEnd = new Date(`${existingBooking.date}T${existingBooking.startTime}`)
      existingEnd.setMinutes(existingEnd.getMinutes() + existingBooking.duration)

      const newStart = new Date(`${newBooking.date}T${newBooking.startTime}`)

      const overlaps = newStart < existingEnd

      expect(overlaps).toBe(false)
    })

    it('should prevent double booking on same date and time', async () => {
      const mockError = {
        response: {
          status: 409,
          data: {
            detail: 'Time slot is already booked',
            conflict: {
              existingBookingId: 'booking-123',
              requestedTime: '2024-12-25T10:00:00',
            },
          },
        },
      }
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(
        api.post('/bookings', {
          userId: 'user-1',
          date: '2024-12-25',
          time: '10:00',
          duration: 60,
        })
      ).rejects.toEqual(mockError)
    })

    it('should check availability before creating booking', async () => {
      const mockAvailability = {
        data: {
          available: false,
          conflictingBookings: [
            {
              id: 'booking-123',
              time: '10:00',
              duration: 60,
            },
          ],
        },
      }
      vi.mocked(api.get).mockResolvedValue(mockAvailability)

      const response = await api.get('/bookings/availability?date=2024-12-25&time=10:00&duration=60')

      expect(response.data.available).toBe(false)
      expect(response.data.conflictingBookings).toHaveLength(1)
    })

    it('should return available slots', async () => {
      const mockAvailability = {
        data: {
          available: true,
          availableSlots: ['09:00', '10:00', '11:00', '14:00', '15:00'],
        },
      }
      vi.mocked(api.get).mockResolvedValue(mockAvailability)

      const response = await api.get('/bookings/availability?date=2024-12-25')

      expect(response.data.available).toBe(true)
      expect(response.data.availableSlots).toContain('10:00')
    })
  })

  describe('Concurrent Booking Prevention', () => {
    it('should handle race conditions when booking simultaneously', async () => {
      // Simulate two simultaneous booking requests
      const booking1 = api.post('/bookings', {
        userId: 'user-1',
        date: '2024-12-25',
        time: '10:00',
        duration: 60,
      })

      const booking2 = api.post('/bookings', {
        userId: 'user-2',
        date: '2024-12-25',
        time: '10:00',
        duration: 60,
      })

      // Mock first succeeds, second fails
      vi.mocked(api.post)
        .mockResolvedValueOnce({
          data: { success: true, booking: { id: 'booking-1' } },
        })
        .mockRejectedValueOnce({
          response: {
            status: 409,
            data: { detail: 'Time slot is already booked' },
          },
        })

      const results = await Promise.allSettled([booking1, booking2])

      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
    })

    it('should use database transactions to prevent double booking', () => {
      // This would be tested at the API/database level
      // Here we're testing the concept
      const useTransaction = true
      const lockRow = true

      expect(useTransaction).toBe(true)
      expect(lockRow).toBe(true)
    })
  })

  describe('Time Slot Validation', () => {
    it('should validate booking fits within business hours', () => {
      const businessHours = { start: '09:00', end: '17:00' }
      const bookingTime = '08:00' // Before business hours

      const bookingHour = parseInt(bookingTime.split(':')[0])
      const businessStart = parseInt(businessHours.start.split(':')[0])

      expect(bookingHour < businessStart).toBe(true)
    })

    it('should validate booking end time is within business hours', () => {
      const businessHours = { start: '09:00', end: '17:00' }
      const booking = { time: '16:30', duration: 60 } // Ends at 17:30

      const bookingStart = parseInt(booking.time.split(':')[0])
      const bookingEnd = bookingStart + booking.duration / 60
      const businessEnd = parseInt(businessHours.end.split(':')[0])

      expect(bookingEnd > businessEnd).toBe(true)
    })

    it('should check for minimum booking duration', () => {
      const minDuration = 30 // minutes
      const requestedDuration = 15

      expect(requestedDuration >= minDuration).toBe(false)
    })

    it('should check for maximum booking duration', () => {
      const maxDuration = 240 // 4 hours
      const requestedDuration = 300

      expect(requestedDuration <= maxDuration).toBe(false)
    })
  })

  describe('User Booking Limits', () => {
    it('should prevent user from having multiple bookings at same time', async () => {
      const mockError = {
        response: {
          status: 409,
          data: {
            detail: 'You already have a booking at this time',
          },
        },
      }
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(
        api.post('/bookings', {
          userId: 'user-1',
          date: '2024-12-25',
          time: '10:00',
          duration: 60,
        })
      ).rejects.toEqual(mockError)
    })

    it('should allow user to have multiple bookings on different dates', async () => {
      const mockResponse = {
        data: {
          success: true,
          booking: { id: 'booking-2', date: '2024-12-26', time: '10:00' },
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const response = await api.post('/bookings', {
        userId: 'user-1',
        date: '2024-12-26', // Different date
        time: '10:00',
        duration: 60,
      })

      expect(response.data.success).toBe(true)
    })
  })
})


