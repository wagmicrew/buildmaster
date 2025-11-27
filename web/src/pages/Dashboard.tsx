import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { Server, GitBranch, Activity, Database, Clock, CheckCircle, XCircle, Loader } from 'lucide-react'

interface EnvironmentStats {
  name: string
  status: 'online' | 'offline' | 'error'
  uptime: string
  memory: {
    used: number
    total: number
    percent: number
  }
  cpu: {
    percent: number
    cores: number
  }
  git: {
    branch: string
    commit: string
    lastUpdate: string
    hasChanges: boolean
  }
  lastBuild: {
    status: 'success' | 'failed' | 'running' | 'none'
    time: string
    duration: string
  }
  database: {
    status: 'connected' | 'disconnected'
    responseTime: string
  }
}

export default function Dashboard() {
  // Fetch Dev environment statistics
  const { data: devStats } = useQuery({
    queryKey: ['dev-stats'],
    queryFn: async (): Promise<EnvironmentStats> => {
      const [health, git, buildStatus] = await Promise.all([
        api.get('/health/server?env=dev'),
        api.get('/git/status?env=dev'),
        api.get('/build/status').catch(() => ({ data: { status: 'none' } }))
      ])

      const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400)
        const hours = Math.floor((seconds % 86400) / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        return `${days}d ${hours}h ${minutes}m`
      }

      return {
        name: 'Development',
        status: health.data.uptime > 0 ? 'online' : 'offline',
        uptime: formatUptime(health.data.uptime || 0),
        memory: {
          used: health.data.memory?.used_mb || 0,
          total: health.data.memory?.total_mb || 0,
          percent: health.data.memory?.percent || 0
        },
        cpu: {
          percent: health.data.cpu?.percent || 0,
          cores: health.data.cpu?.cores || 0
        },
        git: {
          branch: git.data.branch || 'main',
          commit: git.data.commit?.substring(0, 8) || 'unknown',
          lastUpdate: git.data.last_update || new Date().toISOString(),
          hasChanges: git.data.has_changes || false
        },
        lastBuild: {
          status: buildStatus.data.status || 'none',
          time: buildStatus.data.started_at ? new Date(buildStatus.data.started_at).toLocaleString() : 'No builds',
          duration: buildStatus.data.duration || 'N/A'
        },
        database: {
          status: health.data.database?.status === 'connected' ? 'connected' : 'disconnected',
          responseTime: health.data.database?.response_time || 'N/A'
        }
      }
    },
    refetchInterval: 5000
  })

  // Fetch Prod environment statistics
  const { data: prodStats } = useQuery({
    queryKey: ['prod-stats'],
    queryFn: async (): Promise<EnvironmentStats> => {
      const [health, git] = await Promise.all([
        api.get('/health/server?env=prod'),
        api.get('/git/status?env=prod')
      ])

      const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400)
        const hours = Math.floor((seconds % 86400) / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        return `${days}d ${hours}h ${minutes}m`
      }

      return {
        name: 'Production',
        status: health.data.uptime > 0 ? 'online' : 'offline',
        uptime: formatUptime(health.data.uptime || 0),
        memory: {
          used: health.data.memory?.used_mb || 0,
          total: health.data.memory?.total_mb || 0,
          percent: health.data.memory?.percent || 0
        },
        cpu: {
          percent: health.data.cpu?.percent || 0,
          cores: health.data.cpu?.cores || 0
        },
        git: {
          branch: git.data.branch || 'main',
          commit: git.data.commit?.substring(0, 8) || 'unknown',
          lastUpdate: git.data.last_update || new Date().toISOString(),
          hasChanges: git.data.has_changes || false
        },
        lastBuild: {
          status: 'none', // Production doesn't have builds
          time: 'N/A',
          duration: 'N/A'
        },
        database: {
          status: health.data.database?.status === 'connected' ? 'connected' : 'disconnected',
          responseTime: health.data.database?.response_time || 'N/A'
        }
      }
    },
    refetchInterval: 5000
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'success':
        return <CheckCircle className="text-emerald-400" size={20} />
      case 'offline':
      case 'disconnected':
      case 'failed':
        return <XCircle className="text-rose-400" size={20} />
      case 'running':
        return <Loader className="animate-spin text-yellow-400" size={20} />
      default:
        return <Activity className="text-slate-400" size={20} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'success':
        return 'text-emerald-400'
      case 'offline':
      case 'disconnected':
      case 'failed':
        return 'text-rose-400'
      case 'running':
        return 'text-yellow-400'
      default:
        return 'text-slate-400'
    }
  }

  const EnvironmentCard = ({ stats }: { stats: EnvironmentStats }) => (
    <div className="bg-black/20 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">{stats.name}</h2>
        <div className="flex items-center gap-2">
          {getStatusIcon(stats.status)}
          <span className={`text-sm font-medium ${getStatusColor(stats.status)}`}>
            {stats.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Server Statistics */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Server className="text-slate-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Server</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Uptime:</span>
            <span className="ml-2 text-white">{stats.uptime}</span>
          </div>
          <div>
            <span className="text-slate-400">CPU:</span>
            <span className="ml-2 text-white">{stats.cpu.percent.toFixed(1)}% ({stats.cpu.cores} cores)</span>
          </div>
          <div>
            <span className="text-slate-400">Memory:</span>
            <span className="ml-2 text-white">{stats.memory.used}MB / {stats.memory.total}MB</span>
          </div>
          <div>
            <span className="text-slate-400">Memory %:</span>
            <span className="ml-2 text-white">{stats.memory.percent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Git Information */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <GitBranch className="text-slate-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Git</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div>
            <span className="text-slate-400">Branch:</span>
            <span className="ml-2 text-white">{stats.git.branch}</span>
          </div>
          <div>
            <span className="text-slate-400">Commit:</span>
            <span className="ml-2 text-white font-mono">{stats.git.commit}</span>
          </div>
          <div>
            <span className="text-slate-400">Last Update:</span>
            <span className="ml-2 text-white">{new Date(stats.git.lastUpdate).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-400">Changes:</span>
            <span className={`ml-2 ${stats.git.hasChanges ? 'text-yellow-400' : 'text-emerald-400'}`}>
              {stats.git.hasChanges ? 'Pending changes' : 'Clean'}
            </span>
          </div>
        </div>
      </div>

      {/* Build Information */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="text-slate-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Last Build</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status:</span>
            <div className="flex items-center gap-2">
              {getStatusIcon(stats.lastBuild.status)}
              <span className={`${getStatusColor(stats.lastBuild.status)}`}>
                {stats.lastBuild.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <span className="text-slate-400">Time:</span>
            <span className="ml-2 text-white">{stats.lastBuild.time}</span>
          </div>
          <div>
            <span className="text-slate-400">Duration:</span>
            <span className="ml-2 text-white">{stats.lastBuild.duration}</span>
          </div>
        </div>
      </div>

      {/* Database Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-slate-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Database</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status:</span>
            <div className="flex items-center gap-2">
              {getStatusIcon(stats.database.status)}
              <span className={`${getStatusColor(stats.database.status)}`}>
                {stats.database.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <span className="text-slate-400">Response Time:</span>
            <span className="ml-2 text-white">{stats.database.responseTime}</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Environment Statistics</h1>
        <p className="text-slate-400">Real-time monitoring of Development and Production environments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {devStats && <EnvironmentCard stats={devStats} />}
        {prodStats && <EnvironmentCard stats={prodStats} />}
      </div>

      {/* Loading States */}
      {!devStats && !prodStats && (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin text-slate-400" size={32} />
          <span className="ml-3 text-slate-400">Loading environment statistics...</span>
        </div>
      )}
    </div>
  )
}
