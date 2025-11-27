import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import GitPull from './pages/GitPull'
import Build from './pages/Build'
import Deploy from './pages/Deploy'
import Health from './pages/Health'
import DatabaseAdmin from './pages/DatabaseAdmin'
import Troubleshooting from './pages/Troubleshooting'
import Settings from './pages/Settings'
import { authService } from './services/auth'
import Layout from './components/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/git"
          element={
            <PrivateRoute>
              <Layout>
                <GitPull />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/build"
          element={
            <PrivateRoute>
              <Layout>
                <Build />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/deploy"
          element={
            <PrivateRoute>
              <Layout>
                <Deploy />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/health"
          element={
            <PrivateRoute>
              <Layout>
                <Health />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/database"
          element={
            <PrivateRoute>
              <Layout>
                <DatabaseAdmin />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/troubleshooting"
          element={
            <PrivateRoute>
              <Layout>
                <Troubleshooting />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Layout>
                <Settings />
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App

