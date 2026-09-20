/**
 * "Beta" como superíndice junto al nombre de la marca ("Convive" + Beta): avisa
 * de que esta es la primera versión que se comparte. Se usa dentro del mismo
 * <span> del nombre, para que suba y baje con él (logo de acceso, splash y
 * barra lateral). Cuando salga de beta, basta con quitarlo de esos tres sitios.
 */
export default function BetaBadge() {
  return (
    <sup className="ml-1 align-super text-[10px] leading-none font-extrabold uppercase tracking-wider text-violet-500 dark:text-violet-300 select-none">
      Beta
    </sup>
  )
}
