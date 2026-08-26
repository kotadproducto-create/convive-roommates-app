import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NoFloor from '../pages/NoFloor'
import SplashScreen from './SplashScreen'

export default function ProtectedRoute({ children }) {
  const { user, floor, loading } = useAuth()
  if (loading) return <SplashScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!floor) return <NoFloor />
  return children
}
