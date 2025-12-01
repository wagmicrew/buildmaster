import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { 
  FileText, Save, RefreshCw, CheckCircle, XCircle, 
  Zap, Server, Key, Globe, AlertTriangle, Loader,
  ChevronDown, Search
} from 'lucide-react'

interface NginxEditorProps {
  configPath?: string
  env?: 'dev' | 'prod'
}

export default function NginxEditor({ configPath, env = 'dev' }: NginxEditorProps) {
  const [content, setContent] = useState('')
  const [selectedSite, setSelectedSite] = useState(configPath || '')
  const [serverName, setServerName] = useState('')
  const [port, setPort] = useState(3000)
  const [selectedPm2Process, setSelectedPm2Process] = useState('')
  const [enableSsl, setEnableSsl] = useState(false)
  const [selectedCert, setSelectedCert] = useState('')
  const [showAutofix, setShowAutofix] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Fetch nginx sites
  const { data: nginxSites } = useQuery({
    queryKey: ['nginx-sites'],
    queryFn: async () => {
      const response = await api.get('/settings/nginx-sites')
      return response.data
    }
  })

  // Fetch PM2 processes
  const { data: pm2Processes } = useQuery({
    queryKey: ['pm2-processes'],
    queryFn: async () => {
      const response = await api.get('/settings/pm2-processes')
      return response.data
    }
  })

  // Fetch SSL certificates
  const { data: sslCerts } = useQuery({
    queryKey: ['ssl-certificates'],
    queryFn: async () => {
      const response = await api.get('/nginx/ssl-certificates')
      return response.data
    }
  })

  // Load config when site is selected
  useEffect(() => {
    if (selectedSite) {
      loadConfig(selectedSite)
    }
  }, [selectedSite])

  const loadConfig = async (path: string) => {
    try {
      const response = await api.get(`/nginx/config/${encodeURIComponent(path)}`)
      if (response.data.success) {
        setContent(response.data.content)
        setErrorMessage('')
        // Try to extract server_name and port from config
        extractConfigInfo(response.data.content)
      } else {
        setErrorMessage(response.data.error)
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Failed to load config')
    }
  }

  const extractConfigInfo = (config: string) => {
    // Extract server_name
    const serverNameMatch = config.match(/server_name\s+([^;]+);/)
    if (serverNameMatch) {
      setServerName(serverNameMatch[1].trim())
    }

    // Extract port from proxy_pass
    const portMatch = config.match(/proxy_pass\s+http:\/\/127\.0\.0\.1:(\d+)/)
    if (portMatch) {
      setPort(parseInt(portMatch[1]))
    }

    // Check if SSL is enabled
    setEnableSsl(config.includes('ssl_certificate'))
  }

  const saveConfig = useMutation({
    mutationFn: async (configContent: string) => {
      const response = await api.post(
        `/nginx/config/${encodeURIComponent(selectedSite)}`,
        { content: configContent, backup: true }
      )
      return response.data
    },
    onSuccess: (data) => {
      if (data.success) {
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
        setErrorMessage(data.error)
      }
    },
    onError: (error: any) => {
      setSaveStatus('error')
      setErrorMessage(error.response?.data?.detail || 'Failed to save config')
    }
  })

  const autofixConfig = useMutation({
    mutationFn: async () => {
      const cert = sslCerts?.certificates?.find((c: any) => c.domain === selectedCert)
      const response = await api.post('/nginx/autofix', {
        config_path: selectedSite,
        server_name: serverName,
        port: port,
        pm2_process: selectedPm2Process || undefined,
        ssl_cert_path: cert?.cert_path || undefined,
        ssl_key_path: cert?.key_path || undefined,
        enable_ssl: enableSsl
      })
      return response.data
    },
    onSuccess: (data) => {
      if (data.success) {
        setContent(data.config)
        setShowAutofix(false)
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setErrorMessage(data.error)
      }
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.detail || 'Failed to generate config')
    }
  })

  const testConfig = useMutation({
    mutationFn: async () => {
      // Save first, then test
      await saveConfig.mutateAsync(content)
      const response = await api.post('/settings/nginx/reload')
      return response.data
    },
    onSuccess: (data) => {
      if (data.success) {
        setSaveStatus('success')
        setErrorMessage('')
      } else {
        setSaveStatus('error')
        setErrorMessage(data.error || 'Config test failed')
      }
    }
  })

  const handleSave = () => {
    setSaveStatus('saving')
    saveConfig.mutate(content)
  }

  const handleAutofix = () => {
    if (!serverName || !port) {
      setErrorMessage('Server name and port are required')
      return
    }
    autofixConfig.mutate()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="text-blue-400" size={24} />
          <h2 className="text-2xl font-bold text-white">Nginx Configuration Editor</h2>
        </div>
        <button
          onClick={() => setShowAutofix(!showAutofix)}
          className="px-4 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-2"
        >
          <Zap size={16} />
          {showAutofix ? 'Hide' : 'Show'} Autofix
        </button>
      </div>

      {/* Site Selection */}
      <div className="glass-subtle rounded-xl p-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Select Nginx Site
        </label>
        <div className="relative">
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none appearance-none pr-10"
          >
            <option value="">Select a site...</option>
            {nginxSites?.siteDetails?.map((site: any) => (
              <option key={site.name} value={site.configPath}>
                {site.name} {site.enabled && '(enabled)'}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>

      {/* Autofix Panel */}
      {showAutofix && (
        <div className="glass-subtle rounded-xl p-6 border border-blue-500/30">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="text-blue-400" size={20} />
            Auto-fix for Next.js
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Server Name</label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="example.com"
                className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 3000)}
                className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">PM2 Process (Optional)</label>
              <div className="relative">
                <select
                  value={selectedPm2Process}
                  onChange={(e) => setSelectedPm2Process(e.target.value)}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none appearance-none pr-10"
                >
                  <option value="">Auto-detect or manual</option>
                  {pm2Processes?.processes?.map((proc: any) => (
                    <option key={proc.name} value={proc.name}>
                      {proc.name} ({proc.status})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                <input
                  type="checkbox"
                  checked={enableSsl}
                  onChange={(e) => setEnableSsl(e.target.checked)}
                  className="w-4 h-4 text-blue-500 bg-slate-800 border-slate-600 rounded"
                />
                Enable SSL/HTTPS
              </label>
            </div>

            {enableSsl && (
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-2">SSL Certificate</label>
                <div className="relative">
                  <select
                    value={selectedCert}
                    onChange={(e) => setSelectedCert(e.target.value)}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none appearance-none pr-10"
                  >
                    <option value="">Select certificate...</option>
                    {sslCerts?.certificates?.map((cert: any) => (
                      <option key={cert.domain} value={cert.domain}>
                        {cert.domain} {cert.info?.notAfter && `(expires: ${cert.info.notAfter})`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleAutofix}
            disabled={autofixConfig.isPending || !serverName || !port}
            className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {autofixConfig.isPending ? (
              <>
                <Loader className="animate-spin" size={16} />
                Generating...
              </>
            ) : (
              <>
                <Zap size={16} />
                Generate Next.js Config
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/20 border border-rose-500/50 rounded-lg flex items-start gap-2">
          <AlertTriangle className="text-rose-400 mt-0.5" size={20} />
          <div className="text-rose-300 text-sm">{errorMessage}</div>
        </div>
      )}

      {/* Editor */}
      <div className="glass-subtle rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Configuration File</h3>
          <div className="flex gap-2">
            <button
              onClick={() => testConfig.mutate()}
              disabled={!selectedSite || testConfig.isPending}
              className="px-4 py-2 bg-green-500/20 border border-green-500/50 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={testConfig.isPending ? 'animate-spin' : ''} size={16} />
              Test & Reload
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedSite || saveConfig.isPending || saveStatus === 'saving'}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saveStatus === 'saving' ? (
                <>
                  <Loader className="animate-spin" size={16} />
                  Saving...
                </>
              ) : saveStatus === 'success' ? (
                <>
                  <CheckCircle size={16} />
                  Saved
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save
                </>
              )}
            </button>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-96 bg-slate-900 text-slate-100 font-mono text-sm p-4 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none resize-none"
          placeholder="Select a site to load configuration..."
          spellCheck={false}
        />
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-300">
        <p className="font-semibold mb-2">💡 Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-blue-200/80">
          <li>Use Autofix to generate optimized Next.js configuration</li>
          <li>Select a PM2 process to auto-detect the correct port</li>
          <li>SSL certificates are auto-discovered from Let's Encrypt</li>
          <li>Config is automatically backed up before saving</li>
          <li>Test & Reload validates and applies the configuration</li>
        </ul>
      </div>
    </div>
  )
}

