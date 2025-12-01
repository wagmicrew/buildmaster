import { Zap, Clock, CheckCircle, Loader, Circle } from 'lucide-react'

interface TurbopackPhase {
  name: string
  type: string
  status: 'completed' | 'active' | 'pending'
  duration_ms?: number
  line?: string
}

interface TurbopackInfo {
  phases: TurbopackPhase[]
  current_phase?: TurbopackPhase
  total_time_ms?: number
  is_turbopack: boolean
  workers_active: number
  estimated_time_remaining?: number
  build_progress?: {
    current: number
    total: number
    percentage: number
  }
}

interface TurbopackWorkersProps {
  turbopackInfo?: TurbopackInfo
}

export default function TurbopackWorkers({ turbopackInfo }: TurbopackWorkersProps) {
  if (!turbopackInfo || !turbopackInfo.is_turbopack) {
    return null
  }

  const formatTime = (ms?: number) => {
    if (!ms) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatEstimatedTime = (ms?: number) => {
    if (!ms) return null
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const getPhaseIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-400" size={16} />
      case 'active':
        return <Loader className="text-sky-400 animate-spin" size={16} />
      default:
        return <Circle className="text-slate-600" size={16} />
    }
  }

  const getPhaseColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-500/30 bg-green-500/10 text-green-300'
      case 'active':
        return 'border-sky-500/50 bg-sky-500/20 text-sky-300 animate-pulse'
      default:
        return 'border-slate-700/50 bg-slate-800/30 text-slate-500'
    }
  }

  const activePhases = turbopackInfo.phases.filter(p => p.status === 'active')
  const completedPhases = turbopackInfo.phases.filter(p => p.status === 'completed')
  const pendingPhases = turbopackInfo.phases.filter(p => p.status === 'pending')

  return (
    <div className="glass-subtle rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="text-yellow-400" size={20} />
        <h3 className="text-lg font-semibold text-white">Turbopack Build Status</h3>
        {turbopackInfo.workers_active > 0 && (
          <span className="ml-auto px-2 py-1 bg-sky-500/20 text-sky-300 text-xs rounded">
            {turbopackInfo.workers_active} active
          </span>
        )}
      </div>

      {/* Build Progress */}
      {turbopackInfo.build_progress && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Page Generation</span>
            <span className="text-white font-semibold">
              {turbopackInfo.build_progress.current} / {turbopackInfo.build_progress.total}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-sky-500 to-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${turbopackInfo.build_progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Estimated Time Remaining */}
      {turbopackInfo.estimated_time_remaining && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="text-blue-400" size={16} />
            <span className="text-sm text-blue-300">
              Estimated time remaining: <strong>{formatEstimatedTime(turbopackInfo.estimated_time_remaining)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Current Phase */}
      {turbopackInfo.current_phase && (
        <div className="mb-4 p-3 bg-sky-500/20 border border-sky-500/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Loader className="text-sky-400 animate-spin" size={16} />
            <span className="text-sm font-medium text-sky-300">Current Phase</span>
          </div>
          <div className="text-white font-semibold">{turbopackInfo.current_phase.name}</div>
          {turbopackInfo.current_phase.duration_ms && (
            <div className="text-xs text-slate-400 mt-1">
              Duration: {formatTime(turbopackInfo.current_phase.duration_ms)}
            </div>
          )}
        </div>
      )}

      {/* Build Phases */}
      {turbopackInfo.phases.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Build Phases</h4>
          <div className="space-y-2">
            {/* Active Phases */}
            {activePhases.map((phase, idx) => (
              <div
                key={`active-${idx}`}
                className={`border rounded-lg p-3 ${getPhaseColor(phase.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getPhaseIcon(phase.status)}
                    <span className="font-medium text-sm">{phase.name}</span>
                  </div>
                  {phase.duration_ms && (
                    <span className="text-xs opacity-75">{formatTime(phase.duration_ms)}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Completed Phases */}
            {completedPhases.map((phase, idx) => (
              <div
                key={`completed-${idx}`}
                className={`border rounded-lg p-3 ${getPhaseColor(phase.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getPhaseIcon(phase.status)}
                    <span className="font-medium text-sm">{phase.name}</span>
                  </div>
                  {phase.duration_ms && (
                    <span className="text-xs opacity-75">{formatTime(phase.duration_ms)}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Pending Phases */}
            {pendingPhases.length > 0 && pendingPhases.slice(0, 3).map((phase, idx) => (
              <div
                key={`pending-${idx}`}
                className={`border rounded-lg p-3 ${getPhaseColor(phase.status)}`}
              >
                <div className="flex items-center gap-2">
                  {getPhaseIcon(phase.status)}
                  <span className="font-medium text-sm">{phase.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-green-400">{completedPhases.length}</div>
          <div className="text-xs text-slate-400">Completed</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-sky-400">{activePhases.length}</div>
          <div className="text-xs text-slate-400">Active</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-500">{pendingPhases.length}</div>
          <div className="text-xs text-slate-400">Pending</div>
        </div>
      </div>
    </div>
  )
}

