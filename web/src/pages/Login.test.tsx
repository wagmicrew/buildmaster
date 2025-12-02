import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Login from './Login'
import { authService } from '../services/auth'

// Mock the auth service
vi.mock('../services/auth', () => ({
  authService: {
    requestOTP: vi.fn(),
    verifyOTP: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: vi.fn(),
  },
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Email Step', () => {
    it('should render email input form', () => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /send otp/i })).toBeInTheDocument()
    })

    it('should allow user to enter email', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email address/i)
      await user.type(emailInput, 'test@example.com')

      expect(emailInput).toHaveValue('test@example.com')
    })

    it('should call requestOTP when form is submitted with valid email', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent successfully',
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send otp/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(authService.requestOTP).toHaveBeenCalledWith('test@example.com')
      })
    })

    it('should show error message when OTP request fails', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockRejectedValue({
        response: {
          data: { detail: 'Email not authorized' },
        },
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send otp/i })

      await user.type(emailInput, 'unauthorized@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/email not authorized/i)).toBeInTheDocument()
      })
    })

    it('should show success message and switch to OTP step when OTP is sent', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent successfully',
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send otp/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/otp sent to your email/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/enter otp code/i)).toBeInTheDocument()
      })
    })

    it('should disable submit button while loading', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true, message: 'OK' }), 100))
      )

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send otp/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      expect(submitButton).toBeDisabled()
      expect(screen.getByText(/sending/i)).toBeInTheDocument()
    })
  })

  describe('OTP Verification Step', () => {
    beforeEach(() => {
      // Mock initial state at OTP step
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent',
      })
    })

    it('should render OTP input form after email submission', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send otp/i })

      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/enter otp code/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument()
      })
    })

    it('should only allow numeric input in OTP field', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent',
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      // Get to OTP step
      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send otp/i })
      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        const otpInput = screen.getByLabelText(/enter otp code/i)
        expect(otpInput).toBeInTheDocument()
      })

      const otpInput = screen.getByLabelText(/enter otp code/i)
      await user.type(otpInput, 'abc123xyz')

      // Should only contain numbers
      expect(otpInput).toHaveValue('123')
    })

    it('should limit OTP input to 6 digits', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent',
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      // Get to OTP step
      const emailInput = screen.getByLabelText(/email address/i)
      const submitButton = screen.getByRole('button', { name: /send otp/i })
      await user.type(emailInput, 'test@example.com')
      await user.click(submitButton)

      await waitFor(() => {
        const otpInput = screen.getByLabelText(/enter otp code/i)
        expect(otpInput).toBeInTheDocument()
      })

      const otpInput = screen.getByLabelText(/enter otp code/i)
      await user.type(otpInput, '1234567890')

      // Should be limited to 6 digits
      expect(otpInput).toHaveValue('123456')
    })

    it('should call verifyOTP when form is submitted with valid OTP', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent',
      })
      vi.mocked(authService.verifyOTP).mockResolvedValue({
        success: true,
        session_token: 'test-token',
        expires_at: '2024-12-31T23:59:59',
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      // Get to OTP step
      const emailInput = screen.getByLabelText(/email address/i)
      const emailSubmitButton = screen.getByRole('button', { name: /send otp/i })
      await user.type(emailInput, 'test@example.com')
      await user.click(emailSubmitButton)

      await waitFor(() => {
        const otpInput = screen.getByLabelText(/enter otp code/i)
        expect(otpInput).toBeInTheDocument()
      })

      const otpInput = screen.getByLabelText(/enter otp code/i)
      const verifyButton = screen.getByRole('button', { name: /verify/i })

      await user.type(otpInput, '123456')
      await user.click(verifyButton)

      await waitFor(() => {
        expect(authService.verifyOTP).toHaveBeenCalledWith('test@example.com', '123456')
      })
    })

    it('should navigate to dashboard on successful verification', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent',
      })
      vi.mocked(authService.verifyOTP).mockResolvedValue({
        success: true,
        session_token: 'test-token',
        expires_at: '2024-12-31T23:59:59',
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      // Get to OTP step
      const emailInput = screen.getByLabelText(/email address/i)
      const emailSubmitButton = screen.getByRole('button', { name: /send otp/i })
      await user.type(emailInput, 'test@example.com')
      await user.click(emailSubmitButton)

      await waitFor(() => {
        const otpInput = screen.getByLabelText(/enter otp code/i)
        expect(otpInput).toBeInTheDocument()
      })

      const otpInput = screen.getByLabelText(/enter otp code/i)
      const verifyButton = screen.getByRole('button', { name: /verify/i })

      await user.type(otpInput, '123456')
      await user.click(verifyButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('should show error message when OTP verification fails', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent',
      })
      vi.mocked(authService.verifyOTP).mockRejectedValue({
        response: {
          data: { detail: 'Invalid OTP code' },
        },
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      // Get to OTP step
      const emailInput = screen.getByLabelText(/email address/i)
      const emailSubmitButton = screen.getByRole('button', { name: /send otp/i })
      await user.type(emailInput, 'test@example.com')
      await user.click(emailSubmitButton)

      await waitFor(() => {
        const otpInput = screen.getByLabelText(/enter otp code/i)
        expect(otpInput).toBeInTheDocument()
      })

      const otpInput = screen.getByLabelText(/enter otp code/i)
      const verifyButton = screen.getByRole('button', { name: /verify/i })

      await user.type(otpInput, '000000')
      await user.click(verifyButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid otp/i)).toBeInTheDocument()
      })
    })

    it('should allow going back to email step', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent',
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      // Get to OTP step
      const emailInput = screen.getByLabelText(/email address/i)
      const emailSubmitButton = screen.getByRole('button', { name: /send otp/i })
      await user.type(emailInput, 'test@example.com')
      await user.click(emailSubmitButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/enter otp code/i)).toBeInTheDocument()
      })

      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
        expect(screen.queryByLabelText(/enter otp code/i)).not.toBeInTheDocument()
      })
    })

    it('should disable verify button when OTP is less than 6 digits', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent',
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      // Get to OTP step
      const emailInput = screen.getByLabelText(/email address/i)
      const emailSubmitButton = screen.getByRole('button', { name: /send otp/i })
      await user.type(emailInput, 'test@example.com')
      await user.click(emailSubmitButton)

      await waitFor(() => {
        const otpInput = screen.getByLabelText(/enter otp code/i)
        expect(otpInput).toBeInTheDocument()
      })

      const otpInput = screen.getByLabelText(/enter otp code/i)
      const verifyButton = screen.getByRole('button', { name: /verify/i })

      await user.type(otpInput, '12345')

      expect(verifyButton).toBeDisabled()

      await user.type(otpInput, '6')

      await waitFor(() => {
        expect(verifyButton).not.toBeDisabled()
      })
    })
  })

  describe('LocalStorage Integration', () => {
    it('should store session token in localStorage on successful verification', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.requestOTP).mockResolvedValue({
        success: true,
        message: 'OTP sent',
      })
      vi.mocked(authService.verifyOTP).mockResolvedValue({
        success: true,
        session_token: 'test-session-token-123',
        expires_at: '2024-12-31T23:59:59',
      })

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      )

      // Get to OTP step
      const emailInput = screen.getByLabelText(/email address/i)
      const emailSubmitButton = screen.getByRole('button', { name: /send otp/i })
      await user.type(emailInput, 'test@example.com')
      await user.click(emailSubmitButton)

      await waitFor(() => {
        const otpInput = screen.getByLabelText(/enter otp code/i)
        expect(otpInput).toBeInTheDocument()
      })

      const otpInput = screen.getByLabelText(/enter otp code/i)
      const verifyButton = screen.getByRole('button', { name: /verify/i })

      await user.type(otpInput, '123456')
      await user.click(verifyButton)

      await waitFor(() => {
        expect(localStorage.getItem('session_token')).toBe('test-session-token-123')
      })
    })
  })
})


