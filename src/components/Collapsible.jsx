/**
 * Contenedor que anima su alto entre 0 y el alto real del contenido —
 * truco de `grid-template-rows` 0fr→1fr: a diferencia de animar
 * `max-height` a mano, no hace falta conocer ni adivinar la altura final
 * del contenido para que la transición se vea suave. Primitiva de bajo
 * nivel: no dibuja cabecera ni flecha (ver ExpandableSection para eso).
 */
export default function Collapsible({ expanded, className = '', children }) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      } ${className}`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}
