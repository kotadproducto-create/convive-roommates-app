import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import TaskCard from '../components/TaskCard'
import Avatar from '../components/Avatar'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { update } from '../lib/db'
import { TASK_TYPES } from '../lib/rotation'
import { currentPeriodKey } from '../lib/activities'
import { SparkleIcon, EditIcon, TrashIcon, PlusIcon, MinusIcon } from '../components/icons'
import { format, formatDistanceToNowStrict } from 'date-fns'

/**
 * Gestor de actividades del piso: junto a las 3 tareas fijas
 * (Compras/Basura/Lavadora, que siguen rotando automáticamente y no
 * son editables desde acá — ver rotation.js), un listado de
 * actividades propias con frecuencia flexible (semanal con N veces,
 * mensual, o evento único) creadas por cualquier miembro del piso.
 * Ver DataContext.jsx (activities/activityCompletions/addActivity/...)
 * y lib/activities.js para el modelo de datos.
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

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))

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

      <div className="mb-5">
        <GroupNoteCard floor={floor} memberById={memberById} t={t} dateLocale={dateLocale} />
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
          />
        </Reveal>
      )}

      <section className="mb-6">
        <h3 className="font-display font-semibold mb-3">{t('activities.fixedTasksTitle')}</h3>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <Reveal key={task.id}>
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

      <section>
        <h3 className="font-display font-semibold mb-3">{t('activities.ownActivitiesTitle')}</h3>
        {activities.length === 0 ? (
          <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('activities.empty')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {activities.map((activity, i) => {
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

/** Nota compartida del piso: texto libre, editable por cualquier
 * miembro (misma policy de "floors" ya vigente — is_active_member),
 * con quién la editó por última vez y cuándo. Se guarda en floors.notes
 * directo con update() de db.js, mismo patrón que ya usa
 * FloorSettings.jsx para el resto de ajustes del piso. */
function GroupNoteCard({ floor, memberById, t, dateLocale }) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(floor?.notes || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setValue(floor?.notes || '')
  }, [floor?.notes, editing])

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

function describeFrequency(activity, t, dateLocale) {
  if (activity.frequencyType === 'weekly') {
    const n = activity.timesPerWeek || 1
    return t(n > 1 ? 'activities.frequencyWeeklyPlural' : 'activities.frequencyWeekly', { n })
  }
  if (activity.frequencyType === 'monthly') return t('activities.frequencyMonthly')
  if (activity.specificDate) {
    return t('activities.frequencyOnceDate', {
      date: format(new Date(`${activity.specificDate}T00:00:00`), "d 'de' MMMM", { locale: dateLocale })
    })
  }
  return t('activities.frequencyOnce')
}

function ActivityCard({ activity, completion, memberById, onEdit, onDelete, onProgress, t, dateLocale }) {
  const assignee = memberById[completion?.assignedUserId || activity.assignedUserId]
  const target = activity.timesPerWeek || 1
  const timesDone = completion?.timesDone || 0
  const isDone = completion?.completed || false
  const isStepper = activity.frequencyType === 'weekly' && target > 1

  return (
    <div className={`card p-4 flex flex-col gap-3 ${isDone ? 'opacity-70' : ''}`}>
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
    </div>
  )
}

const FREQUENCY_OPTIONS = [
  ['weekly', 'freqWeeklyOption'],
  ['monthly', 'freqMonthlyOption'],
  ['once', 'freqOnceOption']
]

function ActivityForm({ initial, members, onCancel, onSubmit, t }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [frequencyType, setFrequencyType] = useState(initial?.frequencyType || 'weekly')
  const [timesPerWeek, setTimesPerWeek] = useState(initial?.timesPerWeek || 1)
  const [specificDate, setSpecificDate] = useState(initial?.specificDate || '')
  const [assignmentMode, setAssignmentMode] = useState(initial?.assignmentMode || 'manual')
  const [assignedUserId, setAssignedUserId] = useState(initial?.assignedUserId || '')
  const [submitting, setSubmitting] = useState(false)

  const needsPerson = frequencyType === 'once' || assignmentMode === 'manual'

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
        timesPerWeek: Number(timesPerWeek) || 1,
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
          {FREQUENCY_OPTIONS.map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFrequencyType(value)}
              className={`flex-1 py-1.5 rounded-lg ${frequencyType === value ? 'bg-white dark:bg-ink-800 shadow-sm' : ''}`}
            >
              {t(`activities.${labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      {frequencyType === 'weekly' && (
        <label className="text-sm">
          {t('activities.timesPerWeekLabel')}
          <input
            type="number"
            min="1"
            max="7"
            className="input mt-1"
            value={timesPerWeek}
            onChange={(e) => setTimesPerWeek(e.target.value)}
          />
        </label>
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
