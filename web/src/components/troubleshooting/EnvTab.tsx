import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

export default function EnvTab({ selectedEnvironment }: { selectedEnvironment: 'dev' | 'prod' }) {
  // Environment Analysis Query
  const { data: envAnalysis } = useQuery({
    queryKey: ['env-analysis', selectedEnvironment],
    queryFn: async () => {
      const response = await api.get(`/troubleshooting/env-analysis/${selectedEnvironment}`)
      return response.data
    }
  })

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Environment Analysis - {selectedEnvironment.toUpperCase()}</h2>

      {envAnalysis ? (
        <div className="space-y-6">
          {/* Issues */}
          {envAnalysis.issues && envAnalysis.issues.length > 0 && (
            <div>
              <h3 className="text-rose-400 font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle size={20} />
                Critical Issues
              </h3>
              <div className="space-y-2">
                {envAnalysis.issues.map((issue: any, index: number) => (
                  <div key={index} className="bg-rose-500/20 border border-rose-500/50 rounded-lg p-4">
                    <div className="text-rose-400 font-medium">{issue.issue}</div>
                    <div className="text-slate-400 text-sm mt-1">File: {issue.file}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {envAnalysis.warnings && envAnalysis.warnings.length > 0 && (
            <div>
              <h3 className="text-yellow-400 font-semibold mb-3">Warnings</h3>
              <div className="space-y-2">
                {envAnalysis.warnings.map((warning: any, index: number) => (
                  <div key={index} className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
                    <div className="text-yellow-400 font-medium">{warning.warning}</div>
                    <div className="text-slate-400 text-sm mt-1">File: {warning.file}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Environment Files */}
          <div>
            <h3 className="text-white font-semibold mb-3">Environment Files</h3>
            <div className="space-y-3">
              {Object.entries(envAnalysis.env_files || {}).map(([file, data]: [string, any]) => (
                <div key={file} className="bg-white/5 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{file}</span>
                    {data.exists ? (
                      <CheckCircle className="text-green-400" size={20} />
                    ) : (
                      <XCircle className="text-slate-600" size={20} />
                    )}
                  </div>
                  {data.exists && data.variable_count !== undefined && (
                    <div className="text-slate-400 text-sm">
                      {data.variable_count} variables
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  )
}
