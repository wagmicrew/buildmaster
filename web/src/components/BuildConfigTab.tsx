import { useState } from 'react'
import { Play, Loader, Settings, Zap, Activity, Rocket, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

export default function BuildConfigTab({ 
  config, 
  onChange, 
  startBuildMutation 
}: { 
  config: any
  onChange: (config: any) => void
  startBuildMutation: any
}) {
  const [buildType, setBuildType] = useState<'development' | 'production'>('development')
  
  // Check for active builds
  const { data: activeBuildCheck } = useQuery({
    queryKey: ['active-build-check'],
    queryFn: async () => {
      const response = await api.get('/build/active')
      return response.data
    },
    refetchInterval: 2000,
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="text-green-400" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-white">Build Configuration</h2>
          <p className="text-slate-400">Configure build parameters and start new builds</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Build Mode */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Build Mode
          </label>
          <select
            value={config.build_mode}
            onChange={(e) => onChange({ ...config, build_mode: e.target.value })}
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            <option value="quick" className="bg-slate-800 text-white">Quick Build</option>
            <option value="full" className="bg-slate-800 text-white">Full Build</option>
            <option value="ram-optimized" className="bg-slate-800 text-white">RAM Optimized</option>
          </select>
        </div>

        {/* Workers */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Workers
          </label>
          <input
            type="number"
            value={config.workers}
            onChange={(e) => onChange({ ...config, workers: parseInt(e.target.value) })}
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            min="1"
            max="8"
          />
        </div>

        {/* Memory */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Max Old Space Size (MB)
          </label>
          <input
            type="number"
            value={config.max_old_space_size}
            onChange={(e) => onChange({ ...config, max_old_space_size: parseInt(e.target.value) })}
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            min="1024"
            max="16384"
            step="1024"
          />
        </div>

        {/* Build Flags */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Build Options
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.test_database}
              onChange={(e) => onChange({ ...config, test_database: e.target.checked })}
              className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
            />
            <span className="text-slate-300">Test Database</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.test_redis}
              onChange={(e) => onChange({ ...config, test_redis: e.target.checked })}
              className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
            />
            <span className="text-slate-300">Test Redis</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.skip_deps}
              onChange={(e) => onChange({ ...config, skip_deps: e.target.checked })}
              className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
            />
            <span className="text-slate-300">Skip Dependencies</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.force_clean}
              onChange={(e) => onChange({ ...config, force_clean: e.target.checked })}
              className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
            />
            <span className="text-slate-300">Force Clean</span>
          </label>
        </div>

        {/* Advanced Options */}
        <div className="border-t border-slate-700 pt-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors mb-4"
          >
            <Settings size={18} />
            <span className="font-medium">Advanced Options</span>
            <span className="text-xs">({showAdvanced ? 'Hide' : 'Show'})</span>
          </button>

          {showAdvanced && (
            <div className="space-y-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-4">
                <Zap size={14} className="inline mr-1" />
                Performance & Optimization Settings
              </p>

              {/* Performance Options */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.use_redis_cache}
                    onChange={(e) => onChange({ ...config, use_redis_cache: e.target.checked })}
                    className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                  />
                  <span className="text-slate-300 text-sm">
                    🚀 Use Redis Build Cache <span className="text-green-400">(-40% time)</span>
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.incremental_build}
                    onChange={(e) => onChange({ ...config, incremental_build: e.target.checked })}
                    className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                  />
                  <span className="text-slate-300 text-sm">
                    📦 Incremental Build <span className="text-green-400">(-30% time)</span>
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.parallel_processing}
                    onChange={(e) => onChange({ ...config, parallel_processing: e.target.checked })}
                    className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                  />
                  <span className="text-slate-300 text-sm">
                    ⚡ Parallel Processing <span className="text-green-400">(-20% time)</span>
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.skip_type_check}
                    onChange={(e) => onChange({ ...config, skip_type_check: e.target.checked })}
                    className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                  />
                  <span className="text-slate-300 text-sm">
                    ⏭️ Skip TypeScript Type Checking <span className="text-yellow-400">(risky, -60% time)</span>
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.experimental_turbo}
                    onChange={(e) => onChange({ ...config, experimental_turbo: e.target.checked })}
                    className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                  />
                  <span className="text-slate-300 text-sm">
                    🔥 Experimental Turbo Mode <span className="text-rose-400">(unstable, -50% time)</span>
                  </span>
                </label>
              </div>

              {/* Output Optimization */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs text-slate-400 mb-3">Output Optimization</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.minify_output}
                      onChange={(e) => onChange({ ...config, minify_output: e.target.checked })}
                      className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                    />
                    <span className="text-slate-300 text-sm">Minify Output</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.tree_shaking}
                      onChange={(e) => onChange({ ...config, tree_shaking: e.target.checked })}
                      className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                    />
                    <span className="text-slate-300 text-sm">Tree Shaking (Remove unused code)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.code_splitting}
                      onChange={(e) => onChange({ ...config, code_splitting: e.target.checked })}
                      className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                    />
                    <span className="text-slate-300 text-sm">Code Splitting</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.compress_assets}
                      onChange={(e) => onChange({ ...config, compress_assets: e.target.checked })}
                      className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                    />
                    <span className="text-slate-300 text-sm">Compress Assets (Gzip/Brotli)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.optimize_images}
                      onChange={(e) => onChange({ ...config, optimize_images: e.target.checked })}
                      className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                    />
                    <span className="text-slate-300 text-sm">Optimize Images</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.source_maps}
                      onChange={(e) => onChange({ ...config, source_maps: e.target.checked })}
                      className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                    />
                    <span className="text-slate-300 text-sm">Generate Source Maps</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.remove_console_logs}
                      onChange={(e) => onChange({ ...config, remove_console_logs: e.target.checked })}
                      className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
                    />
                    <span className="text-slate-300 text-sm">Remove Console Logs (Production)</span>
                  </label>
                </div>
              </div>

              {/* Additional Advanced Options */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs text-slate-400 mb-3">Additional Options</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Max Semi Space Size (MB)
                    </label>
                    <input
                      type="number"
                      value={config.max_semi_space_size}
                      onChange={(e) => onChange({ ...config, max_semi_space_size: parseInt(e.target.value) })}
                      className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 text-sm"
                      min="0"
                      max="1024"
                      step="64"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Build Type Selector */}
        <div className="bg-gradient-to-br from-sky-500/20 to-purple-500/20 rounded-xl p-6 border border-sky-500/30">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Rocket className="text-sky-400" size={20} />
            Build Type
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setBuildType('development')}
              className={`p-4 rounded-lg border-2 transition-all ${
                buildType === 'development'
                  ? 'bg-sky-500/20 border-sky-500 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              <Zap size={24} className="mx-auto mb-2" />
              <div className="font-semibold">Development</div>
              <div className="text-xs mt-1">Fast iteration</div>
            </button>
            <button
              onClick={() => setBuildType('production')}
              className={`p-4 rounded-lg border-2 transition-all ${
                buildType === 'production'
                  ? 'bg-emerald-500/20 border-emerald-500 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              <Rocket size={24} className="mx-auto mb-2" />
              <div className="font-semibold">Production</div>
              <div className="text-xs mt-1">Optimized for deploy</div>
            </button>
          </div>
          
          {buildType === 'production' && (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
              <div className="font-semibold mb-1 flex items-center gap-2">
                <AlertCircle size={14} />
                Production Build
              </div>
              <div>This will create an optimized build in /var/www/dintrafikskolax_dev ready for deployment</div>
            </div>
          )}
        </div>

        {/* Heartbeat Status */}
        {activeBuildCheck?.has_active_build && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 flex items-center gap-3">
            <Activity className="text-sky-400 animate-pulse" size={20} />
            <div>
              <div className="text-sm font-semibold text-sky-300">Build in Progress</div>
              <div className="text-xs text-slate-400">Build ID: {activeBuildCheck.active_build?.build_id?.substring(0, 8)}...</div>
            </div>
          </div>
        )}

        {/* Start Build Button */}
        <button
          onClick={() => startBuildMutation.mutate({ ...config, build_type: buildType })}
          disabled={startBuildMutation.isPending || activeBuildCheck?.has_active_build}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg"
        >
          {startBuildMutation.isPending ? (
            <>
              <Loader className="animate-spin" size={20} />
              Starting {buildType === 'production' ? 'Production' : 'Development'} Build...
            </>
          ) : activeBuildCheck?.has_active_build ? (
            <>
              <Activity className="animate-pulse" size={20} />
              Build Already Running
            </>
          ) : (
            <>
              {buildType === 'production' ? <Rocket size={20} /> : <Play size={20} />}
              Start {buildType === 'production' ? 'Production' : 'Development'} Build
            </>
          )}
        </button>
      </div>
    </div>
  )
}
