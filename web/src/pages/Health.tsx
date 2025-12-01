import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { Activity, Database, Server, CheckCircle, XCircle, Loader, Play, Square, RefreshCw, Wrench } from 'lucide-react'

export default function Health() {
  const queryClient = useQueryClient()
  const [_gitActionFeedback, setGitActionFeedback] = useState<{
    action: string
    status: 'loading' | 'success' | 'error'
    message: string
  } | null>(null)
  const [_showCleanConfirm, setShowCleanConfirm] = useState(false)
  const [_filesToClean, setFilesToClean] = useState<string[]>([])
  const [serviceFeedback, setServiceFeedback] = useState<{
    service: string
    action: string
    status: 'loading' | 'success' | 'error'
    message: string
  } | null>(null)

  // Service status queries
  const { refetch: refetchServices } = useQuery({
    queryKey: ['services-status'],
    queryFn: async () => {
      const response = await api.get('/services/status')
      return response.data
    },
    refetchInterval: 10000,
  })

  // PostgreSQL mutations
  const postgresStartMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/services/postgres/start')
      return response.data
    },
    onMutate: () => {
      setServiceFeedback({ service: 'postgres', action: 'start', status: 'loading', message: 'Starting PostgreSQL...' })
    },
    onSuccess: (data) => {
      setServiceFeedback({ service: 'postgres', action: 'start', status: data.success ? 'success' : 'error', message: data.message })
      queryClient.invalidateQueries({ queryKey: ['services-status'] })
      queryClient.invalidateQueries({ queryKey: ['health-database'] })
      setTimeout(() => setServiceFeedback(null), 5000)
    },
    onError: (error: any) => {
      setServiceFeedback({ service: 'postgres', action: 'start', status: 'error', message: error.response?.data?.detail || 'Failed to start' })
      setTimeout(() => setServiceFeedback(null), 5000)
    }
  })

  const postgresStopMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/services/postgres/stop')
      return response.data
    },
    onMutate: () => {
      setServiceFeedback({ service: 'postgres', action: 'stop', status: 'loading', message: 'Stopping PostgreSQL...' })
    },
    onSuccess: (data) => {
      setServiceFeedback({ service: 'postgres', action: 'stop', status: data.success ? 'success' : 'error', message: data.message })
      queryClient.invalidateQueries({ queryKey: ['services-status'] })
      queryClient.invalidateQueries({ queryKey: ['health-database'] })
      setTimeout(() => setServiceFeedback(null), 5000)
    },
    onError: (error: any) => {
      setServiceFeedback({ service: 'postgres', action: 'stop', status: 'error', message: error.response?.data?.detail || 'Failed to stop' })
      setTimeout(() => setServiceFeedback(null), 5000)
    }
  })

  const postgresRestartMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/services/postgres/restart')
      return response.data
    },
    onMutate: () => {
      setServiceFeedback({ service: 'postgres', action: 'restart', status: 'loading', message: 'Restarting PostgreSQL...' })
    },
    onSuccess: (data) => {
      setServiceFeedback({ service: 'postgres', action: 'restart', status: data.success ? 'success' : 'error', message: data.message })
      queryClient.invalidateQueries({ queryKey: ['services-status'] })
      queryClient.invalidateQueries({ queryKey: ['health-database'] })
      setTimeout(() => setServiceFeedback(null), 5000)
    },
    onError: (error: any) => {
      setServiceFeedback({ service: 'postgres', action: 'restart', status: 'error', message: error.response?.data?.detail || 'Failed to restart' })
      setTimeout(() => setServiceFeedback(null), 5000)
    }
  })

  const postgresMaintenanceMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/services/postgres/maintenance')
      return response.data
    },
    onMutate: () => {
      setServiceFeedback({ service: 'postgres', action: 'maintenance', status: 'loading', message: 'Running maintenance (VACUUM ANALYZE)...' })
    },
    onSuccess: (data) => {
      setServiceFeedback({ service: 'postgres', action: 'maintenance', status: data.success ? 'success' : 'error', message: data.message })
      setTimeout(() => setServiceFeedback(null), 8000)
    },
    onError: (error: any) => {
      setServiceFeedback({ service: 'postgres', action: 'maintenance', status: 'error', message: error.response?.data?.detail || 'Maintenance failed' })
      setTimeout(() => setServiceFeedback(null), 5000)
    }
  })

  // Redis mutations
  const redisStartMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/services/redis/start')
      return response.data
    },
    onMutate: () => {
      setServiceFeedback({ service: 'redis', action: 'start', status: 'loading', message: 'Starting Redis...' })
    },
    onSuccess: (data) => {
      setServiceFeedback({ service: 'redis', action: 'start', status: data.success ? 'success' : 'error', message: data.message })
      queryClient.invalidateQueries({ queryKey: ['services-status'] })
      queryClient.invalidateQueries({ queryKey: ['health-redis'] })
      setTimeout(() => setServiceFeedback(null), 5000)
    },
    onError: (error: any) => {
      setServiceFeedback({ service: 'redis', action: 'start', status: 'error', message: error.response?.data?.detail || 'Failed to start' })
      setTimeout(() => setServiceFeedback(null), 5000)
    }
  })

  const redisStopMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/services/redis/stop')
      return response.data
    },
    onMutate: () => {
      setServiceFeedback({ service: 'redis', action: 'stop', status: 'loading', message: 'Stopping Redis...' })
    },
    onSuccess: (data) => {
      setServiceFeedback({ service: 'redis', action: 'stop', status: data.success ? 'success' : 'error', message: data.message })
      queryClient.invalidateQueries({ queryKey: ['services-status'] })
      queryClient.invalidateQueries({ queryKey: ['health-redis'] })
      setTimeout(() => setServiceFeedback(null), 5000)
    },
    onError: (error: any) => {
      setServiceFeedback({ service: 'redis', action: 'stop', status: 'error', message: error.response?.data?.detail || 'Failed to stop' })
      setTimeout(() => setServiceFeedback(null), 5000)
    }
  })

  const redisRestartMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/services/redis/restart')
      return response.data
    },
    onMutate: () => {
      setServiceFeedback({ service: 'redis', action: 'restart', status: 'loading', message: 'Restarting Redis...' })
    },
    onSuccess: (data) => {
      setServiceFeedback({ service: 'redis', action: 'restart', status: data.success ? 'success' : 'error', message: data.message })
      queryClient.invalidateQueries({ queryKey: ['services-status'] })
      queryClient.invalidateQueries({ queryKey: ['health-redis'] })
      setTimeout(() => setServiceFeedback(null), 5000)
    },
    onError: (error: any) => {
      setServiceFeedback({ service: 'redis', action: 'restart', status: 'error', message: error.response?.data?.detail || 'Failed to restart' })
      setTimeout(() => setServiceFeedback(null), 5000)
    }
  })

  const { data: serverHealth } = useQuery({
    queryKey: ['health-server'],
    queryFn: async () => {
      const response = await api.get('/health/server')
      return response.data
    },
    refetchInterval: 5000,
  })

  const { data: dbHealth } = useQuery({
    queryKey: ['health-database'],
    queryFn: async () => {
      const response = await api.get('/health/database')
      return response.data
    },
    refetchInterval: 10000,
  })

  const { data: redisHealth } = useQuery({
    queryKey: ['health-redis'],
    queryFn: async () => {
      const response = await api.get('/health/redis')
      return response.data
    },
    refetchInterval: 10000,
  })

  const { data: envHealth } = useQuery({
    queryKey: ['health-environment'],
    queryFn: async () => {
      const response = await api.get('/health/environment')
      return response.data
    },
    refetchInterval: 10000,
  })

  const { data: _gitStatus, refetch: refetchGitStatus } = useQuery({
    queryKey: ['git-status-detailed'],
    queryFn: async () => {
      const response = await api.get('/git/status/detailed')
      return response.data
    },
    refetchInterval: 15000,
  })

  // Git action mutations (unused - for future git management features)
  // @ts-expect-error - Intentionally unused for future features
  const _stashMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/git/stash')
      return response.data
    },
    onSuccess: (data) => {
      setGitActionFeedback({ action: 'stash', status: 'success', message: data.message })
      setTimeout(() => setGitActionFeedback(null), 5000)
      refetchGitStatus()
    },
    onError: (error: any) => {
      setGitActionFeedback({ action: 'stash', status: 'error', message: error.response?.data?.detail || 'Failed to stash' })
      setTimeout(() => setGitActionFeedback(null), 5000)
    }
  })

  // @ts-expect-error - Intentionally unused for future features
  const _popMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/git/stash/pop')
      return response.data
    },
    onSuccess: (data) => {
      setGitActionFeedback({ action: 'pop', status: 'success', message: data.message })
      setTimeout(() => setGitActionFeedback(null), 5000)
      refetchGitStatus()
    },
    onError: (error: any) => {
      setGitActionFeedback({ action: 'pop', status: 'error', message: error.response?.data?.detail || 'Failed to pop stash' })
      setTimeout(() => setGitActionFeedback(null), 5000)
    }
  })

  // @ts-expect-error - Intentionally unused for future features
  const _cleanCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/git/clean')
      return response.data
    },
    onSuccess: (data) => {
      if (data.files) {
        setFilesToClean(data.files)
        setShowCleanConfirm(true)
      }
    }
  })

  // @ts-expect-error - Intentionally unused for future features
  const _cleanConfirmMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/git/clean/confirm')
      return response.data
    },
    onSuccess: (data) => {
      setGitActionFeedback({ action: 'clean', status: 'success', message: data.message })
      setTimeout(() => setGitActionFeedback(null), 5000)
      setShowCleanConfirm(false)
      refetchGitStatus()
    },
    onError: (error: any) => {
      setGitActionFeedback({ action: 'clean', status: 'error', message: error.response?.data?.detail || 'Failed to clean' })
      setTimeout(() => setGitActionFeedback(null), 5000)
    }
  })

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">System Health</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Server Health */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Server className="text-sky-400" size={24} />
              <h2 className="text-xl font-semibold text-white">Server</h2>
            </div>
            {serverHealth ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">CPU Usage</span>
                  <span className="text-white font-medium">
                    {serverHealth.cpu?.percent != null ? serverHealth.cpu.percent.toFixed(1) : 'N/A'}%
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full"
                    style={{ width: `${serverHealth.cpu?.percent ?? 0}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Memory</span>
                  <span className="text-white font-medium">
                    {serverHealth.memory?.available_mb != null && serverHealth.memory?.total_mb != null
                      ? `${serverHealth.memory.available_mb} MB / ${serverHealth.memory.total_mb} MB`
                      : 'N/A'}
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${serverHealth.memory?.percent ?? 0}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Disk</span>
                  <span className="text-white font-medium">
                    {serverHealth.disk?.free_gb != null && serverHealth.disk?.total_gb != null
                      ? `${serverHealth.disk.free_gb} GB / ${serverHealth.disk.total_gb} GB`
                      : 'N/A'}
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${serverHealth.disk?.percent ?? 0}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Uptime</span>
                  <span className="text-white font-medium">
                    {serverHealth.uptime != null ? formatUptime(serverHealth.uptime) : 'N/A'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader className="animate-spin" size={20} />
                Loading...
              </div>
            )}
          </div>

          {/* Database Health */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Database className="text-green-400" size={24} />
                <h2 className="text-xl font-semibold text-white">PostgreSQL</h2>
              </div>
              <button
                onClick={() => refetchServices()}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Refresh status"
              >
                <RefreshCw size={16} className="text-slate-400" />
              </button>
            </div>
            {dbHealth ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {dbHealth.connected ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-rose-400" size={20} />
                  )}
                  <span className={dbHealth.connected ? 'text-green-400' : 'text-rose-400'}>
                    {dbHealth.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {dbHealth.response_time_ms && (
                  <div className="text-slate-400 text-sm">
                    Response time: {dbHealth.response_time_ms.toFixed(2)}ms
                  </div>
                )}
                {dbHealth.version && (
                  <div className="text-slate-400 text-sm">
                    Version: {dbHealth.version}
                  </div>
                )}
                {dbHealth.error && (
                  <div className="text-rose-400 text-sm bg-rose-500/20 p-2 rounded">
                    {dbHealth.error}
                  </div>
                )}
                
                {/* Service Controls */}
                <div className="pt-3 border-t border-white/10">
                  <div className="text-xs text-slate-500 mb-2">Service Controls</div>
                  <div className="flex flex-wrap gap-2">
                    {!dbHealth.connected ? (
                      <button
                        onClick={() => postgresStartMutation.mutate()}
                        disabled={postgresStartMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                      >
                        {postgresStartMutation.isPending ? <Loader className="animate-spin" size={12} /> : <Play size={12} />}
                        Start
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => postgresRestartMutation.mutate()}
                          disabled={postgresRestartMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                        >
                          {postgresRestartMutation.isPending ? <Loader className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                          Restart
                        </button>
                        <button
                          onClick={() => postgresStopMutation.mutate()}
                          disabled={postgresStopMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                        >
                          {postgresStopMutation.isPending ? <Loader className="animate-spin" size={12} /> : <Square size={12} />}
                          Stop
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => postgresMaintenanceMutation.mutate()}
                      disabled={postgresMaintenanceMutation.isPending || !dbHealth.connected}
                      className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                      title="Run VACUUM ANALYZE"
                    >
                      {postgresMaintenanceMutation.isPending ? <Loader className="animate-spin" size={12} /> : <Wrench size={12} />}
                      Maintenance
                    </button>
                  </div>
                </div>
                
                {/* Feedback */}
                {serviceFeedback && serviceFeedback.service === 'postgres' && (
                  <div className={`text-sm p-2 rounded ${
                    serviceFeedback.status === 'loading' ? 'bg-sky-500/20 text-sky-400' :
                    serviceFeedback.status === 'success' ? 'bg-green-500/20 text-green-400' :
                    'bg-rose-500/20 text-rose-400'
                  }`}>
                    {serviceFeedback.status === 'loading' && <Loader className="inline animate-spin mr-2" size={12} />}
                    {serviceFeedback.message}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader className="animate-spin" size={20} />
                Loading...
              </div>
            )}
          </div>

          {/* Redis Health */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Activity className="text-purple-400" size={24} />
                <h2 className="text-xl font-semibold text-white">Redis</h2>
              </div>
              <button
                onClick={() => refetchServices()}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Refresh status"
              >
                <RefreshCw size={16} className="text-slate-400" />
              </button>
            </div>
            {redisHealth ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {redisHealth.connected ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-rose-400" size={20} />
                  )}
                  <span className={redisHealth.connected ? 'text-green-400' : 'text-rose-400'}>
                    {redisHealth.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {redisHealth.response_time_ms && (
                  <div className="text-slate-400 text-sm">
                    Response time: {redisHealth.response_time_ms.toFixed(2)}ms
                  </div>
                )}
                {redisHealth.error && (
                  <div className="text-rose-400 text-sm bg-rose-500/20 p-2 rounded">
                    {redisHealth.error}
                  </div>
                )}
                
                {/* Service Controls */}
                <div className="pt-3 border-t border-white/10">
                  <div className="text-xs text-slate-500 mb-2">Service Controls</div>
                  <div className="flex flex-wrap gap-2">
                    {!redisHealth.connected ? (
                      <button
                        onClick={() => redisStartMutation.mutate()}
                        disabled={redisStartMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                      >
                        {redisStartMutation.isPending ? <Loader className="animate-spin" size={12} /> : <Play size={12} />}
                        Start
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => redisRestartMutation.mutate()}
                          disabled={redisRestartMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                        >
                          {redisRestartMutation.isPending ? <Loader className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                          Restart
                        </button>
                        <button
                          onClick={() => redisStopMutation.mutate()}
                          disabled={redisStopMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs rounded-lg transition-colors disabled:opacity-50"
                        >
                          {redisStopMutation.isPending ? <Loader className="animate-spin" size={12} /> : <Square size={12} />}
                          Stop
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Feedback */}
                {serviceFeedback && serviceFeedback.service === 'redis' && (
                  <div className={`text-sm p-2 rounded ${
                    serviceFeedback.status === 'loading' ? 'bg-sky-500/20 text-sky-400' :
                    serviceFeedback.status === 'success' ? 'bg-green-500/20 text-green-400' :
                    'bg-rose-500/20 text-rose-400'
                  }`}>
                    {serviceFeedback.status === 'loading' && <Loader className="inline animate-spin mr-2" size={12} />}
                    {serviceFeedback.message}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader className="animate-spin" size={20} />
                Loading...
              </div>
            )}
          </div>

          {/* Environment Health */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="text-yellow-400" size={24} />
              <h2 className="text-xl font-semibold text-white">Environment</h2>
            </div>
            {envHealth ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Dev Environment</span>
                  {envHealth.dev_env_exists ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-rose-400" size={20} />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Prod Environment</span>
                  {envHealth.prod_env_exists ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-rose-400" size={20} />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">App Environment</span>
                  {envHealth?.app_env_exists ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-rose-400" size={20} />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PM2 Dev</span>
                  {envHealth?.pm2_dev_running ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-rose-400" size={20} />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PM2 Prod</span>
                  {envHealth?.pm2_prod_running ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-rose-400" size={20} />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PM2 App</span>
                  {envHealth?.pm2_app_running ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-rose-400" size={20} />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Git Status</span>
                  <span className={`font-medium ${
                    envHealth.git_repo_status === 'clean' ? 'text-green-400' :
                    envHealth.git_repo_status === 'dirty' ? 'text-yellow-400' :
                    'text-slate-400'
                  }`}>
                    {envHealth.git_repo_status}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader className="animate-spin" size={20} />
                Loading...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

