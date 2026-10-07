# Fonts

## Faruma (Dhivehi)

Dhivehi (`dv`) typography uses **Faruma** and nothing else. The files here were supplied by the
business owner:

    Faruma.ttf     original file (Faruma, Version 2.0 Official release)
    Faruma.woff2   the same font repackaged as WOFF2 (smaller download); glyphs are unchanged

They are loaded by `@font-face` in `src/index.css` for Thaana characters only. If Faruma ever fails to
load, the app shows a visible warning instead of substituting another Thaana font.
