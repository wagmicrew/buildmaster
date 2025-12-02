import { describe, it, expect } from 'vitest'

// Example utility functions to test
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${minutes}m`
}

describe('Format Utilities', () => {
  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(1024)).toBe('1.00 KB')
      expect(formatBytes(1048576)).toBe('1.00 MB')
      expect(formatBytes(1073741824)).toBe('1.00 GB')
    })

    it('should handle small values', () => {
      expect(formatBytes(500)).toBe('500.00 B')
      expect(formatBytes(512)).toBe('512.00 B')
    })

    it('should handle large values', () => {
      expect(formatBytes(1099511627776)).toBe('1.00 TB')
    })
  })

  describe('formatUptime', () => {
    it('should format uptime correctly', () => {
      expect(formatUptime(0)).toBe('0d 0h 0m')
      expect(formatUptime(60)).toBe('0d 0h 1m')
      expect(formatUptime(3600)).toBe('0d 1h 0m')
      expect(formatUptime(86400)).toBe('1d 0h 0m')
      expect(formatUptime(90061)).toBe('1d 1h 1m')
    })

    it('should handle multiple days', () => {
      expect(formatUptime(172800)).toBe('2d 0h 0m')
      expect(formatUptime(259200)).toBe('3d 0h 0m')
    })
  })
})


