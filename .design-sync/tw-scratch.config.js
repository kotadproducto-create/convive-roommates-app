// Throwaway config for the design-sync export only — extends the real
// tailwind.config.js's theme but scans the kitchen-sink file too, so the
// compiled CSS carries the full palette instead of just what the app's
// current JSX happens to reference. Never used by the app's own build.
import base from '../tailwind.config.js'

export default {
  ...base,
  content: ['./.design-sync/kitchen-sink.html', './index.html', './src/**/*.{js,jsx}']
}
