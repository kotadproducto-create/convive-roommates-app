import { describe, it, expect } from 'vitest'
import { potOnBehalfMessage, potDisputeMessage } from '../pot'
import es from '../i18n/es'
import en from '../i18n/en'

const get = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
const vars = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',')

describe('potOnBehalfMessage — aviso de "X registró un aporte/gasto a tu nombre"', () => {
  it('aporte, sin concepto', () => {
    const msg = potOnBehalfMessage({ actorName: 'Ana', kind: 'contribution', amount: 20, dateISO: '2026-09-27T10:00:00.000Z' })
    expect(msg).toContain('Ana ha registrado un aporte de 20,00 € a tu nombre en el Pote')
    expect(msg).not.toContain('Concepto')
  })

  it('gasto, con concepto', () => {
    const msg = potOnBehalfMessage({ actorName: 'Ana', kind: 'expense', amount: 15, dateISO: '2026-09-27T10:00:00.000Z', note: 'Detergente' })
    expect(msg).toContain('Ana ha registrado un gasto de 15,00 € a tu nombre en el Pote')
    expect(msg).toContain('Concepto: Detergente')
  })

  it('el importe siempre se muestra en valor absoluto (los gastos se guardan negativos)', () => {
    const msg = potOnBehalfMessage({ actorName: 'Ana', kind: 'expense', amount: -15, dateISO: '2026-09-27T10:00:00.000Z' })
    expect(msg).toContain('15,00 €')
    expect(msg).not.toContain('-15,00')
  })

  it('incluye la fecha', () => {
    const msg = potOnBehalfMessage({ actorName: 'Ana', kind: 'contribution', amount: 5, dateISO: '2026-01-15T10:00:00.000Z' })
    expect(msg).toMatch(/\(\d{1,2}\/\d{1,2}\/\d{4}\)/)
  })
})

describe('potDisputeMessage — aviso a quien registró el movimiento', () => {
  it('incluye quién reporta y el motivo', () => {
    const msg = potDisputeMessage({ actorName: 'Beto', reason: 'El importe no es correcto' })
    expect(msg).toContain('Beto reportó una incidencia')
    expect(msg).toContain('El importe no es correcto')
  })
})

describe('i18n de "Reportar incidencia" (Pote)', () => {
  const keys = [
    'reportDisputeButton',
    'disputeReportedNote',
    'disputeDialogTitle',
    'disputeDialogSubjectContribution',
    'disputeDialogSubjectExpense',
    'disputeReasonPlaceholder',
    'disputeSubmit',
    'disputeSubmitting',
    'disputeSuccessToast',
    'disputeErrorToast'
  ]

  it('todas las claves existen en español e inglés', () => {
    for (const key of keys) {
      expect(typeof get(es, `wallet.${key}`)).toBe('string')
      expect(typeof get(en, `wallet.${key}`)).toBe('string')
    }
  })

  it('las claves con variables usan las mismas en ambos idiomas', () => {
    for (const key of ['disputeDialogSubjectContribution', 'disputeDialogSubjectExpense', 'disputeErrorToast']) {
      expect(vars(get(es, `wallet.${key}`))).toBe(vars(get(en, `wallet.${key}`)))
    }
  })
})
