import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Esto avisa claramente en consola si alguien olvidó configurar el .env,
  // en vez de fallar con un error críptico más abajo.
  console.error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env (copia .env.example).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
