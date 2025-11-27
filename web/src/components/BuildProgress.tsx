import { CheckCircle, Circle, Loader, XCircle } from 'lucide-react'

interface BuildProgressProps {
  currentStep: string
  progress: number
  status: string
}

const BUILD_STEPS = [
  { id: 'INIT', label: 'Initialize', color: 'sky' },
  { id: 'CLEAN', label: 'Clean', color: 'purple' },
  { id: 'DEPS', label: 'Dependencies', color: 'blue' },
  { id: 'CHECKS', label: 'Pre-checks', color: 'cyan' },
  { id: 'CONFIG', label: 'Configure', color: 'indigo' },
  { id: 'BUILD', label: 'Building', color: 'green' },
  { id: 'VERIFY', label: 'Verify', color: 'yellow' },
  { id: 'COMPLETE', label: 'Complete', color: 'emerald' },
]

export default function BuildProgress({ currentStep, progress, status }: BuildProgressProps) {
  const getStepStatus = (stepId: string) => {
    const currentIndex = BUILD_STEPS.findIndex(s => s.id === currentStep)
    const stepIndex = BUILD_STEPS.findIndex(s => s.id === stepId)
    
    if (status === 'error' && stepIndex === currentIndex) {
      return 'error'
    }
    if (stepIndex < currentIndex) {
      return 'completed'
    }
    if (stepIndex === currentIndex) {
      return 'active'
    }
    return 'pending'
  }

  const getStepIcon = (stepId: string) => {
    const stepStatus = getStepStatus(stepId)
    
    switch (stepStatus) {
      case 'completed':
        return <CheckCircle className="text-green-400" size={20} />
      case 'active':
        return <Loader className="text-sky-400 animate-spin" size={20} />
      case 'error':
        return <XCircle className="text-rose-400" size={20} />
      default:
        return <Circle className="text-slate-600" size={20} />
    }
  }

  const getStepColor = (stepId: string) => {
    const stepStatus = getStepStatus(stepId)
    
    switch (stepStatus) {
      case 'completed':
        return 'text-green-400 border-green-400/50 bg-green-500/10'
      case 'active':
        return 'text-sky-400 border-sky-400/50 bg-sky-500/10 animate-pulse'
      case 'error':
        return 'text-rose-400 border-rose-400/50 bg-rose-500/10'
      default:
        return 'text-slate-600 border-slate-700/50 bg-slate-800/30'
    }
  }

  return (
    <div className="glass-subtle rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">Build Progress</h3>
      
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">Overall Progress</span>
          <span className="text-white font-semibold">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-sky-500 to-green-500 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress || 0}%` }}
          />
        </div>
      </div>

      {/* Build steps */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {BUILD_STEPS.map((step) => (
          <div
            key={step.id}
            className={`border rounded-lg p-3 transition-all duration-300 ${getStepColor(step.id)}`}
          >
            <div className="flex items-center gap-2 mb-1">
              {getStepIcon(step.id)}
              <span className="font-medium text-sm">{step.label}</span>
            </div>
            {getStepStatus(step.id) === 'active' && (
              <div className="text-xs opacity-75 mt-1">In progress...</div>
            )}
          </div>
        ))}
      </div>

      {/* Current step details */}
      {currentStep && (
        <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center gap-2">
            <Loader className="text-sky-400 animate-spin" size={16} />
            <span className="text-sm text-slate-300">
              Currently: <span className="text-white font-semibold">
                {BUILD_STEPS.find(s => s.id === currentStep)?.label || currentStep}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
