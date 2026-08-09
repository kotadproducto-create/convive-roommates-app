## Convive — tokens & styling conventions

This is a **tokens-only** export: `window.Convive` has no importable React components. Convive's "components" are page-specific screens tightly bound to its own app state (auth, roommate data) and aren't reusable outside that app. What ships here is real, production CSS — Tailwind utility classes plus a small set of hand-written semantic classes — for building new markup in Convive's actual visual language.

### Dark mode
Dark mode is a `.dark` class toggled on a root element (`<html>` or a top-level wrapper), not a media query. Every dark-mode style in this system is a `dark:` Tailwind variant — apply it the same way when styling new markup: `bg-linen-100 dark:bg-charcoal-900`.

### Fonts
`font-display` (Fredoka, headings/brand) and `font-body` (Inter, body text) are loaded from Google Fonts at runtime (`fonts.googleapis.com`), not shipped in this bundle — the host page must include the `<link>` tag or these fall back to system fonts.

### Color families (real values, from `tailwind.config.js`)
| Family | Shades | Use |
|---|---|---|
| `linen` | 50, 100, 200 | light-mode background/surface |
| `charcoal` | 700, 800, 900 | dark-mode background/surface, body text |
| `plum` | 50, 100, 300, 500, 600, 700 | primary brand/accent (buttons, links, focus ring) |
| `mustard` | 100, 400, 500 | secondary accent (badges, highlights) |
| `sage` | 100, 500 | success/positive state |
| `clay` | 100, 500 | danger/destructive state |

Use as standard Tailwind utilities: `bg-plum-500`, `text-charcoal-900`, `border-linen-200`, always paired with a `dark:` counterpart (see `body`'s own rule: `bg-linen-100 text-charcoal-900 dark:bg-charcoal-900 dark:text-linen-100`).

### Semantic classes (defined in `styles.css`, safe to reuse verbatim)
- `.card` — the standard surface/container: white/`charcoal-800` background, `linen-200`/`charcoal-700` border, `rounded-xl2`, subtle shadow.
- `.btn-primary` — filled `plum-500` action button (hover `plum-600`, white text).
- `.btn-secondary` — muted `linen-200`/`charcoal-700` button for secondary actions.
- `.btn-danger` — filled `clay-500` button for destructive actions.
- `.input` — text input: `linen-50`/`charcoal-700` background, `linen-200`/`charcoal-700` border, rounded.
- `rounded-xl2` (1.25rem) is this system's signature large corner radius — prefer it over the default `rounded-xl` for cards and primary surfaces.

### Where the truth lives
Read `styles.css` (imports `_ds_bundle.css`, which carries the full compiled CSS) before styling anything — it's the actual shipped stylesheet, not a summary.

### Idiomatic snippet
```html
<div class="card p-5 dark:bg-charcoal-800">
  <h2 class="font-display font-semibold text-lg text-charcoal-900 dark:text-linen-100">Título</h2>
  <p class="text-sm text-charcoal-900/60 dark:text-linen-100/60 mb-4">Texto secundario.</p>
  <div class="flex gap-2">
    <button class="btn-primary text-sm">Acción principal</button>
    <button class="btn-secondary text-sm">Cancelar</button>
  </div>
</div>
```
