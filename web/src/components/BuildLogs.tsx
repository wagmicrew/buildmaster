import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { Activity, ChevronDown, ChevronUp, Terminal, Square, AlertTriangle } from 'lucide-react'

interface BuildLogsProps {
  buildId: string
}

export default function BuildLogs({ buildId }: BuildLogsProps) {
  const [showConsole, setShowConsole] = useState(false)
  const [lastHeartbeat, setLastHeartbeat] = useState(Date.now())
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const { data: logsData } = useQuery({
    queryKey: ['build-logs', buildId],
    queryFn: async () => {
      setLastHeartbeat(Date.now()) // Update heartbeat timestamp
      const response = await api.get(`/build/logs/${buildId}?lines=500`)
      return response.data
    },
    refetchInterval: 2000, // Poll every 2 seconds
  })

  const { data: buildStatus } = useQuery({
    queryKey: ['build-status', buildId],
    queryFn: async () => {
      const response = await api.get(`/build/status/${buildId}`)
      return response.data
    },
    refetchInterval: 3000, // Poll every 3 seconds
  })

  const killBuildMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/build/kill/${buildId}`)
      return response.data
    },
    onSuccess: () => {
      setShowKillConfirm(false)
    },
    onError: (error: any) => {
      alert(`Failed to kill build: ${error.response?.data?.detail || 'Unknown error'}`)
    }
  })

  // Parse logs into structured lines
  const parsedLogs = logsData?.logs ? logsData.logs.split('\n').filter((line: string) => line.trim()) : []
  const recentLogs = parsedLogs.slice(-20) // Show last 20 lines

  // Calculate time since last heartbeat for animation
  const isHeartbeatRecent = Date.now() - lastHeartbeat < 500

  return (
    <div className="glass rounded-2xl p-4 sm:p-6">
      {/* Header with Heartbeat */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Terminal className="text-emerald-400" size={20} />
          <h2 className="text-lg sm:text-xl font-semibold text-white">Build Logs</h2>
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
        <div className="flex items-center gap-2">
          {/* Kill Build Button - Only show for running builds */}
          {buildStatus?.status === 'running' && (
            <button
              onClick={() => setShowKillConfirm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 text-sm rounded-lg transition-colors"
            >
              <Square size={16} />
              Kill Build
            </button>
          )}
          <button
            onClick={() => setShowConsole(!showConsole)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            {showConsole ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showConsole ? 'Hide Console' : 'Show Console'}
          </button>
        </div>
      </div>

      {/* Kill Confirmation Dialog */}
      {showKillConfirm && (
        <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-rose-400 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="text-rose-400 font-semibold mb-2">Kill Build Process</h3>
              <p className="text-slate-300 text-sm mb-4">
                Are you sure you want to kill this build process? This will terminate all build operations and cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => killBuildMutation.mutate()}
                  disabled={killBuildMutation.isPending}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {killBuildMutation.isPending ? 'Killing...' : 'Kill Build'}
                </button>
                <button
                  onClick={() => setShowKillConfirm(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parsed Log Lines */}
      <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
        {recentLogs.length > 0 ? (
          recentLogs.map((line: string, idx: number) => (
            <div 
              key={idx}
              className="text-xs sm:text-sm px-3 py-1.5 bg-black/30 rounded border-l-2 border-slate-600 hover:border-emerald-500/50 transition-colors font-mono text-slate-300"
            >
              {line}
            </div>
          ))
        ) : (
          <div className="text-slate-500 text-sm text-center py-8">No logs available yet...</div>
        )}
      </div>

      {/* Collapsible Raw Console */}
      {showConsole && (
        <div className="mt-4 bg-black/50 rounded-xl p-4 font-mono text-xs sm:text-sm text-slate-300 max-h-96 overflow-y-auto">
          {logsData?.logs ? (
            <pre className="whitespace-pre-wrap">{logsData.logs}</pre>
          ) : (
            <div className="text-slate-500">No console output yet...</div>
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}

