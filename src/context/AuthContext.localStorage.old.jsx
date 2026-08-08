import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getAll, create, update, getById, generateInviteCode } from '../lib/db'

const AuthContext = createContext(null)
const SESSION_KEY = 'convive_session_userId'

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem(SESSION_KEY))
  const [user, setUser] = useState(null)
  const [floor, setFloor] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!userId) {
      setUser(null)
      setFloor(null)
      setLoading(false)
      return
    }
    const u = getById('users', userId)
    setUser(u)
    if (u?.floorId) {
      setFloor(getById('floors', u.floorId))
    } else {
      setFloor(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  function persistSession(id) {
    if (id) localStorage.setItem(SESSION_KEY, id)
    else localStorage.removeItem(SESSION_KEY)
    setUserId(id)
  }

  // --- Acciones ---

  function login(email, password) {
    const found = getAll('users').find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (!found) throw new Error('Email o contraseña incorrectos.')
    persistSession(found.id)
    return found
  }

  function registerAndCreateFloor({ name, email, password, floorName }) {
    if (getAll('users').some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Ya existe una cuenta con ese email.')
    }
    const newFloor = create('floors', {
      name: floorName,
      inviteCode: generateInviteCode(),
      rotationOrder: [],
      potAmount: 0,
      potThreshold: 30,
      potPerPerson: 10
    })
    const newUser = create('users', {
      name,
      email,
      password,
      floorId: newFloor.id,
      role: 'admin',
      points: 0
    })
    update('floors', newFloor.id, { rotationOrder: [newUser.id] })
    persistSession(newUser.id)
    return newUser
  }

  function registerAndJoinFloor({ name, email, password, inviteCode }) {
    if (getAll('users').some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Ya existe una cuenta con ese email.')
    }
    const targetFloor = getAll('floors').find(
      (f) => f.inviteCode.toUpperCase() === inviteCode.trim().toUpperCase()
    )
    if (!targetFloor) throw new Error('Código de invitación no válido.')
    const newUser = create('users', {
      name,
      email,
      password,
      floorId: targetFloor.id,
      role: 'member',
      points: 0
    })
    update('floors', targetFloor.id, {
      rotationOrder: [...targetFloor.rotationOrder, newUser.id]
    })
    persistSession(newUser.id)
    return newUser
  }

  function logout() {
    persistSession(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, floor, loading, login, registerAndCreateFloor, registerAndJoinFloor, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
