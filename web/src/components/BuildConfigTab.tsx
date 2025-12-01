import { useState } from 'react'
import { Play, Loader, Settings, Zap, Activity, Rocket, AlertCircle, Code2, Server, HelpCircle, Layers } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

// Project type options
const PROJECT_TYPES = [
  { value: 'auto', label: 'Auto-detect', description: 'Automatically detect from package.json' },
  { value: 'nextjs', label: 'Next.js', description: 'Next.js React framework' },
]

// Build target options
const BUILD_TARGETS = [
  { value: 'development', label: 'Development', description: 'Development build with source maps', color: 'blue' },
  { value: 'production', label: 'Production', description: 'Optimized production build', color: 'green' },
]

// Help tooltip component
function HelpTooltip({ text, children }: { text: string; children?: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-slate-500 hover:text-slate-300 transition-colors ml-1"
      >
        <HelpCircle size={14} />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 border border-slate-600 rounded-lg shadow-xl text-xs text-slate-300">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 border-r border-b border-slate-600"></div>
          {text}
          {children}
        </div>
      )}
    </div>
  )
}

// Option with help text
function BuildOption({ 
  label, 
  helpText, 
  checked, 
  onChange, 
  badge,
  badgeColor = 'green'
}: { 
  label: string
  helpText: string
  checked: boolean
  onChange: (checked: boolean) => void
  badge?: string
  badgeColor?: 'green' | 'yellow' | 'rose' | 'blue'
}) {
  const badgeColors = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    rose: 'text-rose-400',
    blue: 'text-blue-400'
  }
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-green-500 bg-slate-800 border-slate-600 rounded focus:ring-2 focus:ring-green-500/20"
      />
      <span className="text-slate-300 text-sm flex items-center">
        {label}
        {badge && <span className={`ml-2 ${badgeColors[badgeColor]}`}>({badge})</span>}
        <HelpTooltip text={helpText} />
      </span>
    </label>
  )
}

// Next.js specific build options
const NEXTJS_OPTIONS = {
  next_standalone: {
    label: 'Standalone Output',
    help: 'Create a standalone build with all dependencies bundled. Ideal for Docker deployments. Reduces node_modules size by 80%+.',
    default: true
  },
  next_export: {
    label: 'Static Export',
    help: 'Export as static HTML. No server required but loses SSR/ISR features. Good for static hosting (Netlify, Vercel static).',
    default: false
  },
  next_swc_minify: {
    label: 'SWC Minification',
    help: 'Use SWC instead of Terser for minification. 7x faster builds with similar output size. Recommended for Next.js 13+.',
    default: true
  },
  next_image_optimization: {
    label: 'Image Optimization',
    help: 'Enable Next.js Image Optimization API. Automatically serves optimized images in modern formats (WebP, AVIF).',
    default: true
  },
  next_bundle_analyzer: {
    label: 'Bundle Analyzer',
    help: 'Generate visual bundle analysis report. Opens interactive treemap showing module sizes. Great for optimization.',
    default: false
  },
  next_modularize_imports: {
    label: 'Modularize Imports',
    help: 'Automatically transform barrel imports to direct imports. Reduces bundle size for libraries like lodash, MUI, etc.',
    default: true
  }
}

// Helper function to get build settings based on build mode
function getBuildSettings(buildMode: string) {
  switch (buildMode) {
    case 'quick':
      return {
        skipDeps: true,
        forceClean: false,
        testDatabase: false,
        testRedis: false,
        skipPM2: true,
        skipRedis: true,
        memoryMonitoring: false,
        buildScript: 'build:quick'
      }
    case 'clean':
      return {
        skipDeps: false,
        forceClean: true,
        testDatabase: true,
        testRedis: true,
        skipPM2: false,
        skipRedis: false,
        memoryMonitoring: false,
        buildScript: 'build:clean'
      }
    case 'phased':
      return {
        skipDeps: false,
        forceClean: false,
        testDatabase: false,
        testRedis: false,
        skipPM2: false,
        skipRedis: false,
        memoryMonitoring: true,
        buildScript: 'build:phased'
      }
    case 'phased-prod':
      return {
        skipDeps: false,
        forceClean: false,
        testDatabase: true,
        testRedis: true,
        skipPM2: false,
        skipRedis: false,
        memoryMonitoring: true,
        buildScript: 'build:phased:prod'
      }
    case 'ram-optimized':
      return {
        skipDeps: false,
        forceClean: false,
        testDatabase: true,
        testRedis: true,
        skipPM2: false,
        skipRedis: false,
        memoryMonitoring: false,
        buildScript: 'build:server'
      }
    default: // full
      return {
        skipDeps: false,
        forceClean: false,
        testDatabase: true,
        testRedis: true,
        skipPM2: false,
        skipRedis: false,
        memoryMonitoring: false,
        buildScript: 'build:server'
      }
  }
}

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
        {/* Project Type */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            <Code2 size={16} className="text-purple-400" />
            Project Type
          </label>
          <select
            value={config.project_type || 'auto'}
            onChange={(e) => onChange({ ...config, project_type: e.target.value })}
            className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            {PROJECT_TYPES.map((type) => (
              <option key={type.value} value={type.value} className="bg-slate-800 text-white">
                {type.label} - {type.description}
              </option>
            ))}
          </select>
        </div>

        {/* Build Target (Development vs Production) */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            <Server size={16} className="text-cyan-400" />
            Build Target
          </label>
          <div className="grid grid-cols-2 gap-3">
            {BUILD_TARGETS.map((target) => (
              <button
                key={target.value}
                onClick={() => onChange({ ...config, build_target: target.value })}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  config.build_target === target.value
                    ? target.color === 'blue'
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-green-500 bg-green-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className={`font-semibold ${
                  config.build_target === target.value
                    ? target.color === 'blue' ? 'text-blue-400' : 'text-green-400'
                    : 'text-white'
                }`}>
                  {target.label}
                </div>
                <div className="text-xs text-slate-400 mt-1">{target.description}</div>
              </button>
            ))}
          </div>
        </div>

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
            <option value="quick" className="bg-slate-800 text-white">Quick Build (skip PM2, Redis)</option>
            <option value="full" className="bg-slate-800 text-white">Full Build (with PM2, Redis)</option>
            <option value="phased" className="bg-slate-800 text-white">Phased Build (memory-safe)</option>
            <option value="phased-prod" className="bg-slate-800 text-white">Phased Production (with tests)</option>
            <option value="clean" className="bg-slate-800 text-white">Clean Build (clears cache)</option>
            <option value="ram-optimized" className="bg-slate-800 text-white">RAM Optimized</option>
          </select>
        </div>

        {/* Build Settings Preview */}
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-4 border border-blue-500/30">
          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Settings size={16} className="text-blue-400" />
            Build Settings for {config.build_mode}
          </h3>
          <div className="text-xs text-slate-400 space-y-1">
            {(() => {
              const settings = getBuildSettings(config.build_mode);
              return (
                <>
                  <p>• Skip Dependencies: {settings.skipDeps ? 'Yes' : 'No'}</p>
                  <p>• Force Clean Cache: {settings.forceClean ? 'Yes' : 'No'}</p>
                  <p>• Test Database: {settings.testDatabase ? 'Yes' : 'No'}</p>
                  <p>• Test Redis: {settings.testRedis ? 'Yes' : 'No'}</p>
                  <p>• Skip PM2: {settings.skipPM2 ? 'Yes' : 'No'}</p>
                  <p>• Skip Redis: {settings.skipRedis ? 'Yes' : 'No'}</p>
                  <p>• Memory Monitoring: {settings.memoryMonitoring ? 'Yes' : 'No'}</p>
                  <p>• Build Script: {settings.buildScript}</p>
                </>
              );
            })()}
          </div>
        </div>

        {/* Dynamic Project-Specific Options */}
        {config.project_type === 'nextjs' && (
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl p-4 border border-blue-500/30">
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <Layers size={16} className="text-blue-400" />
              Next.js Build Options
              <HelpTooltip text="These options control Next.js-specific build behavior including SSR, image optimization, and output format." />
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(NEXTJS_OPTIONS).map(([key, opt]) => (
                <BuildOption
                  key={key}
                  label={opt.label}
                  helpText={opt.help}
                  checked={config[key] ?? opt.default}
                  onChange={(checked) => onChange({ ...config, [key]: checked })}
                />
              ))}
            </div>
            
            {/* Next.js specific inputs */}
            <div className="mt-4 pt-4 border-t border-blue-500/20 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                  Output Mode
                  <HelpTooltip text="'standalone' creates a self-contained build. 'export' generates static HTML. 'default' uses standard Next.js output." />
                </label>
                <select
                  value={config.next_output || 'standalone'}
                  onChange={(e) => onChange({ ...config, next_output: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                >
                  <option value="standalone">Standalone (Docker-ready)</option>
                  <option value="export">Static Export</option>
                  <option value="default">Default</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                  Image Formats
                  <HelpTooltip text="Modern formats like AVIF/WebP are smaller but require browser support. AVIF is smallest but slowest to encode." />
                </label>
                <select
                  value={config.next_image_formats || 'webp'}
                  onChange={(e) => onChange({ ...config, next_image_formats: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                >
                  <option value="webp">WebP only</option>
                  <option value="avif,webp">AVIF + WebP (Best compression)</option>
                  <option value="original">Original formats only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                  Compiler
                  <HelpTooltip text="SWC is Rust-based and much faster. Babel has more plugins but is slower. Use SWC unless you need specific Babel plugins." />
                </label>
                <select
                  value={config.next_compiler || 'swc'}
                  onChange={(e) => onChange({ ...config, next_compiler: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                >
                  <option value="swc">SWC (Fast, recommended)</option>
                  <option value="babel">Babel (More plugins)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                  React Compiler
                  <HelpTooltip text="Experimental React Compiler (React Forget) auto-memoizes components. Can improve performance but may cause issues." />
                </label>
                <select
                  value={config.next_react_compiler || 'disabled'}
                  onChange={(e) => onChange({ ...config, next_react_compiler: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                >
                  <option value="disabled">Disabled</option>
                  <option value="enabled">Enabled (Experimental)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Workers */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
            Workers
            <HelpTooltip text="Number of parallel build workers. More workers = faster builds but more memory usage. Recommended: CPU cores - 1." />
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
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
            Max Old Space Size (MB)
            <HelpTooltip text="Maximum heap memory for Node.js. Increase for large projects (8GB+ recommended). Too low causes 'heap out of memory' errors." />
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
          
          <BuildOption
            label="Test Database"
            helpText="Verify database connection before build. Prevents deployment with broken DB config. Adds ~5s to build time."
            checked={config.test_database}
            onChange={(checked) => onChange({ ...config, test_database: checked })}
          />

          <BuildOption
            label="Test Redis"
            helpText="Verify Redis connection before build. Essential if your app uses Redis for caching or sessions."
            checked={config.test_redis}
            onChange={(checked) => onChange({ ...config, test_redis: checked })}
          />

          <BuildOption
            label="Skip Dependencies"
            helpText="Skip 'pnpm install' step. Use when dependencies haven't changed to save 30-60s. Risky if package.json changed."
            checked={config.skip_deps}
            onChange={(checked) => onChange({ ...config, skip_deps: checked })}
            badge="-30s"
            badgeColor="green"
          />

          <BuildOption
            label="Force Clean"
            helpText="Delete .next/dist cache before building. Fixes stale cache issues but increases build time significantly."
            checked={config.force_clean}
            onChange={(checked) => onChange({ ...config, force_clean: checked })}
            badge="+2-5min"
            badgeColor="yellow"
          />
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
                <BuildOption
                  label="🚀 Use Redis Build Cache"
                  helpText="Cache build artifacts in Redis for faster subsequent builds. Requires Redis server. Best for CI/CD pipelines with shared cache."
                  checked={config.use_redis_cache}
                  onChange={(checked) => onChange({ ...config, use_redis_cache: checked })}
                  badge="-40% time"
                  badgeColor="green"
                />

                <BuildOption
                  label="📦 Incremental Build"
                  helpText="Only rebuild changed files using TypeScript's incremental compilation. Stores build info in .tsbuildinfo. Much faster for small changes."
                  checked={config.incremental_build}
                  onChange={(checked) => onChange({ ...config, incremental_build: checked })}
                  badge="-30% time"
                  badgeColor="green"
                />

                <BuildOption
                  label="⚡ Parallel Processing"
                  helpText="Use multiple CPU cores for compilation. Faster builds but higher memory usage. Disable if you're running out of memory."
                  checked={config.parallel_processing}
                  onChange={(checked) => onChange({ ...config, parallel_processing: checked })}
                  badge="-20% time"
                  badgeColor="green"
                />

                <BuildOption
                  label="⏭️ Skip TypeScript Type Checking"
                  helpText="Skip type checking during build. RISKY: Type errors won't be caught. Only use for quick iterations when you're confident in your types."
                  checked={config.skip_type_check}
                  onChange={(checked) => onChange({ ...config, skip_type_check: checked })}
                  badge="risky, -60% time"
                  badgeColor="yellow"
                />

                <BuildOption
                  label="🔥 Experimental Turbo Mode"
                  helpText="Use Next.js Turbopack experimental features. UNSTABLE: May cause build failures. Only for testing new features."
                  checked={config.experimental_turbo}
                  onChange={(checked) => onChange({ ...config, experimental_turbo: checked })}
                  badge="unstable, -50% time"
                  badgeColor="rose"
                />
              </div>

              {/* Output Optimization */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs text-slate-400 mb-3">Output Optimization</p>
                <div className="space-y-3">
                  <BuildOption
                    label="Minify Output"
                    helpText="Compress JavaScript/CSS by removing whitespace and shortening variable names. Essential for production. Adds ~10-30s to build."
                    checked={config.minify_output}
                    onChange={(checked) => onChange({ ...config, minify_output: checked })}
                  />

                  <BuildOption
                    label="Tree Shaking"
                    helpText="Remove unused code from bundles. Analyzes imports to eliminate dead code. Can reduce bundle size by 20-50%."
                    checked={config.tree_shaking}
                    onChange={(checked) => onChange({ ...config, tree_shaking: checked })}
                  />

                  <BuildOption
                    label="Code Splitting"
                    helpText="Split code into smaller chunks loaded on demand. Improves initial load time. Essential for large apps."
                    checked={config.code_splitting}
                    onChange={(checked) => onChange({ ...config, code_splitting: checked })}
                  />

                  <BuildOption
                    label="Compress Assets (Gzip/Brotli)"
                    helpText="Pre-compress static assets for faster delivery. Brotli is 15-25% smaller than Gzip. Requires server support."
                    checked={config.compress_assets}
                    onChange={(checked) => onChange({ ...config, compress_assets: checked })}
                  />

                  <BuildOption
                    label="Optimize Images"
                    helpText="Compress and convert images to modern formats (WebP, AVIF). Can reduce image sizes by 30-80%. Adds build time."
                    checked={config.optimize_images}
                    onChange={(checked) => onChange({ ...config, optimize_images: checked })}
                  />

                  <BuildOption
                    label="Generate Source Maps"
                    helpText="Create .map files for debugging minified code. Essential for production error tracking. Increases build output size."
                    checked={config.source_maps}
                    onChange={(checked) => onChange({ ...config, source_maps: checked })}
                  />

                  <BuildOption
                    label="Remove Console Logs"
                    helpText="Strip console.log/warn/error from production builds. Improves performance and hides debug info. Only for production."
                    checked={config.remove_console_logs}
                    onChange={(checked) => onChange({ ...config, remove_console_logs: checked })}
                  />
                </div>
              </div>

              {/* Additional Advanced Options */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs text-slate-400 mb-3">Additional Options</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                      Max Semi Space Size (MB)
                      <HelpTooltip text="Size of V8's semi-space for young generation garbage collection. Larger values reduce GC frequency but use more memory. Default: 16MB, increase for memory-intensive builds." />
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
              <span className="text-xs opacity-75">
                ({getBuildSettings(config.build_mode).buildScript})
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
