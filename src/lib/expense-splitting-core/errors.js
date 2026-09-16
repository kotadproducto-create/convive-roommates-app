/** Error de dominio: datos de entrada inválidos (montos, porcentajes,
 * shares, participantes) — distinto de un bug interno del motor, para
 * que quien llame pueda distinguir "el usuario metió mal los datos" de
 * "esto es un error nuestro". */
export class SplitValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SplitValidationError'
  }
}
