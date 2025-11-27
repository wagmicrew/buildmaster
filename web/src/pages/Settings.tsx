import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import {
  Settings as SettingsIcon,
  Server,
  Database,
  Play,
  Box,
  Globe,
  Package,
  Save,
  RefreshCw,
  Loader,
  CheckCircle,
  XCircle,
  FolderOpen,
  Terminal,
  Eye,
  EyeOff,
  ChevronDown,
  AlertTriangle
} from 'lucide-react'

type SettingsTab = 'development' | 'production' | 'database' | 'build' | 'pm2' | 'nginx' | 'server'

interface AppSettings {
  development: {
    path: string
    git: {
      remote: string
      branch: string
      autoDetected: boolean
    }
  }
  production: {
    path: string
    git: {
      remote: string
      branch: string
      autoDetected: boolean
    }
  }
  database: {
    useLocalhost: boolean
    host: string
    port: number
    masterUser: string
    masterPassword: string
    devDatabase: string
    prodDatabase: string
    sslMode: string
  }
  build: {
    autoDetect: boolean
    detectedScripts: string[]
    devBuildScript: string
    prodBuildScript: string
    buildDirectory: string
    outputDirectory: string
  }
  pm2: {
    dev: {
      name: string
      mode: 'fork' | 'cluster'
      instances: number
      maxMemory: string
      autoRestart: boolean
      watchEnabled: boolean
    }
    prod: {
      name: string
      mode: 'fork' | 'cluster'
      instances: number
      maxMemory: string
      autoRestart: boolean
      watchEnabled: boolean
    }
  }
  nginx: {
    dev: {
      siteName: string
      configPath: string
      sitesEnabledPath: string
      serverName: string
      port: number
      sslEnabled: boolean
      sslCertPath: string
      sslKeyPath: string
    }
    prod: {
      siteName: string
      configPath: string
      sitesEnabledPath: string
      serverName: string
      port: number
      sslEnabled: boolean
      sslCertPath: string
      sslKeyPath: string
    }
  }
  server: {
    hostname: string
    os: string
    nodeVersion: string
    npmVersion: string
    pythonVersion: string
    lastPackageUpdate: string
    autoUpdates: boolean
  }
}

const defaultSettings: AppSettings = {
  development: {
    path: '/var/www/dintrafikskolax_dev',
    git: {
      remote: 'origin',
      branch: 'main',
      autoDetected: true
    }
  },
  production: {
    path: '/var/www/dintrafikskolax_prod',
    git: {
      remote: 'origin',
      branch: 'main',
      autoDetected: true
    }
  },
  database: {
    useLocalhost: true,
    host: 'localhost',
    port: 5432,
    masterUser: 'postgres',
    masterPassword: '',
    devDatabase: 'dintrafikskolax_dev',
    prodDatabase: 'dintrafikskolax_prod',
    sslMode: 'prefer'
  },
  build: {
    autoDetect: true,
    detectedScripts: [],
    devBuildScript: 'npm run build',
    prodBuildScript: 'npm run build',
    buildDirectory: '',
    outputDirectory: '.next'
  },
  pm2: {
    dev: {
      name: 'dintrafikskolax-dev',
      mode: 'fork',
      instances: 1,
      maxMemory: '512M',
      autoRestart: true,
      watchEnabled: false
    },
    prod: {
      name: 'dintrafikskolax-prod',
      mode: 'cluster',
      instances: 4,
      maxMemory: '1G',
      autoRestart: true,
      watchEnabled: false
    }
  },
  nginx: {
    dev: {
      siteName: 'dintrafikskolax-dev',
      configPath: '/etc/nginx/sites-available/dintrafikskolax-dev',
      sitesEnabledPath: '/etc/nginx/sites-enabled/dintrafikskolax-dev',
      serverName: 'dev.dintrafikskolahlm.se',
      port: 3000,
      sslEnabled: true,
      sslCertPath: '/etc/letsencrypt/live/dintrafikskolahlm.se/fullchain.pem',
      sslKeyPath: '/etc/letsencrypt/live/dintrafikskolahlm.se/privkey.pem'
    },
    prod: {
      siteName: 'dintrafikskolax-prod',
      configPath: '/etc/nginx/sites-available/dintrafikskolax-prod',
      sitesEnabledPath: '/etc/nginx/sites-enabled/dintrafikskolax-prod',
      serverName: 'dintrafikskolahlm.se',
      port: 3001,
      sslEnabled: true,
      sslCertPath: '/etc/letsencrypt/live/dintrafikskolahlm.se/fullchain.pem',
      sslKeyPath: '/etc/letsencrypt/live/dintrafikskolahlm.se/privkey.pem'
    }
  },
  server: {
    hostname: 'dintrafikskolahlm.se',
    os: 'Ubuntu 22.04',
    nodeVersion: '',
    npmVersion: '',
    pythonVersion: '',
    lastPackageUpdate: '',
    autoUpdates: false
  }
}

const menuItems = [
  { id: 'development' as SettingsTab, label: 'Development', icon: FolderOpen, description: 'Dev environment paths & git' },
  { id: 'production' as SettingsTab, label: 'Production', icon: Server, description: 'Prod environment paths & git' },
  { id: 'database' as SettingsTab, label: 'Database', icon: Database, description: 'PostgreSQL connection settings' },
  { id: 'build' as SettingsTab, label: 'Build Engine', icon: Play, description: 'Build scripts & configuration' },
  { id: 'pm2' as SettingsTab, label: 'PM2', icon: Box, description: 'Process manager settings' },
  { id: 'nginx' as SettingsTab, label: 'Nginx', icon: Globe, description: 'Web server configuration' },
  { id: 'server' as SettingsTab, label: 'Server', icon: Package, description: 'Packages & system updates' }
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('development')
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const queryClient = useQueryClient()

  // Fetch settings
  const { data: fetchedSettings, isLoading, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings')
      return response.data as AppSettings
    }
  })

  // Auto-detect system info
  const { data: serverInfo } = useQuery({
    queryKey: ['server-info'],
    queryFn: async () => {
      const response = await api.get('/settings/server-info')
      return response.data
    }
  })

  // Detect build scripts
  const detectScriptsMutation = useMutation({
    mutationFn: async (path: string) => {
      const response = await api.post('/settings/detect-scripts', { path })
      return response.data
    },
    onSuccess: (data) => {
      setSettings(prev => ({
        ...prev,
        build: {
          ...prev.build,
          detectedScripts: data.scripts || [],
          autoDetect: true
        }
      }))
    }
  })

  // Detect PM2 processes
  const { data: pm2Processes } = useQuery({
    queryKey: ['pm2-processes'],
    queryFn: async () => {
      const response = await api.get('/settings/pm2-processes')
      return response.data
    }
  })

  // Detect Nginx sites
  const { data: nginxSites } = useQuery({
    queryKey: ['nginx-sites'],
    queryFn: async () => {
      const response = await api.get('/settings/nginx-sites')
      return response.data
    }
  })

  // Read database config from .env files
  const { data: envDatabaseConfig, refetch: refetchEnvDb } = useQuery({
    queryKey: ['env-database-config'],
    queryFn: async () => {
      const response = await api.get('/settings/database/from-env')
      return response.data
    }
  })

  // List available databases - manual trigger only (don't auto-run without password)
  const { data: availableDatabases, refetch: refetchAvailableDb, isFetching: isFetchingDatabases } = useQuery({
    queryKey: ['available-databases', settings.database.host, settings.database.port, settings.database.masterUser],
    queryFn: async () => {
      const response = await api.get('/settings/database/available', {
        params: {
          host: settings.database.useLocalhost ? 'localhost' : settings.database.host,
          port: settings.database.port,
          user: settings.database.masterUser,
          password: settings.database.masterPassword
        }
      })
      return response.data
    },
    enabled: false, // Only run when manually triggered via refetch
    retry: false
  })

  // Apply env database config to settings
  const applyEnvDatabaseConfig = () => {
    if (envDatabaseConfig) {
      setSettings(prev => ({
        ...prev,
        database: {
          ...prev.database,
          devDatabase: envDatabaseConfig.dev?.database || prev.database.devDatabase,
          prodDatabase: envDatabaseConfig.prod?.database || prev.database.prodDatabase,
          sslMode: envDatabaseConfig.dev?.sslMode || envDatabaseConfig.prod?.sslMode || prev.database.sslMode
        }
      }))
    }
  }

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: AppSettings) => {
      const response = await api.post('/settings', newSettings)
      return response.data
    },
    onSuccess: () => {
      setSaveStatus('success')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setTimeout(() => setSaveStatus('idle'), 3000)
    },
    onError: () => {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  })

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings)
    }
  }, [fetchedSettings])

  useEffect(() => {
    if (serverInfo) {
      setSettings(prev => ({
        ...prev,
        server: {
          ...prev.server,
          ...serverInfo
        }
      }))
    }
  }, [serverInfo])

  const handleSave = () => {
    setSaveStatus('saving')
    saveSettingsMutation.mutate(settings)
  }

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const renderDevelopmentSettings = () => (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <FolderOpen className="text-sky-400" size={20} />
          Development Environment
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Project Path</label>
            <input
              type="text"
              value={settings.development.path}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                development: { ...prev.development, path: e.target.value }
              }))}
              className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
              placeholder="/var/www/your-app-dev"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Git Remote</label>
              <input
                type="text"
                value={settings.development.git.remote}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  development: {
                    ...prev.development,
                    git: { ...prev.development.git, remote: e.target.value }
                  }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                placeholder="origin"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Git Branch</label>
              <input
                type="text"
                value={settings.development.git.branch}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  development: {
                    ...prev.development,
                    git: { ...prev.development.git, branch: e.target.value }
                  }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                placeholder="main"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderProductionSettings = () => (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="text-emerald-400" size={20} />
          Production Environment
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Project Path</label>
            <input
              type="text"
              value={settings.production.path}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                production: { ...prev.production, path: e.target.value }
              }))}
              className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none"
              placeholder="/var/www/your-app-prod"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Git Remote</label>
              <input
                type="text"
                value={settings.production.git.remote}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  production: {
                    ...prev.production,
                    git: { ...prev.production.git, remote: e.target.value }
                  }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none"
                placeholder="origin"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Git Branch</label>
              <input
                type="text"
                value={settings.production.git.branch}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  production: {
                    ...prev.production,
                    git: { ...prev.production.git, branch: e.target.value }
                  }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none"
                placeholder="main"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderDatabaseSettings = () => (
    <div className="space-y-6">
      {/* Detected from .env files */}
      {envDatabaseConfig && (envDatabaseConfig.dev?.hasConfig || envDatabaseConfig.prod?.hasConfig) && (
        <div className="glass rounded-xl p-6 border border-green-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <CheckCircle className="text-green-400" size={20} />
              Detected from .env Files
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetchEnvDb()}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <button
                onClick={applyEnvDatabaseConfig}
                className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors flex items-center gap-2"
              >
                <CheckCircle size={14} />
                Apply to Settings
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {envDatabaseConfig.dev?.hasConfig && (
              <div className="p-3 bg-black/30 rounded-lg">
                <div className="text-xs text-slate-400 mb-1">Development (from {envDatabaseConfig.dev.source})</div>
                <div className="text-white font-mono text-sm">{envDatabaseConfig.dev.database}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Host: {envDatabaseConfig.dev.host}:{envDatabaseConfig.dev.port} | SSL: {envDatabaseConfig.dev.sslMode}
                </div>
              </div>
            )}
            {envDatabaseConfig.prod?.hasConfig && (
              <div className="p-3 bg-black/30 rounded-lg">
                <div className="text-xs text-slate-400 mb-1">Production (from {envDatabaseConfig.prod.source})</div>
                <div className="text-white font-mono text-sm">{envDatabaseConfig.prod.database}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Host: {envDatabaseConfig.prod.host}:{envDatabaseConfig.prod.port} | SSL: {envDatabaseConfig.prod.sslMode}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Database className="text-green-400" size={20} />
          PostgreSQL Connection
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
            <input
              type="checkbox"
              id="useLocalhost"
              checked={settings.database.useLocalhost}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                database: { ...prev.database, useLocalhost: e.target.checked }
              }))}
              className="w-4 h-4 accent-green-500"
            />
            <label htmlFor="useLocalhost" className="text-white">Use localhost connection</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Host</label>
              <input
                type="text"
                value={settings.database.host}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  database: { ...prev.database, host: e.target.value }
                }))}
                disabled={settings.database.useLocalhost}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-green-500/50 focus:outline-none disabled:opacity-50"
                placeholder="localhost"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Port</label>
              <input
                type="number"
                value={settings.database.port}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  database: { ...prev.database, port: parseInt(e.target.value) }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-green-500/50 focus:outline-none"
                placeholder="5432"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Master User</label>
              <input
                type="text"
                value={settings.database.masterUser}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  database: { ...prev.database, masterUser: e.target.value }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-green-500/50 focus:outline-none"
                placeholder="postgres"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Master Password</label>
              <div className="relative">
                <input
                  type={showPasswords['masterPassword'] ? 'text' : 'password'}
                  value={settings.database.masterPassword}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    database: { ...prev.database, masterPassword: e.target.value }
                  }))}
                  className="w-full bg-black/50 text-white p-3 pr-10 rounded-lg border border-white/10 focus:border-green-500/50 focus:outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('masterPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPasswords['masterPassword'] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Database Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Dev Database Name</label>
              <input
                type="text"
                value={settings.database.devDatabase}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  database: { ...prev.database, devDatabase: e.target.value }
                }))}
                list="available-databases-list"
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-green-500/50 focus:outline-none"
                placeholder="myapp_dev"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Prod Database Name</label>
              <input
                type="text"
                value={settings.database.prodDatabase}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  database: { ...prev.database, prodDatabase: e.target.value }
                }))}
                list="available-databases-list"
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-green-500/50 focus:outline-none"
                placeholder="myapp_prod"
              />
            </div>
          </div>

          {/* Datalist for autocomplete (hidden, populated when databases loaded) */}
          {availableDatabases?.databases?.length > 0 && (
            <datalist id="available-databases-list">
              {availableDatabases.databases.map((db: string) => (
                <option key={db} value={db} />
              ))}
            </datalist>
          )}

          {/* Quick actions for database detection */}
          <div className="p-3 bg-black/20 rounded-lg border border-white/5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    refetchEnvDb()
                    // Auto-apply after refetch
                    setTimeout(() => {
                      if (envDatabaseConfig?.dev?.hasConfig || envDatabaseConfig?.prod?.hasConfig) {
                        applyEnvDatabaseConfig()
                      }
                    }, 500)
                  }}
                  className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs transition-colors flex items-center gap-1.5"
                >
                  <Database size={12} />
                  Detect from .env
                </button>
                {settings.database.masterPassword && (
                  <button
                    onClick={() => refetchAvailableDb()}
                    disabled={isFetchingDatabases}
                    className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {isFetchingDatabases ? (
                      <Loader className="animate-spin" size={12} />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    {availableDatabases?.databases?.length > 0 
                      ? `${availableDatabases.databases.length} DBs` 
                      : 'Load DB list'}
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Or type database names manually
              </div>
            </div>
            {availableDatabases?.error && (
              <div className="text-xs text-rose-400 mt-2">
                {availableDatabases.error}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">SSL Mode</label>
            <div className="relative">
              <select
                value={settings.database.sslMode}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  database: { ...prev.database, sslMode: e.target.value }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-green-500/50 focus:outline-none appearance-none"
              >
                <option value="disable">Disable</option>
                <option value="prefer">Prefer</option>
                <option value="require">Require</option>
                <option value="verify-ca">Verify CA</option>
                <option value="verify-full">Verify Full</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderBuildSettings = () => (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Play className="text-yellow-400" size={20} />
          Build Engine Configuration
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoDetect"
                checked={settings.build.autoDetect}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  build: { ...prev.build, autoDetect: e.target.checked }
                }))}
                className="w-4 h-4 accent-yellow-500"
              />
              <label htmlFor="autoDetect" className="text-white">Auto-detect build scripts from package.json</label>
            </div>
            <button
              onClick={() => detectScriptsMutation.mutate(settings.development.path)}
              disabled={detectScriptsMutation.isPending}
              className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm hover:bg-yellow-500/30 transition-colors flex items-center gap-2"
            >
              {detectScriptsMutation.isPending ? (
                <Loader className="animate-spin" size={14} />
              ) : (
                <RefreshCw size={14} />
              )}
              Detect
            </button>
          </div>

          {settings.build.detectedScripts.length > 0 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="text-sm text-yellow-300 mb-2">Detected Scripts:</div>
              <div className="flex flex-wrap gap-2">
                {settings.build.detectedScripts.map((script, idx) => (
                  <span key={idx} className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                    {script}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Dev Build Script</label>
              <div className="relative">
                <select
                  value={settings.build.devBuildScript}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    build: { ...prev.build, devBuildScript: e.target.value }
                  }))}
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-yellow-500/50 focus:outline-none appearance-none"
                >
                  <option value="">Select script...</option>
                  {settings.build.detectedScripts.map((script, idx) => (
                    <option key={idx} value={`npm run ${script}`}>npm run {script}</option>
                  ))}
                  <option value="npm run build">npm run build</option>
                  <option value="npm run build:dev">npm run build:dev</option>
                  <option value="yarn build">yarn build</option>
                  <option value="pnpm build">pnpm build</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Prod Build Script</label>
              <div className="relative">
                <select
                  value={settings.build.prodBuildScript}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    build: { ...prev.build, prodBuildScript: e.target.value }
                  }))}
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-yellow-500/50 focus:outline-none appearance-none"
                >
                  <option value="">Select script...</option>
                  {settings.build.detectedScripts.map((script, idx) => (
                    <option key={idx} value={`npm run ${script}`}>npm run {script}</option>
                  ))}
                  <option value="npm run build">npm run build</option>
                  <option value="npm run build:prod">npm run build:prod</option>
                  <option value="yarn build">yarn build</option>
                  <option value="pnpm build">pnpm build</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Build Directory (optional)</label>
              <input
                type="text"
                value={settings.build.buildDirectory}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  build: { ...prev.build, buildDirectory: e.target.value }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-yellow-500/50 focus:outline-none"
                placeholder="Leave empty for project root"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Output Directory</label>
              <input
                type="text"
                value={settings.build.outputDirectory}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  build: { ...prev.build, outputDirectory: e.target.value }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-yellow-500/50 focus:outline-none"
                placeholder=".next, dist, build..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderPM2Settings = () => (
    <div className="space-y-6">
      {/* Development PM2 */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Box className="text-sky-400" size={20} />
          PM2 Development Process
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Process Name</label>
            <div className="relative">
              <select
                value={settings.pm2.dev.name}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  pm2: { ...prev.pm2, dev: { ...prev.pm2.dev, name: e.target.value } }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none appearance-none"
              >
                <option value="">Select PM2 process...</option>
                {pm2Processes?.processes?.map((p: any, idx: number) => (
                  <option key={idx} value={p.name}>{p.name} ({p.pm2_env?.exec_mode || 'fork'})</option>
                ))}
                <option value="custom">Custom name...</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Execution Mode</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="devMode"
                    checked={settings.pm2.dev.mode === 'fork'}
                    onChange={() => setSettings(prev => ({
                      ...prev,
                      pm2: { ...prev.pm2, dev: { ...prev.pm2.dev, mode: 'fork' } }
                    }))}
                    className="w-4 h-4 accent-sky-500"
                  />
                  <span className="text-white">Fork</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="devMode"
                    checked={settings.pm2.dev.mode === 'cluster'}
                    onChange={() => setSettings(prev => ({
                      ...prev,
                      pm2: { ...prev.pm2, dev: { ...prev.pm2.dev, mode: 'cluster' } }
                    }))}
                    className="w-4 h-4 accent-sky-500"
                  />
                  <span className="text-white">Cluster</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Instances</label>
              <input
                type="number"
                value={settings.pm2.dev.instances}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  pm2: { ...prev.pm2, dev: { ...prev.pm2.dev, instances: parseInt(e.target.value) } }
                }))}
                min={1}
                disabled={settings.pm2.dev.mode === 'fork'}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Max Memory</label>
              <input
                type="text"
                value={settings.pm2.dev.maxMemory}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  pm2: { ...prev.pm2, dev: { ...prev.pm2.dev, maxMemory: e.target.value } }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                placeholder="512M"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer p-2">
                <input
                  type="checkbox"
                  checked={settings.pm2.dev.autoRestart}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    pm2: { ...prev.pm2, dev: { ...prev.pm2.dev, autoRestart: e.target.checked } }
                  }))}
                  className="w-4 h-4 accent-sky-500"
                />
                <span className="text-white text-sm">Auto Restart</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2">
                <input
                  type="checkbox"
                  checked={settings.pm2.dev.watchEnabled}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    pm2: { ...prev.pm2, dev: { ...prev.pm2.dev, watchEnabled: e.target.checked } }
                  }))}
                  className="w-4 h-4 accent-sky-500"
                />
                <span className="text-white text-sm">Watch Files</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Production PM2 */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Box className="text-emerald-400" size={20} />
          PM2 Production Process
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Process Name</label>
            <div className="relative">
              <select
                value={settings.pm2.prod.name}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  pm2: { ...prev.pm2, prod: { ...prev.pm2.prod, name: e.target.value } }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none appearance-none"
              >
                <option value="">Select PM2 process...</option>
                {pm2Processes?.processes?.map((p: any, idx: number) => (
                  <option key={idx} value={p.name}>{p.name} ({p.pm2_env?.exec_mode || 'fork'})</option>
                ))}
                <option value="custom">Custom name...</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Execution Mode</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="prodMode"
                    checked={settings.pm2.prod.mode === 'fork'}
                    onChange={() => setSettings(prev => ({
                      ...prev,
                      pm2: { ...prev.pm2, prod: { ...prev.pm2.prod, mode: 'fork' } }
                    }))}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <span className="text-white">Fork</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="prodMode"
                    checked={settings.pm2.prod.mode === 'cluster'}
                    onChange={() => setSettings(prev => ({
                      ...prev,
                      pm2: { ...prev.pm2, prod: { ...prev.pm2.prod, mode: 'cluster' } }
                    }))}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <span className="text-white">Cluster</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Instances</label>
              <input
                type="number"
                value={settings.pm2.prod.instances}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  pm2: { ...prev.pm2, prod: { ...prev.pm2.prod, instances: parseInt(e.target.value) } }
                }))}
                min={1}
                disabled={settings.pm2.prod.mode === 'fork'}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Max Memory</label>
              <input
                type="text"
                value={settings.pm2.prod.maxMemory}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  pm2: { ...prev.pm2, prod: { ...prev.pm2.prod, maxMemory: e.target.value } }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none"
                placeholder="1G"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer p-2">
                <input
                  type="checkbox"
                  checked={settings.pm2.prod.autoRestart}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    pm2: { ...prev.pm2, prod: { ...prev.pm2.prod, autoRestart: e.target.checked } }
                  }))}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-white text-sm">Auto Restart</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2">
                <input
                  type="checkbox"
                  checked={settings.pm2.prod.watchEnabled}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    pm2: { ...prev.pm2, prod: { ...prev.pm2.prod, watchEnabled: e.target.checked } }
                  }))}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-white text-sm">Watch Files</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNginxSettings = () => (
    <div className="space-y-6">
      {/* Development Nginx */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="text-sky-400" size={20} />
          Nginx Development Site
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Site Name</label>
            <div className="relative">
              <select
                value={settings.nginx.dev.siteName}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  nginx: { ...prev.nginx, dev: { ...prev.nginx.dev, siteName: e.target.value } }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none appearance-none"
              >
                <option value="">Select site...</option>
                {nginxSites?.sites?.map((site: string, idx: number) => (
                  <option key={idx} value={site}>{site}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Server Name</label>
              <input
                type="text"
                value={settings.nginx.dev.serverName}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  nginx: { ...prev.nginx, dev: { ...prev.nginx.dev, serverName: e.target.value } }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                placeholder="dev.example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Proxy Port</label>
              <input
                type="number"
                value={settings.nginx.dev.port}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  nginx: { ...prev.nginx, dev: { ...prev.nginx.dev, port: parseInt(e.target.value) } }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
            <input
              type="checkbox"
              id="devSsl"
              checked={settings.nginx.dev.sslEnabled}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                nginx: { ...prev.nginx, dev: { ...prev.nginx.dev, sslEnabled: e.target.checked } }
              }))}
              className="w-4 h-4 accent-sky-500"
            />
            <label htmlFor="devSsl" className="text-white">SSL Enabled</label>
          </div>

          {settings.nginx.dev.sslEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">SSL Certificate Path</label>
                <input
                  type="text"
                  value={settings.nginx.dev.sslCertPath}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    nginx: { ...prev.nginx, dev: { ...prev.nginx.dev, sslCertPath: e.target.value } }
                  }))}
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">SSL Key Path</label>
                <input
                  type="text"
                  value={settings.nginx.dev.sslKeyPath}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    nginx: { ...prev.nginx, dev: { ...prev.nginx.dev, sslKeyPath: e.target.value } }
                  }))}
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Production Nginx */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="text-emerald-400" size={20} />
          Nginx Production Site
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Site Name</label>
            <div className="relative">
              <select
                value={settings.nginx.prod.siteName}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  nginx: { ...prev.nginx, prod: { ...prev.nginx.prod, siteName: e.target.value } }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none appearance-none"
              >
                <option value="">Select site...</option>
                {nginxSites?.sites?.map((site: string, idx: number) => (
                  <option key={idx} value={site}>{site}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Server Name</label>
              <input
                type="text"
                value={settings.nginx.prod.serverName}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  nginx: { ...prev.nginx, prod: { ...prev.nginx.prod, serverName: e.target.value } }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none"
                placeholder="example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Proxy Port</label>
              <input
                type="number"
                value={settings.nginx.prod.port}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  nginx: { ...prev.nginx, prod: { ...prev.nginx.prod, port: parseInt(e.target.value) } }
                }))}
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
            <input
              type="checkbox"
              id="prodSsl"
              checked={settings.nginx.prod.sslEnabled}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                nginx: { ...prev.nginx, prod: { ...prev.nginx.prod, sslEnabled: e.target.checked } }
              }))}
              className="w-4 h-4 accent-emerald-500"
            />
            <label htmlFor="prodSsl" className="text-white">SSL Enabled</label>
          </div>

          {settings.nginx.prod.sslEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">SSL Certificate Path</label>
                <input
                  type="text"
                  value={settings.nginx.prod.sslCertPath}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    nginx: { ...prev.nginx, prod: { ...prev.nginx.prod, sslCertPath: e.target.value } }
                  }))}
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">SSL Key Path</label>
                <input
                  type="text"
                  value={settings.nginx.prod.sslKeyPath}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    nginx: { ...prev.nginx, prod: { ...prev.nginx.prod, sslKeyPath: e.target.value } }
                  }))}
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderServerSettings = () => (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Package className="text-purple-400" size={20} />
          Server Information
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-black/30 rounded-lg">
            <div className="text-sm text-slate-400 mb-1">Hostname</div>
            <div className="text-white font-medium">{settings.server.hostname || 'Loading...'}</div>
          </div>
          <div className="p-4 bg-black/30 rounded-lg">
            <div className="text-sm text-slate-400 mb-1">Operating System</div>
            <div className="text-white font-medium">{settings.server.os || 'Loading...'}</div>
          </div>
          <div className="p-4 bg-black/30 rounded-lg">
            <div className="text-sm text-slate-400 mb-1">Node.js Version</div>
            <div className="text-white font-medium">{settings.server.nodeVersion || 'Loading...'}</div>
          </div>
          <div className="p-4 bg-black/30 rounded-lg">
            <div className="text-sm text-slate-400 mb-1">npm Version</div>
            <div className="text-white font-medium">{settings.server.npmVersion || 'Loading...'}</div>
          </div>
          <div className="p-4 bg-black/30 rounded-lg">
            <div className="text-sm text-slate-400 mb-1">Python Version</div>
            <div className="text-white font-medium">{settings.server.pythonVersion || 'Loading...'}</div>
          </div>
          <div className="p-4 bg-black/30 rounded-lg">
            <div className="text-sm text-slate-400 mb-1">Last Package Update</div>
            <div className="text-white font-medium">{settings.server.lastPackageUpdate || 'Never'}</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Terminal className="text-orange-400" size={20} />
          System Updates
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
            <input
              type="checkbox"
              id="autoUpdates"
              checked={settings.server.autoUpdates}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                server: { ...prev.server, autoUpdates: e.target.checked }
              }))}
              className="w-4 h-4 accent-orange-500"
            />
            <label htmlFor="autoUpdates" className="text-white">Enable automatic security updates</label>
          </div>

          <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-orange-400 mt-0.5" size={20} />
              <div>
                <div className="text-orange-300 font-medium mb-1">Package Management</div>
                <p className="text-sm text-orange-200/70">
                  Use the Troubleshooting page to manage system packages, clear caches, and run system updates.
                  Automatic updates only apply to security patches.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'development': return renderDevelopmentSettings()
      case 'production': return renderProductionSettings()
      case 'database': return renderDatabaseSettings()
      case 'build': return renderBuildSettings()
      case 'pm2': return renderPM2Settings()
      case 'nginx': return renderNginxSettings()
      case 'server': return renderServerSettings()
      default: return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="animate-spin text-slate-400" size={32} />
        <span className="ml-3 text-slate-400">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SettingsIcon className="text-slate-400" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="text-slate-400">Configure your build dashboard and server settings</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Reload
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader className="animate-spin" size={16} />
                Saving...
              </>
            ) : saveStatus === 'success' ? (
              <>
                <CheckCircle size={16} />
                Saved!
              </>
            ) : saveStatus === 'error' ? (
              <>
                <XCircle size={16} />
                Error
              </>
            ) : (
              <>
                <Save size={16} />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Left Sidebar Menu */}
        <div className="w-64 flex-shrink-0">
          <div className="glass rounded-xl p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs opacity-70">{item.description}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
