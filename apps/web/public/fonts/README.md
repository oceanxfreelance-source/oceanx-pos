# Fonts

## Faruma (required for Dhivehi)

Dhivehi (`dv`) typography is configured to use **Faruma** and nothing else.
The font file is **not** bundled with this repository.

Place the licensed Faruma font files here:

    apps/web/public/fonts/Faruma.woff2   (preferred)
    apps/web/public/fonts/Faruma.ttf     (fallback)

They are loaded by `@font-face` in `src/index.css`. When Dhivehi is the active
language and Faruma cannot be loaded, the app shows a visible warning instead of
silently substituting another Thaana font.
