import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getAll, getById, create, update, generateInviteCode } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null) // fila de "profiles", camelCase
  const [floor, setFloor] = useState(null)
  const [membership, setMembership] = useState(null) // fila activa de "floor_memberships" (trae el role)
  const [pendingRequest, setPendingRequest] = useState(null) // solicitud 'pending' o 'rejected' más reciente, si no hay piso activo
  const [loading, setLoading] = useState(true)

  const loadProfileAndFloor = useCallback(async (authUserId) => {
    if (!authUserId) {
      setUser(null)
      setFloor(null)
      setMembership(null)
      setPendingRequest(null)
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
      setPendingRequest(null)
      return
    }

    setFloor(null)

    const pending = await getAll('floor_memberships', { userId: authUserId, status: 'pending' })
    const latestPending = pending[pending.length - 1] || null
    if (latestPending) {
      const f = await getById('floors', latestPending.floorId)
      setPendingRequest({ ...latestPending, floorName: f?.name })
      return
    }

    const rejected = await getAll('floor_memberships', { userId: authUserId, status: 'rejected' })
    const latestRejected = rejected[rejected.length - 1] || null
    if (latestRejected) {
      const f = await getById('floors', latestRejected.floorId)
      setPendingRequest({ ...latestRejected, floorName: f?.name })
    } else {
      setPendingRequest(null)
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

  // Mientras no hay piso activo (esperando aprobación, o rechazado), se
  // escucha en vivo la propia fila de floor_memberships para que la
  // pantalla de espera se actualice sola en cuanto alguien decida, sin
  // que el usuario tenga que refrescar.
  useEffect(() => {
    const authUserId = session?.user?.id
    if (!authUserId || floor) return
    const channel = supabase
      .channel(`my-memberships-${authUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'floor_memberships', filter: `user_id=eq.${authUserId}` },
        () => loadProfileAndFloor(authUserId)
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [session?.user?.id, floor, loadProfileAndFloor])

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

  // Ya no da acceso inmediato: crea una solicitud 'pending' que debe ser
  // aceptada por algún miembro activo del piso (ver JoinRequestPopup /
  // FloorSettings). El nuevo usuario ve la pantalla de espera de NoFloor
  // hasta que alguien decida.
  async function registerAndRequestJoin({ name, email, password, inviteCode }) {
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
      status: 'pending'
    })

    await loadProfileAndFloor(signUpData.user.id)
  }

  // Para un usuario ya logueado sin piso activo (rechazado, o expulsado)
  // que quiere solicitar unirse a otro piso desde la pantalla de NoFloor.
  async function requestJoinFloor(inviteCode) {
    if (!session?.user?.id) return
    const floors = await getAll('floors', { inviteCode: inviteCode.trim().toUpperCase() })
    const targetFloor = floors[0]
    if (!targetFloor) throw new Error('Código de invitación no válido.')

    await create('floor_memberships', {
      userId: session.user.id,
      floorId: targetFloor.id,
      role: 'member',
      status: 'pending'
    })

    await loadProfileAndFloor(session.user.id)
  }

  async function withdrawRequest(membershipId) {
    await update('floor_memberships', membershipId, { status: 'left' })
    if (session?.user?.id) await loadProfileAndFloor(session.user.id)
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  // Re-verifica la contraseña actual (inicia sesión con ella) antes de
  // aplicar la nueva, para que cambiar la contraseña exija de verdad
  // conocer la actual y no solo tener una sesión abierta sin vigilar.
  async function changePassword(currentPassword, newPassword) {
    if (!session?.user?.email) throw new Error('No hay sesión activa.')
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword
    })
    if (verifyError) throw new Error('La contraseña actual no es correcta.')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(traduceErrorAuth(error))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        email: session?.user?.email || null,
        floor,
        membership,
        pendingRequest,
        loading,
        login,
        registerAndCreateFloor,
        registerAndRequestJoin,
        requestJoinFloor,
        withdrawRequest,
        changePassword,
        logout,
        refresh
      }}
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
