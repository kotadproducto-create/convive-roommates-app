import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useLanguage } from '../context/LanguageContext'
import { publicTurnsLink } from '../lib/publicTurns'
import { getFloorPublicLink, setFloorPublicLink } from '../lib/publicTurnsApi'
import { ConfirmVirtualDialog } from './VirtualMembers'
import { ShareIcon } from './icons'

/**
 * Tu piso → "Link de turnos": un enlace (y su QR) de solo lectura, sin iniciar
 * sesión, con a quién le toca y quién está a cargo. Cualquier miembro puede verlo
 * y compartirlo; solo un admin lo activa, lo desactiva o lo regenera.
 */
export default function PublicTurnsLinkCard({ floorId, floorName, isAdmin }) {
  const { t } = useLanguage()
  const [link, setLink] = useState(undefined) // undefined = cargando; { enabled, token } después
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [confirm, setConfirm] = useState(null) // 'regenerate' | 'disable'

  useEffect(() => {
    if (!floorId) return undefined
    let active = true
    getFloorPublicLink(floorId)
      .then((result) => {
        if (!active) return
        if (result?.ok) setLink(result)
        else setLoadError(true)
      })
      .catch((err) => {
        console.error('get_floor_public_link', err)
        if (active) setLoadError(true)
      })
    return () => {
      active = false
    }
  }, [floorId])

  const url = link?.enabled && link.token ? publicTurnsLink(window.location.origin, link.token) : ''

  // El QR se dibuja en negro sobre blanco aunque la app esté en modo oscuro: así lo lee cualquier cámara.
  useEffect(() => {
    if (!showQr || !url) {
      setQrUrl('')
      return undefined
    }
    let active = true
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#17131C', light: '#FFFFFF' } })
      .then((dataUrl) => active && setQrUrl(dataUrl))
      .catch((err) => console.error('qr', err))
    return () => {
      active = false
    }
  }, [showQr, url])

  async function changeLink(action) {
    const result = await setFloorPublicLink(floorId, action)
    if (!result?.ok) throw new Error(result?.error || action)
    setLink(result)
    setError('')
    if (!result.enabled) setShowQr(false)
  }

  async function handleEnable() {
    setBusy(true)
    setError('')
    try {
      await changeLink('enable')
    } catch (err) {
      console.error('enable public link', err)
      setError(t('floorSettings.turnsLink.error'))
    } finally {
      setBusy(false)
    }
  }

  async function handleShare() {
    const text = t('floorSettings.turnsLink.shareText', { floor: floorName })
    setNotice('')
    try {
      if (navigator.share) {
        await navigator.share({ title: t('floorSettings.turnsLink.title'), text, url })
        return
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setNotice(t('floorSettings.turnsLink.copied'))
      setTimeout(() => setNotice(''), 2500)
    } catch {
      setNotice(url)
    }
  }

  function handleDownloadQr() {
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = 'turnos-del-piso.png'
    a.click()
  }

  return (
    <>
      <h2 className="font-display font-semibold mb-1">{t('floorSettings.turnsLink.title')}</h2>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">{t('floorSettings.turnsLink.subtitle')}</p>

      {loadError ? (
        <p className="text-sm font-medium text-clay-500">{t('floorSettings.turnsLink.loadError')}</p>
      ) : link === undefined ? (
        <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('floorSettings.turnsLink.loading')}</p>
      ) : !link.enabled ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
            {isAdmin ? t('floorSettings.turnsLink.notEnabledAdmin') : t('floorSettings.turnsLink.notEnabledMember')}
          </p>
          {isAdmin && (
            <button type="button" className="btn-primary text-sm self-start" onClick={handleEnable} disabled={busy}>
              {busy ? t('floorSettings.turnsLink.enabling') : t('floorSettings.turnsLink.enable')}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="bg-cream-100 dark:bg-ink-700 border-2 border-ink-900/10 dark:border-cream-100/15 rounded-xl px-3 py-2 text-xs break-all select-all">{url}</div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={handleShare}>
              <ShareIcon className="w-4 h-4 shrink-0" />
              {t('floorSettings.turnsLink.share')}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowQr((s) => !s)}>
              {t(showQr ? 'floorSettings.turnsLink.hideQr' : 'floorSettings.turnsLink.showQr')}
            </button>
            <a href={url} target="_blank" rel="noreferrer noopener" className="btn-secondary text-sm">
              {t('floorSettings.turnsLink.open')}
            </a>
          </div>

          {notice && <p className="text-xs font-semibold text-sage-500 break-all">{notice}</p>}

          {showQr && (
            <div className="flex flex-col items-start gap-2">
              <div className="bg-white rounded-xl p-2 border-2 border-ink-900/10 w-full max-w-[16rem] aspect-square flex items-center justify-center">
                {qrUrl ? <img src={qrUrl} alt={t('floorSettings.turnsLink.qrAlt')} className="w-full h-full" /> : <span className="text-xs text-ink-900/50">{t('floorSettings.turnsLink.loading')}</span>}
              </div>
              {qrUrl && (
                <button type="button" className="text-xs font-semibold text-violet-500 hover:underline" onClick={handleDownloadQr}>
                  {t('floorSettings.turnsLink.downloadQr')}
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-ink-900/10 dark:border-cream-100/15">
              <button type="button" className="text-xs font-semibold text-gold-500 hover:underline" onClick={() => setConfirm('regenerate')}>
                {t('floorSettings.turnsLink.regenerate')}
              </button>
              <button type="button" className="text-xs font-semibold text-clay-500 hover:underline" onClick={() => setConfirm('disable')}>
                {t('floorSettings.turnsLink.disable')}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm font-medium text-clay-500 mt-2">{error}</p>}

      {confirm && (
        <ConfirmVirtualDialog
          danger
          title={t(confirm === 'regenerate' ? 'floorSettings.turnsLink.regenerateTitle' : 'floorSettings.turnsLink.disableTitle')}
          body={t(confirm === 'regenerate' ? 'floorSettings.turnsLink.regenerateBody' : 'floorSettings.turnsLink.disableBody')}
          confirmLabel={t(confirm === 'regenerate' ? 'floorSettings.turnsLink.regenerateYes' : 'floorSettings.turnsLink.disableYes')}
          workingLabel={t('floorSettings.turnsLink.working')}
          onClose={() => setConfirm(null)}
          onConfirm={() => changeLink(confirm)}
        />
      )}
    </>
  )
}
