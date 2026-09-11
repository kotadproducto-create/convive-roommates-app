import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'
import Avatar from '../components/Avatar'
import { AuthShell } from './Login'
import { CameraIcon } from '../components/icons'
import { getMemberColor } from '../lib/roomieColors'

const STEP_COUNT = 3

/**
 * Cuestionario de bienvenida, solo tras el registro (ver Register.jsx,
 * que navega acá en vez de "/"): completar el perfil en pasos cortos,
 * totalmente opcional — se puede omitir cada paso, o todo de una, sin
 * que eso bloquee el acceso a la app. Mismos campos e inputs que ya
 * tiene PersonalInfoCard en Perfil.jsx (ese formulario sigue intacto,
 * esto es solo una capa de UX que los ofrece antes). Todo se guarda en
 * un único updateProfile() al terminar u omitir, junto con
 * onboardingSeen:true para que no vuelva a aparecer.
 */
export default function Onboarding() {
  const { user, refresh } = useAuth()
  const { updateProfile } = useData()
  const navigate = useNavigate()
  const { t } = useLanguage()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState({
    nickname: '',
    age: '',
    agePublic: true,
    phone: '',
    phonePublic: true,
    occupation: '',
    occupationPublic: true,
    interests: '',
    bio: '',
    color: getMemberColor(user),
    avatarFile: null,
    avatarPreview: null
  })

  function set(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  async function finish() {
    if (!user) return
    setSaving(true)
    try {
      await updateProfile(user.id, {
        nickname: fields.nickname.trim() || null,
        age: fields.age ? Number(fields.age) : null,
        agePublic: fields.agePublic,
        phone: fields.phone.trim() || null,
        phonePublic: fields.phonePublic,
        occupation: fields.occupation.trim() || null,
        occupationPublic: fields.occupationPublic,
        interests: fields.interests.trim() || null,
        presentationMessage: fields.bio.trim() || null,
        color: fields.color,
        avatarFile: fields.avatarFile || undefined,
        onboardingSeen: true
      })
      await refresh()
    } finally {
      setSaving(false)
      navigate('/')
    }
  }

  function skipAll() {
    if (!user || saving) return
    finish()
  }

  function next() {
    if (step < STEP_COUNT - 1) setStep((s) => s + 1)
    else finish()
  }

  if (!user) return null

  return (
    <AuthShell>
      <div className="flex items-center justify-center gap-1.5 mb-4">
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-violet-500' : i < step ? 'w-1.5 bg-violet-500' : 'w-1.5 bg-cream-200 dark:bg-ink-700'}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight mb-1">{t('onboarding.step1Title')}</h1>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60">{t('onboarding.step1Subtitle')}</p>
          </div>
          <label className="text-sm">
            {t('perfil.nickname')}
            <input className="input mt-1" value={fields.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder={t('perfil.nicknamePlaceholder')} />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm block">
                {t('perfil.age')}
                <input type="number" min="1" max="129" className="input mt-1" value={fields.age} onChange={(e) => set('age', e.target.value)} />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-ink-900/50 dark:text-cream-100/50 mt-1.5">
                <input type="checkbox" checked={fields.agePublic} onChange={(e) => set('agePublic', e.target.checked)} />
                {t('perfil.visibleToOthers')}
              </label>
            </div>
            <div>
              <label className="text-sm block">
                {t('perfil.phone')}
                <input type="tel" className="input mt-1" value={fields.phone} onChange={(e) => set('phone', e.target.value)} placeholder={t('perfil.phonePlaceholder')} />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-ink-900/50 dark:text-cream-100/50 mt-1.5">
                <input type="checkbox" checked={fields.phonePublic} onChange={(e) => set('phonePublic', e.target.checked)} />
                {t('perfil.visibleToOthers')}
              </label>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight mb-1">{t('onboarding.step2Title')}</h1>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60">{t('onboarding.step2Subtitle')}</p>
          </div>
          <div>
            <label className="text-sm block">
              {t('perfil.occupation')}
              <input className="input mt-1" value={fields.occupation} onChange={(e) => set('occupation', e.target.value)} placeholder={t('perfil.occupationPlaceholder')} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-900/50 dark:text-cream-100/50 mt-1.5">
              <input type="checkbox" checked={fields.occupationPublic} onChange={(e) => set('occupationPublic', e.target.checked)} />
              {t('perfil.visibleToOthers')}
            </label>
          </div>
          <label className="text-sm">
            {t('perfil.interests')}
            <input className="input mt-1" value={fields.interests} onChange={(e) => set('interests', e.target.value)} placeholder={t('perfil.interestsPlaceholder')} />
          </label>
          <label className="text-sm">
            {t('perfil.bio')}
            <textarea
              className="input mt-1 min-h-20"
              value={fields.bio}
              maxLength={240}
              onChange={(e) => set('bio', e.target.value)}
              placeholder={t('perfil.bioPlaceholder')}
            />
            <span className="text-xs text-ink-900/40 dark:text-cream-100/40">{fields.bio.length}/240</span>
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight mb-1">{t('onboarding.step3Title')}</h1>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60">{t('onboarding.step3Subtitle')}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar url={fields.avatarPreview || user.avatarUrl} name={user.name} size="w-16 h-16" textSize="text-xl" />
              <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-violet-500 text-cream-100 flex items-center justify-center cursor-pointer border-2 border-cream-100 dark:border-ink-900">
                <CameraIcon className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    set('avatarFile', file)
                    set('avatarPreview', URL.createObjectURL(file))
                  }}
                />
              </label>
            </div>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60">{t('onboarding.profilePhoto')}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <span className="block w-9 h-9 rounded-full border-2 border-ink-900 dark:border-cream-100/40" style={{ backgroundColor: fields.color }} />
              <input
                type="color"
                value={fields.color}
                onChange={(e) => set('color', e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label={t('perfil.yourColorAria')}
              />
            </div>
            <div className="text-sm">
              <p className="font-medium">{t('perfil.yourColor')}</p>
              <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{t('perfil.colorHint')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-6">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="text-sm font-semibold text-violet-500 hover:underline">
            {t('onboarding.back')}
          </button>
        ) : (
          <button type="button" onClick={skipAll} disabled={saving} className="text-sm font-semibold text-ink-900/50 dark:text-cream-100/50 hover:underline">
            {t('onboarding.skipAll')}
          </button>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={next} disabled={saving} className="text-sm font-semibold text-ink-900/50 dark:text-cream-100/50 hover:underline">
            {t('onboarding.skip')}
          </button>
          <button type="button" onClick={next} disabled={saving} className="btn-primary text-sm">
            {saving ? t('onboarding.saving') : step === STEP_COUNT - 1 ? t('onboarding.finish') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </AuthShell>
  )
}
