import React, { useState, useEffect } from 'react'
import { 
  GitBranch, 
  Hammer, 
  Rocket, 
  Settings, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Globe
} from 'lucide-react'

interface Project {
  name: string
  path: string
  repo_url: string
  branch: string
  domain: string
  status: string
  last_sync?: number
  last_build?: number
  health_url?: string
}

interface HealthStatus {
  [key: string]: {
    healthy: boolean
    domain: string
    status: string
  }
}

const statusColors = {
  idle: 'bg-gray-500',
  syncing: 'bg-blue-500',
  building: 'bg-yellow-500',
  deploying: 'bg-orange-500',
  success: 'bg-green-500',
  error: 'bg-red-500'
}

const statusIcons = {
  idle: Clock,
  syncing: RefreshCw,
  building: Hammer,
  deploying: Rocket,
  success: CheckCircle,
  error: XCircle
}

export default function TrafikAppManager() {
  const [projects, setProjects] = useState<Project[]>([])
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({})

  useEffect(() => {
    fetchProjects()
    fetchHealthStatus()
    
    const interval = setInterval(() => {
      fetchProjects()
      fetchHealthStatus()
    }, 30000) // Update every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/trafikapp/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHealthStatus = async () => {
    try {
      const response = await fetch('/api/trafikapp/health-all')
      if (response.ok) {
        const data = await response.json()
        setHealthStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch health status:', error)
    }
  }

  const runAction = async (projectName: string, action: string) => {
    setActionLoading((prev: any) => ({ ...prev, [`${projectName}-${action}`]: true }))
    
    try {
      const response = await fetch(`/api/trafikapp/projects/${projectName}/${action}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        // Refresh data after action starts
        setTimeout(() => {
          fetchProjects()
        }, 1000)
      }
    } catch (error) {
      console.error(`Failed to ${action} ${projectName}:`, error)
    } finally {
      setActionLoading((prev: any) => ({ ...prev, [`${projectName}-${action}`]: false }))
    }
  }

  const runPipeline = async (projectName: string) => {
    setActionLoading((prev: any) => ({ ...prev, [`${projectName}-pipeline`]: true }))
    
    try {
      const response = await fetch('/api/trafikapp/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ project: projectName })
      })
      
      if (response.ok) {
        setTimeout(() => {
          fetchProjects()
        }, 1000)
      }
    } catch (error) {
      console.error(`Failed to run pipeline for ${projectName}:`, error)
    } finally {
      setActionLoading((prev: any) => ({ ...prev, [`${projectName}-pipeline`]: false }))
    }
  }


  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getStatusIcon = (status: string) => {
    const Icon = statusIcons[status as keyof typeof statusIcons] || Clock
    return React.createElement(Icon, { className: "w-4 h-4" })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading TrafikApp projects...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">TrafikApp Manager</h2>
          <p className="text-gray-600">Manage deployment of Dintrafikskola and TrafikApp projects</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => runAction('all', 'sync-all')}
            disabled={actionLoading['all-sync-all']}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          >
            <GitBranch className="w-4 h-4" />
            Sync All
          </button>
          <button 
            onClick={() => runAction('all', 'build-all')}
            disabled={actionLoading['all-build-all']}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          >
            <Hammer className="w-4 h-4" />
            Build All
          </button>
          <button 
            onClick={() => runAction('all', 'deploy-all')}
            disabled={actionLoading['all-deploy-all']}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          >
            <Rocket className="w-4 h-4" />
            Deploy All
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project: any) => {
          const health = healthStatus[project.name]
          const StatusIcon = getStatusIcon(project.status)
          
          return (
            <div key={project.name} className="bg-white border border-gray-200 rounded-lg shadow-sm relative">
              <div className="p-6 pb-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{project.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusColors[project.status as keyof typeof statusColors]}`} />
                    <StatusIcon className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <Globe className="w-4 h-4" />
                  <a 
                    href={`https://${project.domain}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {project.domain}
                  </a>
                  {health && (
                    <span 
                      className={`ml-auto px-2 py-1 text-xs rounded-full ${
                        health.healthy 
                          ? "bg-green-100 text-green-800" 
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {health.healthy ? "Healthy" : "Unhealthy"}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="px-6 pb-4 space-y-4">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Branch:</span>
                    <span className="font-mono">{project.branch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Sync:</span>
                    <span className="text-xs">{formatTime(project.last_sync)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Build:</span>
                    <span className="text-xs">{formatTime(project.last_build)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-1"
                    onClick={() => runAction(project.name, 'sync')}
                    disabled={actionLoading[`${project.name}-sync`]}
                  >
                    {actionLoading[`${project.name}-sync`] ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <GitBranch className="w-3 h-3" />
                    )}
                    <span>Sync</span>
                  </button>
                  
                  <button
                    className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-1"
                    onClick={() => runAction(project.name, 'build')}
                    disabled={actionLoading[`${project.name}-build`]}
                  >
                    {actionLoading[`${project.name}-build`] ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Hammer className="w-3 h-3" />
                    )}
                    <span>Build</span>
                  </button>
                  
                  <button
                    className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-1"
                    onClick={() => runAction(project.name, 'deploy')}
                    disabled={actionLoading[`${project.name}-deploy`]}
                  >
                    {actionLoading[`${project.name}-deploy`] ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Rocket className="w-3 h-3" />
                    )}
                    <span>Deploy</span>
                  </button>
                  
                  <button
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-1"
                    onClick={() => runPipeline(project.name)}
                    disabled={actionLoading[`${project.name}-pipeline`]}
                  >
                    {actionLoading[`${project.name}-pipeline`] ? (
                      <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Settings className="w-3 h-3 mr-1" />
                    )}
                    Pipeline
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {projects.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="text-center py-8">
            <Settings className="w-12 h-12 mx-auto text-gray-400 mb-4" />
           <h3 className="text-lg font-semibold mb-2">No Projects Configured</h3>
            <p className="text-gray-600">
              Configure TrafikApp projects in the configuration file to get started.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
