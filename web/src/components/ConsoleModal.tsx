import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { X, Terminal, Activity } from 'lucide-react'

interface ConsoleModalProps {
  buildId: string
  isOpen: boolean
  onClose: () => void
}

export default function ConsoleModal({ buildId, isOpen, onClose }: ConsoleModalProps) {
  const [lastHeartbeat, setLastHeartbeat] = useState(Date.now())
  const logEndRef = useRef<HTMLDivElement>(null)

  const { data: logsData } = useQuery({
    queryKey: ['build-logs', buildId],
    queryFn: async () => {
      setLastHeartbeat(Date.now())
      const response = await api.get(`/build/logs/${buildId}?lines=1000`)
      return response.data
    },
    refetchInterval: isOpen ? 2000 : 0, // Only poll when open
    enabled: isOpen
  })

  // Parse logs into structured lines
  const parsedLogs = logsData?.logs ? logsData.logs.split('\n').filter((line: string) => line.trim()) : []

  // Auto-scroll to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [parsedLogs])

  // Calculate time since last heartbeat for animation
  const isHeartbeatRecent = Date.now() - lastHeartbeat < 500

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-6xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Terminal className="text-emerald-400" size={20} />
            <h3 className="text-lg font-semibold text-white">Build Console</h3>
            {/* Heartbeat Indicator */}
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
              <Activity 
                className={`text-emerald-400 transition-all duration-300 ${
                  isHeartbeatRecent ? 'scale-125 opacity-100' : 'scale-100 opacity-60'
                }`} 
                size={14}
              />
              <span className="text-xs text-emerald-300 font-medium">Live</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="text-white" size={20} />
          </button>
        </div>

        {/* Console Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-4 bg-black/50 font-mono text-sm">
            {parsedLogs.length > 0 ? (
              <div className="space-y-1">
                {parsedLogs.map((line: string, idx: number) => (
                  <div 
                    key={idx}
                    className="text-slate-300 leading-relaxed"
                  >
                    <span className="text-slate-500 mr-2">[{(idx + 1).toString().padStart(3, '0')}]</span>
                    {line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Terminal className="mx-auto mb-2 opacity-50" size={32} />
                  <p>Waiting for console output...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-black/30">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Build ID: {buildId.substring(0, 12)}...</span>
            <span>{parsedLogs.length} lines</span>
          </div>
        </div>
      </div>
    </div>
  )
}
