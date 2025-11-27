import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { XCircle } from 'lucide-react'

export default function PackagesTab({ selectedEnvironment }: { selectedEnvironment: 'dev' | 'prod' }) {
  // Package Versions Query
  const { data: packages } = useQuery({
    queryKey: ['packages', selectedEnvironment],
    queryFn: async () => {
      const response = await api.get(`/troubleshooting/packages/${selectedEnvironment}`)
      return response.data
    }
  })

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Package Versions - {selectedEnvironment.toUpperCase()}</h2>

      {packages ? (
        packages.error ? (
          <div className="bg-rose-500/20 border border-rose-500/50 rounded-lg p-6 text-center">
            <XCircle className="mx-auto text-rose-400 mb-3" size={48} />
            <p className="text-rose-400">{packages.error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/5 p-4 rounded-lg">
              <div className="text-slate-400 text-sm mb-1">Total Packages</div>
              <div className="text-white text-2xl font-bold">{packages.packages?.total_count || 0}</div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-3">Dependencies ({Object.keys(packages.packages?.dependencies || {}).length})</h3>
              <div className="bg-black/50 p-4 rounded-lg max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(packages.packages?.dependencies || {}).map(([pkg, version]: [string, any]) => (
                      <tr key={pkg} className="border-b border-white/10">
                        <td className="py-2 text-slate-300">{pkg}</td>
                        <td className="py-2 text-sky-400 text-right font-mono">{version}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-3">Dev Dependencies ({Object.keys(packages.packages?.devDependencies || {}).length})</h3>
              <div className="bg-black/50 p-4 rounded-lg max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(packages.packages?.devDependencies || {}).map(([pkg, version]: [string, any]) => (
                      <tr key={pkg} className="border-b border-white/10">
                        <td className="py-2 text-slate-300">{pkg}</td>
                        <td className="py-2 text-purple-400 text-right font-mono">{version}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  )
}
