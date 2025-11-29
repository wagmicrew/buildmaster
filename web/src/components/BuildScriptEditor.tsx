import { useState, useEffect, useCallback } from 'react'
import { 
  FileCode, Save, Play, AlertTriangle, CheckCircle, Zap, 
  Cpu, RefreshCw, Plus, Trash2, Copy,
  ChevronDown, ChevronRight, Lightbulb, Shield, Timer,
  AlertCircle, FileText, Code2
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

// Build script templates
const SCRIPT_TEMPLATES = {
  'quick-dev': {
    name: 'Quick Development Build',
    description: 'Fast build for development, skips optimizations',
    script: 'cross-env NODE_ENV=development next build',
    category: 'development',
    estimatedTime: '2-5 min',
    memoryUsage: 'Low'
  },
  'production-optimized': {
    name: 'Production Optimized',
    description: 'Full production build with all optimizations',
    script: 'cross-env NODE_ENV=production NODE_OPTIONS="--max-old-space-size=8192" next build',
    category: 'production',
    estimatedTime: '15-25 min',
    memoryUsage: 'High'
  },
  'memory-safe': {
    name: 'Memory Safe Build',
    description: 'Build with memory limits and garbage collection',
    script: 'cross-env NODE_ENV=production NODE_OPTIONS="--max-old-space-size=4096 --gc-interval=100" next build',
    category: 'production',
    estimatedTime: '20-30 min',
    memoryUsage: 'Medium'
  },
  'phased-build': {
    name: 'Phased Build',
    description: 'Build in phases for large projects',
    script: 'node scripts/build-phased.mjs',
    category: 'production',
    estimatedTime: '25-40 min',
    memoryUsage: 'Low'
  },
  'turbo-experimental': {
    name: 'Turbo Experimental',
    description: 'Uses Next.js Turbopack (experimental)',
    script: 'cross-env NODE_ENV=production next build --turbo',
    category: 'experimental',
    estimatedTime: '5-10 min',
    memoryUsage: 'Medium'
  },
  'clean-build': {
    name: 'Clean Build',
    description: 'Removes cache before building',
    script: 'rimraf .next && cross-env NODE_ENV=production next build',
    category: 'maintenance',
    estimatedTime: '20-30 min',
    memoryUsage: 'High'
  },
  'with-analysis': {
    name: 'Build with Bundle Analysis',
    description: 'Generates bundle analysis report',
    script: 'cross-env ANALYZE=true NODE_ENV=production next build',
    category: 'analysis',
    estimatedTime: '20-30 min',
    memoryUsage: 'High'
  },
  'standalone': {
    name: 'Standalone Build',
    description: 'Creates standalone output for Docker',
    script: 'cross-env NODE_ENV=production NEXT_OUTPUT=standalone next build',
    category: 'production',
    estimatedTime: '15-25 min',
    memoryUsage: 'High'
  }
}

// Optimization suggestions based on script analysis
interface OptimizationSuggestion {
  type: 'warning' | 'error' | 'info' | 'success'
  title: string
  description: string
  fix?: string
  impact: 'high' | 'medium' | 'low'
}

interface BuildScript {
  name: string
  command: string
  category: string
  description: string
  recommended?: boolean
  isCustom?: boolean
  timeout?: number
  memoryLimit?: number
}

interface AnalysisResult {
  suggestions: OptimizationSuggestion[]
  estimatedTime: string
  memoryEstimate: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  sanityChecks: {
    passed: boolean
    checks: { name: string; passed: boolean; message: string }[]
  }
}

function analyzeScript(script: string): AnalysisResult {
  const suggestions: OptimizationSuggestion[] = []
  let estimatedTime = '10-20 min'
  let memoryEstimate = '4-8 GB'
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
  
  const sanityChecks: { name: string; passed: boolean; message: string }[] = []

  // Check for memory settings
  if (!script.includes('max-old-space-size')) {
    suggestions.push({
      type: 'warning',
      title: 'No memory limit set',
      description: 'Build may crash on large projects without memory limits',
      fix: 'Add NODE_OPTIONS="--max-old-space-size=8192"',
      impact: 'high'
    })
    sanityChecks.push({ name: 'Memory Limit', passed: false, message: 'No --max-old-space-size configured' })
  } else {
    const memMatch = script.match(/max-old-space-size=(\d+)/)
    if (memMatch) {
      const memSize = parseInt(memMatch[1])
      if (memSize < 4096) {
        suggestions.push({
          type: 'warning',
          title: 'Low memory limit',
          description: `${memSize}MB may not be enough for large builds`,
          fix: 'Increase to at least 4096 or 8192',
          impact: 'medium'
        })
      }
      memoryEstimate = `${Math.round(memSize / 1024)} GB`
    }
    sanityChecks.push({ name: 'Memory Limit', passed: true, message: 'Memory limit configured' })
  }

  // Check for NODE_ENV
  if (!script.includes('NODE_ENV=')) {
    suggestions.push({
      type: 'error',
      title: 'NODE_ENV not set',
      description: 'Build environment not specified, may use wrong optimizations',
      fix: 'Add NODE_ENV=production or NODE_ENV=development',
      impact: 'high'
    })
    sanityChecks.push({ name: 'Environment', passed: false, message: 'NODE_ENV not specified' })
    riskLevel = 'medium'
  } else {
    sanityChecks.push({ name: 'Environment', passed: true, message: 'NODE_ENV configured' })
  }

  // Check for cross-env (Windows compatibility)
  if (script.includes('NODE_ENV=') && !script.includes('cross-env')) {
    suggestions.push({
      type: 'info',
      title: 'Consider cross-env',
      description: 'Using cross-env ensures Windows compatibility',
      fix: 'Prefix with cross-env for cross-platform support',
      impact: 'low'
    })
  }

  // Check for turbo mode
  if (script.includes('--turbo')) {
    suggestions.push({
      type: 'warning',
      title: 'Turbopack is experimental',
      description: 'Turbopack may have stability issues in production',
      impact: 'medium'
    })
    riskLevel = 'medium'
    estimatedTime = '5-10 min'
  }

  // Check for cache clearing
  if (script.includes('rimraf .next') || script.includes('rm -rf .next')) {
    suggestions.push({
      type: 'info',
      title: 'Cache will be cleared',
      description: 'Build will take longer but ensures clean state',
      impact: 'low'
    })
    estimatedTime = '20-35 min'
  }

  // Check for bundle analysis
  if (script.includes('ANALYZE=true')) {
    suggestions.push({
      type: 'info',
      title: 'Bundle analysis enabled',
      description: 'Will generate bundle size report after build',
      impact: 'low'
    })
  }

  // Check for potential infinite loops or dangerous patterns
  if (script.includes('while true') || script.includes('for (;;)')) {
    suggestions.push({
      type: 'error',
      title: 'Potential infinite loop detected',
      description: 'Script contains patterns that may cause infinite execution',
      impact: 'high'
    })
    riskLevel = 'critical'
    sanityChecks.push({ name: 'Loop Safety', passed: false, message: 'Potential infinite loop detected' })
  } else {
    sanityChecks.push({ name: 'Loop Safety', passed: true, message: 'No dangerous loop patterns' })
  }

  // Check for timeout
  if (!script.includes('timeout') && script.length > 50) {
    suggestions.push({
      type: 'info',
      title: 'No timeout configured',
      description: 'Consider adding a timeout to prevent runaway builds',
      fix: 'BuildMaster will enforce a 30-minute timeout automatically',
      impact: 'medium'
    })
  }
  sanityChecks.push({ name: 'Timeout Protection', passed: true, message: 'BuildMaster enforces 30-min timeout' })

  // Estimate time based on script complexity
  if (script.includes('phased') || script.includes('standalone')) {
    estimatedTime = '25-40 min'
  } else if (script.includes('quick') || script.includes('development')) {
    estimatedTime = '2-5 min'
  }

  // Add success suggestion if all looks good
  if (suggestions.filter(s => s.type === 'error' || s.type === 'warning').length === 0) {
    suggestions.push({
      type: 'success',
      title: 'Script looks good!',
      description: 'No major issues detected in this build script',
      impact: 'low'
    })
  }

  return {
    suggestions,
    estimatedTime,
    memoryEstimate,
    riskLevel,
    sanityChecks: {
      passed: sanityChecks.every(c => c.passed),
      checks: sanityChecks
    }
  }
}

export default function BuildScriptEditor() {
  const queryClient = useQueryClient()
  const [selectedScript, setSelectedScript] = useState<string | null>(null)
  const [editedCommand, setEditedCommand] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showNewScript, setShowNewScript] = useState(false)
  const [newScriptName, setNewScriptName] = useState('')
  const [newScriptCommand, setNewScriptCommand] = useState('')
  const [newScriptDescription, setNewScriptDescription] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [environment, setEnvironment] = useState<'dev' | 'prod'>('dev')

  // Fetch available scripts
  const { data: scriptsData, isLoading: scriptsLoading } = useQuery({
    queryKey: ['build-scripts', environment],
    queryFn: async () => {
      const response = await api.get('/build/scripts/all', {
        params: { environment }
      })
      return response.data
    }
  })

  // Fetch custom scripts
  const { data: customScripts } = useQuery({
    queryKey: ['custom-scripts'],
    queryFn: async () => {
      const response = await api.get('/build/scripts/custom')
      return response.data
    }
  })

  // Save script mutation
  const saveScriptMutation = useMutation({
    mutationFn: async (data: { name: string; command: string; description: string; environment: string }) => {
      const response = await api.post('/build/scripts/save', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['build-scripts'] })
      queryClient.invalidateQueries({ queryKey: ['custom-scripts'] })
      setIsEditing(false)
    }
  })

  // Delete script mutation
  const deleteScriptMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.delete(`/build/scripts/${name}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['build-scripts'] })
      queryClient.invalidateQueries({ queryKey: ['custom-scripts'] })
      setSelectedScript(null)
    }
  })

  // Create new script mutation
  const createScriptMutation = useMutation({
    mutationFn: async (data: { name: string; command: string; description: string }) => {
      const response = await api.post('/build/scripts/create', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['build-scripts'] })
      queryClient.invalidateQueries({ queryKey: ['custom-scripts'] })
      setShowNewScript(false)
      setNewScriptName('')
      setNewScriptCommand('')
      setNewScriptDescription('')
    }
  })

  // Analyze script when editing
  useEffect(() => {
    if (editedCommand) {
      const result = analyzeScript(editedCommand)
      setAnalysis(result)
    } else {
      setAnalysis(null)
    }
  }, [editedCommand])

  // Handle script selection
  const handleSelectScript = useCallback((script: BuildScript) => {
    setSelectedScript(script.name)
    setEditedCommand(script.command)
    setEditedDescription(script.description || '')
    setIsEditing(false)
  }, [])

  // Handle template selection
  const handleApplyTemplate = (templateKey: string) => {
    const template = SCRIPT_TEMPLATES[templateKey as keyof typeof SCRIPT_TEMPLATES]
    if (template) {
      setNewScriptCommand(template.script)
      setNewScriptDescription(template.description)
      setNewScriptName(templateKey.replace(/-/g, ':'))
      setShowTemplates(false)
    }
  }

  const scripts: BuildScript[] = scriptsData?.scripts || []
  const allScripts = [
    ...scripts,
    ...(customScripts?.scripts || []).map((s: any) => ({ ...s, isCustom: true }))
  ]

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400'
      case 'medium': return 'text-yellow-400'
      case 'high': return 'text-orange-400'
      case 'critical': return 'text-rose-400'
      default: return 'text-slate-400'
    }
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle className="text-rose-400" size={16} />
      case 'warning': return <AlertTriangle className="text-yellow-400" size={16} />
      case 'info': return <Lightbulb className="text-blue-400" size={16} />
      case 'success': return <CheckCircle className="text-green-400" size={16} />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCode className="text-purple-400" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-white">Build Script Editor</h2>
            <p className="text-slate-400">Edit, analyze, and optimize your build scripts</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Script List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Available Scripts</h3>
              <button
                onClick={() => setShowNewScript(true)}
                className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
                title="Add new script"
              >
                <Plus size={18} />
              </button>
            </div>

            {scriptsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="animate-spin text-slate-400" size={24} />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {allScripts.map((script) => (
                  <button
                    key={script.name}
                    onClick={() => handleSelectScript(script)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedScript === script.name
                        ? 'bg-purple-500/20 border border-purple-500/50'
                        : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white text-sm">{script.name}</span>
                      {script.recommended && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                      {script.isCustom && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      {script.description || script.command}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Templates Section */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText size={18} className="text-blue-400" />
                Templates
              </h3>
              {showTemplates ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
            </button>

            {showTemplates && (
              <div className="mt-4 space-y-2">
                {Object.entries(SCRIPT_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => handleApplyTemplate(key)}
                    className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white text-sm">{template.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        template.category === 'production' ? 'bg-emerald-500/20 text-emerald-400' :
                        template.category === 'development' ? 'bg-blue-500/20 text-blue-400' :
                        template.category === 'experimental' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {template.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{template.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Timer size={12} /> {template.estimatedTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Cpu size={12} /> {template.memoryUsage}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor & Analysis */}
        <div className="lg:col-span-2 space-y-4">
          {selectedScript ? (
            <>
              {/* Script Editor */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Code2 size={18} className="text-purple-400" />
                    {selectedScript}
                  </h3>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveScriptMutation.mutate({
                            name: selectedScript,
                            command: editedCommand,
                            description: editedDescription,
                            environment
                          })}
                          disabled={saveScriptMutation.isPending}
                          className="px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Save size={14} />
                          {saveScriptMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-3 py-1.5 text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(editedCommand)}
                          className="p-1.5 text-slate-400 hover:text-white transition-colors"
                          title="Copy command"
                        >
                          <Copy size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Description */}
                {isEditing ? (
                  <input
                    type="text"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="Script description..."
                    className="w-full bg-slate-900 text-slate-300 px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none mb-3 text-sm"
                  />
                ) : (
                  <p className="text-sm text-slate-400 mb-3">{editedDescription || 'No description'}</p>
                )}

                {/* Command Editor */}
                <div className="relative">
                  <textarea
                    value={editedCommand}
                    onChange={(e) => setEditedCommand(e.target.value)}
                    readOnly={!isEditing}
                    className={`w-full h-32 bg-slate-900 text-green-400 font-mono text-sm p-4 rounded-lg border ${
                      isEditing ? 'border-purple-500' : 'border-slate-600'
                    } focus:outline-none resize-none`}
                    placeholder="Enter build command..."
                  />
                  {!isEditing && (
                    <div className="absolute inset-0 bg-transparent cursor-not-allowed" />
                  )}
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => {
                      // This would trigger a test run
                      alert('Test run feature coming soon!')
                    }}
                    className="px-3 py-1.5 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Play size={14} />
                    Test Run
                  </button>
                  {allScripts.find(s => s.name === selectedScript)?.isCustom && (
                    <button
                      onClick={() => {
                        if (confirm(`Delete script "${selectedScript}"?`)) {
                          deleteScriptMutation.mutate(selectedScript)
                        }
                      }}
                      className="px-3 py-1.5 text-sm bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Analysis Panel */}
              {analysis && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Zap size={18} className="text-yellow-400" />
                    Script Analysis
                  </h3>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <Timer className="mx-auto text-blue-400 mb-1" size={20} />
                      <div className="text-sm text-white font-medium">{analysis.estimatedTime}</div>
                      <div className="text-xs text-slate-400">Est. Time</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <Cpu className="mx-auto text-purple-400 mb-1" size={20} />
                      <div className="text-sm text-white font-medium">{analysis.memoryEstimate}</div>
                      <div className="text-xs text-slate-400">Memory</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <Shield className={`mx-auto mb-1 ${getRiskColor(analysis.riskLevel)}`} size={20} />
                      <div className={`text-sm font-medium capitalize ${getRiskColor(analysis.riskLevel)}`}>
                        {analysis.riskLevel}
                      </div>
                      <div className="text-xs text-slate-400">Risk Level</div>
                    </div>
                  </div>

                  {/* Sanity Checks */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                      <Shield size={14} />
                      Sanity Checks
                      {analysis.sanityChecks.passed ? (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">All Passed</span>
                      ) : (
                        <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded">Issues Found</span>
                      )}
                    </h4>
                    <div className="space-y-1">
                      {analysis.sanityChecks.checks.map((check: { name: string; passed: boolean; message: string }, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          {check.passed ? (
                            <CheckCircle className="text-green-400" size={12} />
                          ) : (
                            <AlertCircle className="text-rose-400" size={12} />
                          )}
                          <span className={check.passed ? 'text-slate-400' : 'text-rose-300'}>
                            {check.name}: {check.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                      <Lightbulb size={14} />
                      Optimization Suggestions
                    </h4>
                    <div className="space-y-2">
                      {analysis.suggestions.map((suggestion: OptimizationSuggestion, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            suggestion.type === 'error' ? 'bg-rose-500/10 border-rose-500/30' :
                            suggestion.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                            suggestion.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
                            'bg-blue-500/10 border-blue-500/30'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {getSuggestionIcon(suggestion.type)}
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">{suggestion.title}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  suggestion.impact === 'high' ? 'bg-rose-500/20 text-rose-400' :
                                  suggestion.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {suggestion.impact} impact
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">{suggestion.description}</p>
                              {suggestion.fix && (
                                <div className="mt-2 p-2 bg-slate-900 rounded text-xs font-mono text-green-400">
                                  💡 {suggestion.fix}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
              <FileCode className="mx-auto text-slate-500 mb-4" size={48} />
              <h3 className="text-xl font-semibold text-white mb-2">Select a Script</h3>
              <p className="text-slate-400 mb-4">
                Choose a build script from the list to view, edit, and analyze it
              </p>
              <button
                onClick={() => setShowNewScript(true)}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Plus size={18} />
                Create New Script
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Script Modal */}
      {showNewScript && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="text-green-400" size={20} />
              Create New Build Script
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Script Name
                </label>
                <input
                  type="text"
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  placeholder="e.g., build:custom"
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={newScriptDescription}
                  onChange={(e) => setNewScriptDescription(e.target.value)}
                  placeholder="What does this script do?"
                  className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Command
                  </label>
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Use Template
                  </button>
                </div>
                <textarea
                  value={newScriptCommand}
                  onChange={(e) => setNewScriptCommand(e.target.value)}
                  placeholder="cross-env NODE_ENV=production next build"
                  className="w-full h-24 bg-slate-800 text-green-400 font-mono text-sm px-4 py-2 rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none resize-none"
                />
              </div>

              {/* Preview Analysis */}
              {newScriptCommand && (
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-600">
                  <div className="text-xs text-slate-400 mb-2">Quick Analysis:</div>
                  {(() => {
                    const preview = analyzeScript(newScriptCommand)
                    return (
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <Timer size={12} className="text-blue-400" />
                          {preview.estimatedTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Cpu size={12} className="text-purple-400" />
                          {preview.memoryEstimate}
                        </span>
                        <span className={`flex items-center gap-1 ${getRiskColor(preview.riskLevel)}`}>
                          <Shield size={12} />
                          {preview.riskLevel} risk
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewScript(false)
                  setNewScriptName('')
                  setNewScriptCommand('')
                  setNewScriptDescription('')
                }}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createScriptMutation.mutate({
                  name: newScriptName,
                  command: newScriptCommand,
                  description: newScriptDescription
                })}
                disabled={!newScriptName || !newScriptCommand || createScriptMutation.isPending}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {createScriptMutation.isPending ? 'Creating...' : 'Create Script'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
