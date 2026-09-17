# Convive — guía del proyecto

## Regla de diseño responsive (obligatoria en todo componente/pantalla nuevo)

Ningún elemento (texto, botón, tarjeta, ícono) debe desbordarse, superponerse
o salirse de su contenedor en ningún tamaño de pantalla, empezando por móvil
(~375px de ancho). Cuando el contenido no quepa, debe usarse scroll vertical
— nunca comprimir, recortar con zoom, ni dejar que algo se salga
horizontalmente. `Inicio` (Timeline.jsx) y `Compras` (Shopping.jsx) son la
referencia de cómo debe verse y comportarse cualquier pantalla nueva.

Esto se logra con patrones de CSS concretos, no ajustando tamaños a ojo:

- **Todo `grid` con columnas responsive necesita su base explícita en
  móvil.** `className="grid sm:grid-cols-2 ..."` (sin `grid-cols-1` antes
  del primer breakpoint) deja el grid sin `grid-template-columns` en móvil;
  el navegador arma una sola columna implícita `auto` que puede terminar
  más ancha que el propio contenedor si algún hijo tiene un mínimo de
  contenido grande (ver más abajo) — y como el grid no encoge esa columna
  por debajo de ese mínimo, el contenido se sale de la pantalla. Siempre
  escribir `grid grid-cols-1 sm:grid-cols-2 ...` (o el equivalente con el
  primer breakpoint que se use), fijando la cantidad de columnas en TODOS
  los tamaños, no solo desde el primer breakpoint hacia arriba.
- **Toda fila `flex` que contenga texto truncado (`truncate`) necesita
  `min-w-0`**, tanto en el contenedor flex como en el propio elemento con
  `truncate`. Sin eso, el mínimo por defecto de un hijo flex es el ancho de
  su contenido SIN truncar (`min-width: auto`), así que el texto largo
  empuja a toda la fila — y a sus ancestros (tarjeta, columna de grid) —
  más ancha que el espacio disponible, aunque visualmente parezca que
  "debería" truncarse.
- Los elementos que no deben encogerse (íconos, botones de acción, badges)
  necesitan `shrink-0` explícito; lo demás encoge por defecto.
- Filas de cabecera con varios elementos (`flex items-center
  justify-between`) que puedan no caber en una sola línea en móvil
  necesitan `flex-wrap` + `gap-x-*  gap-y-*` (en vez de solo `gap-*`), para
  que lo que no entra baje de línea en vez de desbordarse.
- Evitar anchos fijos (`min-w-[Nrem]`, `w-[Npx]`) en elementos que
  contienen texto traducible o variable (fechas, nombres) — el texto en
  español suele ser más largo que en inglés y puede no caber.
- **Todo pop-up/modal fijo (`fixed inset-0 z-40 ... flex items-end`, el
  patrón que ya usan `AwayPopup`, `ConfirmPotDialog`, `CreatePollModal`,
  etc.) necesita `max-h-[90vh] overflow-y-auto` en el contenedor del
  contenido.** Sin eso, si el contenido (título + campos + botones) es más
  alto que la pantalla, como al abrir el teclado en móvil o con textos
  largos, la parte de arriba queda empujada por encima del viewport y no
  se puede ver ni cerrar — en vez de eso debe scrollear verticalmente
  dentro del propio pop-up.

### Antes de dar por terminada una pantalla nueva

Probarla en viewport móvil (375px) con contenido real (nombres largos,
textos en español, varios elementos a la vez) y confirmar que
`document.documentElement.scrollWidth` no supera el ancho del viewport —
un desbordamiento horizontal real casi siempre viene de una de las dos
causas de arriba.
