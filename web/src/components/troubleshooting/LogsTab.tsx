import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { Loader } from 'lucide-react'

export default function LogsTab() {
  const [selectedLogType, setSelectedLogType] = useState<'pm2-dev' | 'pm2-prod' | 'nginx' | 'postgres' | 'mail' | 'syslog'>('pm2-dev')

  // Logs Query
  const { data: logs } = useQuery({
    queryKey: ['logs', selectedLogType],
    queryFn: async () => {
      if (selectedLogType.startsWith('pm2-')) {
        const appName = selectedLogType === 'pm2-dev' ? 'dintrafikskolax-dev' : 'dintrafikskolax-prod'
        const response = await api.get(`/troubleshooting/pm2-logs/${appName}?lines=100`)
        return response.data
      } else {
        const response = await api.get(`/troubleshooting/system-logs/${selectedLogType}?lines=100`)
        return response.data
      }
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Log Viewer</h2>
        <select
          value={selectedLogType}
          onChange={(e) => setSelectedLogType(e.target.value as any)}
          className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        >
          <option value="pm2-dev" className="bg-slate-800 text-white">PM2 Dev</option>
          <option value="pm2-prod" className="bg-slate-800 text-white">PM2 Prod</option>
          <option value="nginx" className="bg-slate-800 text-white">Nginx</option>
          <option value="postgres" className="bg-slate-800 text-white">PostgreSQL</option>
          <option value="mail" className="bg-slate-800 text-white">Mail</option>
          <option value="syslog" className="bg-slate-800 text-white">Syslog</option>
        </select>
      </div>

      {logs ? (
        logs.error ? (
          <div className="bg-rose-500/20 border border-rose-500/50 rounded-lg p-4">
            <p className="text-rose-400">{logs.error}</p>
          </div>
        ) : (
          <pre className="bg-black/50 p-4 rounded-lg text-xs text-slate-300 overflow-auto max-h-[600px] font-mono border border-white/10">
            {logs.logs?.join('\n') || 'No logs available'}
          </pre>
        )
      ) : (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin text-orange-400" size={32} />
        </div>
      )}
    </div>
  )
}
