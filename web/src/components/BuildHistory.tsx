import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { CheckCircle, XCircle, Clock, Loader, AlertTriangle, Eye, Calendar, Timer, HardDrive, Cpu } from 'lucide-react'

interface Build {
  build_id: string
  status: string
  started_at: string
  completed_at?: string
  duration_seconds?: number
  build_size_mb?: number
  worker_count?: number
  current_step?: string
  message?: string
  error?: string
  error_type?: string
  config?: {
    build_mode?: string
    workers?: number
    max_old_space_size?: number
  }
}

export default function BuildHistory() {
  const [selectedBuild, setSelectedBuild] = useState<Build | null>(null)
  const [showErrorDialog, setShowErrorDialog] = useState(false)

  const { data: builds, isLoading } = useQuery<Build[]>({
    queryKey: ['build-history'],
    queryFn: async () => {
      const response = await api.get('/build/history?limit=50')
      return response.data.builds || []
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-green-400" size={20} />
      case 'error':
        return <XCircle className="text-rose-400" size={20} />
      case 'running':
        return <Loader className="text-sky-400 animate-spin" size={20} />
      case 'pending':
        return <Clock className="text-yellow-400" size={20} />
      default:
        return <AlertTriangle className="text-slate-400" size={20} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 border-green-500/50 text-green-400'
      case 'error':
        return 'bg-rose-500/10 border-rose-500/50 text-rose-400'
      case 'running':
        return 'bg-sky-500/10 border-sky-500/50 text-sky-400'
      case 'pending':
        return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
      default:
        return 'bg-slate-500/10 border-slate-500/50 text-slate-400'
    }
  }

  const getErrorTypeLabel = (errorType: string) => {
    const labels: Record<string, string> = {
      OUT_OF_MEMORY: '💾 Out of Memory',
      CONNECTION_ERROR: '🔌 Connection Error',
      MODULE_NOT_FOUND: '📦 Module Not Found',
      SYNTAX_ERROR: '⚠️ Syntax Error',
      TYPE_ERROR: '🔤 Type Error',
      BUILD_ERROR: '🔨 Build Error'
    }
    return labels[errorType] || '❌ Error'
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="animate-spin text-sky-400" size={32} />
        <span className="ml-3 text-slate-400">Loading build history...</span>
      </div>
    )
  }

  if (!builds || builds.length === 0) {
    return (
      <div className="text-center p-12 glass-subtle rounded-xl">
        <Clock className="mx-auto text-slate-600 mb-3" size={48} />
        <p className="text-slate-400">No builds yet</p>
        <p className="text-slate-500 text-sm mt-2">Start your first build to see it here</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Build History</h3>
        <span className="text-sm text-slate-400">{builds.length} builds</span>
      </div>

      {/* Build Grid */}
      <div className="grid grid-cols-1 gap-3">
        {builds.map((build) => (
          <div
            key={build.build_id}
            className={`glass-subtle rounded-xl p-4 border transition-all hover:bg-white/5 ${getStatusColor(build.status)}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Status Icon */}
              <div className="md:col-span-1 flex items-center justify-center">
                {getStatusIcon(build.status)}
              </div>

              {/* Build Info */}
              <div className="md:col-span-5">
                <div className="flex items-center gap-2 mb-1">
                  {build.build_id && (
                    <span className="font-mono text-sm text-white">
                      {build.build_id.substring(0, 8)}
                    </span>
                  )}
                  {build.config?.build_mode && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      build.config.build_mode === 'quick' ? 'bg-sky-500/20 text-sky-400' :
                      build.config.build_mode === 'ram-optimized' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {build.config.build_mode}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <Calendar size={12} />
                  {formatDate(build.started_at)}
                  <span className="text-slate-600">•</span>
                  {formatRelativeTime(build.started_at)}
                </div>
              </div>

              {/* Metrics */}
              <div className="md:col-span-4 grid grid-cols-3 gap-2 text-xs">
                <div className="flex flex-col items-center p-2 bg-white/5 rounded-lg">
                  <Timer size={14} className="text-slate-400 mb-1" />
                  <span className="text-white font-medium">{formatDuration(build.duration_seconds)}</span>
                  <span className="text-slate-500">Duration</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/5 rounded-lg">
                  <HardDrive size={14} className="text-slate-400 mb-1" />
                  <span className="text-white font-medium">{build.build_size_mb ? `${build.build_size_mb}MB` : 'N/A'}</span>
                  <span className="text-slate-500">Size</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/5 rounded-lg">
                  <Cpu size={14} className="text-slate-400 mb-1" />
                  <span className="text-white font-medium">{build.worker_count || 'Auto'}</span>
                  <span className="text-slate-500">Workers</span>
                </div>
              </div>

              {/* Actions */}
              <div className="md:col-span-2 flex items-center justify-end gap-2">
                {build.error && (
                  <button
                    onClick={() => {
                      setSelectedBuild(build)
                      setShowErrorDialog(true)
                    }}
                    className="p-2 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg transition-colors"
                    title="View Error"
                  >
                    <Eye size={16} className="text-rose-400" />
                  </button>
                )}
                <span className={`text-xs font-medium px-3 py-1 rounded-full capitalize ${
                  build.status === 'success' ? 'bg-green-500/20 text-green-400' :
                  build.status === 'error' ? 'bg-rose-500/20 text-rose-400' :
                  build.status === 'running' ? 'bg-sky-500/20 text-sky-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {build.status}
                </span>
              </div>
            </div>

            {/* Error Type Badge */}
            {build.error_type && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-1 rounded">
                  {getErrorTypeLabel(build.error_type)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Error Dialog */}
      {showErrorDialog && selectedBuild && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 max-w-3xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <XCircle className="text-rose-400" size={24} />
                Build Error Details
              </h3>
              <button
                onClick={() => setShowErrorDialog(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-400 mb-1">Build ID</div>
                <div className="font-mono text-white">{selectedBuild.build_id}</div>
              </div>

              {selectedBuild.error_type && (
                <div>
                  <div className="text-sm text-slate-400 mb-1">Error Type</div>
                  <div className="text-rose-400">{getErrorTypeLabel(selectedBuild.error_type)}</div>
                </div>
              )}

              <div>
                <div className="text-sm text-slate-400 mb-1">Error Message</div>
                <div className="text-white">{selectedBuild.message}</div>
              </div>

              {selectedBuild.error && (
                <div>
                  <div className="text-sm text-slate-400 mb-2">Error Log (last 2000 characters)</div>
                  <pre className="bg-black/50 p-4 rounded-lg text-xs text-slate-300 overflow-auto max-h-96 font-mono">
                    {selectedBuild.error}
                  </pre>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowErrorDialog(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
