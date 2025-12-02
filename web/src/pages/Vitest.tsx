import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../services/api'
import {
  Activity,
  Play,
  FileText,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  Zap,
  AlertTriangle,
  Edit,
  BarChart3,
  Terminal,
  Code,
  Settings,
  ChevronRight,
  ChevronDown,
  Filter,
  Search,
  Download,
  Upload,
  Save,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react'

interface VitestTest {
  file: string
  full_path: string
  test_names: string[]
  test_count: number
  size_bytes: number
  is_troubleshooting: boolean
  category: string
}

interface TestStatistics {
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
  passRate: number
}

interface TestFailure {
  test: string
  file: string
  error: string
  suggestion: string
  line?: number
  stack?: string
}

interface VitestDiscoveryResult {
  directory: string
  tests: VitestTest[]
  error?: string
  console_output: string[]
}

interface VitestRunResult {
  directory: string
  test_file?: string
  test_name?: string
  success: boolean
  exit_code?: number
  console_output: string[]
  error?: string
  duration_seconds: number
  statistics?: TestStatistics
  failures?: TestFailure[]
}

interface TestSettings {
  verbose: boolean
  coverage: boolean
  watch: boolean
  ui: boolean
  reporter: string
  timeout: number
  threads: number
  environment: string
  testNamePattern?: string
  testFilePattern?: string
}

export default function Vitest() {
  const [environment, setEnvironment] = useState<'dev' | 'prod' | 'app'>('dev')
  const [discoveryResult, setDiscoveryResult] = useState<VitestDiscoveryResult | null>(null)
  const [runResult, setRunResult] = useState<VitestRunResult | null>(null)
  const [selectedTest, setSelectedTest] = useState<VitestTest | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingTest, setEditingTest] = useState<VitestTest | null>(null)
  const [testFileContent, setTestFileContent] = useState('')
  const [showConsole, setShowConsole] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set())
  const [showVerbose, setShowVerbose] = useState(true)
  const [settings, setSettings] = useState<TestSettings>({
    verbose: true,
    coverage: false,
    watch: false,
    ui: false,
    reporter: 'verbose',
    timeout: 5000,
    threads: 1,
    environment: 'jsdom'
  })

  // Discover tests on component mount and environment change
  useEffect(() => {
    discoverTests()
  }, [environment])

  const discoverTests = async () => {
    setIsLoading(true)
    try {
      const response = await api.get(`/troubleshooting/vitest/discover/${environment}`)
      const result = response.data
      setDiscoveryResult(result)
    } catch (error: any) {
      console.error('Error discovering tests:', error)
      setDiscoveryResult({
        directory: environment,
        tests: [],
        error: error.response?.data?.detail || 'Failed to discover tests',
        console_output: []
      })
    } finally {
      setIsLoading(false)
    }
  }

  const runTests = async (testFile?: string, testName?: string) => {
    setIsRunning(true)
    setShowConsole(true)
    try {
      const payload: any = {
        environment,
        verbose: settings.verbose,
        coverage: settings.coverage,
        reporter: settings.reporter,
        timeout: settings.timeout
      }
      if (testFile) payload.test_file = testFile
      if (testName) payload.test_name = testName

      const response = await api.post('/troubleshooting/vitest/run', payload)
      const result = response.data
      
      const parsedResult = parseTestOutput(result)
      setRunResult(parsedResult)
    } catch (error: any) {
      console.error('Error running tests:', error)
      setRunResult({
        directory: environment,
        success: false,
        console_output: [`Error: ${error.response?.data?.detail || 'Failed to run tests'}`],
        duration_seconds: 0,
        error: error.response?.data?.detail || 'Failed to run tests'
      })
    } finally {
      setIsRunning(false)
    }
  }

  const parseTestOutput = (result: VitestRunResult): VitestRunResult => {
    const output = result.console_output.join('\n')
    
    const stats: TestStatistics = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: result.duration_seconds || 0,
      passRate: 0
    }

    // Parse test results from console output
    const passedMatches = output.match(/✓/g)
    const failedMatches = output.match(/✗/g)
    const skippedMatches = output.match(/⚠️/g)
    
    stats.passed = passedMatches?.length || 0
    stats.failed = failedMatches?.length || 0
    stats.skipped = skippedMatches?.length || 0
    stats.total = stats.passed + stats.failed + stats.skipped
    stats.passRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0

    // Extract failures with more detail
    const failures: TestFailure[] = []
    const lines = output.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('✗') || line.includes('FAIL')) {
        const errorMatch = line.match(/✗\s+(.+?)\s*\((.+?):(\d+):(\d+)\)/)
        if (errorMatch) {
          const [, test, file, lineNum] = errorMatch
          // Get error details from next few lines
          let errorDetails = line
          let stack = ''
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            if (lines[j].trim().startsWith('at ') || lines[j].includes('Error:')) {
              stack += lines[j] + '\n'
            } else if (lines[j].trim() && !lines[j].includes('✓') && !lines[j].includes('✗')) {
              errorDetails += '\n' + lines[j]
            }
          }
          
          failures.push({
            test: test.trim(),
            file: file.trim(),
            error: errorDetails.trim(),
            suggestion: generateSuggestion(errorDetails),
            line: parseInt(lineNum),
            stack: stack.trim()
          })
        }
      }
    }

    return {
      ...result,
      statistics: stats,
      failures: failures.length > 0 ? failures : undefined
    }
  }

  const generateSuggestion = (error: string): string => {
    if (error.includes('Cannot find module')) {
      return '💡 Install missing dependencies: npm install <module-name>'
    }
    if (error.includes('timeout')) {
      return '⏱️ Test timed out. Increase timeout in settings or optimize test'
    }
    if (error.includes('TypeError') || error.includes('Cannot read property')) {
      return '🔧 Type error detected. Check variable types, null checks, and imports'
    }
    if (error.includes('AssertionError') || error.includes('toBe') || error.includes('toEqual')) {
      return '❌ Assertion failed. Verify expected vs actual values match'
    }
    if (error.includes('ReferenceError')) {
      return '🔍 Variable not defined. Check variable scope and imports'
    }
    return '🔍 Review test logic, dependencies, and mock setup'
  }

  const toggleTestExpansion = (testFile: string) => {
    const newExpanded = new Set(expandedTests)
    if (newExpanded.has(testFile)) {
      newExpanded.delete(testFile)
    } else {
      newExpanded.add(testFile)
    }
    setExpandedTests(newExpanded)
  }

  const filteredTests = discoveryResult?.tests.filter(test =>
    test.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
    test.test_names.some(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || []

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-gradient-to-r from-green-400 to-emerald-500'
    if (percentage >= 60) return 'bg-gradient-to-r from-yellow-400 to-orange-500'
    return 'bg-gradient-to-r from-red-400 to-pink-500'
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                <Activity className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Vitest Test Runner</h1>
                <p className="text-slate-400">Detailed test execution with verbose feedback and settings</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Environment Toggle */}
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1 border border-white/10">
                {(['dev', 'prod', 'app'] as const).map((env) => (
                  <button
                    key={env}
                    onClick={() => setEnvironment(env)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      environment === env
                        ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {env.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-3 rounded-xl transition-all ${
                  showSettings
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                }`}
                title="Test Settings"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={discoverTests}
                disabled={isLoading}
                className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
              >
                <RefreshCw className={`size-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Test Settings Panel */}
          {showSettings && (
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Settings size={20} />
                Test Configuration
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Verbose Output</label>
                  <button
                    onClick={() => setSettings({ ...settings, verbose: !settings.verbose })}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      settings.verbose
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}
                  >
                    {settings.verbose ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Coverage</label>
                  <button
                    onClick={() => setSettings({ ...settings, coverage: !settings.coverage })}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      settings.coverage
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}
                  >
                    {settings.coverage ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Reporter</label>
                  <select
                    value={settings.reporter}
                    onChange={(e) => setSettings({ ...settings, reporter: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 text-white border border-white/10 focus:border-purple-500 outline-none"
                  >
                    <option value="verbose">Verbose</option>
                    <option value="dot">Dot</option>
                    <option value="json">JSON</option>
                    <option value="html">HTML</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Timeout (ms)</label>
                  <input
                    type="number"
                    value={settings.timeout}
                    onChange={(e) => setSettings({ ...settings, timeout: parseInt(e.target.value) || 5000 })}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 text-white border border-white/10 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Statistics */}
          {runResult?.statistics && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="text-sm text-slate-400 mb-1">Total</div>
                <div className="text-2xl font-bold text-white">{runResult.statistics.total}</div>
              </div>
              <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
                <div className="text-sm text-green-400 mb-1">Passed</div>
                <div className="text-2xl font-bold text-green-400">{runResult.statistics.passed}</div>
              </div>
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                <div className="text-sm text-red-400 mb-1">Failed</div>
                <div className="text-2xl font-bold text-red-400">{runResult.statistics.failed}</div>
              </div>
              <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
                <div className="text-sm text-yellow-400 mb-1">Skipped</div>
                <div className="text-2xl font-bold text-yellow-400">{runResult.statistics.skipped}</div>
              </div>
              <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
                <div className="text-sm text-purple-400 mb-1">Duration</div>
                <div className="text-2xl font-bold text-purple-400">{runResult.statistics.duration.toFixed(2)}s</div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {runResult?.statistics && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Pass Rate</span>
                <span className="text-lg font-bold text-white">{runResult.statistics.passRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full ${getProgressColor(runResult.statistics.passRate)} transition-all duration-1000`}
                  style={{ width: `${runResult.statistics.passRate}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Console Output */}
        {showConsole && runResult && (
          <div className="glass rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Terminal size={24} />
                Console Output
                {runResult.test_file && (
                  <span className="text-sm text-slate-400 font-normal">
                    - {runResult.test_file}
                    {runResult.test_name && ` (${runResult.test_name})`}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  runResult.success
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
                }`}>
                  {runResult.success ? '✓ PASSED' : '✗ FAILED'}
                </span>
                <button
                  onClick={() => setShowVerbose(!showVerbose)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                >
                  {showVerbose ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  onClick={() => copyToClipboard(runResult.console_output.join('\n'))}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                >
                  <Copy size={18} />
                </button>
                <button
                  onClick={() => setShowConsole(false)}
                  className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                >
                  <XCircle size={18} />
                </button>
              </div>
            </div>
            <div className="bg-black/50 rounded-lg p-4 font-mono text-sm overflow-auto max-h-96 border border-white/10">
              <div className="mb-2 text-slate-500 text-xs border-b border-white/10 pb-2">
                Duration: {runResult.duration_seconds.toFixed(2)}s | Exit Code: {runResult.exit_code || 0}
              </div>
              {runResult.console_output.map((line: string, index: number) => {
                if (!showVerbose && (line.trim().length === 0 || line.startsWith(' '))) return null
                
                let lineClass = 'text-slate-300'
                if (line.includes('✓')) lineClass = 'text-green-400'
                if (line.includes('✗')) lineClass = 'text-red-400'
                if (line.includes('⚠️')) lineClass = 'text-yellow-400'
                if (line.includes('Error:') || line.includes('FAIL')) lineClass = 'text-red-500 font-semibold'
                if (line.includes('PASS')) lineClass = 'text-green-400 font-semibold'
                
                return (
                  <div key={index} className={`whitespace-pre-wrap ${lineClass}`}>
                    {line}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Test List */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FileText size={24} />
              Test Files
              {discoveryResult?.tests && (
                <span className="text-sm text-slate-400 font-normal">
                  ({discoveryResult.tests.length} files, {discoveryResult.tests.reduce((sum, t) => sum + t.test_count, 0)} tests)
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 outline-none"
                />
              </div>
              <button
                onClick={() => runTests()}
                disabled={isRunning || !discoveryResult?.tests.length}
                className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
                  isRunning
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                    : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:shadow-lg'
                }`}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="inline size-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="inline size-4 mr-2" />
                    Run All
                  </>
                )}
              </button>
              {!showConsole && runResult && (
                <button
                  onClick={() => setShowConsole(true)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                >
                  <Terminal className="inline size-4 mr-2" />
                  Show Console
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-purple-400" />
            </div>
          ) : discoveryResult?.error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
              <AlertCircle className="inline size-5 mr-2" />
              {discoveryResult.error}
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="size-12 mx-auto mb-3 opacity-50" />
              <p>No tests found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTests.map((test, index) => {
                const isExpanded = expandedTests.has(test.file)
                return (
                  <div
                    key={index}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => toggleTestExpansion(test.file)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </button>
                        <FileText className="text-purple-400" size={20} />
                        <div className="flex-1">
                          <div className="font-semibold text-white">{test.file}</div>
                          <div className="text-sm text-slate-400">
                            {test.test_count} tests • {(test.size_bytes / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedTest(test)
                            runTests(test.file)
                          }}
                          disabled={isRunning}
                          className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 text-sm font-medium"
                        >
                          <Play className="inline size-4 mr-1" />
                          Run
                        </button>
                      </div>
                    </div>
                    {isExpanded && test.test_names.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                        {test.test_names.map((testName, idx) => (
                          <button
                            key={idx}
                            onClick={() => runTests(test.file, testName)}
                            disabled={isRunning}
                            className="w-full text-left px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-slate-300 hover:text-white transition-all disabled:opacity-50"
                          >
                            {testName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Failure Analysis */}
        {runResult?.failures && runResult.failures.length > 0 && (
          <div className="glass rounded-2xl p-6 border border-red-500/30 bg-red-500/5">
            <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle size={24} />
              Failure Analysis ({runResult.failures.length} failures)
            </h2>
            <div className="space-y-4">
              {runResult.failures.map((failure, index) => (
                <div key={index} className="bg-white/5 border border-red-500/30 rounded-lg p-4">
                  <div className="font-semibold text-red-400 mb-2">{failure.test}</div>
                  <div className="text-sm text-slate-400 mb-3">{failure.file}:{failure.line}</div>
                  <div className="bg-black/50 rounded p-3 mb-3 border border-white/10">
                    <code className="text-sm text-red-300 whitespace-pre-wrap">{failure.error}</code>
                  </div>
                  {failure.stack && (
                    <details className="mb-3">
                      <summary className="text-sm text-slate-400 cursor-pointer hover:text-white">Stack Trace</summary>
                      <div className="mt-2 bg-black/50 rounded p-3 border border-white/10">
                        <code className="text-xs text-slate-400 whitespace-pre-wrap">{failure.stack}</code>
                      </div>
                    </details>
                  )}
                  <div className="text-sm text-blue-400">
                    <strong>💡 Suggestion:</strong> {failure.suggestion}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


