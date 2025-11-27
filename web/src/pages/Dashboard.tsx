import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { 
  Server, 
  GitBranch, 
  Activity, 
  Database, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader,
  Cpu,
  HardDrive,
  Zap,
  ArrowRight,
  RefreshCw,
  Rocket,
  Code,
  Globe
} from 'lucide-react'

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

// Circular Progress Component
const CircularProgress = ({ percent, size = 120, strokeWidth = 8, color = 'emerald' }: { 
  percent: number, size?: number, strokeWidth?: number, color?: string 
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percent / 100) * circumference
  
  const colorMap: Record<string, string> = {
    emerald: '#34d399',
    sky: '#38bdf8',
    amber: '#fbbf24',
    rose: '#fb7185',
    purple: '#a78bfa'
  }
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorMap[color] || colorMap.emerald}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-white">{percent.toFixed(0)}%</span>
      </div>
    </div>
  )
}

// Progress Bar Component
const ProgressBar = ({ percent, color = 'emerald', label, value }: { 
  percent: number, color?: string, label: string, value: string 
}) => {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    purple: 'bg-purple-500'
  }
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-medium">{value}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorMap[color]} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  )
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

  const navigate = useNavigate()

  const EnvironmentCard = ({ stats, isDev = false }: { stats: EnvironmentStats, isDev?: boolean }) => {
    const accentColor = isDev ? 'sky' : 'emerald'
    const gradientFrom = isDev ? 'from-sky-500' : 'from-emerald-500'
    const gradientTo = isDev ? 'to-blue-600' : 'to-teal-600'
    const borderColor = isDev ? 'border-sky-500/30' : 'border-emerald-500/30'
    const iconBg = isDev ? 'bg-sky-500/20' : 'bg-emerald-500/20'
    const iconColor = isDev ? 'text-sky-400' : 'text-emerald-400'
    const EnvIcon = isDev ? Code : Globe

    return (
      <div className={`glass rounded-2xl overflow-hidden border ${borderColor}`}>
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center`}>
                <EnvIcon className="text-white" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{stats.name}</h2>
                <p className="text-white/70 text-sm">
                  {isDev ? 'dev.dintrafikskolahlm.se' : 'dintrafikskolahlm.se'}
                </p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-full ${stats.status === 'online' ? 'bg-white/20' : 'bg-red-500/50'} backdrop-blur`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${stats.status === 'online' ? 'bg-white animate-pulse' : 'bg-red-300'}`} />
                <span className="text-white font-medium text-sm">
                  {stats.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Resource Gauges */}
          <div className="flex justify-around items-center py-4">
            <div className="text-center">
              <CircularProgress percent={stats.cpu.percent} size={100} color={accentColor} />
              <div className="mt-2 flex items-center justify-center gap-1 text-slate-400 text-sm">
                <Cpu size={14} />
                <span>CPU</span>
              </div>
            </div>
            <div className="text-center">
              <CircularProgress percent={stats.memory.percent} size={100} color={accentColor} />
              <div className="mt-2 flex items-center justify-center gap-1 text-slate-400 text-sm">
                <HardDrive size={14} />
                <span>Memory</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl ${iconBg}`}>
              <div className="flex items-center gap-2 mb-1">
                <Clock className={iconColor} size={16} />
                <span className="text-slate-400 text-xs">Uptime</span>
              </div>
              <span className="text-white font-semibold">{stats.uptime}</span>
            </div>
            <div className={`p-4 rounded-xl ${iconBg}`}>
              <div className="flex items-center gap-2 mb-1">
                <Zap className={iconColor} size={16} />
                <span className="text-slate-400 text-xs">CPU Cores</span>
              </div>
              <span className="text-white font-semibold">{stats.cpu.cores} cores</span>
            </div>
          </div>

          {/* Memory Progress */}
          <ProgressBar 
            percent={stats.memory.percent} 
            color={accentColor}
            label="Memory Usage"
            value={`${stats.memory.used}MB / ${stats.memory.total}MB`}
          />

          {/* Git Section */}
          <div className="p-4 bg-black/20 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <GitBranch size={16} />
              <span>Git Status</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <code className={`px-2 py-1 rounded ${iconBg} ${iconColor} text-sm font-mono`}>
                  {stats.git.branch}
                </code>
                <code className="text-slate-400 text-sm font-mono">
                  {stats.git.commit}
                </code>
              </div>
              {stats.git.hasChanges ? (
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                  Changes pending
                </span>
              ) : (
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                  Clean
                </span>
              )}
            </div>
          </div>

          {/* Database & Build Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-black/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Database className="text-slate-400" size={16} />
                <span className="text-slate-400 text-sm">Database</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(stats.database.status)}
                <span className={getStatusColor(stats.database.status)}>
                  {stats.database.status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            <div className="p-4 bg-black/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="text-slate-400" size={16} />
                <span className="text-slate-400 text-sm">Last Build</span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(stats.lastBuild.status)}
                <span className={getStatusColor(stats.lastBuild.status)}>
                  {stats.lastBuild.status === 'none' ? 'No builds' : stats.lastBuild.status}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3">
            {isDev ? (
              <>
                <button 
                  onClick={() => navigate('/build')}
                  className={`flex-1 py-3 px-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity`}
                >
                  <Rocket size={18} />
                  Build
                </button>
                <button 
                  onClick={() => navigate('/git')}
                  className="flex-1 py-3 px-4 bg-white/10 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
                >
                  <RefreshCw size={18} />
                  Pull
                </button>
              </>
            ) : (
              <button 
                onClick={() => navigate('/deploy')}
                className={`flex-1 py-3 px-4 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity`}
              >
                <ArrowRight size={18} />
                Deploy
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-3">
          Environment Dashboard
        </h1>
        <p className="text-slate-400 text-lg">Real-time monitoring of your deployment environments</p>
      </div>

      {/* Environment Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {devStats ? (
          <EnvironmentCard stats={devStats} isDev={true} />
        ) : (
          <div className="glass rounded-2xl p-12 flex items-center justify-center border border-sky-500/20">
            <div className="text-center">
              <Loader className="animate-spin text-sky-400 mx-auto mb-4" size={40} />
              <p className="text-slate-400">Loading Development environment...</p>
            </div>
          </div>
        )}
        
        {prodStats ? (
          <EnvironmentCard stats={prodStats} isDev={false} />
        ) : (
          <div className="glass rounded-2xl p-12 flex items-center justify-center border border-emerald-500/20">
            <div className="text-center">
              <Loader className="animate-spin text-emerald-400 mx-auto mb-4" size={40} />
              <p className="text-slate-400">Loading Production environment...</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 text-center">
          <Server className="mx-auto text-slate-400 mb-2" size={24} />
          <div className="text-2xl font-bold text-white">2</div>
          <div className="text-slate-400 text-sm">Environments</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <Activity className="mx-auto text-emerald-400 mb-2" size={24} />
          <div className="text-2xl font-bold text-white">
            {(devStats?.status === 'online' ? 1 : 0) + (prodStats?.status === 'online' ? 1 : 0)}
          </div>
          <div className="text-slate-400 text-sm">Online</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <Database className="mx-auto text-sky-400 mb-2" size={24} />
          <div className="text-2xl font-bold text-white">
            {(devStats?.database.status === 'connected' ? 1 : 0) + (prodStats?.database.status === 'connected' ? 1 : 0)}
          </div>
          <div className="text-slate-400 text-sm">DB Connected</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <GitBranch className="mx-auto text-purple-400 mb-2" size={24} />
          <div className="text-2xl font-bold text-white">
            {(devStats?.git.hasChanges ? 1 : 0) + (prodStats?.git.hasChanges ? 1 : 0)}
          </div>
          <div className="text-slate-400 text-sm">Pending Changes</div>
        </div>
      </div>
    </div>
  )
}
