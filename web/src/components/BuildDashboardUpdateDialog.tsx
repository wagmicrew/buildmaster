import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { X, AlertCircle, Loader, CheckCircle, XCircle, Package, RefreshCw } from 'lucide-react'

interface BuildDashboardUpdateDialogProps {
  isOpen: boolean
  onClose: () => void
  changedFiles: string[]
}

export default function BuildDashboardUpdateDialog({
  isOpen,
  onClose,
  changedFiles
}: BuildDashboardUpdateDialogProps) {
  const [installing, setInstalling] = useState(false)
  const [installSteps, setInstallSteps] = useState<Array<{
    step: string
    status: 'pending' | 'running' | 'success' | 'error'
    message: string
  }>>([])

  const installMutation = useMutation({
    mutationFn: async () => {
      setInstalling(true)
      
      // Initialize steps
      setInstallSteps([
        { step: 'copy_api', status: 'pending', message: 'Copy API files' },
        { step: 'build_frontend', status: 'pending', message: 'Build frontend' },
        { step: 'restart_api', status: 'pending', message: 'Restart API server' }
      ])
      
      const response = await api.post('/build-dashboard/install')
      return response.data
    },
    onSuccess: (data) => {
      // Update steps from response
      if (data.steps) {
        setInstallSteps(data.steps.map((s: any) => ({
          step: s.step,
          status: s.status === 'success' ? 'success' : s.status === 'error' ? 'error' : 'running',
          message: s.message
        })))
      }
      
      // Wait 2 seconds then reload
      setTimeout(() => {
        // Force logout and reload
        localStorage.removeItem('session_token')
        window.location.href = '/login'
      }, 2000)
    },
    onError: () => {
      setInstallSteps(prev => prev.map(s => 
        s.status === 'pending' || s.status === 'running' 
          ? { ...s, status: 'error' }
          : s
      ))
    }
  })

  if (!isOpen) return null

  const handleInstall = () => {
    installMutation.mutate()
  }

  const handleCancel = () => {
    if (!installing) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-orange-500/30 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-b border-orange-500/30 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Package className="text-orange-400" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Build Dashboard Update</h2>
                <p className="text-slate-400 text-sm">New changes detected in build dashboard</p>
              </div>
            </div>
            {!installing && (
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="text-slate-400" size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {!installing ? (
            <>
              {/* Warning */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-orange-400 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <div className="font-semibold text-orange-400 mb-2">Action Required</div>
                    <div className="text-sm text-slate-300">
                      This commit includes {changedFiles.length} change(s) to the Build Dashboard. 
                      Updating will:
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-slate-400 ml-5 list-disc">
                      <li>Copy updated files to /var/www/build</li>
                      <li>Rebuild the frontend interface</li>
                      <li>Restart the API server</li>
                      <li>Require you to login again</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Changed Files */}
              <div className="mb-6">
                <div className="text-sm font-semibold text-slate-300 mb-3">Changed Files:</div>
                <div className="bg-black/30 rounded-lg p-4 max-h-40 overflow-y-auto">
                  {changedFiles.map((file, idx) => (
                    <div key={idx} className="text-xs font-mono text-slate-400 py-1">
                      {file.replace('Documentation_new/build-dashboard/', '')}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Installation Progress */}
              <div className="space-y-3">
                {installSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      step.status === 'success' 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : step.status === 'error'
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : step.status === 'running'
                        ? 'bg-sky-500/10 border-sky-500/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    {step.status === 'pending' && (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                    )}
                    {step.status === 'running' && (
                      <Loader className="text-sky-400 animate-spin" size={20} />
                    )}
                    {step.status === 'success' && (
                      <CheckCircle className="text-green-400" size={20} />
                    )}
                    {step.status === 'error' && (
                      <XCircle className="text-rose-400" size={20} />
                    )}
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${
                        step.status === 'success' ? 'text-green-400' :
                        step.status === 'error' ? 'text-rose-400' :
                        step.status === 'running' ? 'text-sky-400' :
                        'text-slate-400'
                      }`}>
                        {step.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {installMutation.isSuccess && (
                <div className="mt-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="text-green-400 animate-spin" size={20} />
                    <div className="text-sm text-green-400">
                      Installation complete! Redirecting to login...
                    </div>
                  </div>
                </div>
              )}

              {installMutation.isError && (
                <div className="mt-6 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
                  <div className="text-sm text-rose-400">
                    Installation failed: {installMutation.error instanceof Error ? installMutation.error.message : 'Unknown error'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!installing && (
          <div className="bg-white/5 border-t border-white/10 p-6 flex gap-3 justify-end">
            <button
              onClick={handleCancel}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleInstall}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg transition-all font-medium shadow-lg"
            >
              Update Build Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
