import React, { useState, useEffect } from 'react'
import { Shield, Play, FileText, Copy, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
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
}

export const VitestRunner: React.FC = () => {
  const [environment, setEnvironment] = useState<'dev' | 'prod'>('dev')
  const [discoveryResult, setDiscoveryResult] = useState<VitestDiscoveryResult | null>(null)
  const [runResult, setRunResult] = useState<VitestRunResult | null>(null)
  const [selectedTest, setSelectedTest] = useState<VitestTest | null>(null)
  const [selectedTestName, setSelectedTestName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [copied, setCopied] = useState(false)

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
    try {
      const payload: any = { environment }
      if (testFile) payload.test_file = testFile
      if (testName) payload.test_name = testName

      const response = await api.post('/troubleshooting/vitest/run', payload)
      const result = response.data
      setRunResult(result)
    } catch (error) {
      console.error('Error running tests:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const runAllTests = () => {
    setSelectedTest(null)
    setSelectedTestName('')
    runTests()
  }

  const runSelectedTest = () => {
    if (selectedTest) {
      runTests(selectedTest.file, selectedTestName || undefined)
    }
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

  const getStatusIcon = (success: boolean) => {
    if (success) return <CheckCircle className="w-4 h-4 text-green-500" />
    return <XCircle className="w-4 h-4 text-red-500" />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold">Vitest Test Runner</h2>
        </div>
        <div className="flex items-center space-x-4">
          {/* Environment Toggle */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Environment:</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as 'dev' | 'prod')}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="dev">Development</option>
              <option value="prod">Production</option>
            </select>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={discoverTests}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            title="Refresh test discovery"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Test Discovery */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            Available Tests
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={runAllTests}
              disabled={isRunning || !discoveryResult?.tests.length}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Run All Tests
            </button>
            <button
              onClick={getReport}
              disabled={isLoading}
              className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center"
            >
              {copied ? <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Report'}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Discovering tests...</span>
          </div>
        ) : discoveryResult?.error ? (
          <div className="flex items-center text-red-600 py-4">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span>{discoveryResult.error}</span>
          </div>
        ) : discoveryResult?.tests.length === 0 ? (
          <div className="text-gray-500 py-4 text-center">
            No Vitest tests found in {environment} environment
          </div>
        ) : (
          <div className="space-y-2">
            {discoveryResult?.tests.map((test: VitestTest, index: number) => (
              <div
                key={index}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  selectedTest?.file === test.file ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedTest(test)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {test.is_troubleshooting ? (
                      <Shield className="w-4 h-4 text-blue-500" />
                    ) : (
                      <FileText className="w-4 h-4 text-gray-400" />
                    )}
                    <div>
                      <div className="font-medium text-sm">{test.file}</div>
                      <div className="text-xs text-gray-500">
                        {test.test_count} tests • {test.size_bytes} bytes
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedTest(test)
                      setSelectedTestName('')
                      runTests(test.file)
                    }}
                    disabled={isRunning}
                    className="p-1 text-gray-600 hover:text-blue-600 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Test Names */}
                {test.test_names.length > 0 && selectedTest?.file === test.file && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-sm font-medium mb-2">Individual Tests:</div>
                    <div className="space-y-1">
                      {test.test_names.map((testName: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedTestName(testName)
                            runTests(test.file, testName)
                          }}
                          disabled={isRunning}
                          className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded disabled:opacity-50 flex items-center justify-between group"
                        >
                          <span>{testName}</span>
                          <Play className="w-3 h-3 opacity-0 group-hover:opacity-100" />
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

      {/* Test Results */}
      {runResult && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center">
              {getStatusIcon(runResult.success)}
              <span className="ml-2">
                Test Results {runResult.test_file && `- ${runResult.test_file}`}
                {runResult.test_name && ` (${runResult.test_name})`}
              </span>
            </h3>
            <button
              onClick={() => copyToClipboard(runResult.console_output.join('\n'))}
              className="p-2 text-gray-600 hover:text-gray-800"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <div className="mb-2 text-gray-400">
              Duration: {runResult.duration_seconds}s | Exit Code: {runResult.exit_code}
            </div>
            {runResult.console_output.map((line: string, index: number) => (
              <div key={index} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Console Output from Discovery */}
      {discoveryResult?.console_output && discoveryResult.console_output.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-4">Discovery Output</h3>
          <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            {discoveryResult.console_output.map((line: string, index: number) => (
              <div key={index} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
