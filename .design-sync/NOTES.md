# design-sync notes — Convive Roomie App

## Why this is a tokens-only sync

`roomie-app` is the Convive product app, not a component library — no Storybook,
no `.d.ts`, no `main`/`module`/`exports` in `package.json`. Its "components"
(`Topbar`, `Sidebar`, `TaskCard`, `IncidentCard`, `AppLayout`, `ProtectedRoute`)
are page-specific and several are hard-coupled to this app's own
`AuthContext`/`DataContext`/`ThemeContext` — not reusable outside it. The user
explicitly chose (2026-08-09) to sync only the Tailwind color tokens and the
handful of semantic utility classes (`.card`, `.btn-primary`, `.btn-secondary`,
`.btn-danger`, `.input`), understanding there's no real component catalog
behind them. `window.Convive` in the uploaded bundle is intentionally empty —
this is the documented "Tokens-only DS" outcome (`[ZERO_MATCH] ... treating as
tokens-only DS`), not a build failure.

## How the build is wired (non-standard for this shape)

- **No `dist/` entry exists**, so `--entry .design-sync/empty-entry.js` (a
  trivial `export {};` file) is passed explicitly on every build/resync
  invocation — this bypasses the normal src-synthesis fallback, which would
  otherwise scan every `.jsx` under `src/` (including the two
  `*.old.jsx` localStorage-era reference files) and fail on a duplicate
  `AuthProvider`/`DataProvider` export collision (`AuthContext.jsx` vs
  `AuthContext.localStorage.old.jsx`, `DataContext.jsx` vs
  `DataContext.localStorage.old.jsx`).
- **`cfg.cssEntry` points at `.design-sync/dist.css`**, a stable-named copy —
  NOT the app's real Vite build output, whose CSS filename is content-hashed
  (`dist/assets/index-<hash>.css`) and changes every build.
- **`.design-sync/dist.css` is compiled via a throwaway Tailwind config**
  (`.design-sync/tw-scratch.config.js`, gitignored-free, committed), not the
  app's real `npm run build`. Reason: the app's real compiled CSS is
  JIT-purged to only the classes its current JSX literally references —
  e.g. `bg-plum-500`, `bg-sage-500`, `font-body`, `rounded-xl2` were all
  MISSING from a plain `vite build` output because nothing in the app
  happens to use those exact utility strings directly (only indirectly via
  `@apply` inside `.btn-primary`/`body`/etc., which resolves the property
  but doesn't register the standalone utility class). `.design-sync/kitchen-sink.html`
  lists every color × shade + `font-display`/`font-body`/`rounded-xl2`
  literally, so the scratch config's `content` glob picks them all up.
  **`cfg.buildCmd` runs this scratch compile — it does NOT run `vite build`.**
- The regular `npm run build` (real Vite output, `dist/`) is unrelated to
  this sync and was only used once, early on, to sanity-check what compiled
  Tailwind output looks like before switching to the scratch-config approach.

## Re-sync risks — read before re-running

- **`.design-sync/kitchen-sink.html` must be kept in sync with
  `tailwind.config.js`'s color palette by hand.** If a color family or shade
  is added/removed in `tailwind.config.js`, the kitchen-sink file needs the
  matching `bg-*`/`text-*`/`border-*` classes added/removed, or the next
  sync's CSS will silently miss (or keep stale) shades — there's no
  automatic link between the two files.
- **Fonts (Fredoka, Inter) are NOT shipped in the bundle.** They're loaded at
  runtime from `fonts.googleapis.com` via a `<link>` in the app's
  `index.html`, which isn't part of what's uploaded. Declared via
  `cfg.runtimeFontPrefixes` to suppress `[FONT_MISSING]`, but this means any
  design built from this DS will render in a fallback font unless the design
  agent (or claude.ai/design itself) separately loads that Google Fonts URL.
  If that turns out to matter, the real fix is sourcing local woff2 files for
  Fredoka/Inter and wiring `cfg.extraFonts` instead.
- **Zero components is permanent for this repo as currently structured** —
  not something a re-sync will "fix" on its own. It would take either (a)
  extracting genuinely reusable, decoupled presentational components into
  their own package with real prop contracts, or (b) accepting this
  tokens-only shape long-term.
- Render check is always run with `--no-render-check` — there is nothing to
  render-check with 0 components. Don't chase a `[RENDER_SKIPPED]` warning
  here; it's expected.

## Re-sync command

```sh
cp -r <skill-base-dir>/package-build.mjs <skill-base-dir>/package-validate.mjs \
  <skill-base-dir>/package-capture.mjs <skill-base-dir>/resync.mjs \
  <skill-base-dir>/lib <skill-base-dir>/storybook .ds-sync/
echo '{"name":"ds-sync-deps","private":true}' > .ds-sync/package.json
(cd .ds-sync && npm i esbuild ts-morph @types/react)

npx tailwindcss -c .design-sync/tw-scratch.config.js -i src/index.css -o .design-sync/dist.css --minify

# fetch project's _ds_sync.json to .design-sync/.cache/remote-sync.json first (DesignSync get_file), then:
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --out ./ds-bundle --entry .design-sync/empty-entry.js --no-render-check \
  --remote .design-sync/.cache/remote-sync.json
```
