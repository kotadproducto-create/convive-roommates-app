import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import TaskCard from '../components/TaskCard'
import CalendarView from '../components/CalendarView'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { TASK_TYPES, getMondayOfWeek } from '../lib/rotation'
import { potAmountColorClass } from '../lib/pot'
import { AlertIcon } from '../components/icons'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard() {
  const { user } = useAuth()
  const { floor, members, tasks, shoppingItems, completeTask, uncompleteTask, requestWasher, addPotContribution, weekKey } = useData()
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

  const weekTasks = useMemo(
    () =>
      tasks
        .slice()
        .sort((a, b) => TASK_TYPES.findIndex((t) => t.key === a.type) - TASK_TYPES.findIndex((t) => t.key === b.type)),
    [tasks]
  )
  const doneCount = weekTasks.filter((t) => t.completed).length
  const outOfStockItems = shoppingItems.filter((i) => i.stockLevel === 'out')

  return (
    <AppLayout title="Calendario semanal">
      {outOfStockItems.length > 0 && (
        <Reveal>
          <Link to="/compras" className="card p-3 mb-5 flex items-center gap-2 border-clay-500/50 hover:-translate-y-0.5 transition-transform">
            <AlertIcon className="w-5 h-5 text-clay-500 shrink-0" />
            <p className="text-sm font-medium text-clay-500">
              Reponer: {outOfStockItems.map((i) => i.name).join(', ')}
            </p>
          </Link>
        </Reveal>
      )}

      {/* Encabezado: dónde estamos */}
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold tracking-tight">Hola, {user?.name?.split(' ')[0]}</h2>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
          Semana del {format(monday, "d 'de' MMMM", { locale: es })} al {format(sunday, "d 'de' MMMM", { locale: es })} en {floor?.name}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start mb-8">
        {/* Zona primaria: qué tengo pendiente */}
        <section className="lg:col-span-2">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display text-lg font-bold">Tareas de esta semana</h3>
            <span className="text-xs font-semibold text-ink-900/50 dark:text-cream-100/50">
              {doneCount}/{weekTasks.length} completadas
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {weekTasks.map((task, i) => (
              <Reveal key={task.id} delay={i * 70}>
                <TaskCard
                  task={task}
                  typeInfo={TASK_TYPES.find((t) => t.key === task.type)}
                  assignee={memberById[task.assignedUserId]}
                  currentUserId={user?.id}
                  onToggle={(id, undo) => (undo ? uncompleteTask(id) : completeTask(id))}
                />
              </Reveal>
            ))}
          </div>
        </section>

        {/* Zona secundaria: pote, lavadora, cómo va la rotación */}
        <aside className="flex flex-col gap-4">
          <Reveal delay={80}>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-1">Pote de compras</p>
            <p className={`text-2xl font-display font-bold mb-3 ${potAmountColorClass(floor?.potAmount ?? 0)}`}>
              {floor?.potAmount ?? 0}€
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input w-20"
                value={contribution}
                min={1}
                onChange={(e) => setContribution(e.target.value)}
              />
              <button className="btn-secondary text-sm flex-1" onClick={() => addPotContribution(contribution)}>
                Aportar
              </button>
            </div>
          </div>
          </Reveal>

          <Reveal delay={150}>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-1">Lavadora</p>
            <p className="text-sm mb-3">Avisa al grupo si vas a ponerla.</p>
            <button className="btn-primary text-sm w-full" onClick={handleWasher}>
              {washerMsg ? 'Avisado ✓' : 'Voy a usarla'}
            </button>
          </div>
          </Reveal>

          <Reveal delay={220}>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-2">Orden de rotación</p>
            <ol className="flex flex-col gap-2">
              {(floor?.rotationOrder || []).map((id, idx) => {
                const m = memberById[id]
                if (!m) return null
                return (
                  <li key={id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    {m.name}
                  </li>
                )
              })}
            </ol>
          </div>
          </Reveal>
        </aside>
      </div>

      <Reveal as="section">
        <h2 className="font-display text-lg font-bold mb-3">Calendario</h2>
        <CalendarView
          floor={floor}
          memberById={memberById}
          currentWeekKey={weekKey}
          tasks={tasks}
          completeTask={completeTask}
          uncompleteTask={uncompleteTask}
        />
      </Reveal>
    </AppLayout>
  )
}
