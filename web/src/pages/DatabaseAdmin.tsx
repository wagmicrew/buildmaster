import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { Database, Play, FileText, AlertTriangle, CheckCircle, XCircle, Loader, Copy, Download, Trash2, Eye, EyeOff, Server, RefreshCw, Inbox, Plus, X, Edit, Save, Wrench, UserPlus, Shield, Zap } from 'lucide-react'

type DatabaseTabType = 'migrations' | 'setup' | 'sync' | 'backups' | 'crud' | 'env-editor' | 'toolkit'

export default function DatabaseAdmin() {
  const [selectedEnvironment, setSelectedEnvironment] = useState<'dev' | 'prod'>('dev')
  const [selectedMigration, setSelectedMigration] = useState<any>(null)
  const [showSqlContent, setShowSqlContent] = useState(false)
  const [customSql, setCustomSql] = useState('')
  const [sqlResult, setSqlResult] = useState<any>(null)
  const [showExecuteDialog, setShowExecuteDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<DatabaseTabType>('migrations')
  const [newDevDbUrl, setNewDevDbUrl] = useState('')
  const [newProdDbUrl, setNewProdDbUrl] = useState('')
  const [setupFeedback, setSetupFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Sync tab state - source/target determined by selectedEnvironment
  const syncSource = selectedEnvironment // Source is the selected environment
  const syncTarget = selectedEnvironment === 'dev' ? 'prod' : 'dev' // Target is the opposite
  const [syncType, setSyncType] = useState<'schema_only' | 'full_data' | 'tables_only'>('schema_only')
  const [syncTables, setSyncTables] = useState<string[]>([])
  const [syncResult, setSyncResult] = useState<any>(null)

  // Backup tab state - uses selectedEnvironment
  const backupEnv = selectedEnvironment // Backup from selected environment
  const [backupType, setBackupType] = useState<'full' | 'schema_only'>('full')
  const [backupResult, setBackupResult] = useState<any>(null)

  // CRUD tab state - uses selectedEnvironment
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [schemaData, setSchemaData] = useState<any>(null)
  const [tableData, setTableData] = useState<any>(null)
  const [tablePage, setTablePage] = useState(0)
  
  // Table creation state
  const [showCreateTableDialog, setShowCreateTableDialog] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  const [newTableColumns, setNewTableColumns] = useState<Array<{name: string, type: string, nullable: boolean, defaultValue: string}>>([{name: 'id', type: 'SERIAL PRIMARY KEY', nullable: false, defaultValue: ''}])
  
  // Table deletion state
  const [showDeleteTableDialog, setShowDeleteTableDialog] = useState(false)
  const [tableToDelete, setTableToDelete] = useState('')
  const [deleteSanityQuestion, setDeleteSanityQuestion] = useState({num1: 0, num2: 0, answer: 0})
  const [deleteSanityAnswer, setDeleteSanityAnswer] = useState('')

  // Test Database Setup state
  const [testDbName, setTestDbName] = useState('')
  const [testUsername, setTestUsername] = useState('')
  const [testPassword, setTestPassword] = useState('')
  const [cloneFromProd, setCloneFromProd] = useState(true)
  const [testSetupResult, setTestSetupResult] = useState<any>(null)
  // Test database uses selectedEnvironment to determine which directory to update

  // Env Editor state
  const [selectedEnvFile, setSelectedEnvFile] = useState<string>('.env.local')
  const [envFileContent, setEnvFileContent] = useState<string>('')
  const [availableEnvFiles, setAvailableEnvFiles] = useState<string[]>([])
  const [envEditorSaved, setEnvEditorSaved] = useState(false)

  // Toolkit state
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserPrivileges, setNewUserPrivileges] = useState({
    can_login: true,
    can_create_db: false,
    can_create_role: false,
    is_superuser: false
  })
  const [showPrivilegesDialog, setShowPrivilegesDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedPrivTable, setSelectedPrivTable] = useState('')
  const [selectedPrivileges, setSelectedPrivileges] = useState<string[]>([])
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false)
  const [tablesToOptimize, setTablesToOptimize] = useState<string[]>([])

  // Fetch SQL migrations
  const { data: migrations, isLoading: migrationsLoading, refetch: refetchMigrations } = useQuery({
    queryKey: ['sql-migrations', selectedEnvironment],
    queryFn: async () => {
      const response = await api.get(`/troubleshooting/sql-migrations/${selectedEnvironment}`)
      return response.data
    },
  })

  // Check if migration is applied mutation
  const checkMigrationAppliedMutation = useMutation({
    mutationFn: async (filename: string) => {
      const response = await api.get(`/troubleshooting/check-migration-applied/${selectedEnvironment}`, {
        params: { filename }
      })
      return response.data
    }
  })

  // Helper function to check if date is today
  const isToday = (dateString: string) => {
    const migrationDate = new Date(dateString).toDateString()
    const today = new Date().toDateString()
    return migrationDate === today
  }

  // Sort migrations by newest first
  const sortedMigrations = migrations?.migrations?.sort((a: any, b: any) => 
    new Date(b.modified).getTime() - new Date(a.modified).getTime()
  ) || []

  // Fetch dev DB config for Setup tab
  const { data: devDbConfig, isLoading: devDbConfigLoading, refetch: refetchDevDbConfig } = useQuery({
    queryKey: ['db-env-config', 'dev'],
    queryFn: async () => {
      const response = await api.get('/database/env-config/dev')
      return response.data
    },
    enabled: activeTab === 'setup'
  })

  // Fetch prod DB config for Setup tab
  const { data: prodDbConfig, isLoading: prodDbConfigLoading, refetch: refetchProdDbConfig } = useQuery({
    queryKey: ['db-env-config', 'prod'],
    queryFn: async () => {
      const response = await api.get('/database/env-config/prod')
      return response.data
    },
    enabled: activeTab === 'setup'
  })

  // Database selector state
  const [devSelectedDb, setDevSelectedDb] = useState<string>('')
  const [prodSelectedDb, setProdSelectedDb] = useState<string>('')
  
  // Fetch database selector data
  const { data: devSelectorData, refetch: refetchDevSelector } = useQuery({
    queryKey: ['db-selector', 'dev'],
    queryFn: async () => {
      const response = await api.get('/database/selector/dev')
      return response.data
    },
    enabled: activeTab === 'setup'
  })

  const { data: prodSelectorData, refetch: refetchProdSelector } = useQuery({
    queryKey: ['db-selector', 'prod'],
    queryFn: async () => {
      const response = await api.get('/database/selector/prod')
      return response.data
    },
    enabled: activeTab === 'setup'
  })

  // Update selected database when data loads
  useEffect(() => {
    if (devSelectorData?.selected?.database_url) {
      setDevSelectedDb(devSelectorData.selected.database_url)
    }
  }, [devSelectorData])

  useEffect(() => {
    if (prodSelectorData?.selected?.database_url) {
      setProdSelectedDb(prodSelectorData.selected.database_url)
    }
  }, [prodSelectorData])

  // Set database selector mutations
  const setDevDbSelectorMutation = useMutation({
    mutationFn: async (database_url: string) => {
      const response = await api.post('/database/selector/dev', { database_url })
      return response.data
    },
    onSuccess: () => {
      refetchDevSelector()
      refetchDevDbConfig()
    }
  })

  const setProdDbSelectorMutation = useMutation({
    mutationFn: async (database_url: string) => {
      const response = await api.post('/database/selector/prod', { database_url })
      return response.data
    },
    onSuccess: () => {
      refetchProdSelector()
      refetchProdDbConfig()
    }
  })

  // Update DATABASE_URL mutations (both dev and prod)
  const updateDevDbUrlMutation = useMutation({
    mutationFn: async (payload: { database_url: string; files?: string[] }) => {
      const response = await api.post('/database/update-database-url', { environment: 'dev', ...payload })
      return response.data
    },
    onSuccess: (data) => {
      setSetupFeedback({ type: 'success', message: data.message || 'Dev DATABASE_URL updated successfully' })
      setTimeout(() => setSetupFeedback(null), 8000)
      setNewDevDbUrl('')
      refetchDevDbConfig()
    },
    onError: (error: any) => {
      setSetupFeedback({ type: 'error', message: error.response?.data?.detail || 'Failed to update dev DATABASE_URL' })
      setTimeout(() => setSetupFeedback(null), 8000)
    }
  })

  const updateProdDbUrlMutation = useMutation({
    mutationFn: async (payload: { database_url: string; files?: string[] }) => {
      const response = await api.post('/database/update-database-url', { environment: 'prod', ...payload })
      return response.data
    },
    onSuccess: (data) => {
      setSetupFeedback({ type: 'success', message: data.message || 'Prod DATABASE_URL updated successfully' })
      setTimeout(() => setSetupFeedback(null), 8000)
      setNewProdDbUrl('')
      refetchProdDbConfig()
    },
    onError: (error: any) => {
      setSetupFeedback({ type: 'error', message: error.response?.data?.detail || 'Failed to update prod DATABASE_URL' })
      setTimeout(() => setSetupFeedback(null), 8000)
    }
  })

  // Sync commands mutation
  const generateSyncCommandsMutation = useMutation({
    mutationFn: async (payload: { source_env: string; target_env: string; options: any }) => {
      const response = await api.post('/database/sync/commands', payload)
      return response.data
    },
    onSuccess: (data) => {
      setSyncResult(data)
    },
    onError: (error: any) => {
      setSyncResult({ commands: [], warnings: [error.response?.data?.detail || 'Failed to generate sync commands'] })
    }
  })

  // Execute sync mutation
  const executeSyncMutation = useMutation({
    mutationFn: async (payload: { source_env: string; target_env: string; options: any }) => {
      const response = await api.post('/database/sync/commands', { ...payload, execute: true })
      return response.data
    },
    onSuccess: (data) => {
      setSyncResult(data)
    },
    onError: (error: any) => {
      setSyncResult({ commands: [], warnings: [error.response?.data?.detail || 'Failed to execute sync'], executed: false })
    }
  })

  // Backup commands mutation
  const generateBackupCommandsMutation = useMutation({
    mutationFn: async (environment: string) => {
      const response = await api.get(`/database/backup/commands/${environment}?backup_type=${backupType}`)
      return response.data
    },
    onSuccess: (data) => {
      setBackupResult(data)
    },
    onError: (error: any) => {
      setBackupResult({ commands: [], warnings: [error.response?.data?.detail || 'Failed to generate backup commands'] })
    }
  })

  // Execute backup mutation
  const executeBackupMutation = useMutation({
    mutationFn: async (environment: string) => {
      const response = await api.get(`/database/backup/commands/${environment}?backup_type=${backupType}&execute=true`)
      return response.data
    },
    onSuccess: async (data) => {
      setBackupResult(data)
      // Trigger download if backup file was created and exists
      if (data.executed && data.backup_file && data.download_url) {
        const filename = data.backup_file
        try {
          // Small delay to ensure file is fully written
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Download using authenticated API call
          const response = await api.get(data.download_url, {
            responseType: 'blob'
          })
          
          // Create blob and trigger download
          const blob = new Blob([response.data], { type: 'application/sql' })
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
        } catch (error) {
          console.error('Download failed:', error)
        }
      }
    },
    onError: (error: any) => {
      setBackupResult({ commands: [], warnings: [error.response?.data?.detail || 'Failed to execute backup'], executed: false })
    }
  })

  // CRUD schema mutation
  const getSchemaMutation = useMutation({
    mutationFn: async (environment: string) => {
      const response = await api.get(`/database/schema/${environment}`)
      return response.data
    },
    onSuccess: (data) => {
      setSchemaData(data)
      if (data.tables?.length > 0 && !selectedTable) {
        setSelectedTable(data.tables[0].name)
      }
    },
    onError: (error: any) => {
      setSchemaData({ error: error.response?.data?.detail || 'Failed to load schema' })
    }
  })

  // Table data mutation
  const getTableDataMutation = useMutation({
    mutationFn: async ({ environment, table, page }: { environment: string; table: string; page: number }) => {
      const response = await api.get(`/database/query/${environment}/${table}?limit=100&offset=${page * 100}`)
      return response.data
    },
    onSuccess: (data) => {
      setTableData(data)
    },
    onError: (error: any) => {
      setTableData({ error: error.response?.data?.detail || 'Failed to load table data' })
    }
  })

  // Create table mutation
  const createTableMutation = useMutation({
    mutationFn: async ({ environment, tableName, columns }: { environment: string; tableName: string; columns: any[] }) => {
      const response = await api.post(`/database/create-table/${environment}`, {
        table_name: tableName,
        columns: columns
      })
      return response.data
    },
    onSuccess: () => {
      setShowCreateTableDialog(false)
      setNewTableName('')
      setNewTableColumns([{name: 'id', type: 'SERIAL PRIMARY KEY', nullable: false, defaultValue: ''}])
      getSchemaMutation.mutate(selectedEnvironment)
    }
  })

  // Delete table mutation
  const deleteTableMutation = useMutation({
    mutationFn: async ({ environment, tableName }: { environment: string; tableName: string }) => {
      const response = await api.delete(`/database/drop-table/${environment}/${tableName}`)
      return response.data
    },
    onSuccess: () => {
      setShowDeleteTableDialog(false)
      setTableToDelete('')
      setDeleteSanityAnswer('')
      if (selectedTable === tableToDelete) {
        setSelectedTable('')
        setTableData(null)
      }
      getSchemaMutation.mutate(selectedEnvironment)
    }
  })

  // Helper function to generate sanity check
  const generateSanityCheck = () => {
    const num1 = Math.floor(Math.random() * 20) + 1
    const num2 = Math.floor(Math.random() * 20) + 1
    setDeleteSanityQuestion({ num1, num2, answer: num1 + num2 })
  }

  // Test database setup mutation
  const setupTestDbMutation = useMutation({
    mutationFn: async (payload: { db_name: string; username: string; password: string; environment: string; clone_from_prod: boolean }) => {
      const response = await api.post('/database/setup-test', payload)
      return response.data
    },
    onSuccess: (data) => {
      setTestSetupResult(data)
      // Refresh environment config after updating .env files
      if (data.success && selectedEnvironment === 'dev') {
        refetchDevDbConfig()
      } else if (data.success && selectedEnvironment === 'prod') {
        refetchProdDbConfig()
      }
    },
    onError: (error: any) => {
      setTestSetupResult({ success: false, warnings: [error.response?.data?.detail || 'Failed to setup test database'] })
    }
  })

  // Env file list mutation
  const getEnvFilesMutation = useMutation({
    mutationFn: async (environment: string) => {
      const response = await api.get(`/database/env-files/${environment}`)
      return response.data
    },
    onSuccess: (data) => {
      if (data.files && data.files.length > 0) {
        setAvailableEnvFiles(data.files)
        // Auto-select first file if current selection not in list
        if (!data.files.includes(selectedEnvFile)) {
          setSelectedEnvFile(data.files[0])
        }
      }
    }
  })

  // Load env file content mutation
  const loadEnvFileMutation = useMutation({
    mutationFn: async ({ environment, filename }: { environment: string; filename: string }) => {
      const response = await api.get(`/database/env-file/${environment}/${filename}`)
      return response.data
    },
    onSuccess: (data) => {
      setEnvFileContent(data.content || '')
      setEnvEditorSaved(false)
    }
  })

  // Save env file mutation
  const saveEnvFileMutation = useMutation({
    mutationFn: async ({ environment, filename, content }: { environment: string; filename: string; content: string }) => {
      const response = await api.post(`/database/env-file/${environment}/${filename}`, { content })
      return response.data
    },
    onSuccess: () => {
      setEnvEditorSaved(true)
      setTimeout(() => setEnvEditorSaved(false), 3000)
    }
  })

  // Toolkit queries and mutations
  const { data: dbUsers, refetch: refetchDbUsers } = useQuery({
    queryKey: ['db-users', selectedEnvironment],
    queryFn: async () => {
      const response = await api.get(`/database/toolkit/users/${selectedEnvironment}`)
      return response.data
    },
    enabled: activeTab === 'toolkit'
  })

  const createUserMutation = useMutation({
    mutationFn: async (payload: { environment: string; username: string; password: string; privileges: any }) => {
      const response = await api.post(`/database/toolkit/users/${payload.environment}`, {
        username: payload.username,
        password: payload.password,
        privileges: payload.privileges
      })
      return response.data
    },
    onSuccess: () => {
      refetchDbUsers()
      setShowCreateUserDialog(false)
      setNewUsername('')
      setNewUserPassword('')
      setNewUserPrivileges({ can_login: true, can_create_db: false, can_create_role: false, is_superuser: false })
    }
  })

  const deleteUserMutation = useMutation({
    mutationFn: async ({ environment, username }: { environment: string; username: string }) => {
      const response = await api.delete(`/database/toolkit/users/${environment}/${username}`)
      return response.data
    },
    onSuccess: () => {
      refetchDbUsers()
    }
  })

  const grantPrivilegesMutation = useMutation({
    mutationFn: async (payload: { environment: string; username: string; table_name: string; privileges: string[] }) => {
      const response = await api.post('/database/toolkit/privileges/grant', payload)
      return response.data
    },
    onSuccess: () => {
      setShowPrivilegesDialog(false)
      setSelectedUser('')
      setSelectedPrivTable('')
      setSelectedPrivileges([])
    }
  })

  const optimizeTablesMutation = useMutation({
    mutationFn: async (payload: { environment: string; table_names: string[] | null }) => {
      const response = await api.post('/database/toolkit/optimize', payload)
      return response.data
    },
    onSuccess: () => {
      setShowOptimizeDialog(false)
      setTablesToOptimize([])
    }
  })

  // Auto-load schema when CRUD tab is active or environment changes
  useEffect(() => {
    if (activeTab === 'crud' && !getSchemaMutation.isPending) {
      getSchemaMutation.mutate(selectedEnvironment)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedEnvironment])

  // Auto-load table data when table is selected
  useEffect(() => {
    if (activeTab === 'crud' && selectedTable && schemaData?.tables && !getTableDataMutation.isPending) {
      setTablePage(0)
      getTableDataMutation.mutate({ environment: selectedEnvironment, table: selectedTable, page: 0 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, selectedEnvironment])

  // Auto-load env files when env-editor tab is active
  useEffect(() => {
    if (activeTab === 'env-editor' && !getEnvFilesMutation.isPending) {
      getEnvFilesMutation.mutate(selectedEnvironment)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedEnvironment])

  // Auto-load selected env file content when file changes
  useEffect(() => {
    if (activeTab === 'env-editor' && selectedEnvFile && availableEnvFiles.includes(selectedEnvFile) && !loadEnvFileMutation.isPending) {
      loadEnvFileMutation.mutate({ environment: selectedEnvironment, filename: selectedEnvFile })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEnvFile, availableEnvFiles])

  const dbTabs = [
    { id: 'migrations' as DatabaseTabType, label: 'Migrations', icon: FileText },
    { id: 'setup' as DatabaseTabType, label: 'Setup & Tools', icon: Database },
    { id: 'toolkit' as DatabaseTabType, label: 'Database Toolkit', icon: Wrench },
    { id: 'sync' as DatabaseTabType, label: 'Sync', icon: Play },
    { id: 'backups' as DatabaseTabType, label: 'Backups', icon: Download },
    { id: 'crud' as DatabaseTabType, label: 'CRUD Explorer', icon: Database },
    { id: 'env-editor' as DatabaseTabType, label: '.env Editor', icon: Edit },
  ]

  // Execute SQL mutation
  const executeSqlMutation = useMutation({
    mutationFn: async ({ sql, dryRun }: { sql: string; dryRun: boolean }) => {
      const response = await api.post('/troubleshooting/execute-sql', null, {
        params: { sql, dry_run: dryRun }
      })
      return response.data
    },
    onSuccess: (data) => {
      setSqlResult(data)
      if (!data.dry_run) {
        setCustomSql('')
        setShowExecuteDialog(false)
      }
    },
  })

  const handleExecuteSql = (sql: string, dryRun: boolean = true) => {
    executeSqlMutation.mutate({ sql, dryRun })
  }

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql)
  }

  const handleDownloadSql = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Database className="text-green-400" size={32} />
              <div>
                <h1 className="text-4xl font-bold text-white">Database Admin</h1>
                <p className="text-slate-400">SQL Migration Management & Execution</p>
              </div>
            </div>
          </div>

          {/* Environment Selector */}
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
              Development
            </button>
            <button
              onClick={() => setSelectedEnvironment('prod')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedEnvironment === 'prod'
                  ? 'bg-green-500 text-white'
                  : 'bg-white/10 text-slate-400 hover:bg-white/20'
              }`}
            >
              Production
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {dbTabs.map((tab) => {
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

        {activeTab === 'migrations' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SQL Migrations List */}
            <div className="lg:col-span-1">
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">SQL Migrations</h2>
                  <button
                    onClick={() => refetchMigrations()}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <Loader size={16} className="text-slate-400" />
                  </button>
                </div>

                {migrationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="animate-spin text-sky-400" size={24} />
                  </div>
                ) : sortedMigrations && sortedMigrations.length > 0 ? (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {sortedMigrations.map((migration: any, index: number) => {
                      const isTodayMigration = isToday(migration.modified)
                      return (
                        <div key={index} className="space-y-2">
                          <button
                            onClick={() => {
                              setSelectedMigration(migration)
                              setShowSqlContent(true)
                            }}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              selectedMigration?.filename === migration.filename
                                ? 'bg-sky-500/20 border-sky-500/50'
                                : isTodayMigration
                                ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <FileText size={16} className={`mt-1 flex-shrink-0 ${isTodayMigration ? 'text-orange-400' : 'text-sky-400'}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-white text-sm font-medium truncate">
                                    {migration.filename}
                                  </span>
                                  {isTodayMigration && (
                                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full font-medium">
                                      TODAY
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 text-xs mt-1">
                                  {formatBytes(migration.size_bytes)} • {migration.line_count} lines
                                </div>
                                <div className="text-slate-500 text-xs mt-1">
                                  Modified: {new Date(migration.modified).toLocaleDateString()} {new Date(migration.modified).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => checkMigrationAppliedMutation.mutate(migration.filename)}
                            disabled={checkMigrationAppliedMutation.isPending}
                            className="w-full py-2 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-50 text-green-400 text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            {checkMigrationAppliedMutation.isPending ? (
                              <Loader className="animate-spin" size={12} />
                            ) : (
                              <CheckCircle size={12} />
                            )}
                            Check if Applied
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <FileText size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No SQL migrations found</p>
                  </div>
                )}

                {migrations && (
                  <div className="mt-4 pt-4 border-t border-white/10 text-sm text-slate-400">
                    Total: {migrations.total_count} migration{migrations.total_count !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>

            {/* SQL Content & Execution */}
            <div className="lg:col-span-2 space-y-6">
              {/* Selected Migration */}
              {selectedMigration && showSqlContent && (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <FileText className="text-sky-400" size={24} />
                    {selectedMigration.filename}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySql(selectedMigration.content)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      title="Copy SQL"
                    >
                      <Copy size={16} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleDownloadSql(selectedMigration.filename, selectedMigration.content)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      title="Download SQL"
                    >
                      <Download size={16} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => setShowSqlContent(false)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      title="Close"
                    >
                      <EyeOff size={16} className="text-slate-400" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-slate-400 space-y-1">
                    <div>Path: <span className="text-white font-mono">{selectedMigration.path}</span></div>
                    <div>Size: <span className="text-white">{formatBytes(selectedMigration.size_bytes)}</span></div>
                    <div>Lines: <span className="text-white">{selectedMigration.line_count}</span></div>
                  </div>
                </div>

                <pre className="bg-black/50 p-4 rounded-lg text-xs text-slate-300 overflow-auto max-h-96 font-mono border border-white/10">
                  {selectedMigration.content}
                </pre>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      setCustomSql(selectedMigration.content)
                      handleExecuteSql(selectedMigration.content, true)
                    }}
                    className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    Dry Run (Preview)
                  </button>
                  <button
                    onClick={() => {
                      setCustomSql(selectedMigration.content)
                      setShowExecuteDialog(true)
                    }}
                    className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Play size={18} />
                    Execute Migration
                  </button>
                </div>
              </div>
              )}

              {/* Custom SQL Executor */}
              <div className="glass rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Play className="text-green-400" size={24} />
                Custom SQL Executor
              </h2>

              <textarea
                value={customSql}
                onChange={(e) => setCustomSql(e.target.value)}
                placeholder="Enter your SQL query here...&#10;&#10;Examples:&#10;SELECT * FROM users LIMIT 10;&#10;INSERT INTO table_name (column1, column2) VALUES ('value1', 'value2');&#10;UPDATE table_name SET column1 = 'value' WHERE id = 1;"
                className="w-full h-48 bg-black/50 text-white p-4 rounded-lg font-mono text-sm border border-white/10 focus:border-sky-500/50 focus:outline-none resize-none"
              />

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleExecuteSql(customSql, true)}
                  disabled={!customSql.trim() || executeSqlMutation.isPending}
                  className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {executeSqlMutation.isPending ? (
                    <Loader className="animate-spin" size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                  Dry Run
                </button>
                <button
                  onClick={() => setShowExecuteDialog(true)}
                  disabled={!customSql.trim() || executeSqlMutation.isPending}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={18} />
                  Execute SQL
                </button>
                <button
                  onClick={() => {
                    setCustomSql('')
                    setSqlResult(null)
                  }}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              </div>

              {/* SQL Result */}
              {sqlResult && (
              <div className={`glass rounded-2xl p-6 border ${
                sqlResult.success ? 'border-green-500/50' : 'border-rose-500/50'
              }`}>
                <div className="flex items-center gap-2 mb-4">
                  {sqlResult.success ? (
                    <CheckCircle className="text-green-400" size={24} />
                  ) : (
                    <XCircle className="text-rose-400" size={24} />
                  )}
                  <h3 className="text-xl font-semibold text-white">
                    {sqlResult.dry_run ? 'Dry Run Result' : 'Execution Result'}
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className={`p-3 rounded-lg ${
                    sqlResult.success ? 'bg-green-500/20' : 'bg-rose-500/20'
                  }`}>
                    <div className={sqlResult.success ? 'text-green-400' : 'text-rose-400'}>
                      {sqlResult.message}
                    </div>
                  </div>

                  {sqlResult.dry_run && sqlResult.sql && (
                    <div>
                      <div className="text-sm text-slate-400 mb-2">SQL Preview:</div>
                      <pre className="bg-black/50 p-3 rounded-lg text-xs text-slate-300 overflow-auto max-h-48 font-mono">
                        {sqlResult.sql}
                      </pre>
                    </div>
                  )}

                  {sqlResult.rows_affected !== undefined && (
                    <div className="text-sm text-slate-400">
                      Rows affected: <span className="text-white font-semibold">{sqlResult.rows_affected}</span>
                    </div>
                  )}

                  {sqlResult.results && sqlResult.results.length > 0 && (
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Results:</div>
                      <div className="bg-black/50 p-3 rounded-lg overflow-auto max-h-64">
                        <table className="w-full text-xs text-slate-300">
                          <tbody>
                            {sqlResult.results.map((row: any[], index: number) => (
                              <tr key={index} className="border-b border-white/10">
                                {row.map((cell: any, cellIndex: number) => (
                                  <td key={cellIndex} className="p-2 font-mono">
                                    {String(cell)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          </div>
        )}

        {/* Execute Confirmation Dialog */}
        {showExecuteDialog && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-6 max-w-2xl w-full">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-yellow-400" size={32} />
                <h3 className="text-2xl font-bold text-white">Confirm SQL Execution</h3>
              </div>

              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
                <p className="text-yellow-400 font-medium">
                  ⚠️ You are about to execute SQL directly on the {selectedEnvironment === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT'} database!
                </p>
                <p className="text-yellow-300 text-sm mt-2">
                  This action cannot be undone. Please review the SQL carefully before proceeding.
                </p>
              </div>

              <div className="mb-4">
                <div className="text-sm text-slate-400 mb-2">SQL to execute:</div>
                <pre className="bg-black/50 p-3 rounded-lg text-xs text-slate-300 overflow-auto max-h-48 font-mono border border-white/10">
                  {customSql}
                </pre>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowExecuteDialog(false)}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleExecuteSql(customSql, false)}
                  disabled={executeSqlMutation.isPending}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {executeSqlMutation.isPending ? (
                    <>
                      <Loader className="animate-spin" size={18} />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Execute Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="space-y-6 mt-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Database Setup & Tools</h2>
              <p className="text-slate-400 text-sm mb-4">
                Configure a dedicated development database and preview connection settings. Changes should only be applied
                to the development environment. Production database configuration must always be updated with extreme
                care and preferably via infrastructure scripts.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4 text-sm text-yellow-300">
                <div className="font-semibold mb-1">Warning</div>
                <p>
                  This section is intended for managing <span className="font-semibold">development</span> database
                  connections. Do not point production to a temporary or experimental database from here. Any future
                  automation for PROD will include multiple confirmation steps.
                </p>
              </div>
            </div>

            {/* Feedback Banner */}
            {setupFeedback && (
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                setupFeedback.type === 'success' 
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : 'bg-rose-500/20 border-rose-500/50 text-rose-400'
              }`}>
                {setupFeedback.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                {setupFeedback.message}
              </div>
            )}

            {/* Current DB Configuration - Dev */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Server className="text-sky-400" size={20} />
                  Development Database Configuration
                </h3>
                <button
                  onClick={() => refetchDevDbConfig()}
                  disabled={devDbConfigLoading}
                  className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <RefreshCw size={16} className={`text-slate-400 ${devDbConfigLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {devDbConfigLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="animate-spin text-sky-400" size={24} />
                </div>
              ) : devDbConfig ? (
                <div className="space-y-3">
                  {devDbConfig.env_files?.map((file: any, index: number) => (
                    <div key={index} className="bg-white/5 p-4 rounded-lg border border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-sky-400" />
                          <span className="text-white font-mono text-sm">{file.name}</span>
                          {!file.exists && <span className="text-slate-500 text-xs">(not found)</span>}
                        </div>
                        {file.has_database_url ? (
                          <CheckCircle size={16} className="text-green-400" />
                        ) : (
                          <XCircle size={16} className="text-slate-500" />
                        )}
                      </div>
                      
                      {file.has_database_url && (
                        <>
                          <div className="mt-2 text-xs font-mono text-slate-300 bg-black/30 p-2 rounded break-all">
                            {file.database_url_display}
                          </div>
                          {file.parsed && (
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              <div><span className="text-slate-500">Host:</span> <span className="text-white">{file.parsed.host || 'N/A'}</span></div>
                              <div><span className="text-slate-500">Port:</span> <span className="text-white">{file.parsed.port || 'N/A'}</span></div>
                              <div><span className="text-slate-500">Database:</span> <span className="text-white">{file.parsed.database || 'N/A'}</span></div>
                              <div><span className="text-slate-500">User:</span> <span className="text-white">{file.parsed.username || 'N/A'}</span></div>
                            </div>
                          )}
                          {file.warnings && file.warnings.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {file.warnings.map((warning: any, wIdx: number) => (
                                <div key={wIdx} className="flex items-start gap-2 text-xs text-orange-400">
                                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                                  <span>{warning.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-400 text-sm">No configuration data available</div>
              )}
            </div>

            {/* Database Selector - Dev */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Database className="text-sky-400" size={20} />
                  Select Development Database
                </h3>
                <button
                  onClick={() => refetchDevSelector()}
                  disabled={devSelectorData === undefined}
                  className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <RefreshCw size={16} className={`text-slate-400`} />
                </button>
              </div>

              {devSelectorData ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Available Databases</label>
                    <select
                      value={devSelectedDb}
                      onChange={(e) => setDevSelectedDb(e.target.value)}
                      className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none font-mono text-sm"
                    >
                      <option value="">-- Select a database --</option>
                      {(devSelectorData as any).available?.map((db: any, idx: number) => (
                        <option key={idx} value={db.database_url}>
                          {db.database_name} ({db.username}@{db.host}:{db.port}) - from {db.source_file}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(devSelectorData as any).selected && (
                    <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 text-xs">
                      <div className="text-sky-300 font-semibold mb-1">Currently Selected:</div>
                      <div className="text-slate-300 font-mono break-all">{(devSelectorData as any).selected.database_url}</div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (devSelectedDb) {
                        setDevDbSelectorMutation.mutate(devSelectedDb)
                      }
                    }}
                    disabled={!devSelectedDb || setDevDbSelectorMutation.isPending}
                    className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {setDevDbSelectorMutation.isPending ? (
                      <>
                        <Loader className="animate-spin" size={18} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Database size={18} />
                        Save Development Database Selection
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader className="animate-spin text-sky-400" size={24} />
                </div>
              )}
            </div>

            {/* Database Selector - Prod */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Database className="text-green-400" size={20} />
                  Select Production Database
                </h3>
                <button
                  onClick={() => refetchProdSelector()}
                  disabled={prodSelectorData === undefined}
                  className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <RefreshCw size={16} className={`text-slate-400`} />
                </button>
              </div>

              {prodSelectorData ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Available Databases</label>
                    <select
                      value={prodSelectedDb}
                      onChange={(e) => setProdSelectedDb(e.target.value)}
                      className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-green-500/50 focus:outline-none font-mono text-sm"
                    >
                      <option value="">-- Select a database --</option>
                      {(prodSelectorData as any).available?.map((db: any, idx: number) => (
                        <option key={idx} value={db.database_url}>
                          {db.database_name} ({db.username}@{db.host}:{db.port}) - from {db.source_file}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(prodSelectorData as any).selected && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-xs">
                      <div className="text-green-300 font-semibold mb-1">Currently Selected:</div>
                      <div className="text-slate-300 font-mono break-all">{(prodSelectorData as any).selected.database_url}</div>
                    </div>
                  )}

                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300 mb-4">
                    <div className="font-semibold mb-1">⚠️ Production Warning</div>
                    <p>Changing the production database selection affects all production operations. Use with extreme caution.</p>
                  </div>

                  <button
                    onClick={() => {
                      if (prodSelectedDb) {
                        setProdDbSelectorMutation.mutate(prodSelectedDb)
                      }
                    }}
                    disabled={!prodSelectedDb || setProdDbSelectorMutation.isPending}
                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {setProdDbSelectorMutation.isPending ? (
                      <>
                        <Loader className="animate-spin" size={18} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Database size={18} />
                        Save Production Database Selection
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader className="animate-spin text-green-400" size={24} />
                </div>
              )}
            </div>

            {/* Current DB Configuration - Prod */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Server className="text-green-400" size={20} />
                  Production Database Configuration
                </h3>
                <button
                  onClick={() => refetchProdDbConfig()}
                  disabled={prodDbConfigLoading}
                  className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <RefreshCw size={16} className={`text-slate-400 ${prodDbConfigLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {prodDbConfigLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="animate-spin text-green-400" size={24} />
                </div>
              ) : prodDbConfig ? (
                <div className="space-y-3">
                  {prodDbConfig.env_files?.map((file: any, index: number) => (
                    <div key={index} className="bg-white/5 p-4 rounded-lg border border-white/10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-green-400" />
                          <span className="text-white font-mono text-sm">{file.name}</span>
                          {!file.exists && <span className="text-slate-500 text-xs">(not found)</span>}
                        </div>
                        {file.has_database_url ? (
                          <CheckCircle size={16} className="text-green-400" />
                        ) : (
                          <XCircle size={16} className="text-slate-500" />
                        )}
                      </div>
                      
                      {file.has_database_url && (
                        <>
                          <div className="mt-2 text-xs font-mono text-slate-300 bg-black/30 p-2 rounded break-all">
                            {file.database_url_display}
                          </div>
                          {file.parsed && (
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              <div><span className="text-slate-500">Host:</span> <span className="text-white">{file.parsed.host || 'N/A'}</span></div>
                              <div><span className="text-slate-500">Port:</span> <span className="text-white">{file.parsed.port || 'N/A'}</span></div>
                              <div><span className="text-slate-500">Database:</span> <span className="text-white">{file.parsed.database || 'N/A'}</span></div>
                              <div><span className="text-slate-500">User:</span> <span className="text-white">{file.parsed.username || 'N/A'}</span></div>
                            </div>
                          )}
                          {file.warnings && file.warnings.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {file.warnings.map((warning: any, wIdx: number) => (
                                <div key={wIdx} className="flex items-start gap-2 text-xs text-orange-400">
                                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                                  <span>{warning.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-400 text-sm">No configuration data available</div>
              )}
            </div>

            {/* Update Dev DATABASE_URL */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Database className="text-sky-400" size={20} />
                Update Development DATABASE_URL
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">
                  New Database URL for Dev <span className="font-mono text-xs">(e.g., postgresql://user:password@localhost:5432/dbname)</span>
                </label>
                <input
                  type="text"
                  value={newDevDbUrl}
                  onChange={(e) => setNewDevDbUrl(e.target.value)}
                  placeholder="postgresql://dev_user:strong_password@localhost:5432/dev_database"
                  className="w-full bg-black/50 text-white p-3 rounded-lg font-mono text-sm border border-white/10 focus:border-sky-500/50 focus:outline-none"
                />
              </div>

              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 text-xs text-sky-300 mb-4">
                <div className="font-semibold mb-1">ℹ️ What this does</div>
                <p>
                  This will update <span className="font-mono">.env.local</span> in the dev directory with the new DATABASE_URL.
                  The dev server must be restarted for changes to take effect.
                </p>
              </div>

              <button
                onClick={() => updateDevDbUrlMutation.mutate({ database_url: newDevDbUrl, files: ['.env.local'] })}
                disabled={!newDevDbUrl.trim() || updateDevDbUrlMutation.isPending}
                className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {updateDevDbUrlMutation.isPending ? (
                  <>
                    <Loader className="animate-spin" size={18} />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Apply to Dev .env.local
                  </>
                )}
              </button>
            </div>

            {/* Production DATABASE_URL Update */}
            <div className="glass rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="text-green-400" size={20} />
            Update Production DATABASE_URL
          </h3>
          <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-4 text-sm text-rose-300 mb-4">
            <div className="font-semibold mb-1">⚠️ Production Warning</div>
            <p className="mb-2">
              Changing the production DATABASE_URL will immediately affect all live users. This should only be done
              during maintenance windows or when migrating databases.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Verify the new database exists and is accessible</li>
              <li>Test with a small subset of data first</li>
              <li>Have a rollback plan ready</li>
              <li>Consider notifying users of potential downtime</li>
            </ul>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">New Production DATABASE_URL</label>
              <input
                type="text"
                value={newProdDbUrl}
                onChange={(e) => setNewProdDbUrl(e.target.value)}
                placeholder="postgresql://user:password@localhost:5432/trafikskolaxv2"
                className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none font-mono text-sm"
              />
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300">
              <div className="font-semibold mb-1">🔒 Safety Notice</div>
              <p>
                This will update <span className="font-mono">.env.local</span> in the production directory.
                The production server must be restarted for changes to take effect.
              </p>
            </div>

            <button
              onClick={() => updateProdDbUrlMutation.mutate({ database_url: newProdDbUrl, files: ['.env.local'] })}
              disabled={!newProdDbUrl.trim() || updateProdDbUrlMutation.isPending}
              className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {updateProdDbUrlMutation.isPending ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  Updating...
                </>
              ) : (
                <>
                  <AlertTriangle size={18} />
                  Update Production DATABASE_URL
                </>
              )}
            </button>
          </div>
        </div>

        {/* Test Database Setup Section */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Database size={20} />
            Setup Test Database
          </h3>
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4 text-sm text-emerald-300 mb-4">
            <div className="font-semibold mb-1">Automated Test Environment</div>
            <p className="mb-2">
              Create a fresh test database with a dedicated user, optionally pre-filled with production data.
              This will automatically configure the dev environment's .env files.
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Creates new database and user with secure permissions</li>
              <li>Optionally clones production data for realistic testing</li>
              <li>Updates all .env files in /var/www/dintrafikskolax_dev/</li>
              <li>Safely isolated from production and main dev databases</li>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Database Name</label>
                <input
                  type="text"
                  value={testDbName}
                  onChange={(e) => setTestDbName(e.target.value)}
                  placeholder="trafikskolax_test_v2"
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Username</label>
                <input
                  type="text"
                  value={testUsername}
                  onChange={(e) => setTestUsername(e.target.value)}
                  placeholder="test_user"
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Password</label>
                <input
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  placeholder="secure_password_123"
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="cloneFromProd"
                checked={cloneFromProd}
                onChange={(e) => setCloneFromProd(e.target.checked)}
                className="w-4 h-4 text-sky-500 bg-black/50 border-white/20 rounded focus:ring-sky-500"
              />
              <label htmlFor="cloneFromProd" className="text-sm text-slate-300">
                Clone production data into test database
              </label>
            </div>

            {/* Button State Indicator */}
            {(!testDbName.trim() || !testUsername.trim() || !testPassword.trim()) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-xs text-yellow-300 mb-3">
                ⚠️ Please fill in all fields: Database Name, Username, and Password
              </div>
            )}

            <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 mb-4 text-xs text-sky-300">
              <div className="font-semibold mb-1">ℹ️ Environment Selection</div>
              <div>Will update all .env* files in: <span className="font-mono">/var/www/dintrafikskolax_{selectedEnvironment === 'dev' ? 'dev' : 'prod'}</span></div>
            </div>

            <button
              onClick={() => {
                console.log('Setup Test DB clicked:', { testDbName, testUsername, testPassword, selectedEnvironment, cloneFromProd })
                setupTestDbMutation.mutate({
                  db_name: testDbName,
                  username: testUsername,
                  password: testPassword,
                  environment: selectedEnvironment,
                  clone_from_prod: cloneFromProd
                })
              }}
              disabled={!testDbName.trim() || !testUsername.trim() || !testPassword.trim() || setupTestDbMutation.isPending}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 relative z-10"
              style={{ pointerEvents: 'auto' }}
              title={(!testDbName.trim() || !testUsername.trim() || !testPassword.trim()) ? 'Please fill in all required fields' : 'Click to setup test database'}
            >
              {setupTestDbMutation.isPending ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  Setting up...
                </>
              ) : (
                <>
                  <Database size={18} />
                  Setup Test Database
                </>
              )}
            </button>
          </div>
        </div>

        {/* Test Database Setup Results */}
        {testSetupResult && (
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Setup Console Output</h3>
              <button
                onClick={() => {
                  const fullOutput = `=== Test Database Setup Output ===\n\nStatus: ${testSetupResult.success ? '✅ SUCCESS' : '❌ FAILED'}\n\n${testSetupResult.warnings && testSetupResult.warnings.length > 0 ? `Warnings:\n${testSetupResult.warnings.map((w: string) => `⚠️  ${w}`).join('\n')}\n\n` : ''}${testSetupResult.success ? `Database URL:\n${testSetupResult.new_database_url}\n\nSQL Commands Executed:\n${testSetupResult.sql_commands.join('\n')}\n\n${testSetupResult.clone_command ? `Clone Command:\n${testSetupResult.clone_command}\n\n` : ''}Environment Files Updated:\n${Object.entries(testSetupResult.env_updates).map(([file, content]: any) => `${file}:\n${content}`).join('\n\n')}` : testSetupResult.error || 'Setup failed'}\n\n=== End Output ===`
                  navigator.clipboard.writeText(fullOutput)
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2 shadow-lg"
              >
                <Copy size={16} />
                Copy to AI
              </button>
            </div>
            
            {/* Console-style output */}
            <div className="bg-black/80 border border-green-500/30 rounded-xl p-4 font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
              {/* Status Line */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-400">$</span>
                <span className="text-slate-300">test-database-setup --execute</span>
              </div>
              
              {/* Warnings */}
              {testSetupResult.warnings && testSetupResult.warnings.length > 0 && (
                <div className="mb-3">
                  {testSetupResult.warnings.map((warning: string, index: number) => (
                    <div key={index} className="flex items-start gap-2 text-orange-400 mb-1">
                      <span>⚠️</span>
                      <span className="break-all">{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Success Output */}
              {testSetupResult.success ? (
                <div className="space-y-2">
                  <div className="text-emerald-400">✅ Test Database Setup Successful</div>
                  <div className="text-slate-400 text-xs mb-2">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                  
                  <div className="text-sky-400 mb-1">📦 Database Created:</div>
                  <div className="text-slate-300 ml-4 mb-2 break-all">{testSetupResult.new_database_url}</div>
                  
                  <div className="text-sky-400 mb-1">🔧 SQL Commands Executed:</div>
                  <div className="ml-4 space-y-1 mb-2">
                    {testSetupResult.sql_commands.map((cmd: string, index: number) => (
                      <div key={index} className="text-green-300 text-xs">
                        <span className="text-green-500">→</span> {cmd}
                      </div>
                    ))}
                  </div>
                  
                  {testSetupResult.clone_command && (
                    <>
                      <div className="text-sky-400 mb-1">📋 Clone Command Generated:</div>
                      <div className="text-slate-300 ml-4 mb-2 text-xs break-all">{testSetupResult.clone_command}</div>
                    </>
                  )}
                  
                  <div className="text-sky-400 mb-1">📝 Environment Files Updated:</div>
                  <div className="ml-4 space-y-2">
                    {Object.entries(testSetupResult.env_updates).map(([file, content]: any) => (
                      <div key={file}>
                        <div className="text-purple-400 text-xs">{file}:</div>
                        <div className="text-slate-400 text-xs ml-2">{content}</div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-slate-400 text-xs mt-3">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
                  <div className="text-green-400 mt-2">✨ Setup complete! Database is ready to use.</div>
                  
                  {testSetupResult.clone_command && (
                    <div className="mt-4 p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                      <div className="text-sky-300 text-sm mb-2">💡 Next Steps:</div>
                      <div className="text-xs text-slate-300 space-y-1">
                        <div>1. Run the clone command to copy data (if needed)</div>
                        <div>2. Use Sync tab to sync data from {selectedEnvironment === 'dev' ? 'Production' : 'Development'}</div>
                        <div>3. Use Backup tab to create backups</div>
                        <div>4. Use CRUD Explorer to view/manage data</div>
                      </div>
                    </div>
                  )}
                  
                  {!testSetupResult.clone_command && (
                    <div className="mt-4 p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                      <div className="text-sky-300 text-sm mb-2">💡 Next Steps:</div>
                      <div className="text-xs text-slate-300 space-y-1">
                        <div>1. Use Sync tab to sync data from {selectedEnvironment === 'dev' ? 'Production' : 'Development'}</div>
                        <div>2. Use Backup tab to create backups</div>
                        <div>3. Use CRUD Explorer to view/manage data</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-rose-400">
                  <div className="mb-2">❌ Setup Failed</div>
                  <div className="text-slate-300 text-xs ml-4">Error: Check the warnings above and try again.</div>
                </div>
              )}
            </div>
          </div>
        )}
          </div>
        )}

        {activeTab === 'sync' && (
          <div className="space-y-6 mt-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Database Sync</h2>
              <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4 text-sm text-yellow-300 mb-4">
                <div className="font-semibold mb-1">High-Risk Operations</div>
                <p className="mb-2">
                  Syncing data between environments can permanently overwrite records. The recommended pattern is:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Allow <span className="font-semibold">Prod → Dev</span> (clone production data down for testing).</li>
                  <li>Allow <span className="font-semibold">Dev → Prod</span> for <span className="font-semibold">schema only</span>, not data.</li>
                  <li>Never push bulk development data into production from this tool.</li>
                </ul>
              </div>
            </div>

            {/* Sync Configuration */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Sync Configuration</h3>
              
              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4 mb-4">
                <div className="text-sm text-sky-300">
                  <div className="font-semibold mb-2">Sync Direction (based on selected environment):</div>
                  <div className="space-y-1">
                    <div>📤 <span className="font-mono">{selectedEnvironment === 'dev' ? 'Development' : 'Production'}</span> → Source</div>
                    <div>📥 <span className="font-mono">{selectedEnvironment === 'dev' ? 'Production' : 'Development'}</span> → Target</div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">Sync Type</label>
                <select
                  value={syncType}
                  onChange={(e) => setSyncType(e.target.value as 'schema_only' | 'full_data' | 'tables_only')}
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                >
                  <option value="schema_only">Schema Only (Safe for Dev→Prod)</option>
                  <option value="full_data">Full Data (Prod→Dev Only)</option>
                  <option value="tables_only">Specific Tables</option>
                </select>
              </div>

              {syncType === 'tables_only' && (
                <div className="mb-4">
                  <label className="block text-sm text-slate-400 mb-2">Tables (comma-separated)</label>
                  <input
                    type="text"
                    value={syncTables.join(', ')}
                    onChange={(e) => setSyncTables(e.target.value.split(',').map(t => t.trim()).filter(t => t))}
                    placeholder="users, bookings, payments"
                    className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => generateSyncCommandsMutation.mutate({
                    source_env: syncSource,
                    target_env: syncTarget,
                    options: { sync_type: syncType, tables: syncTables }
                  })}
                  disabled={generateSyncCommandsMutation.isPending}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {generateSyncCommandsMutation.isPending ? (
                    <>
                      <Loader className="animate-spin" size={18} />
                      Generating Commands...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Generate Sync Commands
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => executeSyncMutation.mutate({
                    source_env: syncSource,
                    target_env: syncTarget,
                    options: { sync_type: syncType, tables: syncTables }
                  })}
                  disabled={executeSyncMutation.isPending}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {executeSyncMutation.isPending ? (
                    <>
                      <Loader className="animate-spin" size={18} />
                      Executing Sync...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Execute Sync Now
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sync Results */}
            {syncResult && (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">
                    {syncResult.executed ? 'Sync Execution Results' : 'Generated Commands'}
                  </h3>
                  {syncResult.console_output && syncResult.console_output.length > 0 && (
                    <button
                      onClick={() => navigator.clipboard.writeText(syncResult.console_output.join('\n'))}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-xs text-white flex items-center gap-1"
                    >
                      <Copy size={12} />
                      Copy to AI
                    </button>
                  )}
                </div>
                
                {/* Console Output */}
                {syncResult.console_output && syncResult.console_output.length > 0 && (
                  <div className="bg-black/80 border border-emerald-500/30 rounded-xl p-4 font-mono text-sm max-h-96 overflow-y-auto mb-4">
                    {syncResult.console_output.map((line: string, idx: number) => (
                      <div key={idx} className="text-slate-300">{line}</div>
                    ))}
                  </div>
                )}
                
                {syncResult.warnings && syncResult.warnings.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {syncResult.warnings.map((warning: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-orange-400">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}

                {syncResult.commands && syncResult.commands.length > 0 ? (
                  <div className="space-y-3">
                    {syncResult.commands.map((cmd: any, index: number) => (
                      <div key={index} className="bg-black/50 p-4 rounded-lg border border-white/10">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {cmd.safe ? <CheckCircle size={16} className="text-green-400" /> : <AlertTriangle size={16} className="text-yellow-400" />}
                            <span className="text-white font-medium">{cmd.description}</span>
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(cmd.command)}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                        <div className="text-xs font-mono text-slate-300 bg-black/30 p-2 rounded break-all">
                          {cmd.command}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 text-sm">No commands generated</div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'backups' && (
          <div className="space-y-6 mt-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Database Backups</h2>
              <div className="bg-rose-500/10 border border-rose-500/50 rounded-xl p-4 text-sm text-rose-300 mb-4">
                <div className="font-semibold mb-1">Production Restore Warning</div>
                <p className="mb-2">
                  Restoring a backup into the production database can permanently destroy live customer data. Any
                  restore tooling exposed here will:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Require multiple confirmation steps.</li>
                  <li>Show the exact database and backup file involved.</li>
                  <li>Prefer read-only previews and command generation over automatic execution.</li>
                </ul>
              </div>
            </div>

            {/* Backup Configuration */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Backup Configuration</h3>
              
              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4 mb-4">
                <div className="text-sm text-sky-300">
                  <div className="font-semibold mb-2">Backup Source:</div>
                  <div>📦 <span className="font-mono">{selectedEnvironment === 'dev' ? 'Development' : 'Production'}</span> environment</div>
                  <div className="text-xs text-slate-400 mt-2">Using all .env* files from /var/www/dintrafikskolax_{selectedEnvironment === 'dev' ? 'dev' : 'prod'}</div>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">Backup Type</label>
                <select
                  value={backupType}
                  onChange={(e) => setBackupType(e.target.value as 'full' | 'schema_only')}
                  className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                >
                  <option value="full">Full Backup (Data + Schema)</option>
                  <option value="schema_only">Schema Only</option>
                </select>
              </div>

              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 text-xs text-sky-300 mb-4">
                <div className="font-semibold mb-1">ℹ️ What this does</div>
                <p>
                  This generates a <span className="font-mono">pg_dump</span> command to create a database backup.
                  For development, you can execute it directly. For production, you'll get the command to run manually.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => generateBackupCommandsMutation.mutate(backupEnv)}
                  disabled={generateBackupCommandsMutation.isPending}
                  className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {generateBackupCommandsMutation.isPending ? (
                    <>
                      <Loader className="animate-spin" size={18} />
                      Generating Commands...
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      Generate Backup Commands
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => executeBackupMutation.mutate(backupEnv)}
                  disabled={executeBackupMutation.isPending}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {executeBackupMutation.isPending ? (
                    <>
                      <Loader className="animate-spin" size={18} />
                      Executing Backup...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Execute Backup & Download
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Backup Results */}
            {backupResult && (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">
                    {backupResult.executed ? 'Backup Execution Results' : 'Backup Commands'}
                  </h3>
                  {backupResult.console_output && backupResult.console_output.length > 0 && (
                    <button
                      onClick={() => navigator.clipboard.writeText(backupResult.console_output.join('\n'))}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-xs text-white flex items-center gap-1"
                    >
                      <Copy size={12} />
                      Copy to AI
                    </button>
                  )}
                </div>
                
                {/* Console Output */}
                {backupResult.console_output && backupResult.console_output.length > 0 && (
                  <div className="bg-black/80 border border-emerald-500/30 rounded-xl p-4 font-mono text-sm max-h-96 overflow-y-auto mb-4">
                    {backupResult.console_output.map((line: string, idx: number) => (
                      <div key={idx} className="text-slate-300">{line}</div>
                    ))}
                  </div>
                )}
                
                {backupResult.warnings && backupResult.warnings.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {backupResult.warnings.map((warning: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-orange-400">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}

                {backupResult.commands && backupResult.commands.length > 0 ? (
                  <div className="space-y-3">
                    {backupResult.commands.map((cmd: any, index: number) => (
                      <div key={index} className="bg-black/50 p-4 rounded-lg border border-white/10">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Database className="text-sky-400" size={16} />
                            <span className="text-white font-medium">{cmd.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {cmd.backup_file && (
                              <span className="text-xs text-slate-400 font-mono">{cmd.backup_file}</span>
                            )}
                            <button
                              onClick={() => navigator.clipboard.writeText(cmd.command)}
                              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs font-mono text-slate-300 bg-black/30 p-2 rounded break-all">
                          {cmd.command}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 text-sm">No commands generated</div>
                )}
              </div>
            )}

            {/* Upload & Restore Section */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Upload & Restore</h3>
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300 mb-4">
                <div className="font-semibold mb-1">⚠️ Production Restore</div>
                <p>
                  Restoring to production requires manual verification. Upload your backup file to preview its contents,
                  then you'll receive safe commands to restore after multiple confirmations.
                </p>
              </div>
              <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                <Inbox className="mx-auto mb-4 text-slate-400" size={48} />
                <p className="text-slate-400 text-sm mb-2">Drop backup file here or click to browse</p>
                <p className="text-slate-500 text-xs">.sql files only</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'crud' && (
          <div className="space-y-6 mt-6">
            {/* Header with environment selector */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Database Manager</h2>
                
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Environment</label>
                    <div className="text-sm text-slate-300">
                      {selectedEnvironment === 'dev' ? 'Development' : 'Production'}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => getSchemaMutation.mutate(selectedEnvironment)}
                    disabled={getSchemaMutation.isPending}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {getSchemaMutation.isPending ? (
                      <>
                        <Loader className="animate-spin" size={16} />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        Load Schema
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-12 gap-6">
              {/* LEFT COLUMN - Table Tree */}
              <div className="col-span-3">
                <div className="glass rounded-2xl p-4 space-y-3">
                  <h3 className="text-lg font-semibold text-white mb-3">Tables</h3>
                  
                  {/* Loading */}
                  {getSchemaMutation.isPending && (
                    <div className="flex items-center justify-center py-8">
                      <Loader className="animate-spin text-sky-400" size={20} />
                    </div>
                  )}

                  {/* Error */}
                  {schemaData?.error && (
                    <div className="bg-rose-500/20 border border-rose-500/50 rounded-lg p-3 text-xs text-rose-400">
                      {schemaData.error}
                    </div>
                  )}

                  {/* Tables List */}
                  {schemaData?.tables && schemaData.tables.length > 0 && (
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {schemaData.tables.map((table: any) => (
                        <div
                          key={table.name}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            selectedTable === table.name
                              ? 'bg-sky-500/20 border border-sky-500/50'
                              : 'bg-black/30 hover:bg-black/50'
                          }`}
                          onClick={() => {
                            setSelectedTable(table.name)
                            setTableData(null)
                            setTablePage(0)
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-mono text-white truncate">
                              {table.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {table.row_count.toLocaleString()} rows
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setTableToDelete(table.name)
                              generateSanityCheck()
                              setShowDeleteTableDialog(true)
                            }}
                            className="p-1 hover:bg-rose-500/20 rounded transition-colors"
                            title="Delete table"
                          >
                            <Trash2 size={14} className="text-rose-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No tables message */}
                  {schemaData?.tables && schemaData.tables.length === 0 && (
                    <div className="text-center py-4 text-slate-400 text-sm">
                      No tables found
                    </div>
                  )}

                  {/* New Table Button */}
                  {schemaData?.tables && (
                    <button
                      onClick={() => setShowCreateTableDialog(true)}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium mt-3"
                    >
                      <Plus size={16} />
                      New Table
                    </button>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN - Table Details & CRUD Operations */}
              <div className="col-span-9">
                {!selectedTable ? (
                  <div className="glass rounded-2xl p-12 text-center">
                    <Database size={48} className="mx-auto mb-4 text-slate-400" />
                    <p className="text-slate-400">
                      Select a table from the left to view and manage its data
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Table Header with Info */}
                    {schemaData?.tables && (() => {
                      const table = schemaData.tables.find((t: any) => t.name === selectedTable)
                      return table ? (
                        <div className="glass rounded-2xl p-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-semibold text-white font-mono">
                              {table.name}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-slate-400">
                              <span>Rows: <span className="text-white font-medium">{table.row_count.toLocaleString()}</span></span>
                              <span>Type: <span className="text-white font-medium">{table.type}</span></span>
                            </div>
                          </div>
                        </div>
                      ) : null
                    })()}

                    {/* Table Data - Auto-loaded (100 rows) */}
                    {getTableDataMutation.isPending && !tableData ? (
                      <div className="glass rounded-2xl p-12 text-center">
                        <Loader className="animate-spin text-sky-400 mx-auto mb-4" size={32} />
                        <p className="text-slate-400">Loading table data...</p>
                      </div>
                    ) : tableData ? (
                      <div className="glass rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-white">Data (100 rows per page)</h4>
                          {tableData.total_rows && (
                            <div className="text-sm text-slate-400">
                              Showing {tableData.data?.length || 0} of {tableData.total_rows.toLocaleString()} rows
                            </div>
                          )}
                        </div>

                        {tableData.error ? (
                          <div className="bg-rose-500/20 border border-rose-500/50 rounded-lg p-4 text-sm text-rose-400">
                            {tableData.error}
                          </div>
                        ) : tableData.data && tableData.data.length > 0 ? (
                          <div className="space-y-4">
                            {/* Pagination */}
                            {tableData.total_rows > 100 && (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setTablePage(Math.max(0, tablePage - 1))
                                    getTableDataMutation.mutate({ environment: selectedEnvironment, table: selectedTable, page: Math.max(0, tablePage - 1) })
                                  }}
                                  disabled={tablePage === 0}
                                  className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded text-sm"
                                >
                                  Previous
                                </button>
                                <span className="text-white text-sm">
                                  Page {tablePage + 1} of {Math.ceil(tableData.total_rows / 100)}
                                </span>
                                <button
                                  onClick={() => {
                                    setTablePage(tablePage + 1)
                                    getTableDataMutation.mutate({ environment: selectedEnvironment, table: selectedTable, page: tablePage + 1 })
                                  }}
                                  disabled={(tablePage + 1) * 100 >= tableData.total_rows}
                                  className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded text-sm"
                                >
                                  Next
                                </button>
                              </div>
                            )}

                            {/* Data Table */}
                            <div className="overflow-auto max-h-96 border border-white/10 rounded-lg">
                              <table className="w-full text-xs">
                                <thead className="bg-black/50 sticky top-0">
                                  <tr>
                                    {tableData.columns.map((col: string) => (
                                      <th key={col} className="p-2 text-left text-slate-300 font-mono border-b border-white/10">
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {tableData.data.map((row: any[], rowIndex: number) => (
                                    <tr key={rowIndex} className="border-b border-white/5 hover:bg-white/5">
                                      {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="p-2 font-mono text-slate-300 break-all max-w-xs">
                                          {cell === null ? (
                                            <span className="text-slate-500 italic">NULL</span>
                                          ) : cell === '' ? (
                                            <span className="text-slate-500 italic">empty</span>
                                          ) : (
                                            String(cell)
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-slate-400 text-sm">No data found</div>
                        )}
                      </div>
                    ) : (
                      <div className="glass rounded-2xl p-12 text-center">
                        <Database size={48} className="mx-auto mb-4 text-slate-400" />
                        <p className="text-slate-400">Select a table to view data</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Create Table Dialog */}
            {showCreateTableDialog && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="glass rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">Create New Table</h3>
                    <button
                      onClick={() => {
                        setShowCreateTableDialog(false)
                        setNewTableName('')
                        setNewTableColumns([{name: 'id', type: 'SERIAL PRIMARY KEY', nullable: false, defaultValue: ''}])
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X size={20} className="text-white" />
                    </button>
                  </div>

                  {/* Table Name */}
                  <div className="mb-4">
                    <label className="block text-sm text-slate-400 mb-2">Table Name</label>
                    <input
                      type="text"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      placeholder="users, products, orders..."
                      className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                    />
                  </div>

                  {/* Columns */}
                  <div className="mb-4">
                    <label className="block text-sm text-slate-400 mb-2">Columns</label>
                    <div className="space-y-2">
                      {newTableColumns.map((col, index) => (
                        <div key={index} className="flex items-center gap-2 bg-black/30 p-3 rounded-lg">
                          <input
                            type="text"
                            value={col.name}
                            onChange={(e) => {
                              const updated = [...newTableColumns]
                              updated[index].name = e.target.value
                              setNewTableColumns(updated)
                            }}
                            placeholder="column_name"
                            className="flex-1 bg-black/50 text-white p-2 rounded border border-white/10 focus:border-sky-500/50 focus:outline-none text-sm"
                          />
                          <select
                            value={col.type}
                            onChange={(e) => {
                              const updated = [...newTableColumns]
                              updated[index].type = e.target.value
                              setNewTableColumns(updated)
                            }}
                            className="bg-black/50 text-white p-2 rounded border border-white/10 focus:border-sky-500/50 focus:outline-none text-sm"
                          >
                            <option value="SERIAL PRIMARY KEY">SERIAL PRIMARY KEY</option>
                            <option value="INTEGER">INTEGER</option>
                            <option value="BIGINT">BIGINT</option>
                            <option value="TEXT">TEXT</option>
                            <option value="VARCHAR(255)">VARCHAR(255)</option>
                            <option value="BOOLEAN">BOOLEAN</option>
                            <option value="TIMESTAMP">TIMESTAMP</option>
                            <option value="DATE">DATE</option>
                            <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                            <option value="JSON">JSON</option>
                            <option value="JSONB">JSONB</option>
                            <option value="UUID">UUID</option>
                          </select>
                          <button
                            onClick={() => {
                              if (newTableColumns.length > 1) {
                                setNewTableColumns(newTableColumns.filter((_, i) => i !== index))
                              }
                            }}
                            className="p-2 hover:bg-rose-500/20 rounded transition-colors"
                            disabled={newTableColumns.length === 1}
                          >
                            <Trash2 size={16} className="text-rose-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => {
                        setNewTableColumns([...newTableColumns, {name: '', type: 'TEXT', nullable: true, defaultValue: ''}])
                      }}
                      className="mt-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-sm flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Add Column
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowCreateTableDialog(false)
                        setNewTableName('')
                        setNewTableColumns([{name: 'id', type: 'SERIAL PRIMARY KEY', nullable: false, defaultValue: ''}])
                      }}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (newTableName && newTableColumns.length > 0) {
                          createTableMutation.mutate({
                            environment: selectedEnvironment,
                            tableName: newTableName,
                            columns: newTableColumns
                          })
                        }
                      }}
                      disabled={!newTableName || newTableColumns.length === 0 || createTableMutation.isPending}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {createTableMutation.isPending ? (
                        <>
                          <Loader className="animate-spin" size={16} />
                          Creating...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          Create Table
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Table Dialog */}
            {showDeleteTableDialog && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="glass rounded-2xl p-6 max-w-md w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-rose-500/20 rounded-full">
                      <AlertTriangle size={24} className="text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Delete Table</h3>
                      <p className="text-sm text-slate-400">This action cannot be undone</p>
                    </div>
                  </div>

                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 mb-4">
                    <p className="text-sm text-rose-300 mb-2">
                      You are about to delete the table: <span className="font-mono font-bold">{tableToDelete}</span>
                    </p>
                    <p className="text-xs text-rose-400">
                      All data in this table will be permanently deleted.
                    </p>
                  </div>

                  {/* Math Sanity Check */}
                  <div className="mb-4">
                    <label className="block text-sm text-slate-400 mb-2">
                      To confirm, solve this: <span className="text-white font-bold">{deleteSanityQuestion.num1} + {deleteSanityQuestion.num2} = ?</span>
                    </label>
                    <input
                      type="number"
                      value={deleteSanityAnswer}
                      onChange={(e) => setDeleteSanityAnswer(e.target.value)}
                      placeholder="Enter answer"
                      className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-rose-500/50 focus:outline-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteTableDialog(false)
                        setTableToDelete('')
                        setDeleteSanityAnswer('')
                      }}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (parseInt(deleteSanityAnswer) === deleteSanityQuestion.answer) {
                          deleteTableMutation.mutate({
                            environment: selectedEnvironment,
                            tableName: tableToDelete
                          })
                        } else {
                          alert('Incorrect answer. Please try again.')
                        }
                      }}
                      disabled={!deleteSanityAnswer || deleteTableMutation.isPending}
                      className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {deleteTableMutation.isPending ? (
                        <>
                          <Loader className="animate-spin" size={16} />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          Delete Table
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'env-editor' && (
          <div className="space-y-6 mt-6">
            {/* Header */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-2">.env File Editor</h2>
              <p className="text-sm text-slate-400">
                Edit environment configuration files for <span className="font-mono text-white">{selectedEnvironment === 'dev' ? 'Development' : 'Production'}</span>
              </p>
            </div>

            {/* File Selector and Actions */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm text-slate-400 mb-2">Select .env File</label>
                  <select
                    value={selectedEnvFile}
                    onChange={(e) => {
                      setSelectedEnvFile(e.target.value)
                      loadEnvFileMutation.mutate({ environment: selectedEnvironment, filename: e.target.value })
                    }}
                    className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none font-mono"
                  >
                    {availableEnvFiles.length > 0 ? (
                      availableEnvFiles.map((file) => (
                        <option key={file} value={file}>{file}</option>
                      ))
                    ) : (
                      <option value=".env.local">.env.local</option>
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => getEnvFilesMutation.mutate(selectedEnvironment)}
                    disabled={getEnvFilesMutation.isPending}
                    className="px-4 py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {getEnvFilesMutation.isPending ? (
                      <>
                        <Loader className="animate-spin" size={16} />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        Refresh Files
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (selectedEnvFile) {
                        loadEnvFileMutation.mutate({ environment: selectedEnvironment, filename: selectedEnvFile })
                      }
                    }}
                    disabled={loadEnvFileMutation.isPending || !selectedEnvFile}
                    className="px-4 py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {loadEnvFileMutation.isPending ? (
                      <>
                        <Loader className="animate-spin" size={16} />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Eye size={16} />
                        Load File
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 text-xs text-sky-300">
                <div className="font-semibold mb-1">ℹ️ Environment Info</div>
                <div>Directory: <span className="font-mono">/var/www/dintrafikskolax_{selectedEnvironment === 'dev' ? 'dev' : 'prod'}</span></div>
                <div>File: <span className="font-mono">{selectedEnvFile}</span></div>
              </div>
            </div>

            {/* Editor */}
            {loadEnvFileMutation.isPending ? (
              <div className="glass rounded-2xl p-12 text-center">
                <Loader className="animate-spin text-sky-400 mx-auto mb-4" size={32} />
                <p className="text-slate-400">Loading file content...</p>
              </div>
            ) : (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">File Content</h3>
                  {envEditorSaved && (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={16} />
                      <span className="text-sm">Saved successfully!</span>
                    </div>
                  )}
                </div>

                <textarea
                  value={envFileContent}
                  onChange={(e) => setEnvFileContent(e.target.value)}
                  placeholder="# Environment variables&#10;DATABASE_URL=postgresql://...&#10;API_KEY=..."
                  className="w-full h-96 bg-black/50 text-white p-4 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none font-mono text-sm resize-y"
                  spellCheck={false}
                />

                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-slate-400">
                    Lines: {envFileContent.split('\n').length} | Characters: {envFileContent.length}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(envFileContent)
                      }}
                      className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                    >
                      <Copy size={14} />
                      Copy
                    </button>

                    <button
                      onClick={() => {
                        if (selectedEnvFile) {
                          saveEnvFileMutation.mutate({
                            environment: selectedEnvironment,
                            filename: selectedEnvFile,
                            content: envFileContent
                          })
                        }
                      }}
                      disabled={saveEnvFileMutation.isPending || !selectedEnvFile}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      {saveEnvFileMutation.isPending ? (
                        <>
                          <Loader className="animate-spin" size={16} />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Save File
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="text-rose-400" size={20} />
                <div className="font-semibold text-rose-300">⚠️ Important</div>
              </div>
              <div className="text-sm text-rose-400 space-y-1">
                <div>• Changes take effect immediately - be careful when editing production files</div>
                <div>• Always backup files before making changes</div>
                <div>• Invalid syntax may break your application</div>
                <div>• Restart services after making changes to environment variables</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'toolkit' && (
          <div className="space-y-6 mt-6">
            {/* Header */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <Wrench className="text-sky-400" size={28} />
                Database Toolkit
              </h2>
              <p className="text-sm text-slate-400">
                Manage database users, tables, privileges, and perform optimizations for <span className="font-mono text-white">{selectedEnvironment === 'dev' ? 'Development' : 'Production'}</span>
              </p>
            </div>

            {/* User Management */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <UserPlus className="text-sky-400" size={20} />
                  Database Users
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refetchDbUsers()}
                    disabled={!dbUsers}
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <RefreshCw size={16} className="text-slate-400" />
                  </button>
                  <button
                    onClick={() => setShowCreateUserDialog(true)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} />
                    New User
                  </button>
                </div>
              </div>

              {dbUsers ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Username</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Privileges</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Roles</th>
                        <th className="text-right py-3 px-4 text-slate-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbUsers.users?.map((user: any) => (
                        <tr key={user.username} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-4 font-mono text-white">{user.username}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {user.is_superuser && <span className="px-2 py-1 bg-rose-500/20 text-rose-300 rounded text-xs">SUPERUSER</span>}
                              {user.can_login && <span className="px-2 py-1 bg-sky-500/20 text-sky-300 rounded text-xs">LOGIN</span>}
                              {user.can_create_db && <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">CREATEDB</span>}
                              {user.can_create_role && <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">CREATEROLE</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300 text-xs">
                            {user.member_of?.length > 0 ? user.member_of.join(', ') : '-'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                if (confirm(`Delete user '${user.username}'?`)) {
                                  deleteUserMutation.mutate({ environment: selectedEnvironment, username: user.username })
                                }
                              }}
                              disabled={deleteUserMutation.isPending}
                              className="p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader className="animate-spin text-sky-400" size={24} />
                </div>
              )}
            </div>

            {/* Table Privileges */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Shield className="text-green-400" size={20} />
                  Table Privileges
                </h3>
                <button
                  onClick={() => setShowPrivilegesDialog(true)}
                  disabled={!schemaData?.tables}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Shield size={16} />
                  Grant/Revoke
                </button>
              </div>

              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 text-xs text-sky-300">
                <div className="font-semibold mb-1">ℹ️ Manage Access</div>
                <div>Grant or revoke SELECT, INSERT, UPDATE, DELETE privileges on specific tables to users</div>
              </div>
            </div>

            {/* Database Optimization */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Zap className="text-amber-400" size={20} />
                  Database Optimization
                </h3>
                <button
                  onClick={() => setShowOptimizeDialog(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Zap size={16} />
                  Optimize
                </button>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
                <div className="font-semibold mb-1">⚡ Performance</div>
                <div>Run VACUUM ANALYZE to reclaim storage and update statistics for the query planner</div>
              </div>
            </div>

            {/* Create User Dialog */}
            {showCreateUserDialog && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="glass rounded-2xl p-6 max-w-md w-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">Create Database User</h3>
                    <button onClick={() => setShowCreateUserDialog(false)} className="text-slate-400 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Username</label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                        placeholder="db_user"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Password</label>
                      <input
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                        placeholder="••••••••"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm text-slate-400 mb-2">Privileges</label>
                      {[
                        { key: 'can_login', label: 'Can Login' },
                        { key: 'can_create_db', label: 'Can Create Database' },
                        { key: 'can_create_role', label: 'Can Create Role' },
                        { key: 'is_superuser', label: 'Superuser (⚠️ Full Access)' }
                      ].map((priv) => (
                        <label key={priv.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newUserPrivileges[priv.key as keyof typeof newUserPrivileges]}
                            onChange={(e) => setNewUserPrivileges({ ...newUserPrivileges, [priv.key]: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-slate-300">{priv.label}</span>
                        </label>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        if (newUsername && newUserPassword) {
                          createUserMutation.mutate({
                            environment: selectedEnvironment,
                            username: newUsername,
                            password: newUserPassword,
                            privileges: newUserPrivileges
                          })
                        }
                      }}
                      disabled={!newUsername || !newUserPassword || createUserMutation.isPending}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {createUserMutation.isPending ? (
                        <>
                          <Loader className="animate-spin" size={18} />
                          Creating...
                        </>
                      ) : (
                        <>
                          <UserPlus size={18} />
                          Create User
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Grant/Revoke Privileges Dialog */}
            {showPrivilegesDialog && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="glass rounded-2xl p-6 max-w-md w-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">Manage Table Privileges</h3>
                    <button onClick={() => setShowPrivilegesDialog(false)} className="text-slate-400 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">User</label>
                      <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                      >
                        <option value="">-- Select User --</option>
                        {dbUsers?.users?.map((user: any) => (
                          <option key={user.username} value={user.username}>{user.username}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Table</label>
                      <select
                        value={selectedPrivTable}
                        onChange={(e) => setSelectedPrivTable(e.target.value)}
                        className="w-full bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                      >
                        <option value="">-- Select Table --</option>
                        {schemaData?.tables?.map((table: any) => (
                          <option key={table.name} value={table.name}>{table.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Privileges</label>
                      <div className="space-y-2">
                        {['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'].map((priv) => (
                          <label key={priv} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedPrivileges.includes(priv)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPrivileges([...selectedPrivileges, priv])
                                } else {
                                  setSelectedPrivileges(selectedPrivileges.filter(p => p !== priv))
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-slate-300">{priv}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (selectedUser && selectedPrivTable && selectedPrivileges.length > 0) {
                            grantPrivilegesMutation.mutate({
                              environment: selectedEnvironment,
                              username: selectedUser,
                              table_name: selectedPrivTable,
                              privileges: selectedPrivileges
                            })
                          }
                        }}
                        disabled={!selectedUser || !selectedPrivTable || selectedPrivileges.length === 0 || grantPrivilegesMutation.isPending}
                        className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Shield size={18} />
                        Grant
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Optimize Dialog */}
            {showOptimizeDialog && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="glass rounded-2xl p-6 max-w-md w-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">Optimize Database</h3>
                    <button onClick={() => setShowOptimizeDialog(false)} className="text-slate-400 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Tables to Optimize</label>
                      <select
                        multiple
                        value={tablesToOptimize}
                        onChange={(e) => setTablesToOptimize(Array.from(e.target.selectedOptions, option => option.value))}
                        className="w-full h-32 bg-black/50 text-white p-3 rounded-lg border border-white/10 focus:border-sky-500/50 focus:outline-none"
                      >
                        {schemaData?.tables?.map((table: any) => (
                          <option key={table.name} value={table.name}>{table.name} ({table.row_count} rows)</option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-400 mt-1">Hold Ctrl/Cmd to select multiple. Leave empty to optimize all tables.</div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
                      <div className="font-semibold mb-1">⚡ Performance Note</div>
                      <div>VACUUM ANALYZE reclaims storage, updates statistics, and may lock tables briefly. Best run during low traffic periods.</div>
                    </div>

                    <button
                      onClick={() => {
                        optimizeTablesMutation.mutate({
                          environment: selectedEnvironment,
                          table_names: tablesToOptimize.length > 0 ? tablesToOptimize : null
                        })
                      }}
                      disabled={optimizeTablesMutation.isPending}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {optimizeTablesMutation.isPending ? (
                        <>
                          <Loader className="animate-spin" size={18} />
                          Optimizing...
                        </>
                      ) : (
                        <>
                          <Zap size={18} />
                          Optimize {tablesToOptimize.length > 0 ? `${tablesToOptimize.length} Table(s)` : 'All Tables'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
