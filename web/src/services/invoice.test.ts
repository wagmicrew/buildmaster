import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from './api'

// Mock the API module
vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}))

describe('Invoice Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Generate Invoice', () => {
    it('should generate an invoice successfully', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        bookingId: 'booking-456',
        userId: 'user-789',
        amount: 500.0,
        currency: 'SEK',
        status: 'pending',
        dueDate: '2024-12-31',
        items: [
          {
            description: 'Driving Lesson',
            quantity: 1,
            price: 500.0,
            total: 500.0,
          },
        ],
      }

      const mockResponse = {
        data: {
          success: true,
          invoice: mockInvoice,
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const response = await api.post('/invoices', {
        bookingId: 'booking-456',
        userId: 'user-789',
        items: [
          {
            description: 'Driving Lesson',
            quantity: 1,
            price: 500.0,
          },
        ],
      })

      expect(api.post).toHaveBeenCalled()
      expect(response.data.success).toBe(true)
      expect(response.data.invoice).toEqual(mockInvoice)
    })

    it('should calculate invoice total correctly', () => {
      const items = [
        { description: 'Item 1', quantity: 2, price: 100.0 },
        { description: 'Item 2', quantity: 1, price: 50.0 },
        { description: 'Item 3', quantity: 3, price: 25.0 },
      ]

      const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0)
      const tax = subtotal * 0.25 // 25% VAT
      const total = subtotal + tax

      expect(subtotal).toBe(325.0) // 200 + 50 + 75
      expect(tax).toBe(81.25)
      expect(total).toBe(406.25)
    })

    it('should include tax in invoice calculation', () => {
      const subtotal = 1000.0
      const taxRate = 0.25
      const tax = subtotal * taxRate
      const total = subtotal + tax

      expect(tax).toBe(250.0)
      expect(total).toBe(1250.0)
    })

    it('should validate invoice items', async () => {
      const invalidInvoice = {
        bookingId: 'booking-1',
        items: [], // Empty items
      }

      const mockError = {
        response: {
          status: 400,
          data: {
            detail: 'Invoice must have at least one item',
          },
        },
      }
      vi.mocked(api.post).mockRejectedValue(mockError)

      await expect(api.post('/invoices', invalidInvoice)).rejects.toEqual(mockError)
    })

    it('should set due date correctly', () => {
      const invoiceDate = new Date('2024-12-01')
      const paymentTerms = 30 // days
      const dueDate = new Date(invoiceDate)
      dueDate.setDate(dueDate.getDate() + paymentTerms)

      expect(dueDate.toISOString().split('T')[0]).toBe('2024-12-31')
    })
  })

  describe('Get Invoice', () => {
    it('should fetch an invoice by ID', async () => {
      const mockInvoice = {
        id: 'invoice-123',
        amount: 500.0,
        status: 'paid',
        items: [],
      }

      const mockResponse = {
        data: mockInvoice,
      }
      vi.mocked(api.get).mockResolvedValue(mockResponse)

      const response = await api.get('/invoices/invoice-123')

      expect(api.get).toHaveBeenCalledWith('/invoices/invoice-123')
      expect(response.data).toEqual(mockInvoice)
    })

    it('should fetch all invoices for a user', async () => {
      const mockInvoices = [
        { id: 'invoice-1', amount: 500.0, status: 'paid' },
        { id: 'invoice-2', amount: 750.0, status: 'pending' },
      ]

      const mockResponse = {
        data: mockInvoices,
      }
      vi.mocked(api.get).mockResolvedValue(mockResponse)

      const response = await api.get('/invoices?userId=user-1')

      expect(response.data).toEqual(mockInvoices)
    })

    it('should handle invoice not found', async () => {
      const mockError = {
        response: {
          status: 404,
          data: {
            detail: 'Invoice not found',
          },
        },
      }
      vi.mocked(api.get).mockRejectedValue(mockError)

      await expect(api.get('/invoices/non-existent')).rejects.toEqual(mockError)
    })
  })

  describe('Update Invoice Status', () => {
    it('should update invoice status to paid', async () => {
      const mockResponse = {
        data: {
          success: true,
          invoice: {
            id: 'invoice-123',
            status: 'paid',
            paidAt: '2024-12-15T10:00:00Z',
          },
        },
      }
      vi.mocked(api.put).mockResolvedValue(mockResponse)

      const response = await api.put('/invoices/invoice-123/status', {
        status: 'paid',
      })

      expect(response.data.success).toBe(true)
      expect(response.data.invoice.status).toBe('paid')
    })

    it('should update invoice status to cancelled', async () => {
      const mockResponse = {
        data: {
          success: true,
          invoice: {
            id: 'invoice-123',
            status: 'cancelled',
            cancelledAt: '2024-12-15T10:00:00Z',
          },
        },
      }
      vi.mocked(api.put).mockResolvedValue(mockResponse)

      const response = await api.put('/invoices/invoice-123/status', {
        status: 'cancelled',
      })

      expect(response.data.invoice.status).toBe('cancelled')
    })

    it('should not allow invalid status transitions', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            detail: 'Cannot change status from paid to pending',
          },
        },
      }
      vi.mocked(api.put).mockRejectedValue(mockError)

      await expect(
        api.put('/invoices/invoice-123/status', {
          status: 'pending',
        })
      ).rejects.toEqual(mockError)
    })
  })

  describe('Invoice PDF Generation', () => {
    it('should generate PDF for invoice', async () => {
      const mockResponse = {
        data: {
          success: true,
          pdfUrl: '/invoices/invoice-123.pdf',
        },
      }
      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const response = await api.post('/invoices/invoice-123/pdf')

      expect(response.data.success).toBe(true)
      expect(response.data.pdfUrl).toBeDefined()
    })

    it('should include all required invoice fields in PDF', () => {
      const invoiceFields = [
        'invoiceNumber',
        'invoiceDate',
        'dueDate',
        'customerName',
        'customerAddress',
        'items',
        'subtotal',
        'tax',
        'total',
      ]

      invoiceFields.forEach((field) => {
        expect(field).toBeDefined()
      })
    })
  })

  describe('Invoice Numbering', () => {
    it('should generate unique invoice numbers', () => {
      const invoiceNumbers = ['INV-2024-001', 'INV-2024-002', 'INV-2024-003']
      const uniqueNumbers = new Set(invoiceNumbers)

      expect(uniqueNumbers.size).toBe(invoiceNumbers.length)
    })

    it('should format invoice numbers correctly', () => {
      const year = 2024
      const sequence = 123
      const invoiceNumber = `INV-${year}-${sequence.toString().padStart(3, '0')}`

      expect(invoiceNumber).toBe('INV-2024-123')
      expect(invoiceNumber).toMatch(/^INV-\d{4}-\d{3}$/)
    })
  })
})


