import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { CheckCircle, XCircle, Loader, GitBranch, RefreshCw, GitCommit } from 'lucide-react'
import BuildDashboardUpdateDialog from '../components/BuildDashboardUpdateDialog'
import SQLMigrationDialog from '../components/SQLMigrationDialog'

export default function GitPull() {
  const [stashChanges, setStashChanges] = useState(true)
  const [force, setForce] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [useCommit, setUseCommit] = useState(false)
  const [commitHash, setCommitHash] = useState('')
  const [showBuildDashboardDialog, setShowBuildDashboardDialog] = useState(false)
  const [showSQLDialog, setShowSQLDialog] = useState(false)
  const [pullResult, setPullResult] = useState<any>(null)

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

  // Fetch git status
  const statusQuery = useQuery({
    queryKey: ['git-status'],
    queryFn: async () => {
      const response = await api.get('/git/status/detailed')
      return response.data
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  // Restart dev server mutation
  const restartDevMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/pm2/dev/reload')
      return response.data
    },
  })

  // Set selected branch to current branch when data loads
  useEffect(() => {
    if (branchesQuery.data?.current && !selectedBranch) {
      setSelectedBranch(branchesQuery.data.current)
    }
  }, [branchesQuery.data, selectedBranch])

  const pullMutation = useMutation<
    {
      success: boolean
      message: string
      changes?: string[]
      conflicts?: string[]
      sql_migrations?: string[]
      build_dashboard_changes?: string[]
      should_reload?: boolean
    },
    Error,
    { stash_changes: boolean; force: boolean; branch?: string }
  >({
    mutationFn: async (data: { stash_changes: boolean; force: boolean; branch?: string }) => {
      const response = await api.post('/git/pull', data)
      return response.data
    },
    onSuccess: (data) => {
      setPullResult(data)
      
      // Check for SQL migrations first
      if (data.sql_migrations && data.sql_migrations.length > 0) {
        setShowSQLDialog(true)
      }
      // Then check for build dashboard changes after SQL is handled
      else if (data.build_dashboard_changes && data.build_dashboard_changes.length > 0) {
        setShowBuildDashboardDialog(true)
      }
      // Otherwise just restart dev if changes exist
      else if (data.should_reload) {
        setTimeout(() => restartDevMutation.mutate(), 2000)
      }
    }
  })

  const handlePull = () => {
    pullMutation.mutate({ 
      stash_changes: stashChanges, 
      force,
      branch: selectedBranch || undefined
    })
  }

  // Handle SQL dialog close
  const handleSQLDialogClose = () => {
    setShowSQLDialog(false)
    
    // After SQL dialog, check for build dashboard updates
    if (pullResult?.build_dashboard_changes && pullResult.build_dashboard_changes.length > 0) {
      setShowBuildDashboardDialog(true)
    }
    // Otherwise just restart dev
    else if (pullResult?.should_reload) {
      setTimeout(() => restartDevMutation.mutate(), 1000)
    }
  }

  const handleRestartDev = () => {
    restartDevMutation.mutate()
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="glass rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Git Pull</h1>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={handlePull}
              disabled={pullMutation.isPending}
              className="py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {pullMutation.isPending ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Pulling...
                </>
              ) : (
                <>
                  <GitBranch size={20} />
                  Pull from Git
                </>
              )}
            </button>

            <button
              onClick={handleRestartDev}
              disabled={restartDevMutation.isPending}
              className="py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {restartDevMutation.isPending ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Restarting...
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  Restart Dev Server
                </>
              )}
            </button>
          </div>

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

            {pullMutation.isSuccess && (
              <div className="glass-subtle rounded-xl p-6 border border-green-500/50">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-green-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h3 className="text-green-400 font-semibold mb-2">Pull Successful</h3>
                    <p className="text-slate-300 text-sm">{pullMutation.data.message}</p>
                    {pullMutation.data.changes && pullMutation.data.changes.length > 0 && (
                      <div className="mt-3">
                        <p className="text-slate-400 text-sm mb-2">Changes:</p>
                        <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                          {pullMutation.data.changes.map((change: string, idx: number) => (
                            <li key={idx}>{change}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-3 p-2 bg-sky-500/10 rounded-lg border border-sky-500/30">
                      <div className="flex items-center gap-2 text-sky-400 text-sm">
                        <RefreshCw className="animate-spin" size={16} />
                        <span>Dev server will restart automatically in 2 seconds...</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {pullMutation.isError && (
              <div className="glass-subtle rounded-xl p-6 border border-rose-500/50">
                <div className="flex items-start gap-3">
                  <XCircle className="text-rose-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h3 className="text-rose-400 font-semibold mb-2">Pull Failed</h3>
                    <p className="text-slate-300 text-sm">
                      {(pullMutation.error as any)?.response?.data?.message || 'An error occurred'}
                    </p>
                    {((pullMutation.error as any)?.response?.data?.conflicts || []).length > 0 && (
                      <div className="mt-3">
                        <p className="text-slate-400 text-sm mb-2">Conflicts detected:</p>
                        <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                          {((pullMutation.error as any)?.response?.data?.conflicts || []).map((conflict: string, idx: number) => (
                            <li key={idx}>{conflict}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {restartDevMutation.isSuccess && (
              <div className="glass-subtle rounded-xl p-6 border border-green-500/50">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-green-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h3 className="text-green-400 font-semibold mb-2">Dev Server Restarted</h3>
                    <p className="text-slate-300 text-sm">{restartDevMutation.data.message || 'Development server has been restarted successfully'}</p>
                    <p className="text-slate-400 text-xs mt-2">You can now test your uploaded changes.</p>
                  </div>
                </div>
              </div>
            )}

            {restartDevMutation.isError && (
              <div className="glass-subtle rounded-xl p-6 border border-rose-500/50">
                <div className="flex items-start gap-3">
                  <XCircle className="text-rose-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h3 className="text-rose-400 font-semibold mb-2">Restart Failed</h3>
                    <p className="text-slate-300 text-sm">
                      {(restartDevMutation.error as any)?.response?.data?.message || 'Failed to restart development server'}
                    </p>
                    <p className="text-slate-400 text-xs mt-2">Please check the server logs and try again.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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

