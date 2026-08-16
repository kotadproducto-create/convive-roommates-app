/**
 * Círculo de avatar reutilizado en Topbar, Convives y Perfil: muestra la
 * foto subida si existe, si no cae de vuelta a la inicial del nombre
 * (mismo look que ya tenía la app antes de poder subir fotos).
 */
export default function Avatar({ url, name, size = 'w-10 h-10', textSize = 'text-sm' }) {
  return (
    <div className={`${size} rounded-full border-2 border-ink-900 shrink-0 overflow-hidden flex items-center justify-center ${!url ? 'bg-gold-400 text-ink-900' : ''}`}>
      {url ? (
        <img src={url} alt={name || 'Avatar'} className="w-full h-full object-cover" />
      ) : (
        <span className={`font-bold ${textSize}`}>{name?.[0]?.toUpperCase() || '?'}</span>
      )}
    </div>
  )
}
