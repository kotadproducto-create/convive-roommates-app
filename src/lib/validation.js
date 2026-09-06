/** Misma regla de contraseña en todos los formularios que la piden. */
export const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d).{8,}$/
export const PASSWORD_RULE_MESSAGE = 'La nueva contraseña debe tener al menos 8 caracteres, una mayúscula y un número.'
