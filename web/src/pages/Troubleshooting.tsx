import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { 
  Wrench, Trash2, Loader, CheckCircle, XCircle, 
  Server, Activity, FileText, AlertTriangle, RefreshCw, HardDrive, Package
} from 'lucide-react'
import LogsTab from '../components/troubleshooting/LogsTab'
import EnvTab from '../components/troubleshooting/EnvTab'
import PackagesTab from '../components/troubleshooting/PackagesTab'

type TabType = 'cache' | 'redis' | 'logs' | 'connectivity' | 'env' | 'packages'

export default function Troubleshooting() {
  const [activeTab, setActiveTab] = useState<TabType>('cache')
  const [selectedEnvironment, setSelectedEnvironment] = useState<'dev' | 'prod'>('dev')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Cache Status Query
  const { data: cacheStatus, refetch: refetchCache } = useQuery({
    queryKey: ['cache-status', selectedEnvironment],
    queryFn: async () => {
      const response = await api.get(`/troubleshooting/cache-status/${selectedEnvironment}`)
      return response.data
    },
    enabled: activeTab === 'cache'
  })

  // Redis Status Query
  const { data: redisStatus, refetch: refetchRedis } = useQuery({
    queryKey: ['redis-status'],
    queryFn: async () => {
      const response = await api.get('/troubleshooting/redis-status')
      return response.data
    },
    enabled: activeTab === 'redis'
  })

  // Connectivity Test Query
  const { data: connectivityTest, refetch: refetchConnectivity, isLoading: connectivityLoading } = useQuery({
    queryKey: ['connectivity-test'],
    queryFn: async () => {
      const response = await api.get('/troubleshooting/connectivity-test')
      return response.data
    },
    enabled: activeTab === 'connectivity'
  })

  // Clear Cache Mutation
  const clearCacheMutation = useMutation({
    mutationFn: async (cacheType: string) => {
      const response = await api.post(`/troubleshooting/clear-cache/${selectedEnvironment}/${cacheType}`)
      return response.data
    },
    onSuccess: (data) => {
      setFeedback({ type: 'success', message: data.message })
      setTimeout(() => setFeedback(null), 5000)
      refetchCache()
    },
    onError: (error: any) => {
      setFeedback({ type: 'error', message: error.response?.data?.detail || 'Failed to clear cache' })
      setTimeout(() => setFeedback(null), 5000)
    }
  })

  // Clear Redis Mutation
  const clearRedisMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/troubleshooting/clear-redis?pattern=*')
      return response.data
    },
    onSuccess: (data) => {
      setFeedback({ type: 'success', message: data.message })
      setTimeout(() => setFeedback(null), 5000)
      refetchRedis()
    },
    onError: (error: any) => {
      setFeedback({ type: 'error', message: error.response?.data?.detail || 'Failed to clear Redis' })
      setTimeout(() => setFeedback(null), 5000)
    }
  })

  
  const tabs = [
    { id: 'cache' as TabType, label: 'Cache Management', icon: HardDrive },
    { id: 'redis' as TabType, label: 'Redis', icon: Activity },
    { id: 'logs' as TabType, label: 'Logs', icon: FileText },
    { id: 'connectivity' as TabType, label: 'Connectivity', icon: Server },
    { id: 'env' as TabType, label: 'Environment', icon: AlertTriangle },
    { id: 'packages' as TabType, label: 'Packages', icon: Package },
  ]

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Wrench className="text-orange-400" size={32} />
            <div>
              <h1 className="text-4xl font-bold text-white">Troubleshooting</h1>
              <p className="text-slate-400">System diagnostics and maintenance tools</p>
            </div>
          </div>

          {/* Environment Selector */}
          {(activeTab === 'cache' || activeTab === 'env' || activeTab === 'packages') && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Environment:</span>
              <button
                onClick={() => setSelectedEnvironment('dev')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedEnvironment === 'dev'
                    ? 'bg-sky-500 text-white'
                    : 'bg-white/10 text-slate-400 hover:bg-white/20'
                }`}
              >
                Dev
              </button>
              <button
                onClick={() => setSelectedEnvironment('prod')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedEnvironment === 'prod'
                    ? 'bg-green-500 text-white'
                    : 'bg-white/10 text-slate-400 hover:bg-white/20'
                }`}
              >
                Prod
              </button>
            </div>
          )}
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
            feedback.type === 'success' 
              ? 'bg-green-500/20 border-green-500/50 text-green-400'
              : 'bg-rose-500/20 border-rose-500/50 text-rose-400'
          }`}>
            {feedback.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
            {feedback.message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/10 text-slate-400 hover:bg-white/20'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Dynamic Content Area */}
        <div className="glass rounded-2xl p-6">
          {/* Cache Management */}
          {activeTab === 'cache' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Cache Management - {selectedEnvironment.toUpperCase()}</h2>
              
              {cacheStatus ? (
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">Total Cache Size</span>
                      <span className="text-sky-400 text-xl font-bold">{cacheStatus.total_size_mb} MB</span>
                    </div>
                  </div>

                  {Object.entries(cacheStatus.caches || {}).map(([key, cache]: [string, any]) => (
                    <div key={key} className="bg-white/5 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold capitalize">{key} Cache</h3>
                          <p className="text-slate-400 text-sm">{cache.path}</p>
                        </div>
                        <button
                          onClick={() => clearCacheMutation.mutate(key)}
                          disabled={clearCacheMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          {clearCacheMutation.isPending ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                          Clear
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Size:</span>
                          <span className="text-white ml-2 font-medium">{cache.size_mb} MB</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Files:</span>
                          <span className="text-white ml-2 font-medium">{cache.file_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => clearCacheMutation.mutate('all')}
                    disabled={clearCacheMutation.isPending}
                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {clearCacheMutation.isPending ? <Loader className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    Clear All Caches
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin text-orange-400" size={32} />
                </div>
              )}
            </div>
          )}

          {/* Redis */}
          {activeTab === 'redis' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Redis Cache</h2>
              
              {redisStatus ? (
                redisStatus.connected ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white/5 p-4 rounded-lg">
                        <div className="text-slate-400 text-sm mb-1">Version</div>
                        <div className="text-white text-xl font-bold">{redisStatus.info.version}</div>
                      </div>
                      <div className="bg-white/5 p-4 rounded-lg">
                        <div className="text-slate-400 text-sm mb-1">Memory Used</div>
                        <div className="text-white text-xl font-bold">{redisStatus.info.used_memory}</div>
                      </div>
                      <div className="bg-white/5 p-4 rounded-lg">
                        <div className="text-slate-400 text-sm mb-1">Total Keys</div>
                        <div className="text-white text-xl font-bold">{redisStatus.info.total_keys}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => clearRedisMutation.mutate()}
                      disabled={clearRedisMutation.isPending}
                      className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {clearRedisMutation.isPending ? <Loader className="animate-spin" size={18} /> : <Trash2 size={18} />}
                      Clear All Redis Keys
                    </button>
                  </div>
                ) : (
                  <div className="bg-rose-500/20 border border-rose-500/50 rounded-lg p-6 text-center">
                    <XCircle className="mx-auto text-rose-400 mb-3" size={48} />
                    <p className="text-rose-400 font-semibold">Redis Not Connected</p>
                    <p className="text-slate-400 text-sm mt-2">{redisStatus.error}</p>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin text-orange-400" size={32} />
                </div>
              )}
            </div>
          )}

          {/* Connectivity */}
          {activeTab === 'connectivity' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Connectivity Tests</h2>
                <button
                  onClick={() => refetchConnectivity()}
                  disabled={connectivityLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {connectivityLoading ? <Loader className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                  Run Tests
                </button>
              </div>

              {connectivityTest ? (
                <div className="space-y-4">
                  {Object.entries(connectivityTest.tests || {}).map(([key, test]: [string, any]) => (
                    <div key={key} className={`p-4 rounded-lg border ${
                      test.status === 'pass' 
                        ? 'bg-green-500/20 border-green-500/50'
                        : 'bg-rose-500/20 border-rose-500/50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {test.status === 'pass' ? (
                            <CheckCircle className="text-green-400" size={24} />
                          ) : (
                            <XCircle className="text-rose-400" size={24} />
                          )}
                          <div>
                            <h3 className="text-white font-semibold capitalize">{key}</h3>
                            <p className={test.status === 'pass' ? 'text-green-400 text-sm' : 'text-rose-400 text-sm'}>
                              {test.message}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          test.status === 'pass'
                            ? 'bg-green-500/30 text-green-400'
                            : 'bg-rose-500/30 text-rose-400'
                        }`}>
                          {test.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin text-orange-400" size={32} />
                </div>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && <LogsTab />}

          {/* Environment Tab */}
          {activeTab === 'env' && <EnvTab selectedEnvironment={selectedEnvironment} />}

          {/* Packages Tab */}
          {activeTab === 'packages' && <PackagesTab selectedEnvironment={selectedEnvironment} />}
        </div>
      </div>
    </div>
  )
}
