import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NoFloor from '../pages/NoFloor'

export default function ProtectedRoute({ children }) {
  const { user, floor, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!floor) return <NoFloor />
  return children
}
