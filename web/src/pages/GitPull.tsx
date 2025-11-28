import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { CheckCircle, XCircle, Loader, GitBranch, RefreshCw, GitCommit, AlertTriangle, Eye, Server } from 'lucide-react'
import BuildDashboardUpdateDialog from '../components/BuildDashboardUpdateDialog'
import SQLMigrationDialog from '../components/SQLMigrationDialog'

export default function GitPull() {
  const [selectedEnv, setSelectedEnv] = useState<'dev' | 'prod'>('dev')
  const [stashChanges, setStashChanges] = useState(false)
  const [force, setForce] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [useCommit, setUseCommit] = useState(false)
  const [commitHash, setCommitHash] = useState('')
  const [showBuildDashboardDialog, setShowBuildDashboardDialog] = useState(false)
  const [showSQLDialog, setShowSQLDialog] = useState(false)
  const [pullResult, setPullResult] = useState<any>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [showLocalChangesModal, setShowLocalChangesModal] = useState(false)
  const [localChangesFiles, setLocalChangesFiles] = useState<string[]>([])

  // Fetch available branches
  const branchesQuery = useQuery({
    queryKey: ['git-branches'],
    queryFn: async () => {
      const response = await api.get('/git/branches')
      return response.data as {
        current: string | null
        local: string[]
        remote: string[]
      }
    },
  })

  // Fetch git status for selected env
  const statusQuery = useQuery({
    queryKey: ['git-status', selectedEnv],
    queryFn: async () => {
      const response = await api.get(`/git/status?env=${selectedEnv}`)
      return response.data
    },
    refetchInterval: 5000,
  })

  // Restart server mutation
  const restartMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/pm2/restart?env=${selectedEnv}`)
      return response.data
    },
    onSuccess: () => {
      setShowRestartConfirm(false)
      setPullResult((prev: any) => prev ? { ...prev, restarted: true } : null)
    }
  })

  // Preview changes mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/git/preview-pull?env=${selectedEnv}`)
      return response.data
    },
    onSuccess: (data) => setPreviewData(data)
  })

  // Set selected branch to current branch when data loads
  useEffect(() => {
    if (branchesQuery.data?.current && !selectedBranch) {
      setSelectedBranch(branchesQuery.data.current)
    }
  }, [branchesQuery.data, selectedBranch])

  // Pull mutation using new endpoint
  const pullMutation = useMutation({
    mutationFn: async (options: { stash?: boolean; force?: boolean }) => {
      const response = await api.post(`/git/pull-env?env=${selectedEnv}&stash=${options.stash || false}&force=${options.force || false}`)
      return response.data
    },
    onSuccess: (data) => {
      setPullResult(data)
      setPreviewData(null)
      
      // Check for local changes - show modal
      if (!data.success && data.has_local_changes) {
        setLocalChangesFiles(data.files || [])
        setShowLocalChangesModal(true)
        return
      }
      
      // Check for SQL migrations first
      if (data.sql_migrations && data.sql_migrations.length > 0) {
        setShowSQLDialog(true)
      }
      // Then check for build dashboard changes
      else if (data.build_dashboard_changes && data.build_dashboard_changes.length > 0) {
        setShowBuildDashboardDialog(true)
      }
      // Show restart confirmation (NO auto-restart)
      else if (data.success && !data.already_up_to_date) {
        setShowRestartConfirm(true)
      }
    }
  })

  const handlePreview = () => {
    setPreviewData(null)
    setPullResult(null)
    previewMutation.mutate()
  }

  const handlePull = (stash = false, forceDelete = false) => {
    setShowLocalChangesModal(false)
    pullMutation.mutate({ stash, force: forceDelete })
  }

  // Handle SQL dialog close
  const handleSQLDialogClose = () => {
    setShowSQLDialog(false)
    
    // After SQL dialog, check for build dashboard updates
    if (pullResult?.build_dashboard_changes && pullResult.build_dashboard_changes.length > 0) {
      setShowBuildDashboardDialog(true)
    }
    // Show restart confirmation (NO auto-restart)
    else if (pullResult?.success && !pullResult?.already_up_to_date) {
      setShowRestartConfirm(true)
    }
  }

  const handleRestart = () => {
    restartMutation.mutate()
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="glass rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Git Pull</h1>

          {/* Environment Selector */}
          <div className="glass-subtle rounded-xl p-4 mb-6">
            <label className="block text-sm text-slate-400 mb-3">Select Environment</label>
            <div className="flex gap-3">
              <button
                onClick={() => { setSelectedEnv('dev'); setPreviewData(null); setPullResult(null); }}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  selectedEnv === 'dev' 
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Server size={18} />
                Development
              </button>
              <button
                onClick={() => { setSelectedEnv('prod'); setPreviewData(null); setPullResult(null); }}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  selectedEnv === 'prod' 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Server size={18} />
                Production
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              className="py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 border border-blue-500/30"
            >
              {previewMutation.isPending ? (
                <><Loader className="animate-spin" size={20} /> Checking...</>
              ) : (
                <><Eye size={20} /> Preview Changes</>
              )}
            </button>

            <button
              onClick={() => handlePull()}
              disabled={pullMutation.isPending}
              className={`py-3 font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                selectedEnv === 'prod' 
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                  : 'bg-sky-500 hover:bg-sky-600 text-white'
              }`}
            >
              {pullMutation.isPending ? (
                <><Loader className="animate-spin" size={20} /> Pulling...</>
              ) : (
                <><GitBranch size={20} /> Pull {selectedEnv.toUpperCase()}</>
              )}
            </button>

            <button
              onClick={handleRestart}
              disabled={restartMutation.isPending}
              className="py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 border border-amber-500/30"
            >
              {restartMutation.isPending ? (
                <><Loader className="animate-spin" size={20} /> Restarting...</>
              ) : (
                <><RefreshCw size={20} /> Restart {selectedEnv.toUpperCase()}</>
              )}
            </button>
          </div>

          {/* Preview Results */}
          {previewData && (
            <div className="glass-subtle rounded-xl p-6 mb-6 border border-blue-500/30">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Eye size={20} className="text-blue-400" /> 
                Incoming Changes for {selectedEnv.toUpperCase()}
              </h3>
              {previewData.error ? (
                <div className="text-red-400">{previewData.error}</div>
              ) : !previewData.has_changes ? (
                <div className="text-green-400 flex items-center gap-2">
                  <CheckCircle size={16} /> Already up to date
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-slate-300">
                    <span className="text-cyan-400 font-bold">{previewData.commit_count}</span> commit(s), 
                    <span className="text-cyan-400 font-bold"> {previewData.file_count}</span> file(s)
                  </div>
                  {previewData.commits?.slice(0, 5).map((commit: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <code className="text-cyan-400 font-mono">{commit.hash}</code>
                      <span className="text-slate-400">{commit.message}</span>
                    </div>
                  ))}
                  {previewData.buildmaster_files?.length > 0 && (
                    <div className="mt-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                      <div className="text-amber-400 font-medium flex items-center gap-2">
                        <AlertTriangle size={16} /> BuildMaster code detected
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pull Result */}
          {pullResult && (
            <div className={`glass-subtle rounded-xl p-6 mb-6 border ${
              pullResult.success ? 'border-green-500/30' : 'border-red-500/30'
            }`}>
              <div className={`flex items-center gap-2 text-lg font-semibold mb-2 ${
                pullResult.success ? 'text-green-400' : 'text-red-400'
              }`}>
                {pullResult.success ? <CheckCircle size={20} /> : <XCircle size={20} />}
                {pullResult.success ? 'Pull Successful' : 'Pull Failed'}
              </div>
              <p className="text-slate-300">{pullResult.message || pullResult.error}</p>
              {pullResult.changed_files?.length > 0 && (
                <div className="mt-3 text-sm text-slate-400">
                  Changed: {pullResult.changed_files.slice(0, 5).join(', ')}
                  {pullResult.changed_files.length > 5 && ` (+${pullResult.changed_files.length - 5} more)`}
                </div>
              )}
              {pullResult.restarted && (
                <div className="mt-3 text-green-400 flex items-center gap-2">
                  <CheckCircle size={16} /> Server restarted
                </div>
              )}
            </div>
          )}

          {/* Git Status */}
          <div className="glass-subtle rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <GitCommit size={20} />
              Git Status
              {statusQuery.isLoading && <Loader className="animate-spin" size={16} />}
            </h2>
            
            {statusQuery.isLoading ? (
              <div className="text-slate-400">Loading status...</div>
            ) : statusQuery.error ? (
              <div className="text-rose-400">Failed to load git status</div>
            ) : statusQuery.data && typeof statusQuery.data === 'object' && !('detail' in statusQuery.data) ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current Branch:</span>
                  <span className="text-white font-medium">{statusQuery.data?.branch || 'Unknown'}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Working Directory:</span>
                  <span className={`font-medium ${statusQuery.data?.clean ? 'text-green-400' : 'text-yellow-400'}`}>
                    {statusQuery.data?.clean ? 'Clean' : 'Modified'}
                  </span>
                </div>

                {statusQuery.data?.ahead > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ahead of remote:</span>
                    <span className="text-white font-medium">{statusQuery.data.ahead} commits</span>
                  </div>
                )}

                {statusQuery.data?.behind > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Behind remote:</span>
                    <span className="text-white font-medium">{statusQuery.data.behind} commits</span>
                  </div>
                )}

                {/* File Changes */}
                {(statusQuery.data?.modified?.length > 0 || 
                  statusQuery.data?.added?.length > 0 || 
                  statusQuery.data?.deleted?.length > 0 || 
                  statusQuery.data?.untracked?.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <h3 className="text-sm font-medium text-slate-300 mb-3">File Changes:</h3>
                    <div className="space-y-2">
                      {statusQuery.data?.modified?.length > 0 && (
                        <div>
                          <span className="text-xs text-yellow-400 font-medium">Modified ({statusQuery.data.modified.length}):</span>
                          <div className="text-xs text-slate-400 ml-2">
                            {statusQuery.data.modified.slice(0, 3).join(', ')}
                            {statusQuery.data.modified.length > 3 && ` +${statusQuery.data.modified.length - 3} more`}
                          </div>
                        </div>
                      )}
                      
                      {statusQuery.data?.added?.length > 0 && (
                        <div>
                          <span className="text-xs text-green-400 font-medium">Added ({statusQuery.data.added.length}):</span>
                          <div className="text-xs text-slate-400 ml-2">
                            {statusQuery.data.added.slice(0, 3).join(', ')}
                            {statusQuery.data.added.length > 3 && ` +${statusQuery.data.added.length - 3} more`}
                          </div>
                        </div>
                      )}
                      
                      {statusQuery.data?.deleted?.length > 0 && (
                        <div>
                          <span className="text-xs text-rose-400 font-medium">Deleted ({statusQuery.data.deleted.length}):</span>
                          <div className="text-xs text-slate-400 ml-2">
                            {statusQuery.data.deleted.slice(0, 3).join(', ')}
                            {statusQuery.data.deleted.length > 3 && ` +${statusQuery.data.deleted.length - 3} more`}
                          </div>
                        </div>
                      )}
                      
                      {statusQuery.data?.untracked?.length > 0 && (
                        <div>
                          <span className="text-xs text-purple-400 font-medium">Untracked ({statusQuery.data.untracked.length}):</span>
                          <div className="text-xs text-slate-400 ml-2">
                            {statusQuery.data.untracked.slice(0, 3).join(', ')}
                            {statusQuery.data.untracked.length > 3 && ` +${statusQuery.data.untracked.length - 3} more`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="glass-subtle rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <GitBranch size={20} />
                Branch Selection
              </h2>
              
              {branchesQuery.isLoading ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader className="animate-spin" size={16} />
                  Loading branches...
                </div>
              ) : branchesQuery.error ? (
                <div className="text-rose-400">Failed to load branches</div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm text-slate-400 mb-2">
                    Select branch to pull from:
                  </label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    {branchesQuery.data?.current && (
                      <option value={branchesQuery.data.current} className="bg-slate-800 text-white">
                        {branchesQuery.data.current} (current)
                      </option>
                    )}
                    {branchesQuery.data?.remote.filter(b => b !== branchesQuery.data?.current).map((branch) => (
                      <option key={branch} value={branch} className="bg-slate-800 text-white">
                        {branch}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="glass-subtle rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Options</h2>
              
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCommit}
                    onChange={(e) => {
                      setUseCommit(e.target.checked)
                      if (!e.target.checked) setCommitHash('')
                    }}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 text-sky-500 focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="text-slate-300">Pull specific commit hash</span>
                </label>

                {useCommit && (
                  <input
                    type="text"
                    value={commitHash}
                    onChange={(e) => setCommitHash(e.target.value)}
                    placeholder="Enter commit hash (e.g., abc123f)"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                )}

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stashChanges}
                    onChange={(e) => setStashChanges(e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 text-sky-500 focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="text-slate-300">Stash local changes before pulling</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(e) => setForce(e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 text-sky-500 focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="text-slate-300">Force delete local changes</span>
                </label>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Restart Confirmation Modal */}
      {showRestartConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <RefreshCw className="text-amber-400" size={20} />
              Restart Server?
            </h4>
            <p className="text-slate-400 mb-6">
              Changes have been pulled successfully. Do you want to restart the {selectedEnv === 'dev' ? 'development' : 'production'} server now?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRestartConfirm(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Not Now
              </button>
              <button
                onClick={handleRestart}
                disabled={restartMutation.isPending}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center justify-center gap-2"
              >
                {restartMutation.isPending ? <Loader className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local Changes Warning Modal */}
      {showLocalChangesModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="text-yellow-400" size={20} />
              Local Changes Detected
            </h4>
            <p className="text-slate-400 mb-4">
              The {selectedEnv} environment has uncommitted changes that may be overwritten.
            </p>
            {localChangesFiles.length > 0 && (
              <div className="p-3 bg-black/30 rounded-lg mb-4 max-h-32 overflow-y-auto">
                <div className="text-xs text-slate-500 font-mono space-y-1">
                  {localChangesFiles.slice(0, 10).map((file, idx) => (
                    <div key={idx}>{file}</div>
                  ))}
                  {localChangesFiles.length > 10 && (
                    <div className="text-slate-600">+{localChangesFiles.length - 10} more files</div>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowLocalChangesModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePull(true, false)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Stash & Pull
              </button>
              <button
                onClick={() => handlePull(false, true)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Discard & Pull
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Migration Dialog */}
      {pullResult?.sql_migrations && (
        <SQLMigrationDialog
          isOpen={showSQLDialog}
          onClose={handleSQLDialogClose}
          migrations={pullResult.sql_migrations}
        />
      )}

      {/* Build Dashboard Update Dialog */}
      {pullResult?.build_dashboard_changes && (
        <BuildDashboardUpdateDialog
          isOpen={showBuildDashboardDialog}
          onClose={() => setShowBuildDashboardDialog(false)}
          changedFiles={pullResult.build_dashboard_changes}
        />
      )}
    </div>
  )
}

