import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { GitBranch, AlertTriangle, CheckCircle, ArrowDown, RefreshCw } from 'lucide-react'

export default function GitEnvironmentStatus() {
  const { data: gitStatus, isLoading, refetch } = useQuery({
    queryKey: ['git-status'],
    queryFn: async () => {
      const response = await api.get('/git/status/detailed')
      return response.data
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  
  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-slate-400">
          <RefreshCw className="animate-spin" size={20} />
          Loading git status...
        </div>
      </div>
    )
  }

  if (!gitStatus) {
    return null
  }

  // Check if this is an error response (has 'detail' property)
  if (typeof gitStatus === 'object' && 'detail' in gitStatus) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-rose-400">
          <AlertTriangle size={20} />
          Failed to load git status
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitBranch className="text-sky-400" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-white">Git Status</h2>
            <p className="text-slate-400 text-sm">Current Repository Status</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} className="text-slate-400" />
        </button>
      </div>

      {/* Git Status Card */}
      <div className={`border rounded-xl p-4 ${gitStatus?.clean ? 'border-green-500/50 bg-green-500/10' : 'border-yellow-500/50 bg-yellow-500/10'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {gitStatus?.clean ? (
              <CheckCircle className="text-green-400" size={24} />
            ) : (
              <AlertTriangle className="text-yellow-400" size={24} />
            )}
            <span className="font-semibold text-white text-lg">Working Directory</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            gitStatus?.clean ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {gitStatus?.clean ? 'Clean' : 'Modified'}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Branch:</span>
            <span className="text-white font-mono">{gitStatus?.branch || 'N/A'}</span>
          </div>
          
          {gitStatus?.current_commit_short && (
            <div className="flex justify-between">
              <span className="text-slate-400">Dev Commit:</span>
              <span className="text-emerald-400 font-mono text-xs">{gitStatus.current_commit_short}</span>
            </div>
          )}
          
          {gitStatus?.latest_remote_commit_short && (
            <div className="flex justify-between">
              <span className="text-slate-400">Remote Commit:</span>
              <span className="text-sky-400 font-mono text-xs">{gitStatus.latest_remote_commit_short}</span>
            </div>
          )}
          
          {gitStatus?.prod_commit_short && (
            <div className="flex justify-between">
              <span className="text-slate-400">Prod Commit:</span>
              <span className="text-rose-400 font-mono text-xs">{gitStatus.prod_commit_short}</span>
            </div>
          )}
          
          {gitStatus?.commits_in_sync !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-400">Sync Status:</span>
              <span className={`text-xs font-medium ${
                gitStatus.commits_in_sync ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {gitStatus.commits_in_sync ? '✓ In Sync' : '✗ Out of Sync'}
              </span>
            </div>
          )}
          
          {gitStatus?.commit_message && (
            <div className="pt-1 text-xs text-slate-300 italic truncate" title={gitStatus.commit_message}>
              "{gitStatus.commit_message}"
            </div>
          )}
          
          {gitStatus?.commit_date && (
            <div className="text-xs text-slate-500">
              {gitStatus.commit_date}
            </div>
          )}
          
          {gitStatus?.ahead > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Ahead of remote:</span>
              <span className="text-sky-400 font-medium">{gitStatus.ahead} commits</span>
            </div>
          )}
          
          {gitStatus?.behind > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Behind remote:</span>
              <span className="text-yellow-400 font-medium">{gitStatus.behind} commits</span>
            </div>
          )}

          {/* File Changes */}
          {(gitStatus?.modified?.length > 0 || gitStatus?.added?.length > 0 || gitStatus?.deleted?.length > 0 || gitStatus?.untracked?.length > 0) && (
            <div className="pt-2 border-t border-white/10">
              <div className="text-slate-400 text-xs mb-2">File Changes:</div>
              <div className="space-y-1">
                {gitStatus?.modified?.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-yellow-400 text-xs">Modified:</span>
                    <span className="text-white text-xs">{gitStatus.modified.length} files</span>
                  </div>
                )}
                {gitStatus?.added?.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-green-400 text-xs">Added:</span>
                    <span className="text-white text-xs">{gitStatus.added.length} files</span>
                  </div>
                )}
                {gitStatus?.deleted?.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-rose-400 text-xs">Deleted:</span>
                    <span className="text-white text-xs">{gitStatus.deleted.length} files</span>
                  </div>
                )}
                {gitStatus?.untracked?.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-purple-400 text-xs">Untracked:</span>
                    <span className="text-white text-xs">{gitStatus.untracked.length} files</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Recommendation */}
      {!gitStatus?.clean && gitStatus?.file_count > 0 && (
        <div className="mt-4 p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-yellow-400 mt-0.5" size={16} />
            <div className="flex-1">
              <div className="font-medium text-sm text-yellow-400">Uncommitted changes</div>
              <div className="text-xs opacity-75 mt-1">
                You have {gitStatus.file_count} file(s) with uncommitted changes
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!gitStatus?.commits_in_sync && gitStatus?.file_count === 0 && gitStatus?.behind > 0 && (
        <div className="mt-4 p-3 rounded-lg border border-sky-500/50 bg-sky-500/10">
          <div className="flex items-start gap-2">
            <ArrowDown className="text-sky-400 mt-0.5" size={16} />
            <div className="flex-1">
              <div className="font-medium text-sm text-sky-400">Updates available</div>
              <div className="text-xs opacity-75 mt-1">
                {gitStatus.behind} commit(s) behind remote - pull to update
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
