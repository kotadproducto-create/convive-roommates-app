import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import IncidentCard from '../components/IncidentCard'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { uploadIncidentPhoto } from '../lib/db'

const EXAMPLES = [
  'Cuidado con la limpieza de la cocina',
  'Recibir paquete (no estaré)',
  'Llaves olvidadas, necesito entrar',
  'Pedir permiso para usar la batidora'
]

export default function Incidents() {
  const { user, membership } = useAuth()
  const { floor, incidents, addIncident, removeIncident } = useData()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
    setSubmitting(true)
    setError('')
    try {
      let photoUrl = null
      if (photoFile) {
        photoUrl = await uploadIncidentPhoto(photoFile, floor.id)
      }
      await addIncident({ title, description, photoUrl, expiresAt: expiresAt || null })
      setTitle('')
      setDescription('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setExpiresAt('')
      setShowForm(false)
    } catch (err) {
      setError('No se pudo publicar la incidencia: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout title="Muro de incidencias">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-charcoal-900/60 dark:text-linen-100/60">
          Avisos temporales para todo el piso: paquetes, permisos, cuidados puntuales...
        </p>
        <button className="btn-primary text-sm shrink-0" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancelar' : '+ Nueva incidencia'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 mb-6 flex flex-col gap-3">
          <input
            className="input"
            placeholder="Título (ej: Recibir paquete de Juan)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className="input min-h-20"
            placeholder="Descripción (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 text-xs text-charcoal-900/50 dark:text-linen-100/50">
            {EXAMPLES.map((ex) => (
              <button
                type="button"
                key={ex}
                onClick={() => setTitle(ex)}
                className="px-2 py-1 rounded-full bg-linen-100 dark:bg-charcoal-700 hover:bg-linen-200"
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="btn-secondary text-sm cursor-pointer">
              📷 Añadir foto
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
            {photoPreview && <img src={photoPreview} alt="preview" className="w-14 h-14 object-cover rounded-lg" />}
            <div className="flex items-center gap-2 text-sm ml-auto">
              <label className="text-charcoal-900/60 dark:text-linen-100/60">Expira:</label>
              <input type="date" className="input w-auto" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-clay-500">{error}</p>}
          <button className="btn-primary self-start" type="submit" disabled={submitting}>
            {submitting ? 'Publicando…' : 'Publicar en el muro'}
          </button>
        </form>
      )}

      {incidents.length === 0 ? (
        <p className="text-sm text-center py-16 text-charcoal-900/50 dark:text-linen-100/50">
          No hay incidencias activas. Cuando publiques una, aparecerá aquí para todo el piso.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              canDelete={incident.userId === user.id || membership?.role === 'admin'}
              onDelete={removeIncident}
            />
          ))}
        </div>
      )}
    </AppLayout>
  )
}
