import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { Loader, CheckCircle, XCircle, Clock, AlertTriangle, Zap, Settings, History, Cpu, Square, Terminal, AlertTriangle as AlertTriangleIcon, FileCode, Shield, Play } from 'lucide-react'
import BuildProgress from '../components/BuildProgress'
import BuildConfigTab from '../components/BuildConfigTab'
import BuildHistoryTab from '../components/BuildHistoryTab'
import BuildScriptEditor from '../components/BuildScriptEditor'
import SystemMetricsPanel from '../components/SystemMetricsPanel'
import WorkerAccordion from '../components/WorkerAccordion'
import ConsoleModal from '../components/ConsoleModal'
import SanityChecker from '../components/SanityChecker'
import VitestRunner from '../components/VitestRunner'

type TabType = 'config' | 'history' | 'active' | 'logs' | 'scripts' | 'sanity' | 'vitest'

export default function Build() {
  const [activeTab, setActiveTab] = useState<TabType>('config')
  const [buildId, setBuildId] = useState<string | null>(null)
  const [showNoChangesDialog, setShowNoChangesDialog] = useState(false)
  const [lastBuildCheck] = useState<any>(null)
  const [buildStartTime, setBuildStartTime] = useState<number | null>(null)
  const [showConsole, setShowConsole] = useState(false)
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [config, setConfig] = useState({
    workers: 4, // Default to 4 workers for typical 4-core servers
    max_old_space_size: 8192, // Default to 8GB for full builds
    max_semi_space_size: 256, // Default to 256MB semi-space
    // Build mode maps directly to backend BuildMode enum values
    build_mode: 'full' as 'quick' | 'full' | 'phased' | 'phased-prod' | 'clean' | 'ram-optimized',
    // Project type and build target
    project_type: 'auto' as 'auto' | 'nextjs' | 'vite-react' | 'vite-express' | 'express',
    build_target: 'development' as 'development' | 'production',
    test_database: true,
    test_redis: true,
    skip_deps: false,
    force_clean: false,
    // Advanced options
    use_redis_cache: false,
    incremental_build: false,
    skip_type_check: false,
    parallel_processing: true,
    minify_output: true,
    source_maps: false,
    tree_shaking: true,
    code_splitting: true,
    compress_assets: true,
    optimize_images: false,
    remove_console_logs: false,
    experimental_turbo: false,
    // Vite-specific options
    vite_mode: null as string | null,
    express_build: true,
    vite_minify: true,
    vite_legacy: false,
    vite_ssr: false,
    vite_manifest: true,
    vite_css_code_split: true,
    vite_sourcemap: false,
    vite_report_size: false,
    vite_chunk_size_warning: true,
    vite_chunk_size_limit: 500,
    vite_asset_inline_limit: 4,
    vite_target: 'esnext',
    vite_minifier: 'esbuild',
    // Next.js specific options
    next_standalone: true,
    next_export: false,
    next_swc_minify: true,
    next_image_optimization: true,
    next_bundle_analyzer: false,
    next_modularize_imports: true,
    next_output: 'standalone',
    next_image_formats: 'webp',
    next_compiler: 'swc',
    next_react_compiler: 'disabled',
    // Express specific options
    express_typescript: true,
    express_bundle: false,
    express_sourcemap: true,
    express_minify: false,
    express_copy_assets: true,
    express_node_target: 'node18',
    express_module_format: 'esm',
    express_out_dir: 'dist',
    express_entry: 'src/index.ts',
  })

  // Fetch system metrics to optimize defaults
  const { data: systemMetrics } = useQuery({
    queryKey: ['system-metrics-config'],
    queryFn: async () => {
      try {
        const response = await api.get('/system/metrics')
        return response.data
      } catch (error) {
        console.warn('Could not fetch system metrics for optimization')
        return null
      }
    },
    refetchInterval: 30000, // Update every 30 seconds
  })

  // Auto-optimize config based on system capabilities
  useEffect(() => {
    if (systemMetrics) {
      const cpuCores = systemMetrics.cpu?.cores || 4
      const totalMemoryMB = systemMetrics.memory?.total_mb || 16384

      // Set optimal workers (cores - 1 to leave one for system)
      const optimalWorkers = Math.max(1, Math.min(cpuCores - 1, 8))

      // Set optimal memory based on available RAM
      let optimalMemory = 8192 // Default 8GB
      if (totalMemoryMB >= 32768) optimalMemory = 16384 // 16GB for 32GB+ RAM
      else if (totalMemoryMB >= 16384) optimalMemory = 8192  // 8GB for 16GB+ RAM
      else if (totalMemoryMB >= 8192) optimalMemory = 4096   // 4GB for 8GB+ RAM

      setConfig((prev: typeof config) => ({
        ...prev,
        workers: prev.workers === 4 ? optimalWorkers : prev.workers, // Only update if still default
        max_old_space_size: prev.max_old_space_size === 8192 ? optimalMemory : prev.max_old_space_size, // Only update if still default
      }))
    }
  }, [systemMetrics])

  const tabs = [
    { id: 'config' as TabType, label: 'Configuration', icon: Settings },
    { id: 'scripts' as TabType, label: 'Scripts', icon: FileCode },
    { id: 'sanity' as TabType, label: 'Sanity Check', icon: Shield },
    { id: 'vitest' as TabType, label: 'Vitest Tests', icon: Play },
    { id: 'history' as TabType, label: 'History', icon: History },
    { id: 'active' as TabType, label: 'Active Build', icon: Cpu },
    { id: 'logs' as TabType, label: 'Logs', icon: Clock },
  ]

  // Check for active builds (heartbeat)
  const { data: activeBuildCheck } = useQuery({
    queryKey: ['active-build'],
    queryFn: async () => {
      const response = await api.get('/build/active')
      return response.data
    },
    refetchInterval: 3000, // Check every 3 seconds
  })

  // Auto-switch to active tab if build is running
  useEffect(() => {
    if (activeBuildCheck?.has_active_build && activeBuildCheck?.active_build) {
      setBuildId(activeBuildCheck.active_build.build_id)
      if (activeTab === 'config') {
        setActiveTab('active')
      }
    }
  }, [activeBuildCheck, activeTab])

  const startBuildMutation = useMutation({
    mutationFn: async (buildConfig: any) => {
      const response = await api.post('/build/start', { config: buildConfig })
      return response.data
    },
    onSuccess: (data) => {
      setBuildId(data.build_id)
      setActiveTab('active')
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Failed to start build')
    }
  })

  const killBuildMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/build/kill/${buildId}`)
      return response.data
    },
    onSuccess: () => {
      setShowKillConfirm(false)
    },
    onError: (error: any) => {
      alert(`Failed to kill build: ${error.response?.data?.detail || 'Unknown error'}`)
    }
  })

  const { data: buildStatus, refetch: refetchStatus } = useQuery<{
    build_id: string
    status: string
    started_at: string
    completed_at?: string
    progress?: number
    current_step?: string
    message?: string
    error?: string
  } | null>({
    queryKey: ['build-status', buildId],
    queryFn: async () => {
      if (!buildId) return null
      const response = await api.get(`/build/status/${buildId}`)
      return response.data
    },
    enabled: !!buildId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === 'running' || data?.status === 'pending') {
        return 2000 // Poll every 2 seconds
      }
      return false
    },
  })

  
  useEffect(() => {
    if (buildStatus?.status === 'running' || buildStatus?.status === 'pending') {
      refetchStatus()
      if (!buildStartTime) {
        setBuildStartTime(Date.now())
      }
    } else if (buildStatus?.status === 'success' || buildStatus?.status === 'error') {
      setBuildStartTime(null)
    }
  }, [buildStatus, refetchStatus, buildStartTime])

  // Build stall detection (5 minutes)
  useEffect(() => {
    if (buildStartTime && buildStatus?.status === 'running') {
      const elapsed = Date.now() - buildStartTime
      if (elapsed > 5 * 60 * 1000) { // 5 minutes
        // Build might be stalled
        console.warn('Build may be stalled - running for over 5 minutes')
      }
    }
  }, [buildStartTime, buildStatus])

  const handleForceRebuild = () => {
    setShowNoChangesDialog(false)
    const buildConfig = {
      ...config,
      workers: config.workers || undefined,
      max_old_space_size: config.max_old_space_size || undefined,
      max_semi_space_size: config.max_semi_space_size || undefined,
    }
    startBuildMutation.mutate(buildConfig)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400'
      case 'error':
        return 'text-rose-400'
      case 'running':
        return 'text-sky-400'
      case 'pending':
        return 'text-yellow-400'
      default:
        return 'text-slate-400'
    }
  }

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
        return null
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Zap className="text-green-400" size={32} />
          <div>
            <h1 className="text-4xl font-bold text-white">Build System</h1>
            <p className="text-slate-400">Configure, monitor, and manage application builds</p>
          </div>
        </div>

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
                    ? 'bg-green-500 text-white'
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
          {/* Configuration Tab */}
          {activeTab === 'config' && (
            <BuildConfigTab 
              config={config}
              onChange={setConfig}
              startBuildMutation={startBuildMutation}
            />
          )}

          {/* Scripts Tab */}
          {activeTab === 'scripts' && <BuildScriptEditor />}

          {/* Sanity Check Tab */}
          {activeTab === 'sanity' && <SanityChecker />}

          {/* Vitest Tests Tab */}
          {activeTab === 'vitest' && <VitestRunner />}

          {/* History Tab */}
          {activeTab === 'history' && <BuildHistoryTab />}

          {/* Active Build Tab */}
          {activeTab === 'active' && buildId && buildStatus && (
            <div className="max-w-7xl mx-auto">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <Cpu className="text-sky-400" size={24} />
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Active Build</h2>
                    <p className="text-sm text-slate-400">Monitor current build progress</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Kill Build Button - Only show for running builds */}
                  {buildStatus?.status === 'running' && (
                    <button
                      onClick={() => setShowKillConfirm(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 text-sm rounded-lg transition-colors"
                    >
                      <Square size={16} />
                      Kill Build
                    </button>
                  )}
                  {/* Console Button */}
                  <button
                    onClick={() => setShowConsole(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <Terminal size={16} />
                    Console
                  </button>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${getStatusColor(buildStatus.status)} bg-white/5`}>
                    {getStatusIcon(buildStatus.status)}
                    <span className="font-medium capitalize text-sm sm:text-base">{buildStatus.status}</span>
                  </div>
                </div>
              </div>

              {/* Build ID & Message Compact */}
              <div className="mb-4 flex flex-col sm:flex-row gap-2 text-xs sm:text-sm">
                <div className="px-3 py-1.5 bg-white/5 rounded-lg">
                  <span className="text-slate-400">Build ID: </span>
                  <span className="text-white font-mono">{buildId.substring(0, 12)}...</span>
                </div>
                {buildStatus.message && (
                  <div className="flex-1 px-3 py-1.5 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-300">
                    {buildStatus.message}
                  </div>
                )}
              </div>

              {/* Error Display */}
              {buildStatus.error && (
                <div className="mb-4 p-3 sm:p-4 bg-rose-500/20 border border-rose-500/50 rounded-xl">
                  <div className="flex items-start gap-2">
                    <XCircle className="text-rose-400 mt-0.5" size={18} />
                    <div className="text-sm text-rose-300">{buildStatus.error}</div>
                  </div>
                </div>
              )}

              {/* Visual Build Progress */}
              <div className="mb-6">
                <BuildProgress 
                  currentStep={buildStatus.current_step || 'INIT'}
                  progress={buildStatus.progress || 0}
                  status={buildStatus.status}
                />
              </div>

              {/* System Metrics and Workers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <SystemMetricsPanel />
                <WorkerAccordion />
              </div>

              
              {/* Build Stall Warning */}
              {buildStartTime && buildStatus?.status === 'running' && 
               Date.now() - buildStartTime > 5 * 60 * 1000 && (
                <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-yellow-500/50 mt-6">
                  <div className="flex flex-col sm:flex-row items-start gap-3">
                    <AlertTriangle className="text-yellow-400 mt-0.5 flex-shrink-0" size={20} />
                    <div className="flex-1">
                      <h3 className="text-yellow-400 font-semibold mb-2 text-sm sm:text-base">Build May Be Stalled</h3>
                      <p className="text-slate-300 text-xs sm:text-sm mb-3">
                        The build has been running for over 5 minutes without completing.
                      </p>
                      <div className="space-y-2 text-xs sm:text-sm text-slate-400">
                        <p className="font-semibold">💡 Suggestions:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Check memory usage (try RAM Optimized mode)</li>
                          <li>Enable Redis cache for faster builds</li>
                          <li>Try incremental build mode</li>
                          <li>Consider restarting the build</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Build Tab - No Active Build */}
          {activeTab === 'active' && !buildId && (
            <div className="text-center py-12">
              <div className="bg-white/5 rounded-lg p-8">
                <Cpu className="mx-auto text-slate-400 mb-4" size={48} />
                <h3 className="text-xl font-bold text-white mb-2">No Active Build</h3>
                <p className="text-slate-400 mb-4">
                  Start a new build from the Configuration tab to see progress here
                </p>
                <button
                  onClick={() => setActiveTab('config')}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                >
                  Go to Configuration
                </button>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Clock className="text-purple-400" size={28} />
                <div>
                  <h2 className="text-2xl font-bold text-white">Build Logs</h2>
                  <p className="text-slate-400">View build output and logs</p>
                </div>
              </div>

              {buildId ? (
                <div className="text-center py-12">
                  <div className="bg-white/5 rounded-lg p-8">
                    <Terminal className="mx-auto text-slate-400 mb-4" size={48} />
                    <p className="text-slate-400 mb-2">Console available in header</p>
                    <p className="text-slate-500 text-sm">Click the "Console" button above to view build output</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-white/5 rounded-lg p-8">
                    <Clock className="mx-auto text-slate-400 mb-4" size={48} />
                    <p className="text-slate-400">No build started yet</p>
                    <div className="flex gap-3 justify-center mt-4">
                      <button
                        onClick={() => setActiveTab('config')}
                        className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                      >
                        Start Build
                      </button>
                      <button
                        onClick={() => setActiveTab('history')}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                      >
                        View History
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* No Changes Dialog */}
        {showNoChangesDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-8 max-w-md w-full border border-yellow-500/50">
              <div className="flex items-start gap-4 mb-6">
                <AlertTriangle className="text-yellow-400 flex-shrink-0" size={32} />
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">No Code Changes Detected</h2>
                  <p className="text-slate-300 text-sm">
                    No files have changed since the last build.
                  </p>
                </div>
              </div>

              {lastBuildCheck && (
                <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last build:</span>
                    <span className="text-white">
                      {lastBuildCheck.last_build_time || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last commit:</span>
                    <span className="text-white">
                      {lastBuildCheck.last_commit_time || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Files changed:</span>
                    <span className="text-white">
                      {lastBuildCheck.files_changed || 0}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-slate-300 text-sm mb-6">
                Are you sure you want to rebuild? This will take 25-35 minutes and use significant server resources.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowNoChangesDialog(false)}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForceRebuild}
                  className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-xl transition-colors"
                >
                  Force Rebuild Anyway
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Kill Confirmation Dialog */}
      {showKillConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="text-rose-400 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="text-rose-400 font-semibold mb-2">Kill Build Process</h3>
                <p className="text-slate-300 text-sm mb-4">
                  Are you sure you want to kill this build process? This will terminate all build operations and cannot be undone.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => killBuildMutation.mutate()}
                    disabled={killBuildMutation.isPending}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {killBuildMutation.isPending ? 'Killing...' : 'Kill Build'}
                  </button>
                  <button
                    onClick={() => setShowKillConfirm(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Console Modal */}
      {buildId && (
        <ConsoleModal 
          buildId={buildId}
          isOpen={showConsole}
          onClose={() => setShowConsole(false)}
        />
      )}
      </div>
    </div>
  )
}

