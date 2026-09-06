import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'

/**
 * Campo de contraseña con el mismo estilo que .input, pero con un botón
 * de ojo para mostrar/ocultar lo que se está escribiendo. Acepta las
 * mismas props que un <input> normal (value, onChange, placeholder,
 * required, minLength, etc.) — solo agrega el toggle por encima.
 */
export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`input pr-10 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-ink-900/40 dark:text-cream-100/40 hover:text-ink-900/70 dark:hover:text-cream-100/70"
      >
        {visible ? <EyeOffIcon className="w-[18px] h-[18px]" /> : <EyeIcon className="w-[18px] h-[18px]" />}
      </button>
    </div>
  )
}
