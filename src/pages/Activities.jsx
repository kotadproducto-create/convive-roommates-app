import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { update } from '../lib/db'
import { currentPeriodKey } from '../lib/activities'
import ActivityCard from '../components/ActivityCard'
import { CloseIcon } from '../components/icons'
import { format, formatDistanceToNowStrict, startOfWeek, addDays } from 'date-fns'

/**
 * Gestor de actividades del piso: una sola lista "Frecuentes" — junta
 * las 3 fijas (Compras/Basura/Lavadora, identificadas por
 * `activity.fixedKey`, no borrables) con las actividades recurrentes
 * propias, porque ambas son filas de la misma tabla `activities` — más
 * "De una sola vez" para eventos puntuales. Ver DataContext.jsx
 * (activities/activityCompletions/addActivity/...) y lib/activities.js
 * para el modelo de datos.
 */
export default function Activities() {
  const { members, activities, activityCompletions, weekKey, addActivity, updateActivity, removeActivity, setActivityProgress } = useData()
  const { showToast } = useToast()
  const { t, dateLocale } = useLanguage()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

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
    if (!confirm(t('activities.confirmDelete', { title: activity.title }))) return false
    removeActivity(activity.id)
    showToast(t('activities.deletedToast'), 'default')
    return true
  }

  function renderCard(activity, i) {
    const periodKey = currentPeriodKey(activity, weekKey)
    const completion = periodKey ? activityCompletions.find((c) => c.activityId === activity.id && c.periodKey === periodKey) : null
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
            onDelete={
              editing
                ? () => {
                    if (handleDelete(editing)) setEditing(null)
                  }
                : null
            }
            t={t}
            dateLocale={dateLocale}
          />
        </Reveal>
      )}

      <section className="mb-6">
        <h3 className="font-display font-semibold mb-3">{t('activities.frequentTitle')}</h3>
        {recurringActivities.length === 0 ? (
          <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('activities.empty')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{recurringActivities.map(renderCard)}</div>
        )}
      </section>

      <section>
        <h3 className="font-display font-semibold mb-3">{t('activities.onceTitle')}</h3>
        {oneTimeActivities.length === 0 ? (
          <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('activities.emptyOnce')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{oneTimeActivities.map(renderCard)}</div>
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

const WEEKDAY_KEYS = [0, 1, 2, 3, 4, 5, 6] // 0=lunes..6=domingo

// Presets de frecuencia: cada uno fija unidad+intervalo por debajo —
// "Otra" es la única que deja tocar esos dos valores a mano.
const PRESETS = ['daily', 'weekly', 'biweekly', 'monthly', 'other']
const PRESET_RECURRENCE = {
  daily: { unit: 'day', interval: 1 },
  weekly: { unit: 'week', interval: 1 },
  biweekly: { unit: 'week', interval: 2 },
  monthly: { unit: 'month', interval: 1 }
}
function presetFromRecurrence(unit, interval) {
  const match = Object.entries(PRESET_RECURRENCE).find(([, v]) => v.unit === unit && v.interval === interval)
  return match ? match[0] : 'other'
}
const PRESET_LABEL_KEYS = {
  daily: 'activities.dailyOption',
  weekly: 'activities.weeklyOption',
  biweekly: 'activities.biweeklyOption',
  monthly: 'activities.monthlyOption',
  other: 'activities.otherOption'
}

function RecurrenceEditor({
  preset,
  onSelectPreset,
  recurrenceUnit,
  setRecurrenceUnit,
  recurrenceInterval,
  setRecurrenceInterval,
  weekdays,
  toggleWeekday,
  untilDate,
  setUntilDate,
  t,
  dateLocale
}) {
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])
  const weekdayLabels = useMemo(
    () => WEEKDAY_KEYS.map((d) => format(addDays(weekStart, d), 'EEEEE', { locale: dateLocale })),
    [weekStart, dateLocale]
  )

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl bg-cream-100 dark:bg-ink-700">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectPreset(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${
              preset === key
                ? 'bg-violet-500 border-violet-500 text-white'
                : 'border-ink-900/20 dark:border-cream-100/20 text-ink-900/60 dark:text-cream-100/60'
            }`}
          >
            {t(PRESET_LABEL_KEYS[key])}
          </button>
        ))}
      </div>

      {preset === 'other' && (
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
            <option value="day">{t('activities.unitDaysOption')}</option>
            <option value="week">{t('activities.unitWeeksOption')}</option>
            <option value="month">{t('activities.unitMonthsOption')}</option>
          </select>
        </div>
      )}

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

function ActivityForm({ initial, members, onCancel, onSubmit, onDelete, t, dateLocale }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [frequencyType, setFrequencyType] = useState(initial?.frequencyType || 'recurring')
  const [recurrenceUnit, setRecurrenceUnit] = useState(initial?.recurrenceUnit || 'week')
  const [recurrenceInterval, setRecurrenceInterval] = useState(initial?.recurrenceInterval || 1)
  const [preset, setPreset] = useState(() => presetFromRecurrence(initial?.recurrenceUnit || 'week', initial?.recurrenceInterval || 1))
  const [weekdays, setWeekdays] = useState(initial?.weekdays || [])
  const [untilDate, setUntilDate] = useState(initial?.untilDate || '')
  const [specificDate, setSpecificDate] = useState(initial?.specificDate || '')
  const [assignmentMode, setAssignmentMode] = useState(initial?.assignmentMode || 'manual')
  const [assignedUserId, setAssignedUserId] = useState(initial?.assignedUserId || '')
  const [submitting, setSubmitting] = useState(false)

  const isFixed = Boolean(initial?.fixedKey)
  const needsPerson = frequencyType === 'once' || assignmentMode === 'manual'

  function selectPreset(key) {
    setPreset(key)
    if (key !== 'other') {
      setRecurrenceUnit(PRESET_RECURRENCE[key].unit)
      setRecurrenceInterval(PRESET_RECURRENCE[key].interval)
    }
  }

  function toggleWeekday(d) {
    setWeekdays((ws) => (ws.includes(d) ? ws.filter((x) => x !== d) : [...ws, d].sort((a, b) => a - b)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    if (frequencyType === 'once' && !specificDate) return
    setSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        fixedKey: initial?.fixedKey || null,
        points: initial?.points ?? null,
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

      {!isFixed && (
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
      )}

      {frequencyType === 'recurring' && (
        <RecurrenceEditor
          preset={preset}
          onSelectPreset={selectPreset}
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

      {frequencyType !== 'once' && !isFixed && (
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
          <select className="input mt-1" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
            <option value="">{t('activities.everyone')}</option>
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

      {initial && !isFixed && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="text-sm font-semibold text-clay-500 hover:underline self-center"
        >
          {t('activities.deleteActivity')}
        </button>
      )}
    </form>
  )
}
