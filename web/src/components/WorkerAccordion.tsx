import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { 
  Users, 
  Loader, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RotateCcw,
  Clock,
  Activity
} from 'lucide-react'

interface Worker {
  id: string
  job_name: string
  status: 'running' | 'completed' | 'failed' | 'stalled'
  duration_seconds: number
  last_updated: string
  is_stalled: boolean
}

interface BuildMetrics {
  workers: Worker[]
  total_workers: number
  running_workers: number
  stalled_workers: number
}

export default function WorkerAccordion() {
  const { data: metrics, isLoading, error } = useQuery<BuildMetrics>({
    queryKey: ['build-metrics'],
    queryFn: async () => {
      const response = await api.get('/build/metrics')
      return response.data
    },
    refetchInterval: 3000, // Update every 3 seconds
  })

  const handleStalledMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/workers/handle-stalled')
      return response.data
    },
  })

  
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const getStatusIcon = (status: string, isStalled: boolean) => {
    if (isStalled) return AlertTriangle
    switch (status) {
      case 'running': return Loader
      case 'completed': return CheckCircle
      case 'failed': return XCircle
      case 'stalled': return AlertTriangle
      default: return Clock
    }
  }

  const getStatusColor = (status: string, isStalled: boolean) => {
    if (isStalled) return 'text-amber-400'
    switch (status) {
      case 'running': return 'text-sky-400'
      case 'completed': return 'text-emerald-400'
      case 'failed': return 'text-rose-400'
      case 'stalled': return 'text-amber-400'
      default: return 'text-slate-400'
    }
  }

  const getStatusBg = (status: string, isStalled: boolean) => {
    if (isStalled) return 'bg-amber-500/10 border-amber-500/30'
    switch (status) {
      case 'running': return 'bg-sky-500/10 border-sky-500/30'
      case 'completed': return 'bg-emerald-500/10 border-emerald-500/30'
      case 'failed': return 'bg-rose-500/10 border-rose-500/30'
      case 'stalled': return 'bg-amber-500/10 border-amber-500/30'
      default: return 'bg-slate-500/10 border-slate-500/30'
    }
  }

  const WorkerPanel = ({ worker }: { worker: Worker }) => {
    const StatusIcon = getStatusIcon(worker.status, worker.is_stalled)
    const statusColor = getStatusColor(worker.status, worker.is_stalled)
    const statusBg = getStatusBg(worker.status, worker.is_stalled)

    return (
      <div className={`bg-black/30 border ${statusBg} rounded-lg p-4 hover:bg-black/40 transition-all duration-300`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusBg}`}>
              <StatusIcon className={statusColor} size={18} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{worker.job_name}</h4>
              <p className="text-xs text-slate-400">Thread: {worker.id}</p>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusBg} ${statusColor}`}>
            {worker.status}
            {worker.is_stalled && ' (stalled)'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="text-slate-400" size={12} />
            <span className="text-slate-400">Duration:</span>
            <span className="text-white font-medium">{formatDuration(worker.duration_seconds)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="text-slate-400" size={12} />
            <span className="text-slate-400">Updated:</span>
            <span className="text-white font-medium">
              {new Date(worker.last_updated).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {worker.is_stalled && (
          <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={12} />
              <span className="text-xs">Worker appears to be stalled</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-rose-400">
          <Users size={16} />
          <span className="text-sm">Failed to load worker status</span>
        </div>
      </div>
    )
  }

  if (isLoading || !metrics) {
    return (
      <div className="bg-black/30 border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader className="animate-pulse" size={16} />
          <span className="text-sm">Loading worker status...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 rounded-lg">
              <Users className="text-sky-400" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Active Threads</h3>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Total: {metrics.total_workers}</span>
                <span className="text-emerald-400">Running: {metrics.running_workers}</span>
                {metrics.stalled_workers > 0 && (
                  <span className="text-amber-400">Stalled: {metrics.stalled_workers}</span>
                )}
              </div>
            </div>
          </div>
          {metrics.stalled_workers > 0 && (
            <button
              onClick={() => handleStalledMutation.mutate()}
              disabled={handleStalledMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {handleStalledMutation.isPending ? (
                <Loader className="animate-spin" size={14} />
              ) : (
                <RotateCcw size={14} />
              )}
              <span className="text-xs text-amber-400">
                Handle Stalled
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Thread Panels */}
      {metrics.workers.length === 0 ? (
        <div className="bg-black/30 border border-white/10 rounded-lg p-8 text-center">
          <Users className="text-slate-500 mx-auto mb-3" size={32} />
          <p className="text-sm text-slate-400">No active threads</p>
          <p className="text-xs text-slate-500 mt-1">Threads will appear here when builds are running</p>
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.workers.map((worker) => (
            <WorkerPanel key={worker.id} worker={worker} />
          ))}
        </div>
      )}
    </div>
  )
}
