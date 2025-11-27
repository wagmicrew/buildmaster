import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Server, 
  TrendingDown,
  Minus,
  AlertTriangle
} from 'lucide-react'

interface SystemMetrics {
  timestamp: string
  memory: {
    total_mb: number
    available_mb: number
    used_mb: number
    percent: number
  }
  cpu: {
    percent: number
    cores: number
    frequency_mhz: number
    load_average: {
      '1min': number
      '5min': number
      '15min': number
    }
  }
  disk: {
    total_gb: number
    free_gb: number
    percent: number
  }
  process: {
    memory_mb: number
    cpu_percent: number
    pid: number
  }
  platform: {
    system: string
    release: string
    hostname: string
  }
}

export default function SystemMetricsPanel() {
  const { data: metrics, isLoading, error } = useQuery<SystemMetrics>({
    queryKey: ['system-metrics'],
    queryFn: async () => {
      const response = await api.get('/system/metrics')
      return response.data
    },
    refetchInterval: 5000, // Update every 5 seconds
  })

  
  const getStatusColor = (percent: number) => {
    if (percent >= 90) return 'text-rose-400'
    if (percent >= 75) return 'text-amber-400'
    if (percent >= 50) return 'text-yellow-400'
    return 'text-emerald-400'
  }

  const getStatusIcon = (percent: number) => {
    if (percent >= 90) return AlertTriangle
    if (percent >= 75) return Minus
    return TrendingDown
  }

  const MetricCard = ({ 
    icon: Icon, 
    label, 
    value, 
    percent, 
    unit = 'MB',
    showTrend = true 
  }: {
    icon: any
    label: string
    value: number
    percent?: number
    unit?: string
    showTrend?: boolean
  }) => {
    const StatusIcon = showTrend && percent !== undefined ? getStatusIcon(percent) : null
    const statusColor = percent !== undefined ? getStatusColor(percent) : ''
    
    return (
      <div className="bg-black/20 border border-white/10 rounded-lg p-3 hover:bg-black/30 transition-all">
        <div className="flex items-center justify-between mb-2">
          <Icon className="text-slate-400" size={16} />
          {StatusIcon && <StatusIcon className={statusColor} size={14} />}
        </div>
        <div className="text-white font-semibold text-lg">
          {value}{unit}
        </div>
        {percent !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${statusColor}`}>
            {StatusIcon && <StatusIcon size={12} />}
            <span>{percent.toFixed(2)}%</span>
          </div>
        )}
        <div className="text-xs text-slate-500 mt-2">{label}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-rose-400">
          <Activity size={16} />
          <span className="text-sm">Failed to load system metrics</span>
        </div>
      </div>
    )
  }

  if (isLoading || !metrics) {
    return (
      <div className="bg-black/30 border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Activity className="animate-pulse" size={16} />
          <span className="text-sm">Loading system metrics...</span>
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
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Activity className="text-emerald-400" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">System Metrics</h3>
              <p className="text-xs text-slate-400">
                {metrics.platform.hostname} • {metrics.platform.system}
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* System Overview Panel */}
      <div className="bg-black/20 border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="text-slate-400" size={16} />
          <span className="text-sm font-medium text-white">System Overview</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            icon={MemoryStick}
            label="Memory Used"
            value={metrics.memory.used_mb}
            percent={metrics.memory.percent}
            unit="MB"
          />
          <MetricCard
            icon={Cpu}
            label="CPU Usage"
            value={metrics.cpu.percent}
            percent={metrics.cpu.percent}
            unit=""
          />
          <MetricCard
            icon={HardDrive}
            label="Disk Used"
            value={metrics.disk.total_gb - metrics.disk.free_gb}
            percent={Math.round(metrics.disk.percent)}
            unit="GB"
          />
          <MetricCard
            icon={Server}
            label="Process Memory"
            value={metrics.process.memory_mb}
            unit="MB"
            showTrend={false}
          />
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CPU Statistics */}
        <div className="bg-black/20 border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="text-slate-400" size={16} />
            <span className="text-sm font-medium text-white">CPU Statistics</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Cores:</span>
              <span className="text-white">{metrics.cpu.cores}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Frequency:</span>
              <span className="text-white">{metrics.cpu.frequency_mhz.toFixed(0)} MHz</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Load (1m):</span>
              <span className={getStatusColor(metrics.cpu.load_average['1min'] * 25)}>
                {metrics.cpu.load_average['1min']}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Load (5m):</span>
              <span className={getStatusColor(metrics.cpu.load_average['5min'] * 25)}>
                {metrics.cpu.load_average['5min']}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Load (15m):</span>
              <span className={getStatusColor(metrics.cpu.load_average['15min'] * 25)}>
                {metrics.cpu.load_average['15min']}
              </span>
            </div>
          </div>
        </div>

        {/* Memory Statistics */}
        <div className="bg-black/20 border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <MemoryStick className="text-slate-400" size={16} />
            <span className="text-sm font-medium text-white">Memory Statistics</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Total:</span>
              <span className="text-white">{metrics.memory.total_mb} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Used:</span>
              <span className="text-white">{metrics.memory.used_mb} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Available:</span>
              <span className="text-emerald-400">{metrics.memory.available_mb} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Process:</span>
              <span className="text-white">{metrics.process.memory_mb} MB</span>
            </div>
          </div>
        </div>

        {/* Platform Statistics */}
        <div className="bg-black/20 border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server className="text-slate-400" size={16} />
            <span className="text-sm font-medium text-white">Platform Statistics</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Host:</span>
              <span className="text-white">{metrics.platform.hostname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">System:</span>
              <span className="text-white">{metrics.platform.system}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Release:</span>
              <span className="text-white">{metrics.platform.release}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Process PID:</span>
              <span className="text-white">{metrics.process.pid}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
