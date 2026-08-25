import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { PushProvider } from './context/PushContext'
import { DataProvider } from './context/DataContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Timeline from './pages/Timeline'
import Dashboard from './pages/Dashboard'
import Incidents from './pages/Incidents'
import Rewards from './pages/Rewards'
import Wallet from './pages/Wallet'
import Convives from './pages/Convives'
import Shopping from './pages/Shopping'
import Perfil from './pages/Perfil'
import FloorSettings from './pages/FloorSettings'

function AuthedData({ children }) {
  // DataProvider depende del piso del usuario autenticado, así que vive
  // dentro de ProtectedRoute pero fuera de cada página individual.
  return <DataProvider>{children}</DataProvider>
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
      <PushProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/olvide-contrasena" element={<ForgotPassword />} />
            <Route path="/restablecer-contrasena" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AuthedData>
                    <Timeline />
                  </AuthedData>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendario"
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
              path="/convives"
              element={
                <ProtectedRoute>
                  <AuthedData>
                    <Convives />
                  </AuthedData>
                </ProtectedRoute>
              }
            />
            <Route
              path="/compras"
              element={
                <ProtectedRoute>
                  <AuthedData>
                    <Shopping />
                  </AuthedData>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pote"
              element={
                <ProtectedRoute>
                  <AuthedData>
                    <Wallet />
                  </AuthedData>
                </ProtectedRoute>
              }
            />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <AuthedData>
                    <Perfil />
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
      </PushProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
