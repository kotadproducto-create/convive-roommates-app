import { useMemo, useState } from 'react'
import {
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns'
import { es } from 'date-fns/locale'
import { potAmountColorClass } from '../lib/pot'

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * Calendario gráfico de movimientos del pote: un punto verde el día que
 * entró dinero, uno rojo el día que se gastó, ambos si hubo los dos, y
 * nada si ese día no se tocó el pote. Al seleccionar un día se muestra el
 * saldo del pote a esa fecha (acumulado de todos los movimientos hasta
 * el final de ese día) y el detalle de lo que se movió ese día.
 */
export default function PotCalendar({ contributions, memberById = {} }) {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(null)

  const byDay = useMemo(() => {
    const map = new Map()
    for (const c of contributions) {
      const key = format(new Date(c.createdAt), 'yyyy-MM-dd')
      const entry = map.get(key) || { aporte: false, gasto: false, items: [] }
      if (Number(c.amount) > 0) entry.aporte = true
      else entry.gasto = true
      entry.items.push(c)
      map.set(key, entry)
    }
    return map
  }, [contributions])

  const sortedByDate = useMemo(
    () => contributions.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [contributions]
  )

  function balanceAsOf(date) {
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    return sortedByDate
      .filter((c) => new Date(c.createdAt) <= end)
      .reduce((sum, c) => sum + Number(c.amount), 0)
  }

  const selectedKey = selected ? format(selected, 'yyyy-MM-dd') : null
  const selectedEntry = selectedKey ? byDay.get(selectedKey) : null
  const selectedItems = selectedEntry
    ? selectedEntry.items.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    : []

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
  })

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => { setCursor((d) => addMonths(d, -1)); setSelected(null) }}
            aria-label="Mes anterior"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700 active:scale-90 transition-transform"
          >
            ‹
          </button>
          <p className="font-display font-bold capitalize min-w-[9rem] text-center">{format(cursor, "MMMM 'de' yyyy", { locale: es })}</p>
          <button
            type="button"
            onClick={() => { setCursor((d) => addMonths(d, 1)); setSelected(null) }}
            aria-label="Mes siguiente"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700 active:scale-90 transition-transform"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-ink-900/60 dark:text-cream-100/60">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sage-500 inline-block" />Aporte</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-clay-500 inline-block" />Gasto</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-ink-900/30 dark:border-cream-100/30 inline-block" />Sin movimiento</span>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((d) => (
          <p key={d} className="text-[10px] font-bold uppercase text-center text-ink-900/40 dark:text-cream-100/40">
            {d}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const key = format(date, 'yyyy-MM-dd')
          const entry = byDay.get(key)
          const inMonth = isSameMonth(date, cursor)
          const label = entry
            ? entry.aporte && entry.gasto
              ? 'Aporte y gasto'
              : entry.aporte
                ? 'Aporte'
                : 'Gasto'
            : 'Sin movimiento'
          const isSelected = selectedKey === key
          return (
            <button
              type="button"
              key={key}
              title={label}
              onClick={() => setSelected((d) => (d && isSameDay(d, date) ? null : date))}
              className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                isSelected
                  ? 'bg-violet-500 text-cream-100'
                  : isToday(date)
                    ? 'ring-2 ring-violet-500'
                    : 'hover:bg-cream-200 dark:hover:bg-ink-700'
              } ${!inMonth ? 'opacity-30' : ''}`}
            >
              <span className="text-[10px] font-semibold">{format(date, 'd')}</span>
              <div className="flex items-center gap-0.5">
                {entry?.aporte && <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cream-100' : 'bg-sage-500'}`} />}
                {entry?.gasto && <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cream-100' : 'bg-clay-500'}`} />}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-4 pt-4 border-t border-ink-900/10 dark:border-cream-100/15">
          <div className="flex items-center justify-between mb-2">
            <p className="font-display font-semibold capitalize">{format(selected, "EEEE d 'de' MMMM", { locale: es })}</p>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50">Saldo ese día</p>
              <p className={`font-display font-bold ${potAmountColorClass(balanceAsOf(selected))}`}>
                {balanceAsOf(selected).toFixed(2)}€
              </p>
            </div>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-ink-900/50 dark:text-cream-100/50">Sin movimientos este día.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {selectedItems.map((c) => {
                const isExpense = Number(c.amount) < 0
                return (
                  <li key={c.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg bg-cream-100 dark:bg-ink-700">
                    <span className="truncate">
                      <strong>{memberById[c.userId]?.name || 'Alguien'}</strong> {isExpense ? 'gastó' : 'aportó'}
                      {c.note && <span className="text-ink-900/50 dark:text-cream-100/50"> · {c.note}</span>}
                    </span>
                    <span className={`font-semibold shrink-0 ml-2 ${isExpense ? 'text-clay-500' : 'text-sage-500'}`}>
                      {isExpense ? '-' : '+'}{Math.abs(Number(c.amount)).toFixed(2)}€
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
