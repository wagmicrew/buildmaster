import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Home, GitBranch, Play, Rocket, Activity, Database, Wrench, Settings, LogOut, Loader, TestTube } from 'lucide-react'
import api from '../services/api'
import { authService } from '../services/auth'

interface NavItem {
  path: string
  label: string
  icon: any
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Home',
    icon: Home
  },
  {
    path: '/git',
    label: 'Git Pull',
    icon: GitBranch
  },
  {
    path: '/build',
    label: 'Build',
    icon: Play
  },
  {
    path: '/deploy',
    label: 'Go Live',
    icon: Rocket
  },
  {
    path: '/health',
    label: 'Health',
    icon: Activity
  },
  {
    path: '/database',
    label: 'Database',
    icon: Database
  },
  {
    path: '/troubleshooting',
    label: 'Troubleshooting',
    icon: Wrench
  },
  {
    path: '/vitest',
    label: 'Vitest',
    icon: TestTube
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings
  }
]

export default function NavigationBar() {
  const location = useLocation()
  const navigate = useNavigate()

  // Fetch build status
  const { data: buildStatus } = useQuery({
    queryKey: ['build-status'],
    queryFn: async () => {
      const response = await api.get('/build/status')
      return response.data
    },
    refetchInterval: 3000, // Poll every 3 seconds
  })

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  const isBuildRunning = buildStatus?.status === 'running'

  return (
    <div className="bg-black/20 border border-white/10 rounded-lg p-2 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Navigation Items */}
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
                  }
                `}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Right Side Items */}
        <div className="flex items-center gap-2">
          {/* Build Status Indicator */}
          {isBuildRunning && (
            <button
              onClick={() => navigate('/build')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                bg-yellow-500/20 text-yellow-400 border border-yellow-500/30
                hover:bg-yellow-500/30 transition-all duration-200"
            >
              <Loader className="animate-spin" size={16} />
              Build Running
            </button>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
              text-slate-400 hover:text-white hover:bg-rose-500/20 border border-transparent
              transition-all duration-200"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
