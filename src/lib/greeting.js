/**
 * Saludo según la hora del día, para la cabecera de Inicio. Mismos
 * tramos horarios que se probaron en la simulación: mañana hasta las
 * 13:00, tarde hasta las 20:00, y noche el resto.
 */
export function getTimeGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour >= 6 && hour < 13) return { label: 'Buenos días', icon: 'sun' }
  if (hour >= 13 && hour < 20) return { label: 'Buenas tardes', icon: 'sun' }
  return { label: 'Buenas noches', icon: 'moon' }
}
