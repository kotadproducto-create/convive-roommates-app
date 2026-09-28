import { useState } from 'react'
import { ChevronDownIcon } from './icons'
import Collapsible from './Collapsible'

/**
 * Sección/fila que arranca contraída: solo su cabecera (título +
 * descripción corta, o un `header` a medida), sin ninguno de sus
 * elementos internos. Tocar la cabecera la expande/contrae con una
 * animación suave (ver Collapsible) — sin texto tipo "Ver todo": la
 * flecha sola indica que se puede abrir.
 *
 * Pensada para reutilizarse en cualquier sección de la app que hoy
 * muestre una lista larga en la pantalla principal: cada pantalla solo
 * pasa su título/descripción (o una cabecera propia, para filas
 * compactas como en FloorSettings) y el contenido de siempre como
 * children. `as`/`className` dejan reusarla tanto para una tarjeta de
 * página (`section`, estilo `card p-5`) como para una fila suelta dentro
 * de una lista (`li`, sin ese estilo).
 */
export default function ExpandableSection({
  as: Tag = 'section',
  className = 'card p-5',
  header,
  title,
  description,
  defaultExpanded = false,
  chevronSize = 'w-5 h-5',
  bodyClassName = 'pt-4',
  children
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <Tag className={className}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        {header || (
          <div className="min-w-0">
            <h2 className="font-display font-semibold">{title}</h2>
            {description && <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mt-1">{description}</p>}
          </div>
        )}
        <ChevronDownIcon
          className={`${chevronSize} shrink-0 mt-0.5 text-ink-900/50 dark:text-cream-100/50 transition-transform duration-300 motion-reduce:transition-none ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      <Collapsible expanded={expanded}>
        <div className={bodyClassName}>{children}</div>
      </Collapsible>
    </Tag>
  )
}
