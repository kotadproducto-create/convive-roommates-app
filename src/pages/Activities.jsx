import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import TaskCard from '../components/TaskCard'
import Avatar from '../components/Avatar'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { update } from '../lib/db'
import { TASK_TYPES, TASK_POINTS, fixedTaskOverride } from '../lib/rotation'
import { currentPeriodKey } from '../lib/activities'
import { SparkleIcon, EditIcon, TrashIcon, PlusIcon, MinusIcon, CloseIcon } from '../components/icons'
import { format, formatDistanceToNowStrict, startOfWeek, addDays } from 'date-fns'

/**
 * Gestor de actividades del piso: una sola lista "Frecuentes" que junta
 * las 3 tareas fijas (Compras/Basura/Lavadora, que siguen rotando
 * automáticamente vía rotation.js) con las actividades recurrentes
 * propias, más "De una sola vez" para eventos puntuales. Las 3 fijas
 * son editables en nombre/puntos por piso (floors.fixed_task_overrides)
 * pero su rotación en sí no se toca acá. Ver DataContext.jsx
 * (activities/activityCompletions/addActivity/...) y lib/activities.js
 * para el modelo de datos de las actividades propias.
 */
export default function Activities() {
  const { user } = useAuth()
  const {
    floor,
    members,
    tasks,
    weekKey,
    completeTask,
    uncompleteTask,
    activities,
    activityCompletions,
    addActivity,
    updateActivity,
    removeActivity,
    setActivityProgress
  } = useData()
  const { showToast } = useToast()
  const { t, dateLocale } = useLanguage()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editingFixedTask, setEditingFixedTask] = useState(null)

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))
  const recurringActivities = activities.filter((a) => a.frequencyType === 'recurring')
  const oneTimeActivities = activities.filter((a) => a.frequencyType === 'once')

  async function handleFormSubmit(input) {
    if (editing) {
      await updateActivity(editing.id, input)
      showToast(t('activities.updatedToast'), 'success')
    } else {
      await addActivity(input)
      showToast(t('activities.createdToast'), 'success')
    }
    setShowForm(false)
    setEditing(null)
  }

  function handleDelete(activity) {
    if (!confirm(t('activities.confirmDelete', { title: activity.title }))) return
    removeActivity(activity.id)
    showToast(t('activities.deletedToast'), 'default')
  }

  async function handleFixedTaskOverrideSave(key, patch) {
    await update('floors', floor.id, {
      fixedTaskOverrides: { ...(floor.fixedTaskOverrides || {}), [key]: patch }
    })
    showToast(t('activities.updatedToast'), 'success')
    setEditingFixedTask(null)
  }

  return (
    <AppLayout title={t('nav.actividades')}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display text-lg font-bold">{t('nav.actividades')}</h2>
          <p className="text-sm text-ink-900/60 dark:text-cream-100/60">{t('activities.subtitle')}</p>
        </div>
        <button
          className="btn-primary text-sm shrink-0"
          onClick={() => {
            setEditing(null)
            setShowForm((s) => !s)
          }}
        >
          {showForm && !editing ? t('activities.cancel') : t('activities.newActivity')}
        </button>
      </div>

      {(showForm || editing) && (
        <Reveal>
          <ActivityForm
            initial={editing}
            members={members}
            onCancel={() => {
              setShowForm(false)
              setEditing(null)
            }}
            onSubmit={handleFormSubmit}
            t={t}
            dateLocale={dateLocale}
          />
        </Reveal>
      )}

      <section className="mb-6">
        <h3 className="font-display font-semibold mb-3">{t('activities.frequentTitle')}</h3>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map((task) => {
            const override = fixedTaskOverride(floor, task.type)
            const typeInfo = TASK_TYPES.find((tt) => tt.key === task.type)
            return (
              <Reveal key={task.id}>
                {editingFixedTask === task.type ? (
                  <FixedTaskEditForm
                    taskKey={task.type}
                    initial={{
                      title: override?.title || t(`taskTypes.${task.type}`),
                      points: override?.points ?? TASK_POINTS[task.type]
                    }}
                    onCancel={() => setEditingFixedTask(null)}
                    onSubmit={(patch) => handleFixedTaskOverrideSave(task.type, patch)}
                    t={t}
                  />
                ) : (
                  <TaskCard
                    task={task}
                    typeInfo={typeInfo}
                    overrideLabel={override?.title}
                    overridePoints={override?.points}
                    assignee={memberById[task.assignedUserId]}
                    currentUserId={user?.id}
                    onToggle={(id, undo) => (undo ? uncompleteTask(id) : completeTask(id))}
                    onEdit={() => setEditingFixedTask(task.type)}
                  />
                )}
              </Reveal>
            )
          })}
          {recurringActivities.map((activity, i) => {
            const periodKey = currentPeriodKey(activity, weekKey)
            const completion = periodKey
              ? activityCompletions.find((c) => c.activityId === activity.id && c.periodKey === periodKey)
              : null
            return (
              <Reveal key={activity.id} delay={i * 40}>
                <ActivityCard
                  activity={activity}
                  completion={completion}
                  memberById={memberById}
                  onEdit={() => {
                    setEditing(activity)
                    setShowForm(false)
                  }}
                  onDelete={() => handleDelete(activity)}
                  onProgress={(delta) => completion && setActivityProgress(completion, delta)}
                  t={t}
                  dateLocale={dateLocale}
                />
              </Reveal>
            )
          })}
        </div>
        {tasks.length === 0 && recurringActivities.length === 0 && (
          <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('activities.empty')}</p>
        )}
      </section>

      <section>
        <h3 className="font-display font-semibold mb-3">{t('activities.onceTitle')}</h3>
        {oneTimeActivities.length === 0 ? (
          <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('activities.emptyOnce')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {oneTimeActivities.map((activity, i) => {
              const periodKey = currentPeriodKey(activity, weekKey)
              const completion = activityCompletions.find((c) => c.activityId === activity.id && c.periodKey === periodKey)
              return (
                <Reveal key={activity.id} delay={i * 40}>
                  <ActivityCard
                    activity={activity}
                    completion={completion}
                    memberById={memberById}
                    onEdit={() => {
                      setEditing(activity)
                      setShowForm(false)
                    }}
                    onDelete={() => handleDelete(activity)}
                    onProgress={(delta) => completion && setActivityProgress(completion, delta)}
                    t={t}
                    dateLocale={dateLocale}
                  />
                </Reveal>
              )
            })}
          </div>
        )}
      </section>
    </AppLayout>
  )
}

/** Nota compartida del piso — ya no se muestra en Actividades (se pidió
 * ocultarla de esta vista), se deja el componente por si se reubica. */
function GroupNoteCard({ floor, memberById, t, dateLocale }) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(floor?.notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!floor || !user) return
    setSaving(true)
    try {
      await update('floors', floor.id, {
        notes: value.trim() || null,
        notesUpdatedBy: user.id,
        notesUpdatedAt: new Date().toISOString()
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const author = floor?.notesUpdatedBy ? memberById[floor.notesUpdatedBy] : null

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-display font-semibold text-sm">{t('activities.noteTitle')}</h3>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setValue(floor?.notes || '')
              setEditing(true)
            }}
            className="text-xs font-semibold text-violet-500 hover:underline shrink-0"
          >
            {floor?.notes ? t('activities.noteEdit') : t('activities.noteAdd')}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="input min-h-20"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('activities.notePlaceholder')}
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm flex-1" onClick={() => setEditing(false)}>
              {t('activities.cancel')}
            </button>
            <button type="button" className="btn-primary text-sm flex-1" onClick={handleSave} disabled={saving}>
              {saving ? t('activities.saving') : t('activities.noteSave')}
            </button>
          </div>
        </div>
      ) : floor?.notes ? (
        <>
          <p className="text-sm text-ink-900/80 dark:text-cream-100/80 whitespace-pre-wrap">{floor.notes}</p>
          {floor.notesUpdatedAt && (
            <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-2">
              {t('activities.noteEditedBy', {
                name: author?.name || t('activities.noteSomeone'),
                time: formatDistanceToNowStrict(new Date(floor.notesUpdatedAt), { locale: dateLocale, addSuffix: true })
              })}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('activities.noteEmpty')}</p>
      )}
    </div>
  )
}

/** Mini-form para renombrar/ajustar los puntos de una de las 3 tareas
 * fijas, sin tocar su rotación (offset/día/turno siguen igual). */
function FixedTaskEditForm({ taskKey, initial, onCancel, onSubmit, t }) {
  const [title, setTitle] = useState(initial.title)
  const [points, setPoints] = useState(initial.points)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSubmit({ title: title.trim(), points: Number(points) || 0 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 flex flex-col gap-3">
      <p className="font-display font-semibold text-sm">{t('activities.editFixedTaskTitle', { title: initial.title })}</p>
      <label className="text-sm">
        {t('activities.fixedTaskNameLabel')}
        <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="text-sm">
        {t('activities.fixedTaskPointsLabel')}
        <input type="number" min="0" className="input mt-1" value={points} onChange={(e) => setPoints(e.target.value)} required />
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary text-sm flex-1" onClick={onCancel}>
          {t('activities.cancel')}
        </button>
        <button className="btn-primary text-sm flex-1" type="submit" disabled={saving}>
          {saving ? t('activities.saving') : t('activities.saveChanges')}
        </button>
      </div>
    </form>
  )
}

function describeFrequency(activity, t, dateLocale) {
  if (activity.frequencyType === 'once') {
    return activity.specificDate
      ? t('activities.frequencyOnceDate', { date: format(new Date(`${activity.specificDate}T00:00:00`), t('calendar.dayMonthFormat'), { locale: dateLocale }) })
      : t('activities.frequencyOnce')
  }
  const interval = activity.recurrenceInterval || 1
  const parts = []
  if (activity.recurrenceUnit === 'month') {
    parts.push(interval > 1 ? t('activities.recurEveryNMonths', { n: interval }) : t('activities.recurEveryMonth'))
  } else {
    parts.push(interval > 1 ? t('activities.recurEveryNWeeks', { n: interval }) : t('activities.recurEveryWeek'))
    if (activity.weekdays?.length) {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 })
      const labels = activity.weekdays
        .slice()
        .sort((a, b) => a - b)
        .map((d) => format(addDays(start, d), 'EEEEE', { locale: dateLocale }))
      parts.push(labels.join(' '))
    }
  }
  if (activity.untilDate) {
    parts.push(t('activities.untilLabel', { date: format(new Date(`${activity.untilDate}T00:00:00`), t('calendar.dayMonthFormat'), { locale: dateLocale }) }))
  }
  return parts.join(' · ')
}

function ActivityCard({ activity, completion, memberById, onEdit, onDelete, onProgress, t, dateLocale }) {
  const assignee = memberById[completion?.assignedUserId || activity.assignedUserId]
  const target = activity.timesPerWeek || 1
  const timesDone = completion?.timesDone || 0
  const isDone = completion?.completed || false
  const isStepper = activity.frequencyType === 'recurring' && activity.recurrenceUnit === 'week' && target > 1
  const notThisPeriod = activity.frequencyType === 'recurring' && !completion

  return (
    <div className={`card p-4 flex flex-col gap-3 ${isDone || notThisPeriod ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl border-2 border-ink-900/70 dark:border-cream-100/30 bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200 flex items-center justify-center shrink-0">
            <SparkleIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold truncate">{activity.title}</p>
            <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{describeFrequency(activity, t, dateLocale)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            title={t('activities.edit')}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
          >
            <EditIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title={t('activities.delete')}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-clay-500 hover:bg-clay-100 dark:hover:bg-clay-500/15"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {notThisPeriod ? (
        <p className="text-xs text-ink-900/40 dark:text-cream-100/40">{t('activities.notThisPeriod')}</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Avatar url={assignee?.avatarUrl} name={assignee?.name} size="w-7 h-7" textSize="text-xs" />
            <span className="text-sm font-medium truncate">{assignee ? assignee.name : t('activities.unassigned')}</span>
            {activity.assignmentMode === 'rotation' && activity.frequencyType !== 'once' && (
              <span className="text-[10px] text-ink-900/40 dark:text-cream-100/40 shrink-0">{t('activities.rotationTag')}</span>
            )}
          </div>

          {isStepper ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t('activities.stepProgress', { done: timesDone, target })}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onProgress(-1)}
                  disabled={timesDone <= 0}
                  className="w-7 h-7 rounded-lg border-2 border-ink-900/70 dark:border-cream-100/30 flex items-center justify-center disabled:opacity-40"
                >
                  <MinusIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onProgress(1)}
                  disabled={timesDone >= target}
                  className="w-7 h-7 rounded-lg border-2 border-ink-900/70 dark:border-cream-100/30 flex items-center justify-center disabled:opacity-40"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : isDone ? (
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-sage-500">{t('activities.completed')}</p>
              <button type="button" onClick={() => onProgress(-1)} className="text-xs text-ink-900/40 dark:text-cream-100/40 hover:underline">
                {t('activities.undo')}
              </button>
            </div>
          ) : (
            <button type="button" className="btn-primary text-sm w-full" onClick={() => onProgress(1)}>
              {t('activities.markDone')}
            </button>
          )}
        </>
      )}
    </div>
  )
}

const WEEKDAY_KEYS = [0, 1, 2, 3, 4, 5, 6] // 0=lunes..6=domingo

function RecurrenceEditor({ recurrenceUnit, setRecurrenceUnit, recurrenceInterval, setRecurrenceInterval, weekdays, toggleWeekday, untilDate, setUntilDate, t, dateLocale }) {
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])
  const weekdayLabels = useMemo(
    () => WEEKDAY_KEYS.map((d) => format(addDays(weekStart, d), 'EEEEE', { locale: dateLocale })),
    [weekStart, dateLocale]
  )

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl bg-cream-100 dark:bg-ink-700">
      <div className="flex items-center gap-2">
        <span className="text-sm shrink-0">{t('activities.repeatEvery')}</span>
        <input
          type="number"
          min="1"
          max="52"
          className="input w-16 text-center"
          value={recurrenceInterval}
          onChange={(e) => setRecurrenceInterval(e.target.value)}
        />
        <select className="input flex-1" value={recurrenceUnit} onChange={(e) => setRecurrenceUnit(e.target.value)}>
          <option value="week">{t('activities.unitWeeksOption')}</option>
          <option value="month">{t('activities.unitMonthsOption')}</option>
        </select>
      </div>

      {recurrenceUnit === 'week' && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-1.5">
            {t('activities.weekdaysLabel')}
          </p>
          <div className="flex gap-1.5">
            {WEEKDAY_KEYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleWeekday(d)}
                className={`w-8 h-8 rounded-full text-xs font-bold uppercase flex items-center justify-center border-2 ${
                  weekdays.includes(d)
                    ? 'bg-violet-500 border-violet-500 text-white'
                    : 'border-ink-900/20 dark:border-cream-100/20 text-ink-900/50 dark:text-cream-100/50'
                }`}
              >
                {weekdayLabels[d]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="text-sm flex-1">
          {t('activities.untilOptionalLabel')}
          <input type="date" className="input mt-1" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} />
        </label>
        {untilDate && (
          <button
            type="button"
            onClick={() => setUntilDate('')}
            aria-label={t('activities.removeUntilAria')}
            className="w-8 h-8 mt-5 rounded-lg flex items-center justify-center text-clay-500 hover:bg-clay-100 dark:hover:bg-clay-500/15 shrink-0"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function ActivityForm({ initial, members, onCancel, onSubmit, t, dateLocale }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [frequencyType, setFrequencyType] = useState(initial?.frequencyType || 'recurring')
  const [recurrenceUnit, setRecurrenceUnit] = useState(initial?.recurrenceUnit || 'week')
  const [recurrenceInterval, setRecurrenceInterval] = useState(initial?.recurrenceInterval || 1)
  const [weekdays, setWeekdays] = useState(initial?.weekdays || [])
  const [untilDate, setUntilDate] = useState(initial?.untilDate || '')
  const [specificDate, setSpecificDate] = useState(initial?.specificDate || '')
  const [assignmentMode, setAssignmentMode] = useState(initial?.assignmentMode || 'manual')
  const [assignedUserId, setAssignedUserId] = useState(initial?.assignedUserId || '')
  const [submitting, setSubmitting] = useState(false)

  const needsPerson = frequencyType === 'once' || assignmentMode === 'manual'

  function toggleWeekday(d) {
    setWeekdays((ws) => (ws.includes(d) ? ws.filter((x) => x !== d) : [...ws, d].sort((a, b) => a - b)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    if (frequencyType === 'once' && !specificDate) return
    if (needsPerson && !assignedUserId) return
    setSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        frequencyType,
        recurrenceUnit: frequencyType === 'recurring' ? recurrenceUnit : null,
        recurrenceInterval: Number(recurrenceInterval) || 1,
        weekdays: frequencyType === 'recurring' && recurrenceUnit === 'week' ? weekdays : null,
        untilDate: frequencyType === 'recurring' ? untilDate || null : null,
        startDate: initial?.startDate || new Date().toISOString().slice(0, 10),
        specificDate: frequencyType === 'once' ? specificDate : null,
        assignmentMode: frequencyType === 'once' ? 'manual' : assignmentMode,
        assignedUserId: assignedUserId || null
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 mb-4 flex flex-col gap-3">
      <h3 className="font-display font-bold">{initial ? t('activities.formTitleEdit') : t('activities.formTitleCreate')}</h3>
      <input
        className="input"
        placeholder={t('activities.titlePlaceholder')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-1.5">{t('activities.frequencyLabel')}</p>
        <div className="flex bg-cream-200 dark:bg-ink-700 rounded-xl p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setFrequencyType('recurring')}
            className={`flex-1 py-1.5 rounded-lg ${frequencyType === 'recurring' ? 'bg-white dark:bg-ink-800 shadow-sm' : ''}`}
          >
            {t('activities.freqCustomOption')}
          </button>
          <button
            type="button"
            onClick={() => setFrequencyType('once')}
            className={`flex-1 py-1.5 rounded-lg ${frequencyType === 'once' ? 'bg-white dark:bg-ink-800 shadow-sm' : ''}`}
          >
            {t('activities.freqOnceOption')}
          </button>
        </div>
      </div>

      {frequencyType === 'recurring' && (
        <RecurrenceEditor
          recurrenceUnit={recurrenceUnit}
          setRecurrenceUnit={setRecurrenceUnit}
          recurrenceInterval={recurrenceInterval}
          setRecurrenceInterval={setRecurrenceInterval}
          weekdays={weekdays}
          toggleWeekday={toggleWeekday}
          untilDate={untilDate}
          setUntilDate={setUntilDate}
          t={t}
          dateLocale={dateLocale}
        />
      )}

      {frequencyType === 'once' && (
        <label className="text-sm">
          {t('activities.dateLabel')}
          <input type="date" className="input mt-1" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} required />
        </label>
      )}

      {frequencyType !== 'once' && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-1.5">{t('activities.assignmentLabel')}</p>
          <div className="flex bg-cream-200 dark:bg-ink-700 rounded-xl p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setAssignmentMode('manual')}
              className={`flex-1 py-1.5 rounded-lg ${assignmentMode === 'manual' ? 'bg-white dark:bg-ink-800 shadow-sm' : ''}`}
            >
              {t('activities.assignManual')}
            </button>
            <button
              type="button"
              onClick={() => setAssignmentMode('rotation')}
              className={`flex-1 py-1.5 rounded-lg ${assignmentMode === 'rotation' ? 'bg-white dark:bg-ink-800 shadow-sm' : ''}`}
            >
              {t('activities.assignRotation')}
            </button>
          </div>
        </div>
      )}

      {needsPerson && (
        <label className="text-sm">
          {frequencyType === 'once' ? t('activities.whoDoesIt') : t('activities.responsiblePerson')}
          <select className="input mt-1" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} required>
            <option value="">{t('activities.choosePerson')}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex gap-2 mt-1">
        <button type="button" className="btn-secondary text-sm flex-1" onClick={onCancel}>
          {t('activities.cancel')}
        </button>
        <button className="btn-primary text-sm flex-1" type="submit" disabled={submitting}>
          {submitting ? t('activities.saving') : initial ? t('activities.saveChanges') : t('activities.createActivity')}
        </button>
      </div>
    </form>
  )
}
