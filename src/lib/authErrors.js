/**
 * Errores de las pantallas de acceso (Login / Registro / Recuperar
 * contraseña), traducibles con el mismo sistema de i18n del resto de la app.
 *
 * AuthContext lanza `Error` con un `code` (y el mensaje en español de
 * siempre, que siguen usando otras pantallas como Perfil). Aquí se elige el
 * texto según el idioma activo: `t('auth.errors.<code>')`. Un error sin código
 * conocido (p. ej. un mensaje crudo de Supabase) se muestra tal cual.
 */
export const AUTH_ERROR_CODES = [
  'emailTaken',
  'invalidCredentials',
  'weakPassword',
  'invalidCode',
  'confirmEmail',
  'invalidInvite',
  'codeSendFailed',
  'unexpected'
]

export function authError(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

export function authErrorMessage(err, t) {
  if (err?.code && AUTH_ERROR_CODES.includes(err.code)) return t(`auth.errors.${err.code}`)
  return err?.message || t('auth.errors.unexpected')
}
