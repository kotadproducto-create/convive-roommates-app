import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getAll, getById, create, update, generateInviteCode } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null) // fila de "profiles", camelCase
  const [floor, setFloor] = useState(null)
  const [membership, setMembership] = useState(null) // fila activa de "floor_memberships" (trae el role)
  const [loading, setLoading] = useState(true)

  const loadProfileAndFloor = useCallback(async (authUserId) => {
    if (!authUserId) {
      setUser(null)
      setFloor(null)
      setMembership(null)
      return
    }
    const profile = await getById('profiles', authUserId)
    setUser(profile)

    const activeMemberships = await getAll('floor_memberships', { userId: authUserId, status: 'active' })
    const activeMembership = activeMemberships[0] || null
    setMembership(activeMembership)

    if (activeMembership?.floorId) {
      const f = await getById('floors', activeMembership.floorId)
      setFloor(f)
    } else {
      setFloor(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      loadProfileAndFloor(session?.user?.id).finally(() => setLoading(false))
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      loadProfileAndFloor(newSession?.user?.id)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfileAndFloor])

  const refresh = useCallback(() => loadProfileAndFloor(session?.user?.id), [session, loadProfileAndFloor])

  // --- Acciones ---

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(traduceErrorAuth(error))
  }

  async function registerAndCreateFloor({ name, email, password, floorName }) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) throw new Error(traduceErrorAuth(signUpError))
    if (!signUpData.session) {
      throw new Error(
        'Cuenta creada, pero Supabase requiere confirmar el email antes de entrar. Revisa tu correo, o desactiva "Confirm email" en Authentication → Providers → Email dentro de Supabase si es solo para tu piso de confianza.'
      )
    }

    const newFloor = await create('floors', {
      name: floorName,
      inviteCode: generateInviteCode(),
      rotationOrder: [],
      potAmount: 0,
      potThreshold: 30,
      potPerPerson: 10
    })

    await create('profiles', {
      id: signUpData.user.id,
      name,
      points: 0
    })

    await create('floor_memberships', {
      userId: signUpData.user.id,
      floorId: newFloor.id,
      role: 'admin',
      status: 'active'
    })

    await update('floors', newFloor.id, { rotationOrder: [signUpData.user.id] })
    await loadProfileAndFloor(signUpData.user.id)
  }

  async function registerAndJoinFloor({ name, email, password, inviteCode }) {
    const floors = await getAll('floors', { inviteCode: inviteCode.trim().toUpperCase() })
    const targetFloor = floors[0]
    if (!targetFloor) throw new Error('Código de invitación no válido.')

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) throw new Error(traduceErrorAuth(signUpError))
    if (!signUpData.session) {
      throw new Error(
        'Cuenta creada, pero Supabase requiere confirmar el email antes de entrar. Revisa tu correo, o desactiva "Confirm email" en Supabase si es solo para tu piso de confianza.'
      )
    }

    await create('profiles', {
      id: signUpData.user.id,
      name,
      points: 0
    })

    await create('floor_memberships', {
      userId: signUpData.user.id,
      floorId: targetFloor.id,
      role: 'member',
      status: 'active'
    })

    await update('floors', targetFloor.id, {
      rotationOrder: [...(targetFloor.rotationOrder || []), signUpData.user.id]
    })

    await loadProfileAndFloor(signUpData.user.id)
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ user, floor, membership, loading, login, registerAndCreateFloor, registerAndJoinFloor, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  )
}

function traduceErrorAuth(error) {
  const msg = error.message || ''
  if (msg.includes('already registered') || msg.includes('already exists')) {
    return 'Ya existe una cuenta con ese email.'
  }
  if (msg.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos.'
  }
  if (msg.includes('Password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  return msg || 'Ha ocurrido un error inesperado.'
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
