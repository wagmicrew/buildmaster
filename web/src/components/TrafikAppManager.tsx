import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  GitBranch, 
  Build, 
  Rocket, 
  Heart, 
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
  building: Build,
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
    setActionLoading(prev => ({ ...prev, [`${projectName}-${action}`]: true }))
    
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
      setActionLoading(prev => ({ ...prev, [`${projectName}-${action}`]: false }))
    }
  }

  const runPipeline = async (projectName: string) => {
    setActionLoading(prev => ({ ...prev, [`${projectName}-pipeline`]: true }))
    
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
      setActionLoading(prev => ({ ...prev, [`${projectName}-pipeline`]: false }))
    }
  }

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getStatusIcon = (status: string) => {
    const Icon = statusIcons[status as keyof typeof statusIcons] || Clock
    return <Icon className="w-4 h-4" />
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
          <Button 
            onClick={() => runAction('all', 'sync-all')}
            disabled={actionLoading['all-sync-all']}
            variant="outline"
          >
            <GitBranch className="w-4 h-4 mr-2" />
            Sync All
          </Button>
          <Button 
            onClick={() => runAction('all', 'build-all')}
            disabled={actionLoading['all-build-all']}
            variant="outline"
          >
            <Build className="w-4 h-4 mr-2" />
            Build All
          </Button>
          <Button 
            onClick={() => runAction('all', 'deploy-all')}
            disabled={actionLoading['all-deploy-all']}
            variant="outline"
          >
            <Rocket className="w-4 h-4 mr-2" />
            Deploy All
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const health = healthStatus[project.name]
          const StatusIcon = getStatusIcon(project.status)
          
          return (
            <Card key={project.name} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusColors[project.status as keyof typeof statusColors]}`} />
                    <StatusIcon className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
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
                    <Badge 
                      variant={health.healthy ? "default" : "destructive"}
                      className="ml-auto"
                    >
                      {health.healthy ? "Healthy" : "Unhealthy"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(project.name, 'sync')}
                    disabled={actionLoading[`${project.name}-sync`]}
                  >
                    {actionLoading[`${project.name}-sync`] ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <GitBranch className="w-3 h-3" />
                    )}
                    <span className="ml-1">Sync</span>
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(project.name, 'build')}
                    disabled={actionLoading[`${project.name}-build`]}
                  >
                    {actionLoading[`${project.name}-build`] ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Build className="w-3 h-3" />
                    )}
                    <span className="ml-1">Build</span>
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(project.name, 'deploy')}
                    disabled={actionLoading[`${project.name}-deploy`]}
                  >
                    {actionLoading[`${project.name}-deploy`] ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Rocket className="w-3 h-3" />
                    )}
                    <span className="ml-1">Deploy</span>
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={() => runPipeline(project.name)}
                    disabled={actionLoading[`${project.name}-pipeline`]}
                  >
                    {actionLoading[`${project.name}-pipeline`] ? (
                      <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Settings className="w-3 h-3 mr-1" />
                    )}
                    Pipeline
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Settings className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Projects Configured</h3>
            <p className="text-gray-600">
              Configure TrafikApp projects in the configuration file to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
