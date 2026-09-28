import { useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import HouseRuleCategoryList from '../components/HouseRuleCategoryList'
import HouseRuleDetailDialog from '../components/HouseRuleDetailDialog'
import HouseRuleProposalModal from '../components/HouseRuleProposalModal'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'

/**
 * Normas del piso: los acuerdos de convivencia vigentes, agrupados por
 * categoría. Proponer una norma (nueva, modificarla o eliminarla) crea
 * una consulta en Votaciones (kind:'house_rule', ver proposeHouseRule en
 * DataContext.jsx) — no cambia nada hasta que el piso la aprueba.
 */
export default function Normas() {
  const { houseRules, houseRuleHistory, proposeHouseRule, needsHouseRuleAcceptance, isNewToHouseRules, acceptHouseRules } = useData()
  const { showToast } = useToast()
  const { t, dateLocale } = useLanguage()
  const [selectedRule, setSelectedRule] = useState(null)
  // { mode: 'create'|'edit'|'delete', rule?: objeto de la norma (edit/delete) }
  const [proposal, setProposal] = useState(null)

  const selectedRuleHistory = useMemo(
    () =>
      selectedRule
        ? houseRuleHistory.filter((h) => h.ruleId === selectedRule.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [],
    [houseRuleHistory, selectedRule]
  )

  async function handleAcceptUpdate() {
    try {
      await acceptHouseRules()
      showToast(t('houseRules.acceptedToast'), 'success')
    } catch (err) {
      showToast(t('houseRules.acceptErrorToast'), 'default')
    }
  }

  async function handleProposalSubmit(payload) {
    try {
      await proposeHouseRule(payload)
      showToast(t('houseRules.proposedToast'), 'success')
      setProposal(null)
    } catch (err) {
      showToast(t('houseRules.proposeErrorToast'), 'default')
    }
  }

  function openProposal(next) {
    setSelectedRule(null)
    setProposal(next)
  }

  return (
    <AppLayout title={t('houseRules.pageTitle')}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-5">
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 min-w-0">{t('houseRules.subtitle')}</p>
        <button className="btn-primary text-sm shrink-0" onClick={() => setProposal({ mode: 'create' })}>
          {t('houseRules.proposeNewButton')}
        </button>
      </div>

      {/* No bloquea nada (a diferencia de HouseRulesGate): quien ya
          conocía las normas solo recibe este aviso discreto cuando
          cambiaron, con la opción de revisar y volver a confirmar. */}
      {needsHouseRuleAcceptance && !isNewToHouseRules && (
        <div className="rounded-xl bg-gold-100 dark:bg-gold-400/15 border-2 border-gold-500/40 px-4 py-3 mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-sm font-semibold text-ink-900 dark:text-cream-100 min-w-0">{t('houseRules.changedBanner')}</p>
          <button type="button" className="btn-secondary text-sm shrink-0" onClick={handleAcceptUpdate}>
            {t('houseRules.acceptUpdateButton')}
          </button>
        </div>
      )}

      <HouseRuleCategoryList rules={houseRules} t={t} onSelectRule={setSelectedRule} emptyLabel={t('houseRules.empty')} />

      {selectedRule && (
        <HouseRuleDetailDialog
          rule={selectedRule}
          history={selectedRuleHistory}
          onClose={() => setSelectedRule(null)}
          onProposeEdit={() => openProposal({ mode: 'edit', rule: selectedRule })}
          onProposeDelete={() => openProposal({ mode: 'delete', rule: selectedRule })}
          t={t}
          dateLocale={dateLocale}
        />
      )}

      {proposal && (
        <HouseRuleProposalModal mode={proposal.mode} rule={proposal.rule} onClose={() => setProposal(null)} onSubmit={handleProposalSubmit} t={t} />
      )}
    </AppLayout>
  )
}
