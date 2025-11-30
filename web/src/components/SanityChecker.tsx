import { useState } from 'react'
import { 
  Shield, RefreshCw, CheckCircle, AlertTriangle, XCircle, 
  SkipForward, Copy, Check, Play, Wrench, Terminal,
  Server, Cpu, Zap, FileCode, Settings, Network, 
  ChevronDown, ChevronRight, Download, Sparkles
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../services/api'

interface CheckResult {
  name: string
  category: string
  status: 'pass' | 'warn' | 'fail' | 'skip'
  message: string
  details?: string
  suggestion?: string
  fix_command?: string
  duration_ms?: number
}

interface SanityReport {
  environment: string
  project_path: string
  timestamp: string
  checks: CheckResult[]
  summary: {
    total: number
    pass: number
    warn: number
    fail: number
    skip: number
  }
  ai_suggestions: string[]
  ready_to_build?: boolean
  console_output?: string
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  system: <Cpu size={16} />,
  node: <FileCode size={16} />,
  nginx: <Server size={16} />,
  vite: <Zap size={16} />,
  react: <Sparkles size={16} />,
  express: <Server size={16} />,
  build: <Settings size={16} />,
  config: <FileCode size={16} />,
  network: <Network size={16} />,
}

const CATEGORY_COLORS: Record<string, string> = {
  system: 'text-blue-400',
  node: 'text-green-400',
  nginx: 'text-emerald-400',
  vite: 'text-purple-400',
  react: 'text-cyan-400',
  express: 'text-yellow-400',
  build: 'text-orange-400',
  config: 'text-pink-400',
  network: 'text-indigo-400',
}

const STATUS_CONFIG = {
  pass: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  warn: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  fail: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  skip: { icon: SkipForward, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
}

export default function SanityChecker() {
  const [environment, setEnvironment] = useState<'dev' | 'prod'>('dev')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['system', 'node', 'build']))
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [showConsole, setShowConsole] = useState(false)
  const [consoleOutput, setConsoleOutput] = useState('')

  // Full sanity check
  const { data: report, isLoading, refetch, isFetching } = useQuery<SanityReport>({
    queryKey: ['sanity-check', environment],
    queryFn: async () => {
      const response = await api.get('/sanity/check', {
        params: { environment }
      })
      return response.data
    },
    enabled: false, // Manual trigger only
    staleTime: 0,
  })

  // Quick check
  const quickCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/sanity/quick', {
        params: { environment }
      })
      return response.data
    }
  })

  // Get console report
  const reportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/sanity/report', {
        params: { environment, format: 'console' }
      })
      return response.data
    },
    onSuccess: (data) => {
      setConsoleOutput(data.console_output || '')
      setShowConsole(true)
    }
  })

  // Fix mutation
  const fixMutation = useMutation({
    mutationFn: async (fixType: string) => {
      const response = await api.post('/sanity/fix', {
        fix_type: fixType,
        environment
      })
      return response.data
    },
    onSuccess: () => {
      // Refresh after fix
      refetch()
    }
  })

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command)
    setCopiedCommand(command)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  const handleCopyConsole = () => {
    navigator.clipboard.writeText(consoleOutput)
    setCopiedCommand('console')
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  // Group checks by category
  const checksByCategory = report?.checks?.reduce((acc, check) => {
    if (!acc[check.category]) {
      acc[check.category] = []
    }
    acc[check.category].push(check)
    return acc
  }, {} as Record<string, CheckResult[]>) || {}

  const getCategoryStatus = (checks: CheckResult[]): 'pass' | 'warn' | 'fail' | 'skip' => {
    if (checks.some(c => c.status === 'fail')) return 'fail'
    if (checks.some(c => c.status === 'warn')) return 'warn'
    if (checks.every(c => c.status === 'skip')) return 'skip'
    return 'pass'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="text-emerald-400" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-white">Sanity Checker</h2>
              <p className="text-slate-400">Validate Nginx, Vite, React, Express setup</p>
            </div>
          </div>
          
          {/* Environment Toggle */}
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setEnvironment('dev')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                environment === 'dev'
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Development
            </button>
            <button
              onClick={() => setEnvironment('prod')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                environment === 'prod'
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Production
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {(isLoading || isFetching) ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Play size={18} />
            )}
            Run Full Check
          </button>
          
          <button
            onClick={() => quickCheckMutation.mutate()}
            disabled={quickCheckMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {quickCheckMutation.isPending ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Zap size={18} />
            )}
            Quick Check
          </button>

          <button
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending || !report}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Terminal size={18} />
            Console Report
          </button>

          {report && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => fixMutation.mutate('install_deps')}
                disabled={fixMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors"
              >
                <Download size={16} />
                Install Deps
              </button>
              <button
                onClick={() => fixMutation.mutate('clear_cache')}
                disabled={fixMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-sm font-medium transition-colors"
              >
                <Wrench size={16} />
                Clear Cache
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Console Output Modal */}
      {showConsole && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Terminal size={20} className="text-emerald-400" />
                Console Report
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyConsole}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {copiedCommand === 'console' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedCommand === 'console' ? 'Copied!' : 'Copy All'}
                </button>
                <button
                  onClick={() => setShowConsole(false)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm font-mono text-green-400 whitespace-pre-wrap">
                {consoleOutput}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Quick Check Results */}
      {quickCheckMutation.data && (
        <div className={`rounded-xl p-4 border ${
          quickCheckMutation.data.ready_to_build 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-yellow-500/10 border-yellow-500/30'
        }`}>
          <div className="flex items-center gap-3">
            {quickCheckMutation.data.ready_to_build ? (
              <CheckCircle className="text-green-400" size={24} />
            ) : (
              <AlertTriangle className="text-yellow-400" size={24} />
            )}
            <div>
              <h3 className="text-lg font-semibold text-white">
                {quickCheckMutation.data.ready_to_build ? 'Ready to Build!' : 'Issues Detected'}
              </h3>
              <p className="text-sm text-slate-400">
                {quickCheckMutation.data.summary.pass} passed, {quickCheckMutation.data.summary.warn} warnings, {quickCheckMutation.data.summary.fail} failed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="text-3xl font-bold text-white">{report.summary.total}</div>
            <div className="text-sm text-slate-400">Total Checks</div>
          </div>
          <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
            <div className="text-3xl font-bold text-green-400">{report.summary.pass}</div>
            <div className="text-sm text-slate-400">Passed</div>
          </div>
          <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
            <div className="text-3xl font-bold text-yellow-400">{report.summary.warn}</div>
            <div className="text-sm text-slate-400">Warnings</div>
          </div>
          <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
            <div className="text-3xl font-bold text-red-400">{report.summary.fail}</div>
            <div className="text-sm text-slate-400">Failed</div>
          </div>
          <div className="bg-slate-500/10 rounded-xl p-4 border border-slate-500/30">
            <div className="text-3xl font-bold text-slate-400">{report.summary.skip}</div>
            <div className="text-sm text-slate-400">Skipped</div>
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      {report?.ai_suggestions && report.ai_suggestions.length > 0 && (
        <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Sparkles className="text-purple-400" size={20} />
            AI Suggestions
          </h3>
          <div className="space-y-2">
            {report.ai_suggestions.map((suggestion, idx) => (
              <div key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">→</span>
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Check Results by Category */}
      {report && (
        <div className="space-y-4">
          {Object.entries(checksByCategory).map(([category, checks]) => {
            const categoryStatus = getCategoryStatus(checks)
            const statusConfig = STATUS_CONFIG[categoryStatus]
            const StatusIcon = statusConfig.icon
            const isExpanded = expandedCategories.has(category)
            
            return (
              <div 
                key={category}
                className={`rounded-xl border ${statusConfig.border} ${statusConfig.bg} overflow-hidden`}
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={CATEGORY_COLORS[category]}>
                      {CATEGORY_ICONS[category]}
                    </span>
                    <span className="text-lg font-semibold text-white capitalize">
                      {category}
                    </span>
                    <span className="text-sm text-slate-400">
                      ({checks.length} checks)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusIcon className={statusConfig.color} size={20} />
                    {isExpanded ? (
                      <ChevronDown className="text-slate-400" size={20} />
                    ) : (
                      <ChevronRight className="text-slate-400" size={20} />
                    )}
                  </div>
                </button>

                {/* Category Checks */}
                {isExpanded && (
                  <div className="border-t border-white/10 divide-y divide-white/5">
                    {checks.map((check, idx) => {
                      const checkStatusConfig = STATUS_CONFIG[check.status]
                      const CheckStatusIcon = checkStatusConfig.icon
                      
                      return (
                        <div key={idx} className="p-4">
                          <div className="flex items-start gap-3">
                            <CheckStatusIcon className={`${checkStatusConfig.color} flex-shrink-0 mt-0.5`} size={18} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-white">{check.name}</span>
                                {check.duration_ms && (
                                  <span className="text-xs text-slate-500">{check.duration_ms.toFixed(0)}ms</span>
                                )}
                              </div>
                              <p className="text-sm text-slate-400 mt-0.5">{check.message}</p>
                              
                              {check.details && (
                                <div className="mt-2 p-2 bg-slate-900/50 rounded text-xs text-slate-400 font-mono whitespace-pre-wrap">
                                  {check.details}
                                </div>
                              )}
                              
                              {check.suggestion && (
                                <div className="mt-2 flex items-start gap-2 text-sm">
                                  <span className="text-yellow-400">💡</span>
                                  <span className="text-slate-300">{check.suggestion}</span>
                                </div>
                              )}
                              
                              {check.fix_command && (
                                <div className="mt-2 flex items-center gap-2">
                                  <code className="flex-1 px-3 py-1.5 bg-slate-900 rounded text-xs text-green-400 font-mono">
                                    {check.fix_command}
                                  </code>
                                  <button
                                    onClick={() => handleCopyCommand(check.fix_command!)}
                                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                    title="Copy command"
                                  >
                                    {copiedCommand === check.fix_command ? (
                                      <Check size={14} className="text-green-400" />
                                    ) : (
                                      <Copy size={14} />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!report && !isLoading && !isFetching && (
        <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
          <Shield className="mx-auto text-slate-500 mb-4" size={48} />
          <h3 className="text-xl font-semibold text-white mb-2">Run Sanity Check</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Validate your Nginx, Vite, React, and Express setup. 
            Get AI-powered suggestions and fix commands.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
          >
            <Play size={20} />
            Start Full Check
          </button>
        </div>
      )}

      {/* Loading State */}
      {(isLoading || isFetching) && (
        <div className="bg-slate-800/50 rounded-xl p-12 border border-emerald-500/30 text-center">
          <RefreshCw className="mx-auto text-emerald-400 mb-4 animate-spin" size={48} />
          <h3 className="text-xl font-semibold text-white mb-2">Running Sanity Checks...</h3>
          <p className="text-slate-400">
            Checking system, Node.js, Nginx, Vite, React, Express, and more...
          </p>
        </div>
      )}

      {/* Project Info */}
      {report && (
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 text-slate-400">
              <span>📁 {report.project_path}</span>
              <span>🕐 {new Date(report.timestamp).toLocaleString()}</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              report.summary.fail === 0 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {report.summary.fail === 0 ? '✅ Ready to Build' : `❌ ${report.summary.fail} Issues`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
