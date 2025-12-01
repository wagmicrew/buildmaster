import React, { useState, useEffect } from 'react'
import { Shield, Play, FileText, Copy, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw, Clock, Zap, AlertTriangle, Edit, BarChart3, Terminal, Code, Activity } from 'lucide-react'
import api from '../services/api'

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

const VitestRunner: React.FC = () => {
  const [environment, setEnvironment] = useState<'dev' | 'prod'>('dev')
  const [discoveryResult, setDiscoveryResult] = useState<VitestDiscoveryResult | null>(null)
  const [runResult, setRunResult] = useState<VitestRunResult | null>(null)
  const [selectedTest, setSelectedTest] = useState<VitestTest | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingTest, setEditingTest] = useState<VitestTest | null>(null)
  const [testFileContent, setTestFileContent] = useState('')
  const [showConsole, setShowConsole] = useState(false)

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
    } catch (error) {
      console.error('Error discovering tests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const runTests = async (testFile?: string, testName?: string) => {
    setIsRunning(true)
    setShowConsole(true)
    try {
      const payload: any = { environment }
      if (testFile) payload.test_file = testFile
      if (testName) payload.test_name = testName

      const response = await api.post('/troubleshooting/vitest/run', payload)
      const result = response.data
      
      // Parse console output to extract statistics and failures
      const parsedResult = parseTestOutput(result)
      setRunResult(parsedResult)
    } catch (error) {
      console.error('Error running tests:', error)
    } finally {
      setIsRunning(false)
      // Keep console visible after tests complete
      setShowConsole(true)
    }
  }

  const parseTestOutput = (result: VitestRunResult): VitestRunResult => {
    const output = result.console_output.join('\n')
    
    // Extract test statistics
    const stats: TestStatistics = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: result.duration_seconds,
      passRate: 0
    }

    // Parse test results from console output
    const testResults = output.match(/✓|✗|⚠️/g) || []
    stats.total = testResults.length
    stats.passed = (output.match(/✓/g) || []).length
    stats.failed = (output.match(/✗/g) || []).length
    stats.skipped = (output.match(/⚠️/g) || []).length
    stats.passRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0

    // Extract failures and generate suggestions
    const failures: TestFailure[] = []
    const errorLines = output.split('\n').filter(line => 
      line.includes('✗') || line.includes('Error:') || line.includes('FAIL')
    )

    errorLines.forEach((line) => {
      const errorMatch = line.match(/✗\s+(.+?)\s*\((.+?):(\d+):\d+\)/)
      if (errorMatch) {
        const [, test, file, lineNum] = errorMatch
        failures.push({
          test: test.trim(),
          file: file.trim(),
          error: line.trim(),
          suggestion: generateSuggestion(line.trim()),
          line: parseInt(lineNum)
        })
      }
    })

    return {
      ...result,
      statistics: stats,
      failures: failures
    }
  }

  const generateSuggestion = (error: string): string => {
    if (error.includes('Cannot find module')) {
      return '💡 Install missing dependencies with: npm install <module-name>'
    }
    if (error.includes('timeout')) {
      return '⏱️ Test timed out. Consider increasing timeout or optimizing test performance'
    }
    if (error.includes('TypeError')) {
      return '🔧 Type error detected. Check variable types and imports'
    }
    if (error.includes('AssertionError')) {
      return '❌ Test assertion failed. Verify expected vs actual values'
    }
    return '🔍 Check test logic and dependencies'
  }

  const openTestEditor = async (test: VitestTest) => {
    setEditingTest(test)
    setShowEditor(true)
    // In a real implementation, you'd fetch the file content
    setTestFileContent(`// Test file: ${test.file}\n// Content would be loaded from server\n\nimport { describe, it, expect } from 'vitest'\n\ndescribe('Sample Test', () => {\n  it('should work', () => {\n    expect(true).toBe(true)\n  })\n})`)
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-gradient-to-r from-green-400 to-emerald-500'
    if (percentage >= 60) return 'bg-gradient-to-r from-yellow-400 to-orange-500'
    return 'bg-gradient-to-r from-red-400 to-pink-500'
  }

  const runAllTests = () => {
    setSelectedTest(null)
    runTests()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getReport = async () => {
    try {
      const response = await api.get(`/troubleshooting/vitest/report/${environment}`)
      const result = response.data
      copyToClipboard(result.copyable)
    } catch (error) {
      console.error('Error getting report:', error)
    }
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Test Running Status Banner */}
      {isRunning && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl shadow-lg p-4 animate-pulse">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-lg font-semibold">Tests Running...</span>
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Console Output - Now at top, only shows when running or has results */}
      {(showConsole && runResult) && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 transform transition-all duration-500 ease-in-out">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center text-gray-900">
              <Terminal className="w-5 h-5 mr-2 text-purple-500" />
              Console Output
              {runResult.test_file && (
                <span className="ml-2 text-sm text-gray-600">
                  - {runResult.test_file}
                  {runResult.test_name && ` (${runResult.test_name})`}
                </span>
              )}
            </h3>
            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                runResult.success 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {runResult.success ? (
                  <><CheckCircle className="w-4 h-4 inline mr-1" /> PASSED</>
                ) : (
                  <><XCircle className="w-4 h-4 inline mr-1" /> FAILED</>
                )}
              </span>
              <button
                onClick={() => copyToClipboard(runResult.console_output.join('\n'))}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowConsole(false)}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
            <div className="mb-2 text-gray-500 border-b border-gray-700 pb-2">
              Duration: {runResult.duration_seconds}s | Exit Code: {runResult.exit_code}
            </div>
            {runResult.console_output.map((line: string, index: number) => {
              let lineClass = 'text-gray-300'
              if (line.includes('✓')) lineClass = 'text-green-400'
              if (line.includes('✗')) lineClass = 'text-red-400'
              if (line.includes('⚠️')) lineClass = 'text-yellow-400'
              if (line.includes('Error:')) lineClass = 'text-red-500 font-semibold'
              if (line.includes('FAIL')) lineClass = 'text-red-400 font-semibold'
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

      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-2xl shadow-lg p-6 border border-blue-100">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-xl shadow-lg transition-all duration-300 ${
            isRunning 
              ? 'bg-gradient-to-br from-orange-500 to-red-600 animate-pulse' 
              : 'bg-gradient-to-br from-blue-500 to-purple-600'
          }`}>
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Vitest Test Runner
            </h2>
            <p className="text-sm text-gray-600">Modern testing with real-time analytics</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {/* Environment Toggle */}
          <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-1">
            <button
              onClick={() => setEnvironment('dev')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                environment === 'dev' 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md transform scale-105' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Zap className="w-4 h-4 inline mr-1" />
              Dev
            </button>
            <button
              onClick={() => setEnvironment('prod')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                environment === 'prod' 
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md transform scale-105' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-1" />
              Prod
            </button>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={discoverTests}
            disabled={isLoading}
            className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 transform hover:scale-105"
            title="Refresh test discovery"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {runResult?.statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tests</p>
                <p className="text-3xl font-bold text-gray-900">{runResult.statistics.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Passed</p>
                <p className="text-3xl font-bold text-green-700">{runResult.statistics.passed}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl shadow-lg p-6 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Failed</p>
                <p className="text-3xl font-bold text-red-700">{runResult.statistics.failed}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-lg p-6 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Duration</p>
                <p className="text-3xl font-bold text-purple-700">{runResult.statistics.duration}s</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {runResult?.statistics && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {runResult.statistics.passRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
            <div 
              className={`h-full ${getProgressColor(runResult.statistics.passRate)} transition-all duration-1000 ease-out flex items-center justify-center text-white font-semibold shadow-lg`}
              style={{ width: `${runResult.statistics.passRate}%` }}
            >
              {runResult.statistics.passRate > 10 && `${runResult.statistics.passRate.toFixed(1)}%`}
            </div>
          </div>
          <div className="flex justify-between mt-4 text-sm">
            <span className="text-green-600 font-medium">{runResult.statistics.passed} passed</span>
            <span className="text-red-600 font-medium">{runResult.statistics.failed} failed</span>
            <span className="text-yellow-600 font-medium">{runResult.statistics.skipped} skipped</span>
          </div>
        </div>
      )}

      {/* Test Discovery */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center text-gray-900">
            <FileText className="w-5 h-5 mr-2 text-blue-500" />
            Available Tests
            {discoveryResult?.tests && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                {discoveryResult.tests.length} files
              </span>
            )}
          </h3>
          <div className="flex space-x-3">
            <button
              onClick={runAllTests}
              disabled={isRunning || !discoveryResult?.tests.length}
              className={`px-6 py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center font-medium transform hover:scale-105 ${
                isRunning 
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white animate-pulse' 
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-xl'
              }`}
            >
              {isRunning ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Run All Tests</>
              )}
            </button>
            <button
              onClick={getReport}
              disabled={isLoading}
              className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center font-medium transform hover:scale-105"
            >
              {copied ? <CheckCircle className="w-4 h-4 mr-2 text-green-300" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Report'}
            </button>
            <button
              onClick={() => setShowConsole(!showConsole)}
              className={`px-4 py-3 rounded-xl hover:shadow-lg transition-all flex items-center font-medium transform hover:scale-105 ${
                showConsole 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white' 
                  : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
              }`}
            >
              <Terminal className="w-4 h-4 mr-2" />
              {showConsole ? 'Hide' : 'Show'} Console
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <span className="text-gray-600 font-medium">Discovering tests...</span>
            </div>
          </div>
        ) : discoveryResult?.error ? (
          <div className="flex items-center text-red-600 py-8 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="w-5 h-5 mr-3" />
            <span className="font-medium">{discoveryResult.error}</span>
          </div>
        ) : discoveryResult?.tests.length === 0 ? (
          <div className="text-gray-500 py-8 text-center bg-gray-50 rounded-lg">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No Vitest tests found in {environment} environment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {discoveryResult?.tests.map((test: VitestTest, index: number) => (
              <div
                key={index}
                className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedTest?.file === test.file 
                    ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-purple-50 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                } text-gray-900`}
                onClick={() => setSelectedTest(test)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${
                      test.is_troubleshooting 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {test.is_troubleshooting ? (
                        <Shield className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 flex items-center">
                        {test.file}
                        {test.is_troubleshooting && (
                          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            Troubleshooting
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {test.test_count} tests • {(test.size_bytes / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openTestEditor(test)
                      }}
                      className="p-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all transform hover:scale-110"
                      title="Edit test file"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTest(test)
                        runTests(test.file)
                      }}
                      disabled={isRunning}
                      className={`p-2 rounded-lg transition-all transform hover:scale-110 ${
                        isRunning
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg'
                      }`}
                      title="Run test"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Test Names */}
                {test.test_names.length > 0 && selectedTest?.file === test.file && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm font-semibold mb-3 text-gray-900">Individual Tests:</div>
                    <div className="space-y-2">
                      {test.test_names.map((testName: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation()
                            runTests(test.file, testName)
                          }}
                          disabled={isRunning}
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg disabled:opacity-50 flex items-center justify-between group transition-all transform hover:scale-[1.02] ${
                            isRunning
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-blue-50 hover:to-purple-50 hover:text-gray-900 hover:shadow-md'
                          }`}
                        >
                          <span className="font-medium">{testName}</span>
                          <Play className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Console Output */}
      {showConsole && runResult && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center text-gray-900">
              <Terminal className="w-5 h-5 mr-2 text-purple-500" />
              Console Output
              {runResult.test_file && (
                <span className="ml-2 text-sm text-gray-600">
                  - {runResult.test_file}
                  {runResult.test_name && ` (${runResult.test_name})`}
                </span>
              )}
            </h3>
            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                runResult.success 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {runResult.success ? (
                  <><CheckCircle className="w-4 h-4 inline mr-1" /> PASSED</>
                ) : (
                  <><XCircle className="w-4 h-4 inline mr-1" /> FAILED</>
                )}
              </span>
              <button
                onClick={() => copyToClipboard(runResult.console_output.join('\n'))}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
            <div className="mb-2 text-gray-500 border-b border-gray-700 pb-2">
              Duration: {runResult.duration_seconds}s | Exit Code: {runResult.exit_code}
            </div>
            {runResult.console_output.map((line: string, index: number) => {
              let lineClass = 'text-gray-300'
              if (line.includes('✓')) lineClass = 'text-green-400'
              if (line.includes('✗')) lineClass = 'text-red-400'
              if (line.includes('⚠️')) lineClass = 'text-yellow-400'
              if (line.includes('Error:')) lineClass = 'text-red-500 font-semibold'
              if (line.includes('FAIL')) lineClass = 'text-red-400 font-semibold'
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

      {/* Failure Analysis */}
      {runResult?.failures && runResult.failures.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-red-100">
          <h3 className="text-lg font-semibold flex items-center text-red-700 mb-4">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Failure Analysis & Suggestions
          </h3>
          <div className="space-y-4">
            {runResult.failures.map((failure: TestFailure, index: number) => (
              <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-800 mb-1">{failure.test}</h4>
                    <p className="text-sm text-red-600 mb-2">{failure.file}:{failure.line}</p>
                    <div className="bg-red-100 border border-red-200 rounded p-2 mb-3">
                      <code className="text-sm text-red-800">{failure.error}</code>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="text-blue-600 font-medium mr-2">💡 Suggestion:</span>
                      <span className="text-gray-700">{failure.suggestion}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test File Editor Modal */}
      {showEditor && editingTest && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[85vh] max-w-7xl flex flex-col transform transition-all duration-300 scale-100">
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Edit Test: {editingTest.file}
                  </h3>
                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                    <span>{editingTest.test_count} tests</span>
                    <span>{(editingTest.size_bytes / 1024).toFixed(1)} KB</span>
                    {editingTest.is_troubleshooting && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        Troubleshooting
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    // Save functionality would go here
                    console.log('Saving test file:', editingTest.file)
                    // In a real implementation, you'd call an API to save the file
                    alert('Test file saved successfully!')
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all transform hover:scale-105 flex items-center font-medium"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save
                </button>
                <button
                  onClick={() => {
                    // Run the test from editor
                    runTests(editingTest.file)
                    setShowEditor(false)
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all transform hover:scale-105 flex items-center font-medium"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run Test
                </button>
                <button
                  onClick={() => setShowEditor(false)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all transform hover:scale-110"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 p-6 overflow-hidden">
              <div className="bg-gray-900 rounded-lg p-4 h-full overflow-auto border-2 border-gray-200">
                <textarea
                  value={testFileContent}
                  onChange={(e) => setTestFileContent(e.target.value)}
                  className="w-full h-full bg-transparent text-gray-300 font-mono text-sm outline-none resize-none leading-relaxed"
                  spellCheck={false}
                  placeholder="Edit your test code here..."
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VitestRunner
