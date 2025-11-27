import api from './api'

export interface OTPRequest {
  email: string
}

export interface OTPVerify {
  email: string
  otp_code: string
}

export interface SessionResponse {
  success: boolean
  session_token?: string
  expires_at?: string
  message?: string
}

export const authService = {
  async requestOTP(email: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/auth/request-otp', { email })
    return response.data
  },

  async verifyOTP(email: string, otpCode: string): Promise<SessionResponse> {
    const response = await api.post('/auth/verify-otp', { email, otp_code: otpCode })
    const data = response.data
    if (data.success && data.session_token) {
      localStorage.setItem('session_token', data.session_token)
    }
    return data
  },

  logout(): void {
    localStorage.removeItem('session_token')
    window.location.href = '/login'
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('session_token')
  },
}

