import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import WorkoutLog from './pages/WorkoutLog'
import WorkoutDetail from './pages/WorkoutDetail'
import ExerciseLibrary from './pages/ExerciseLibrary'
import PRBoard from './pages/PRBoard'
import BodyMetrics from './pages/BodyMetrics'
import MeetPlanner from './pages/MeetPlanner'
import Programs from './pages/Programs'
import AICoach from './pages/AICoach'
import Settings from './pages/Settings'
import ImportWorkouts from './pages/ImportWorkouts'
import Login from './pages/Login'
import Register from './pages/Register'
import EnduranceLog from './pages/EnduranceLog'
import EnduranceDetail from './pages/EnduranceDetail'
import AdminDashboard from './pages/AdminDashboard'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/workouts" element={<WorkoutLog />} />
                <Route path="/workouts/new" element={<WorkoutDetail />} />
                <Route path="/workouts/:id" element={<WorkoutDetail />} />
                <Route path="/import" element={<ImportWorkouts />} />
                <Route path="/exercises" element={<ExerciseLibrary />} />
                <Route path="/prs" element={<PRBoard />} />
                <Route path="/body-metrics" element={<BodyMetrics />} />
                <Route path="/meets" element={<MeetPlanner />} />
                <Route path="/programs" element={<Programs />} />
                <Route path="/ai-coach" element={<AICoach />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/endurance" element={<EnduranceLog />} />
                <Route path="/endurance/new" element={<EnduranceDetail />} />
                <Route path="/endurance/:id" element={<EnduranceDetail />} />
                <Route path="/admin" element={<AdminDashboard />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
