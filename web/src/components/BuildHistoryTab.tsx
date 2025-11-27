import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { 
  CheckCircle, XCircle, Loader, Calendar, Clock, HardDrive, 
  Users, AlertTriangle, Eye
} from 'lucide-react'

interface Build {
  build_id?: string
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

export default function BuildHistoryTab() {
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
        return <Loader className="animate-spin text-sky-400" size={20} />
      case 'pending':
        return <Loader className="animate-spin text-yellow-400" size={20} />
      default:
        return <AlertTriangle className="text-slate-400" size={20} />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-green-400" size={32} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-sky-400" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-white">Build History</h2>
          <p className="text-slate-400">View and analyze recent builds</p>
        </div>
      </div>

      {!builds || builds.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-white/5 rounded-lg p-8">
            <Clock className="mx-auto text-slate-400 mb-4" size={48} />
            <h3 className="text-xl font-bold text-white mb-2">No Builds Yet</h3>
            <p className="text-slate-400">Start your first build to see history here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {builds.map((build) => (
            <div
              key={build.build_id || build.started_at}
              className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => setSelectedBuild(build)}
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
                <div className="md:col-span-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <span className="text-slate-300">Duration:</span>
                    <span className="text-white font-medium">
                      {formatDuration(build.duration_seconds)}
                    </span>
                  </div>
                  {build.build_size_mb && (
                    <div className="flex items-center gap-2">
                      <HardDrive size={14} className="text-slate-400" />
                      <span className="text-slate-300">Size:</span>
                      <span className="text-white font-medium">
                        {build.build_size_mb}MB
                      </span>
                    </div>
                  )}
                  {build.worker_count && (
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-slate-400" />
                      <span className="text-slate-300">Workers:</span>
                      <span className="text-white font-medium">
                        {build.worker_count}
                      </span>
                    </div>
                  )}
                  {build.current_step && (
                    <div className="flex items-center gap-2">
                      <Loader size={14} className="text-slate-400" />
                      <span className="text-slate-300">Step:</span>
                      <span className="text-white font-medium truncate">
                        {build.current_step}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="md:col-span-2 flex items-center justify-end gap-2">
                  {build.error && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedBuild(build)
                        setShowErrorDialog(true)
                      }}
                      className="p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-colors"
                    >
                      <XCircle size={16} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedBuild(build)
                    }}
                    className="p-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-lg transition-colors"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {build.message && (
                <div className="mt-3 text-sm text-slate-400 border-t border-white/10 pt-3">
                  {build.message}
                </div>
              )}
            </div>
          ))}

          {/* Selected Build Details */}
          {selectedBuild && (
            <div className="mt-6 bg-white/5 rounded-lg p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Build Details</h3>
                <button
                  onClick={() => setSelectedBuild(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Build ID:</span>
                  <span className="text-white ml-2 font-mono">
                    {selectedBuild.build_id || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>
                  <span className="text-white ml-2 capitalize">
                    {selectedBuild.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Started:</span>
                  <span className="text-white ml-2">
                    {formatDate(selectedBuild.started_at)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Completed:</span>
                  <span className="text-white ml-2">
                    {selectedBuild.completed_at ? formatDate(selectedBuild.completed_at) : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Duration:</span>
                  <span className="text-white ml-2">
                    {formatDuration(selectedBuild.duration_seconds)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Build Size:</span>
                  <span className="text-white ml-2">
                    {selectedBuild.build_size_mb ? `${selectedBuild.build_size_mb}MB` : 'N/A'}
                  </span>
                </div>
              </div>

              {selectedBuild.config && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <h4 className="text-white font-medium mb-2">Configuration</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Mode:</span>
                      <span className="text-white ml-2">
                        {selectedBuild.config.build_mode || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Workers:</span>
                      <span className="text-white ml-2">
                        {selectedBuild.config.workers || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Memory:</span>
                      <span className="text-white ml-2">
                        {selectedBuild.config.max_old_space_size ? `${selectedBuild.config.max_old_space_size}MB` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Dialog */}
          {showErrorDialog && selectedBuild?.error && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Build Error</h3>
                  <button
                    onClick={() => setShowErrorDialog(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
                <div className="bg-black/50 rounded-lg p-4">
                  <pre className="text-rose-400 text-sm font-mono whitespace-pre-wrap">
                    {selectedBuild.error}
                  </pre>
                </div>
                {selectedBuild.error_type && (
                  <div className="mt-4 text-sm text-slate-400">
                    Error Type: <span className="text-white">{selectedBuild.error_type}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
