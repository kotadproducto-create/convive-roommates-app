import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Expone el servidor a la red local (no solo localhost) para poder
    // abrirlo desde el celular real mientras se ajusta el diseño
    // responsive — ver README/CLAUDE si esto sigue aquí y ya no hace falta.
    host: true
  }
})
