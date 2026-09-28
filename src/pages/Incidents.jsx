import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import IncidentCard from '../components/IncidentCard'
import IncidentDetailDialog from '../components/IncidentDetailDialog'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { uploadIncidentPhoto } from '../lib/db'
import { PinIcon } from '../components/icons'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import Reveal from '../components/Reveal'
import ExpandableSection from '../components/ExpandableSection'
import { INCIDENT_DURATION_OPTIONS, incidentExpiresAt } from '../lib/incidents'

// Para el mínimo del selector de "Otro tiempo": no tiene sentido elegir
// una fecha ya pasada. Se recalcula en cada render, no hace falta que sea
// exacto al segundo.
function minDatetimeLocal() {
  const d = new Date(Date.now() + 60000)
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

export default function Incidents() {
  const { user, membership } = useAuth()
  const { floor, incidents, incidentHistory, incidentComments, addIncident, removeIncident, resolveIncident, addIncidentComment } = useData()
  const { showToast } = useToast()
  const { t, dateLocale } = useLanguage()
  const EXAMPLES = t('incidents.examples')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [duration, setDuration] = useState('24h')
  const [customExpiresAt, setCustomExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Incidencia abierta en el detalle (hilo de comentarios + solucionar):
  // se guarda solo el id y se busca en vivo en incidents/incidentHistory,
  // así el pop-up refleja al instante un comentario nuevo o el cambio a
  // "solucionada" sin tener que cerrarlo y volver a abrirlo.
  const [openIncidentId, setOpenIncidentId] = useState(null)

  const openIncident = useMemo(
    () => [...incidents, ...incidentHistory].find((i) => i.id === openIncidentId) || null,
    [incidents, incidentHistory, openIncidentId]
  )
  const openIncidentComments = useMemo(
    () => incidentComments.filter((c) => c.incidentId === openIncidentId),
    [incidentComments, openIncidentId]
  )
  const commentCountByIncident = useMemo(() => {
    const counts = {}
    for (const c of incidentComments) counts[c.incidentId] = (counts[c.incidentId] || 0) + 1
    return counts
  }, [incidentComments])

  function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    if (duration === 'other' && !customExpiresAt) return
    setSubmitting(true)
    setError('')
    try {
      let photoUrl = null
      if (photoFile) {
        photoUrl = await uploadIncidentPhoto(photoFile, floor.id)
      }
      const durationOption = INCIDENT_DURATION_OPTIONS.find((o) => o.key === duration)
      const finalExpiresAt = durationOption ? incidentExpiresAt(durationOption.hours) : new Date(customExpiresAt).toISOString()
      await addIncident({ title, description, photoUrl, expiresAt: finalExpiresAt })
      showToast(t('incidents.publishedToast'), 'success')
      setTitle('')
      setDescription('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setDuration('24h')
      setCustomExpiresAt('')
      setShowForm(false)
    } catch (err) {
      setError(t('incidents.publishErrorToast', { error: err.message }))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResolve(incidentId) {
    try {
      await resolveIncident(incidentId)
      showToast(t('incidents.resolvedToast'), 'success')
    } catch (err) {
      showToast(t('incidents.resolveErrorToast'), 'default')
    }
  }

  async function handleAddComment(incidentId, body) {
    try {
      await addIncidentComment(incidentId, body)
    } catch (err) {
      showToast(t('incidents.commentErrorToast'), 'default')
    }
  }

  function handleDelete(incidentId) {
    if (openIncidentId === incidentId) setOpenIncidentId(null)
    removeIncident(incidentId)
  }

  return (
    <AppLayout title={t('incidents.title')}>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60">{t('incidents.subtitle')}</p>
        <button className="btn-primary text-sm shrink-0" onClick={() => setShowForm((s) => !s)}>
          {showForm ? t('incidents.cancel') : t('incidents.newIncident')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 mb-6 flex flex-col gap-3">
          <input
            className="input"
            placeholder={t('incidents.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className="input min-h-20"
            placeholder={t('incidents.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 text-xs font-medium text-ink-900/50 dark:text-cream-100/50">
            {EXAMPLES.map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => setTitle(ex)}
                className="px-2 py-1 rounded-full bg-cream-100 dark:bg-ink-700 hover:bg-cream-200"
              >
                {ex}
              </button>
            ))}
          </div>
          <label className="btn-secondary text-sm cursor-pointer self-start">
            📷 {t('incidents.addPhoto')}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
          {photoPreview && <img src={photoPreview} alt={t('incidents.photoPreviewAlt')} className="w-14 h-14 object-cover rounded-lg" />}

          <div>
            <label className="text-sm block mb-1.5">{t('incidents.durationLabel')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INCIDENT_DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDuration(opt.key)}
                  className={`text-sm font-semibold px-3 py-2 rounded-xl border-2 ${
                    duration === opt.key
                      ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
                      : 'border-ink-900/15 dark:border-cream-100/20 text-ink-900/70 dark:text-cream-100/70'
                  }`}
                >
                  {t(`incidents.duration${opt.key}`)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDuration('other')}
                className={`text-sm font-semibold px-3 py-2 rounded-xl border-2 ${
                  duration === 'other'
                    ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
                    : 'border-ink-900/15 dark:border-cream-100/20 text-ink-900/70 dark:text-cream-100/70'
                }`}
              >
                {t('incidents.durationOther')}
              </button>
            </div>
            {duration === 'other' && (
              <label className="text-sm block mt-2">
                {t('incidents.durationOtherLabel')}
                <input
                  type="datetime-local"
                  className="input mt-1"
                  value={customExpiresAt}
                  min={minDatetimeLocal()}
                  onChange={(e) => setCustomExpiresAt(e.target.value)}
                  required
                />
              </label>
            )}
          </div>

          {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
          <button className="btn-primary self-start" type="submit" disabled={submitting || (duration === 'other' && !customExpiresAt)}>
            {submitting ? t('incidents.publishing') : t('incidents.publish')}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-5">
        <ExpandableSection
          title={t('incidents.boardTitle')}
          description={t('incidents.boardDescription', { count: incidents.length, plural: incidents.length === 1 ? '' : 's' })}
          defaultExpanded
        >
          {incidents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-700/25 text-violet-500 dark:text-violet-200 flex items-center justify-center">
                <PinIcon className="w-6 h-6" />
              </div>
              <p className="text-sm text-center text-ink-900/50 dark:text-cream-100/50 max-w-xs">{t('incidents.emptyBody')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {incidents.map((incident, i) => (
                <Reveal key={incident.id} delay={i * 60}>
                  <IncidentCard
                    incident={incident}
                    canDelete={incident.userId === user.id || membership?.role === 'admin'}
                    onDelete={handleDelete}
                    onOpen={() => setOpenIncidentId(incident.id)}
                    commentCount={commentCountByIncident[incident.id] || 0}
                    t={t}
                    dateLocale={dateLocale}
                  />
                </Reveal>
              ))}
            </div>
          )}
        </ExpandableSection>

        <ExpandableSection
          title={t('incidents.historyTitle')}
          description={t('incidents.historyDescription', { count: incidentHistory.length, plural: incidentHistory.length === 1 ? '' : 's' })}
        >
          {incidentHistory.length === 0 ? (
            <p className="text-sm text-center py-8 text-ink-900/50 dark:text-cream-100/50">{t('incidents.historyEmpty')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {incidentHistory.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  canDelete={incident.userId === user.id || membership?.role === 'admin'}
                  onDelete={handleDelete}
                  onOpen={() => setOpenIncidentId(incident.id)}
                  commentCount={commentCountByIncident[incident.id] || 0}
                  t={t}
                  dateLocale={dateLocale}
                />
              ))}
            </div>
          )}
        </ExpandableSection>
      </div>

      {openIncident && (
        <IncidentDetailDialog
          incident={openIncident}
          comments={openIncidentComments}
          canResolve={openIncident.userId === user.id || membership?.role === 'admin'}
          onClose={() => setOpenIncidentId(null)}
          onResolve={handleResolve}
          onAddComment={handleAddComment}
          t={t}
          dateLocale={dateLocale}
        />
      )}
    </AppLayout>
  )
}
