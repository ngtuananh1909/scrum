# Brand assets

Drop your logo files here. All assets are SVG so they scale crisply; you can swap in PNG/JPG at the same names if you prefer.

## Files

| File | Size | Used in |
|------|------|---------|
| `favicon.svg` | 32×32 | Browser tab (`app/layout.tsx` → `icon`) |
| `logo-mark.svg` | 64×64 | Small chips, mobile nav |
| `logo.svg` | 200×48 | Lobby header, in-game top nav |
| `logo-wordmark.svg` | 320×80 | Splash screens, OG / share images |

## Replacing the logo

1. Keep the same filenames (or update the references in the table above).
2. Keep the viewBox aspect ratios so layout doesn't break:
   - mark: `0 0 64 64`
   - logo: `0 0 200 48`
   - wordmark: `0 0 320 80`
3. Recommended exports (when rasterizing):
   - `favicon.ico` 32×32 + 16×16
   - `apple-touch-icon.png` 180×180
   - `og-image.png` 1200×630

## Where the logo is referenced in code

- `src/app/layout.tsx` — favicon (`icon` route)
- `src/app/page.tsx` — lobby header wordmark
- `src/app/game/[roomId]/page.tsx` — top nav logo

If you rename files, search for `/brand/` in the codebase to find all references.
