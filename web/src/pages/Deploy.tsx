import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { Rocket, CheckCircle, XCircle, Loader, AlertTriangle } from 'lucide-react'

export default function Deploy() {
  const [buildId, setBuildId] = useState('')
  const [skipBackup, setSkipBackup] = useState(false)

  const deployMutation = useMutation({
    mutationFn: async (data: { build_id?: string; skip_backup: boolean }) => {
      const response = await api.post('/deploy/golive', data)
      return response.data
    },
  })

  const handleDeploy = () => {
    deployMutation.mutate({
      build_id: buildId || undefined,
      skip_backup: skipBackup,
    })
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Rocket className="text-rose-400" size={32} />
            <h1 className="text-3xl font-bold text-white">Go Live!</h1>
          </div>

          <div className="mb-6 glass-subtle rounded-xl p-4 border border-yellow-500/50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-yellow-400 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="text-yellow-400 font-semibold mb-1">Warning</h3>
                <p className="text-slate-300 text-sm">
                  This will deploy the current build from dev to production and restart the production server.
                  Make sure you have tested the build on dev.dintrafikskolahlm.se first.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Build ID (optional)
              </label>
              <input
                type="text"
                value={buildId}
                onChange={(e) => setBuildId(e.target.value)}
                placeholder="Leave empty to use latest build"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={skipBackup}
                onChange={(e) => setSkipBackup(e.target.checked)}
                className="w-5 h-5 rounded border-white/20 bg-white/10 text-sky-500 focus:ring-2 focus:ring-sky-500"
              />
              <span className="text-slate-300">Skip backup (not recommended)</span>
            </label>

            <button
              onClick={handleDeploy}
              disabled={deployMutation.isPending}
              className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
            >
              {deployMutation.isPending ? (
                <>
                  <Loader className="animate-spin" size={24} />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket size={24} />
                  Deploy to Production
                </>
              )}
            </button>

            {deployMutation.isSuccess && (
              <div className="glass-subtle rounded-xl p-6 border border-green-500/50">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-green-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h3 className="text-green-400 font-semibold mb-2">Deployment Successful</h3>
                    <p className="text-slate-300 text-sm">{deployMutation.data.message}</p>
                    {deployMutation.data.build_id && (
                      <p className="text-slate-400 text-sm mt-2">
                        Build ID: {deployMutation.data.build_id}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {deployMutation.isError && (
              <div className="glass-subtle rounded-xl p-6 border border-rose-500/50">
                <div className="flex items-start gap-3">
                  <XCircle className="text-rose-400 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h3 className="text-rose-400 font-semibold mb-2">Deployment Failed</h3>
                    <p className="text-slate-300 text-sm">
                      {(deployMutation.error as any)?.response?.data?.message || 'An error occurred'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

