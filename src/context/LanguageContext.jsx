import { createContext, useContext, useEffect, useState } from 'react'
import { es as esLocale, enUS as enLocale } from 'date-fns/locale'
import es from '../lib/i18n/es'
import en from '../lib/i18n/en'

const DICTS = { es, en }
const DATE_LOCALES = { es: esLocale, en: enLocale }

const LanguageContext = createContext(null)

/**
 * Idioma de la interfaz: mismo patrón que ThemeContext.jsx (estado +
 * persistencia en localStorage), pero además expone `t()` para leer
 * los diccionarios de src/lib/i18n y `dateLocale` para pasarle a
 * date-fns en vez del `{ locale: es }` fijo que había antes.
 *
 * Solo las pantallas de mayor tráfico usan `t()` por ahora (ver plan
 * de idioma) — el resto de la app sigue en español a mano y seguirá
 * viéndose así aunque se cambie el idioma, hasta que se traduzca.
 */
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('convive_language') || 'es')

  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem('convive_language', language)
  }, [language])

  function t(key, vars) {
    const dict = DICTS[language] || DICTS.es
    let str = key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
    if (str == null) return key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{{${k}}}`, v)
      }
    }
    return str
  }

  const dateLocale = DATE_LOCALES[language] || DATE_LOCALES.es

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dateLocale }}>{children}</LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage debe usarse dentro de <LanguageProvider>')
  return ctx
}
