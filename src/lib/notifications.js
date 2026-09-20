/**
 * Pantalla a la que lleva tocar una notificación, según su `type`
 * (ver los create/notifyUser de DataContext.jsx). Devuelve null si el tipo
 * no tiene una pantalla propia (la notificación solo se marca como leída).
 */
const ROUTE_BY_TYPE = {
  // Actividades y sus avisos
  turno: '/actividades',
  // Espacios compartidos ("Voy a usarla") viven en Actividades; 'lavadora'
  // es el tipo antiguo del mismo aviso.
  shared_space: '/actividades',
  lavadora: '/actividades',
  // Dinero y compras
  pote: '/pote',
  stock_out: '/compras',
  // Personas del piso
  swap: '/convives',
  marked_away: '/convives',
  member_joined: '/convives',
  member_left: '/convives',
  // Salida del piso: la confirma la propia persona en su Perfil
  removal_requested: '/perfil',
  removal_cancelled: '/perfil',
  removal_rejected: '/piso',
  // Ausencias (solicitudes con aprobación de un admin) se gestionan en Tu piso
  absence_requested: '/piso',
  absence_decided: '/piso',
  // Consultas
  poll_created: '/votaciones',
  poll_resolved: '/votaciones',
  // Resultado de una consulta de un apartado concreto
  poll_resolved_pote: '/pote',
  poll_resolved_rotation: '/piso'
}

export function notificationRoute(type) {
  return ROUTE_BY_TYPE[type] || null
}
