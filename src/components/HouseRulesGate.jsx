import { useState } from 'react'
import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'
import HouseRuleCategoryList from './HouseRuleCategoryList'
import { ScrollIcon } from './icons'

/**
 * Pantalla completa que bloquea el resto de la app SOLO para alguien que
 * se acaba de incorporar al piso y nunca aceptó ninguna versión de las
 * Normas (ver isNewToRules/needsToAcceptRules en lib/houseRules.js). Una
 * vez que aceptó una vez, si las normas cambian más adelante ya no vuelve
 * a bloquear — eso es un aviso aparte, no intrusivo (ver el banner en
 * Normas.jsx).
 */
export default function HouseRulesGate({ children }) {
  const { floor, houseRules, isNewToHouseRules, needsHouseRuleAcceptance, acceptHouseRules } = useData()
  const { t } = useLanguage()
  const [accepting, setAccepting] = useState(false)

  if (!(isNewToHouseRules && needsHouseRuleAcceptance)) return children

  async function handleAccept() {
    setAccepting(true)
    try {
      await acceptHouseRules()
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="min-h-screen [min-height:100dvh] bg-cream-50 dark:bg-ink-900 flex flex-col items-center px-4 py-8 landscape-sm:py-4">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-2 mb-6">
        <div className="w-14 h-14 rounded-2xl border-2 border-ink-900 dark:border-cream-100/40 bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200 flex items-center justify-center shrink-0">
          <ScrollIcon className="w-7 h-7" />
        </div>
        <h1 className="font-display text-xl font-bold mt-1 break-words">{t('houseRulesGate.title', { floorName: floor?.name || '' })}</h1>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60">{t('houseRulesGate.body')}</p>
      </div>

      <div className="w-full max-w-md mb-6">
        <HouseRuleCategoryList rules={houseRules} t={t} emptyLabel={t('houseRules.empty')} />
      </div>

      <div className="w-full max-w-md flex flex-col items-center gap-3 pb-4 mt-auto">
        <p className="text-sm text-center text-ink-900/70 dark:text-cream-100/70">{t('houseRulesGate.confirmText')}</p>
        <button type="button" className="btn-primary text-sm w-full" onClick={handleAccept} disabled={accepting}>
          {accepting ? t('houseRulesGate.accepting') : t('houseRulesGate.acceptButton')}
        </button>
      </div>
    </div>
  )
}
