import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { DataProvider } from './context/DataContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Incidents from './pages/Incidents'
import Rewards from './pages/Rewards'
import FloorSettings from './pages/FloorSettings'

function AuthedData({ children }) {
  // DataProvider depende del piso del usuario autenticado, así que vive
  // dentro de ProtectedRoute pero fuera de cada página individual.
  return <DataProvider>{children}</DataProvider>
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AuthedData>
                    <Dashboard />
                  </AuthedData>
                </ProtectedRoute>
              }
            />
            <Route
              path="/incidencias"
              element={
                <ProtectedRoute>
                  <AuthedData>
                    <Incidents />
                  </AuthedData>
                </ProtectedRoute>
              }
            />
            <Route
              path="/recompensas"
              element={
                <ProtectedRoute>
                  <AuthedData>
                    <Rewards />
                  </AuthedData>
                </ProtectedRoute>
              }
            />
            <Route
              path="/piso"
              element={
                <ProtectedRoute>
                  <AuthedData>
                    <FloorSettings />
                  </AuthedData>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
