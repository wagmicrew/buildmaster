import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { Activity, Database, Server, CheckCircle, XCircle, Loader } from 'lucide-react'

export default function Health() {
  const [_gitActionFeedback, setGitActionFeedback] = useState<{
    action: string
    status: 'loading' | 'success' | 'error'
    message: string
  } | null>(null)
  const [_showCleanConfirm, setShowCleanConfirm] = useState(false)
  const [_filesToClean, setFilesToClean] = useState<string[]>([])
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
                  <span className="text-white font-medium">{serverHealth.cpu_percent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full"
                    style={{ width: `${serverHealth.cpu_percent}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Memory</span>
                  <span className="text-white font-medium">
                    {formatBytes(serverHealth.memory_available)} / {formatBytes(serverHealth.memory_total)}
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${serverHealth.memory_percent}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Disk</span>
                  <span className="text-white font-medium">
                    {formatBytes(serverHealth.disk_free)} / {formatBytes(serverHealth.disk_total)}
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${serverHealth.disk_percent}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Uptime</span>
                  <span className="text-white font-medium">{formatUptime(serverHealth.uptime)}</span>
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
            <div className="flex items-center gap-3 mb-4">
              <Database className="text-green-400" size={24} />
              <h2 className="text-xl font-semibold text-white">Database</h2>
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
                {dbHealth.error && (
                  <div className="text-rose-400 text-sm bg-rose-500/20 p-2 rounded">
                    {dbHealth.error}
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
            <div className="flex items-center gap-3 mb-4">
              <Activity className="text-purple-400" size={24} />
              <h2 className="text-xl font-semibold text-white">Redis</h2>
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
                  <span className="text-slate-400">PM2 Dev</span>
                  {envHealth.pm2_dev_running ? (
                    <CheckCircle className="text-green-400" size={20} />
                  ) : (
                    <XCircle className="text-rose-400" size={20} />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PM2 Prod</span>
                  {envHealth.pm2_prod_running ? (
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

