/**
 * Saludo según la hora del día, para la cabecera de Inicio. Mismos
 * tramos horarios que se probaron en la simulación: mañana hasta las
 * 13:00, tarde hasta las 20:00, y noche el resto. Devuelve una clave
 * (no el texto ya armado) para que Timeline la traduzca con `t()`
 * según el idioma elegido — ver src/lib/i18n/{es,en}.js (greeting.*).
 */
export function getTimeGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour >= 6 && hour < 13) return { key: 'morning', icon: 'sun' }
  if (hour >= 13 && hour < 20) return { key: 'afternoon', icon: 'sun' }
  return { key: 'evening', icon: 'moon' }
}
