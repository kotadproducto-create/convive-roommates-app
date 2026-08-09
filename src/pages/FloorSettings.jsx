import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { update } from '../lib/db'

export default function FloorSettings() {
  const { user, membership } = useAuth()
  const { floor, members, reorderRotation, removeMember, setMemberRole } = useData()
  const isAdmin = membership?.role === 'admin'
  const [threshold, setThreshold] = useState(floor?.potThreshold ?? 30)
  const [perPerson, setPerPerson] = useState(floor?.potPerPerson ?? 10)

  const order = floor?.rotationOrder || []
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))

  function move(idx, dir) {
    const newOrder = [...order]
    const target = idx + dir
    if (target < 0 || target >= newOrder.length) return
    ;[newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]]
    reorderRotation(newOrder)
  }

  function handleRemove(member) {
    if (member.id === user.id) {
      alert('No puedes eliminarte a ti mismo. Pide a otro admin que lo haga.')
      return
    }
    if (confirm('¿Eliminar a este roommate? Sus tareas pendientes se reasignarán automáticamente.')) {
      removeMember(member.membershipId, member.id)
    }
  }

  function saveSettings() {
    update('floors', floor.id, { potThreshold: Number(threshold), potPerPerson: Number(perPerson) })
  }

  function makeAdmin(member) {
    setMemberRole(member.membershipId, 'admin')
  }

  return (
    <AppLayout title="Tu piso">
      <div className="grid md:grid-cols-2 gap-5">
        <section className="card p-5">
          <h2 className="font-display font-semibold mb-1">Invitar roommates</h2>
          <p className="text-sm text-charcoal-900/60 dark:text-linen-100/60 mb-3">
            Comparte este código para que se unan a <strong>{floor?.name}</strong>.
          </p>
          <div className="bg-linen-100 dark:bg-charcoal-700 rounded-xl px-4 py-3 text-center text-2xl font-display tracking-widest font-semibold">
            {floor?.inviteCode}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-display font-semibold mb-3">Orden de rotación</h2>
          <p className="text-sm text-charcoal-900/60 dark:text-linen-100/60 mb-3">
            Este es el orden en el que van pasando las 3 tareas semanales.
            {!isAdmin && ' Solo un admin puede reordenarlo.'}
          </p>
          <ol className="flex flex-col gap-2">
            {order.map((id, idx) => {
              const m = memberById[id]
              if (!m) return null
              return (
                <li key={id} className="flex items-center justify-between bg-linen-100 dark:bg-charcoal-700 rounded-xl px-3 py-2">
                  <span className="text-sm">
                    <span className="text-charcoal-900/40 dark:text-linen-100/40 mr-2">{idx + 1}.</span>
                    {m.name} {m.role === 'admin' && <span className="text-[10px] uppercase text-plum-500 ml-1">admin</span>}
                  </span>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => move(idx, -1)} className="w-7 h-7 rounded-lg hover:bg-linen-200 dark:hover:bg-charcoal-800">↑</button>
                      <button onClick={() => move(idx, 1)} className="w-7 h-7 rounded-lg hover:bg-linen-200 dark:hover:bg-charcoal-800">↓</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>

        <section className="card p-5">
          <h2 className="font-display font-semibold mb-3">Roommates</h2>
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-1 py-1.5 text-sm">
                <div>
                  <span className="font-medium">{m.name}</span>{' '}
                  <span className="text-charcoal-900/40 dark:text-linen-100/40">· {m.points || 0} pts</span>
                </div>
                {isAdmin && m.id !== user.id && (
                  <div className="flex gap-2">
                    {m.role !== 'admin' && (
                      <button onClick={() => makeAdmin(m)} className="text-xs text-plum-500 hover:underline">
                        Hacer admin
                      </button>
                    )}
                    <button onClick={() => handleRemove(m)} className="text-xs text-clay-500 hover:underline">
                      Quitar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && (
          <section className="card p-5">
            <h2 className="font-display font-semibold mb-3">Ajustes del pote</h2>
            <label className="text-sm block mb-1">Aviso cuando el pote baje de</label>
            <input className="input mb-3" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            <label className="text-sm block mb-1">Aportación sugerida por persona</label>
            <input className="input mb-4" type="number" value={perPerson} onChange={(e) => setPerPerson(e.target.value)} />
            <button className="btn-primary text-sm" onClick={saveSettings}>Guardar ajustes</button>
          </section>
        )}
      </div>
    </AppLayout>
  )
}
