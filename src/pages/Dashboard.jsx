import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import TaskCard from '../components/TaskCard'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { TASK_TYPES, getMondayOfWeek, whoIsAssigned, getWeekKey } from '../lib/rotation'
import { format, addWeeks } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard() {
  const { user } = useAuth()
  const { floor, members, tasks, completeTask, uncompleteTask, requestWasher, addPotContribution, weekKey } = useData()
  const [contribution, setContribution] = useState(floor?.potPerPerson || 10)
  const [washerMsg, setWasherMsg] = useState(false)

  const monday = getMondayOfWeek(weekKey)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

  function handleWasher() {
    requestWasher()
    setWasherMsg(true)
    setTimeout(() => setWasherMsg(false), 3000)
  }

  const potLow = floor && floor.potAmount < floor.potThreshold

  // Vista previa de próximas 4 semanas (no crea tareas, solo calcula quién tocaría)
  const upcoming = useMemo(() => {
    if (!floor) return []
    return [1, 2, 3, 4].map((offset) => {
      const date = addWeeks(monday, offset)
      const wk = getWeekKey(date)
      return {
        weekKey: wk,
        date,
        assignments: TASK_TYPES.map((t) => ({
          type: t,
          user: memberById[whoIsAssigned(floor.rotationOrder, wk, t.offset)]
        }))
      }
    })
  }, [floor, monday, memberById])

  return (
    <AppLayout title="Calendario semanal">
      <section className="mb-6">
        <p className="text-sm text-charcoal-900/60 dark:text-linen-100/60 mb-4">
          Semana del {format(monday, "d 'de' MMMM", { locale: es })} al {format(sunday, "d 'de' MMMM", { locale: es })}
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-charcoal-900/50 dark:text-linen-100/50">Pote de compras</p>
              <p className={`text-xl font-semibold ${potLow ? 'text-clay-500' : 'text-sage-500'}`}>
                {floor?.potAmount ?? 0}€
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input w-20"
                value={contribution}
                min={1}
                onChange={(e) => setContribution(e.target.value)}
              />
              <button className="btn-secondary text-sm" onClick={() => addPotContribution(contribution)}>
                Aportar
              </button>
            </div>
          </div>

          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-charcoal-900/50 dark:text-linen-100/50">Lavadora</p>
              <p className="text-sm">Avisa al grupo si vas a ponerla</p>
            </div>
            <button className="btn-primary text-sm" onClick={handleWasher}>
              {washerMsg ? 'Avisado ✓' : 'Voy a usarla'}
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {tasks
            .slice()
            .sort((a, b) => TASK_TYPES.findIndex((t) => t.key === a.type) - TASK_TYPES.findIndex((t) => t.key === b.type))
            .map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                typeInfo={TASK_TYPES.find((t) => t.key === task.type)}
                assignee={memberById[task.assignedUserId]}
                currentUserId={user?.id}
                onToggle={(id, undo) => (undo ? uncompleteTask(id) : completeTask(id))}
              />
            ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Próximas semanas</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-charcoal-900/50 dark:text-linen-100/50 border-b border-linen-200 dark:border-charcoal-700">
                <th className="p-3 font-medium">Semana</th>
                {TASK_TYPES.map((t) => (
                  <th key={t.key} className="p-3 font-medium">
                    {t.icon} {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {upcoming.map((row) => (
                <tr key={row.weekKey} className="border-b last:border-0 border-linen-200 dark:border-charcoal-700">
                  <td className="p-3 whitespace-nowrap">{format(row.date, "d MMM", { locale: es })}</td>
                  {row.assignments.map((a) => (
                    <td key={a.type.key} className="p-3">{a.user?.name || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  )
}
