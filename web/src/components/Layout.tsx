import { ReactNode } from 'react'
import NavigationBar from './NavigationBar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-6">
        <NavigationBar />
        {children}
      </div>
    </div>
  )
}
