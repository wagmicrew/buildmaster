import { useState } from 'react'
import { X, Database, Copy, CheckCircle } from 'lucide-react'

interface SQLMigrationDialogProps {
  isOpen: boolean
  onClose: () => void
  migrations: string[]
}

export default function SQLMigrationDialog({
  isOpen,
  onClose,
  migrations
}: SQLMigrationDialogProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  if (!isOpen) return null

  const handleCopy = (migration: string, index: number) => {
    const command = `psql -h 127.0.0.1 -U mintrafiktest -d mintrafiktest -f /var/www/dintrafikskolax_dev/${migration}`
    navigator.clipboard.writeText(command)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-sky-500/30 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-500/20 to-blue-500/20 border-b border-sky-500/30 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/20 rounded-lg">
                <Database className="text-sky-400" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">SQL Migrations Detected</h2>
                <p className="text-slate-400 text-sm">Run these migrations on your dev database</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="text-slate-400" size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 mb-6">
            <div className="text-sm text-sky-300">
              <strong>{migrations.length}</strong> SQL migration file(s) detected. 
              Copy and run these commands on your dev database.
            </div>
          </div>

          {/* Migration Files */}
          <div className="space-y-4">
            {migrations.map((migration, idx) => (
              <div
                key={idx}
                className="bg-black/30 border border-white/10 rounded-lg p-4"
              >
                <div className="flex items-start gap-3 mb-3">
                  <Database className="text-emerald-400 mt-1 flex-shrink-0" size={16} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white mb-1">
                      {migration.split('/').pop()}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {migration}
                    </div>
                  </div>
                </div>

                {/* Command */}
                <div className="bg-black/50 rounded-lg p-3 border border-white/10">
                  <div className="flex items-start gap-2">
                    <code className="flex-1 text-xs text-emerald-400 font-mono break-all">
                      psql -h 127.0.0.1 -U mintrafiktest -d mintrafiktest -f /var/www/dintrafikskolax_dev/{migration}
                    </code>
                    <button
                      onClick={() => handleCopy(migration, idx)}
                      className="flex-shrink-0 p-2 hover:bg-white/10 rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedIndex === idx ? (
                        <CheckCircle className="text-green-400" size={16} />
                      ) : (
                        <Copy className="text-slate-400" size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div className="mt-6 bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="text-sm text-slate-300 font-semibold mb-2">
              📝 How to run:
            </div>
            <ol className="text-xs text-slate-400 space-y-1 ml-4 list-decimal">
              <li>SSH into the server: <code className="text-emerald-400">ssh root@dintrafikskolahlm.se</code></li>
              <li>Copy and paste each command above</li>
              <li>Verify migration was successful</li>
              <li>Click "Continue" when done</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white/5 border-t border-white/10 p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white rounded-lg transition-all font-medium shadow-lg"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
